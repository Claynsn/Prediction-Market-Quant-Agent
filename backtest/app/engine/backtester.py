"""Event-driven backtester.

Walks a merged chronological timeline across all markets. For each market with no
open position it asks the strategy for a signal; on BUY it sizes and opens a
position subject to risk limits; at each market's settlement timestamp it closes
the position at the resolution payoff. Equity is marked-to-market at every step so
we can report an equity curve, drawdown, return, win rate and sample count.

The engine depends only on `MarketDataSource` and the strategy `signal()` shape,
so swapping mock data for real Polymarket data (swap point #1) requires no changes
here.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from ..data.base import MarketDataSource, Market, PricePoint
from ..models import (
    BacktestResult,
    DrawdownPoint,
    EquityPoint,
    StrategyConfig,
    Trade,
)
from ..strategies import threshold


@dataclass
class _Position:
    market: Market
    entry_timestamp: str
    entry_price: float
    fill_price: float
    shares: float
    cost: float  # cash paid including fees


def run_backtest(source: MarketDataSource, config: StrategyConfig) -> BacktestResult:
    markets = source.get_markets()
    num_samples = len(markets)

    # Precompute per-market price lookups and the merged timeline.
    price_at: Dict[str, Dict[str, float]] = {
        m.market_id: {p.timestamp: p.price for p in m.prices} for m in markets
    }
    history: Dict[str, List[PricePoint]] = {m.market_id: [] for m in markets}
    last_price: Dict[str, float] = {}
    settlement_ts: Dict[str, str] = {m.market_id: m.settlement_timestamp for m in markets}
    market_by_id: Dict[str, Market] = {m.market_id: m for m in markets}

    timeline = sorted({p.timestamp for m in markets for p in m.prices})

    cash = config.starting_capital
    positions: Dict[str, _Position] = {}
    settled: set[str] = set()
    trades: List[Trade] = []
    equity_curve: List[EquityPoint] = []
    drawdown_curve: List[DrawdownPoint] = []
    peak = config.starting_capital
    max_drawdown = 0.0

    for ts in timeline:
        # 1) Advance per-market history and last-known price.
        for m in markets:
            price = price_at[m.market_id].get(ts)
            if price is not None:
                history[m.market_id].append(PricePoint(timestamp=ts, price=price))
                last_price[m.market_id] = price

        # 2) Settle markets resolving at this timestamp.
        for mid, pos in list(positions.items()):
            if settlement_ts[mid] == ts:
                payoff = pos.shares * market_by_id[mid].resolution
                cash += payoff
                pnl = payoff - pos.cost
                trades.append(
                    Trade(
                        market_id=mid,
                        question=pos.market.question,
                        entry_timestamp=pos.entry_timestamp,
                        entry_price=pos.entry_price,
                        shares=round(pos.shares, 4),
                        cost=round(pos.cost, 4),
                        payoff=round(payoff, 4),
                        pnl=round(pnl, 4),
                        won=pnl > 0,
                    )
                )
                settled.add(mid)
                del positions[mid]

        # 3) Generate entries for markets with no position, not yet settled, and
        #    that are not resolving right now (no point holding for zero bars).
        for m in markets:
            mid = m.market_id
            if mid in positions or mid in settled:
                continue
            if ts == settlement_ts[mid] or price_at[mid].get(ts) is None:
                continue
            sig = threshold.signal(history[mid], config)
            if sig is None or sig.action != "BUY":
                continue

            equity_now = _mark_equity(cash, positions, last_price)
            notional = equity_now * config.bet_fraction
            notional = min(notional, config.max_market_fraction * config.starting_capital)
            notional = min(notional, cash)
            if notional <= 0:
                continue

            fill_price = min(0.99, sig.price * (1.0 + config.slippage))
            if fill_price <= 0:
                continue
            shares = notional / fill_price
            fee_cost = notional * config.fee
            total_cost = notional + fee_cost
            if total_cost > cash:
                continue
            cash -= total_cost
            positions[mid] = _Position(
                market=m,
                entry_timestamp=ts,
                entry_price=sig.price,
                fill_price=fill_price,
                shares=shares,
                cost=total_cost,
            )

        # 4) Mark-to-market and record curves.
        equity = _mark_equity(cash, positions, last_price)
        equity_curve.append(EquityPoint(timestamp=ts, equity=round(equity, 4)))
        if equity > peak:
            peak = equity
        dd = (equity / peak) - 1.0 if peak > 0 else 0.0
        max_drawdown = min(max_drawdown, dd)
        drawdown_curve.append(DrawdownPoint(timestamp=ts, drawdown=round(dd, 6)))

    final_equity = equity_curve[-1].equity if equity_curve else config.starting_capital
    total_return = (final_equity / config.starting_capital) - 1.0
    num_trades = len(trades)
    wins = sum(1 for t in trades if t.won)
    win_rate = (wins / num_trades) if num_trades else 0.0

    failure_reason = None
    if num_trades == 0:
        failure_reason = (
            f"没有任何市场的 YES 价格达到买入阈值（{config.threshold:.0%}），未产生任何交易。"
            "可以尝试降低阈值，或扩大市场范围。"
        )

    return BacktestResult(
        total_return=round(total_return, 6),
        final_equity=round(final_equity, 4),
        max_drawdown=round(max_drawdown, 6),
        win_rate=round(win_rate, 4),
        num_trades=num_trades,
        num_samples=num_samples,
        failure_reason=failure_reason,
        equity_curve=equity_curve,
        drawdown_curve=drawdown_curve,
        trades=trades,
    )


def _mark_equity(
    cash: float, positions: Dict[str, _Position], last_price: Dict[str, float]
) -> float:
    equity = cash
    for mid, pos in positions.items():
        mark = last_price.get(mid, pos.fill_price)
        equity += pos.shares * mark
    return equity
