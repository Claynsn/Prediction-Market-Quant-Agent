"""Market data source abstraction.

This is swap point #1: the backtest engine only depends on this interface.
To go live on real Polymarket, implement `PolymarketDataSource(MarketDataSource)`
that returns the same `Market` / `PricePoint` shapes, and the engine, strategies
and API stay untouched.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List


@dataclass
class PricePoint:
    """A single observation of a market's YES price (= implied probability)."""

    timestamp: str  # ISO-8601 string, chronological
    price: float    # YES price in [0, 1]; also the implied probability of YES


@dataclass
class Market:
    """A binary prediction market with a YES price time series and a resolution.

    `resolution` is the payoff per YES share at settlement: 1.0 if YES won,
    0.0 if NO won. NO shares pay (1 - resolution). For the MVP we only trade YES.
    """

    market_id: str
    question: str
    prices: List[PricePoint] = field(default_factory=list)
    resolution: float = 0.0  # 1.0 => YES settled true, 0.0 => NO
    resolved: bool = True
    category: str = "general"

    @property
    def settlement_timestamp(self) -> str:
        return self.prices[-1].timestamp if self.prices else ""


class MarketDataSource(ABC):
    """Abstract source of historical/closed markets for backtesting."""

    @abstractmethod
    def get_markets(self) -> List[Market]:
        """Return the universe of markets to backtest over."""
        raise NotImplementedError
