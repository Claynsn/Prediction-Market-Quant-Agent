"""Threshold strategy: buy YES once its price crosses >= threshold, hold to settlement.

A strategy is a pure function from (market price history up to now, config) to an
optional signal. The engine calls it as it walks the timeline. Adding new strategy
types later means adding sibling modules with the same `signal()` shape.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from ..data.base import PricePoint
from ..models import StrategyConfig


@dataclass
class Signal:
    action: str  # "BUY"
    price: float


def signal(history: List[PricePoint], config: StrategyConfig) -> Optional[Signal]:
    """Return a BUY signal if the latest observed YES price meets the threshold.

    The engine only calls this for markets with no open position, so a single
    crossing produces a single entry that is then held to settlement.
    """
    if not history:
        return None
    latest = history[-1]
    if config.side == "YES" and latest.price >= config.threshold:
        return Signal(action="BUY", price=latest.price)
    return None
