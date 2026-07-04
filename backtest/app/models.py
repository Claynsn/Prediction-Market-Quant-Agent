"""Pydantic contracts shared across the API, engine and frontend.

Keep these in sync with web/lib/types.ts.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class StrategyConfig(BaseModel):
    """A concrete, backtestable strategy. The NLP parser turns a fuzzy idea into
    one of these; the engine consumes it. Shape is stable across swap points."""

    name: str = "Threshold YES Buy"
    description: str = ""
    strategy_type: str = "threshold"          # extension point: more types later
    side: str = "YES"                         # MVP only trades YES
    threshold: float = 0.70                   # buy when YES price >= threshold
    starting_capital: float = 1000.0          # USDC
    bet_fraction: float = 0.05                # per-trade size as fraction of equity
    max_market_fraction: float = 0.10         # max exposure to a single market
    fee: float = 0.0                          # taker fee as fraction of notional
    slippage: float = 0.01                    # fraction added to fill price
    hold_to_settlement: bool = True


class IdeaRequest(BaseModel):
    idea: str = Field(..., description="Fuzzy natural-language strategy idea")


class GenerateResponse(BaseModel):
    strategy: StrategyConfig
    # Parameters the parser could not infer and assumed a default for. Surfaced so
    # the UI / a future Claude-driven flow can ask the user to confirm them.
    assumptions: List[str] = []
    missing: List[str] = []


class BacktestRequest(BaseModel):
    strategy: StrategyConfig


class Trade(BaseModel):
    market_id: str
    question: str
    entry_timestamp: str
    entry_price: float
    shares: float
    cost: float
    payoff: float
    pnl: float
    won: bool


class EquityPoint(BaseModel):
    timestamp: str
    equity: float


class DrawdownPoint(BaseModel):
    timestamp: str
    drawdown: float  # negative or zero, as a fraction (e.g. -0.12 = -12%)


class BacktestResult(BaseModel):
    total_return: float          # fraction, e.g. 0.23 = +23%
    final_equity: float
    max_drawdown: float          # fraction, negative
    win_rate: float              # fraction in [0,1]
    num_trades: int
    num_samples: int             # number of markets considered
    failure_reason: Optional[str] = None
    equity_curve: List[EquityPoint] = []
    drawdown_curve: List[DrawdownPoint] = []
    trades: List[Trade] = []
