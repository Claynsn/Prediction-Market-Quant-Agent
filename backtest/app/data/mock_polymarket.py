"""Deterministic mock Polymarket data source.

Generates a small universe of resolved binary markets with plausible YES-price
random walks that drift toward their final resolution. Deterministic via a fixed
seed so backtests are reproducible.

Swap point #1: replace this with `PolymarketDataSource` hitting the real API.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import List

from .base import Market, MarketDataSource, PricePoint


# (question, category, resolution: 1.0 = YES won, 0.0 = NO won, starting YES price)
_MARKET_SPECS = [
    ("Will BTC close above $80k this month?", "crypto", 1.0, 0.55),
    ("Will the Fed cut rates at the next meeting?", "macro", 0.0, 0.48),
    ("Will Team A win the championship?", "sports", 1.0, 0.62),
    ("Will candidate X win the election?", "politics", 0.0, 0.45),
    ("Will the new product launch on time?", "tech", 1.0, 0.71),
    ("Will ETH flip BTC in market cap this year?", "crypto", 0.0, 0.18),
    ("Will GDP growth beat 3% this quarter?", "macro", 1.0, 0.58),
    ("Will the movie gross over $200M opening?", "entertainment", 0.0, 0.52),
    ("Will the bill pass the senate?", "politics", 1.0, 0.66),
    ("Will the startup close its funding round?", "tech", 1.0, 0.60),
    ("Will there be a rate hike surprise?", "macro", 0.0, 0.30),
    ("Will the underdog reach the finals?", "sports", 0.0, 0.40),
    # "Head-fake" markets: priced high (cross the buy threshold) but resolve NO.
    # These create realistic losing trades and drawdown for the threshold strategy.
    ("Will the merger be approved by regulators?", "macro", 0.0, 0.74),
    ("Will the incumbent hold the seat?", "politics", 0.0, 0.78),
    ("Will the favorite win game 7?", "sports", 0.0, 0.72),
]


class MockPolymarketDataSource(MarketDataSource):
    """Generates reproducible synthetic markets for backtesting."""

    def __init__(self, num_days: int = 30, seed: int = 42) -> None:
        self.num_days = num_days
        self.seed = seed

    def get_markets(self) -> List[Market]:
        rng = random.Random(self.seed)
        start = datetime(2024, 1, 1)
        markets: List[Market] = []

        for idx, (question, category, resolution, start_price) in enumerate(_MARKET_SPECS):
            prices: List[PricePoint] = []
            price = start_price
            for day in range(self.num_days):
                # Drift gently toward the eventual resolution + noise; clamp to (0,1).
                pull = (resolution - price) * 0.06
                noise = rng.uniform(-0.04, 0.04)
                price = max(0.02, min(0.98, price + pull + noise))
                ts = (start + timedelta(days=day)).isoformat()
                prices.append(PricePoint(timestamp=ts, price=round(price, 4)))

            markets.append(
                Market(
                    market_id=f"mock-{idx:03d}",
                    question=question,
                    prices=prices,
                    resolution=resolution,
                    resolved=True,
                    category=category,
                )
            )
        return markets
