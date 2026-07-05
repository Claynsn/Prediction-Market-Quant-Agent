"""Rule-based "fuzzy idea -> concrete strategy" parser.

Swap point #2: replace `parse_idea` with a Claude call that returns the same
`(StrategyConfig, assumptions, missing)` shape. The contract here — including the
`missing` list for parameters that could not be inferred — is designed so a future
AI flow can ask follow-up questions to fill the gaps without changing callers.
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple

from ..models import StrategyConfig

# Defaults match the documented MVP strategy.
_DEFAULTS = StrategyConfig()


def _normalize(raw: str) -> float:
    val = float(raw)
    return val / 100.0 if val > 1 else val


def _find_percentage(text: str, keywords: List[str]) -> Optional[float]:
    """Find a percentage tied to any of the given keywords.

    Forward form "keyword <num>%" is always preferred over the reverse form
    "<num>% keyword"; the reverse pass only runs if no forward match exists. This
    stops a percentage from another clause (e.g. the threshold's "70%") that merely
    happens to sit before a keyword from being mistaken for that keyword's value.
    """
    for kw in keywords:  # forward pass
        m = re.search(rf"{kw}[^\d]{{0,4}}(\d{{1,3}}(?:\.\d+)?)\s*%?", text, flags=re.IGNORECASE)
        if m:
            return _normalize(m.group(1))
    for kw in keywords:  # reverse pass (tight window)
        m = re.search(rf"(\d{{1,3}}(?:\.\d+)?)\s*%[^\d]{{0,3}}{kw}", text, flags=re.IGNORECASE)
        if m:
            return _normalize(m.group(1))
    return None


def _find_first_percentage(text: str) -> Optional[float]:
    m = re.search(r"(\d{1,3}(?:\.\d+)?)\s*%", text)
    if m:
        return float(m.group(1)) / 100.0
    return None


def _find_capital(text: str) -> Optional[float]:
    m = re.search(r"(\d{3,7})\s*(?:usdc|usd|刀|美元|u\b|块)", text, flags=re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


def parse_idea(idea: str) -> Tuple[StrategyConfig, List[str], List[str]]:
    text = idea.strip()
    assumptions: List[str] = []
    missing: List[str] = []

    # Threshold: look for an explicit "buy above X%" intent, else any percentage.
    threshold = _find_percentage(text, ["阈值", "概率", "threshold", "probability", "以上", "大于", "超过", "above", "over", ">="])
    if threshold is None:
        threshold = _find_first_percentage(text)
    if threshold is None:
        threshold = _DEFAULTS.threshold
        assumptions.append(f"未指定买入阈值，默认 {threshold:.0%}")
        missing.append("threshold")
    threshold = max(0.5, min(0.98, threshold))

    # Side: default YES; honor an explicit NO mention (MVP still trades YES only,
    # so flag it as a known limitation rather than silently ignoring).
    side = "YES"
    if re.search(r"\bno\b|做空|看跌|押 ?no", text, flags=re.IGNORECASE):
        assumptions.append("检测到 NO/看跌意图，但当前 MVP 仅支持买入 YES，已按 YES 处理")

    # Capital
    capital = _find_capital(text)
    if capital is None:
        capital = _DEFAULTS.starting_capital
        assumptions.append(f"未指定起始资金，默认 {capital:.0f} USDC")
        missing.append("starting_capital")

    # Per-trade size
    bet = _find_percentage(text, ["单笔", "每笔", "仓位", "position", "per trade", "bet"])
    if bet is None:
        bet = _DEFAULTS.bet_fraction
        assumptions.append(f"未指定单笔仓位，默认 {bet:.0%}")
        missing.append("bet_fraction")
    bet = max(0.005, min(0.5, bet))

    name = "阈值买入 YES" if threshold else "Threshold YES Buy"
    description = (
        f"当某个市场 YES 概率 ≥ {threshold:.0%} 时买入，持有到结算。"
        f" 起始资金 {capital:.0f} USDC，单笔 {bet:.0%}，单市场上限 "
        f"{_DEFAULTS.max_market_fraction:.0%}，滑点 {_DEFAULTS.slippage:.0%}。"
    )

    config = StrategyConfig(
        name=name,
        description=description,
        strategy_type="threshold",
        side=side,
        threshold=round(threshold, 4),
        starting_capital=capital,
        bet_fraction=round(bet, 4),
        max_market_fraction=_DEFAULTS.max_market_fraction,
        fee=_DEFAULTS.fee,
        slippage=_DEFAULTS.slippage,
        hold_to_settlement=True,
    )
    return config, assumptions, missing
