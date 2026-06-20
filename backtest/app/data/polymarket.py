"""Real Polymarket data source (swap point #1).

Pulls resolved binary markets from Polymarket's public APIs and shapes them into
the same `Market` / `PricePoint` objects the mock source produces, so the engine,
strategies and API need no changes.

  - Gamma API  (https://gamma-api.polymarket.com/markets): market metadata,
    outcomes, final resolution prices, and the CLOB token ids.
  - CLOB API   (https://clob.polymarket.com/prices-history): the YES token's
    historical price (= implied probability) time series.

Network note: many hosted/sandbox environments block outbound traffic by default.
If Polymarket is unreachable (egress not allowlisted) or returns nothing usable,
this source falls back to the injected `fallback` source so the app keeps working.
Uses only the stdlib (urllib + json) — no extra dependency.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, List, Optional

from .base import Market, MarketDataSource, PricePoint

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"


class PolymarketError(RuntimeError):
    pass


def _http_get_json(url: str, timeout: float) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "clay-quant-os/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as exc:
        raise PolymarketError(f"GET {url} failed: {exc}") from exc


def _maybe_json_list(value: Any) -> List[Any]:
    """Gamma encodes some array fields as JSON strings; accept both shapes."""
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except ValueError:
            return []
    return []


def _iso_from_unix(ts: int) -> str:
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()


class PolymarketDataSource(MarketDataSource):
    """Fetches resolved binary markets + YES price history from Polymarket.

    Args:
        limit: max number of markets to pull.
        fidelity: price-history resolution in minutes (coarse keeps payloads small).
        timeout: per-request timeout in seconds.
        min_points: skip markets with fewer than this many price points.
        fallback: source used when Polymarket is unreachable or yields nothing.
        cache_ttl: seconds to cache the assembled universe in-memory.
    """

    def __init__(
        self,
        limit: int = 20,
        fidelity: int = 720,
        timeout: float = 10.0,
        min_points: int = 5,
        fallback: Optional[MarketDataSource] = None,
        cache_ttl: float = 300.0,
    ) -> None:
        self.limit = limit
        self.fidelity = fidelity
        self.timeout = timeout
        self.min_points = min_points
        self.fallback = fallback
        self.cache_ttl = cache_ttl
        self._cache: Optional[List[Market]] = None
        self._cache_at: float = 0.0
        # Effective mode after the last get_markets() call, surfaced via /health.
        self.last_mode: str = "uninitialized"

    def get_markets(self) -> List[Market]:
        now = time.time()
        if self._cache is not None and (now - self._cache_at) < self.cache_ttl:
            return self._cache

        try:
            markets = self._fetch_live_markets()
        except PolymarketError:
            markets = []

        if not markets:
            if self.fallback is not None:
                self.last_mode = "fallback"
                fb = self.fallback.get_markets()
                self._cache, self._cache_at = fb, now
                return fb
            self.last_mode = "error"
            raise PolymarketError(
                "Polymarket unreachable and no fallback configured. Allowlist "
                "gamma-api.polymarket.com and clob.polymarket.com in egress settings."
            )

        self.last_mode = "live"
        self._cache, self._cache_at = markets, now
        return markets

    # --- internals -------------------------------------------------------

    def _fetch_live_markets(self) -> List[Market]:
        query = urllib.parse.urlencode(
            {
                "closed": "true",
                "limit": str(self.limit),
                "order": "volumeNum",
                "ascending": "false",
            }
        )
        raw = _http_get_json(f"{GAMMA_BASE}/markets?{query}", self.timeout)
        if not isinstance(raw, list):
            raise PolymarketError("Unexpected Gamma response (expected a list)")

        markets: List[Market] = []
        for entry in raw:
            market = self._build_market(entry)
            if market is not None:
                markets.append(market)
        return markets

    def _build_market(self, entry: dict) -> Optional[Market]:
        outcomes = [str(o).strip().lower() for o in _maybe_json_list(entry.get("outcomes"))]
        token_ids = _maybe_json_list(entry.get("clobTokenIds"))
        prices_final = _maybe_json_list(entry.get("outcomePrices"))

        # Only handle binary YES/NO markets with a YES token id and a resolution.
        if len(outcomes) != 2 or "yes" not in outcomes or not token_ids:
            return None
        yes_idx = outcomes.index("yes")
        if yes_idx >= len(token_ids):
            return None
        yes_token = str(token_ids[yes_idx])

        resolution = _resolve_yes_payoff(prices_final, yes_idx)
        if resolution is None:
            return None

        try:
            history = self._fetch_price_history(yes_token)
        except PolymarketError:
            return None
        if len(history) < self.min_points:
            return None

        return Market(
            market_id=str(entry.get("conditionId") or entry.get("id") or yes_token),
            question=str(entry.get("question") or "Polymarket market"),
            prices=history,
            resolution=resolution,
            resolved=True,
            category=str(entry.get("category") or "polymarket"),
        )

    def _fetch_price_history(self, token_id: str) -> List[PricePoint]:
        query = urllib.parse.urlencode(
            {"market": token_id, "interval": "max", "fidelity": str(self.fidelity)}
        )
        data = _http_get_json(f"{CLOB_BASE}/prices-history?{query}", self.timeout)
        history = data.get("history") if isinstance(data, dict) else None
        if not isinstance(history, list):
            return []
        points: List[PricePoint] = []
        for pt in history:
            try:
                ts = _iso_from_unix(pt["t"])
                price = float(pt["p"])
            except (KeyError, TypeError, ValueError):
                continue
            points.append(PricePoint(timestamp=ts, price=round(price, 4)))
        return points


def _resolve_yes_payoff(prices_final: List[Any], yes_idx: int) -> Optional[float]:
    """Map a resolved market's final outcome prices to the YES payoff (1.0 / 0.0)."""
    if yes_idx >= len(prices_final):
        return None
    try:
        yes_price = float(prices_final[yes_idx])
    except (TypeError, ValueError):
        return None
    return 1.0 if yes_price >= 0.5 else 0.0
