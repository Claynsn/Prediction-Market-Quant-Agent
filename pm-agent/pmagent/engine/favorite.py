"""'Buy the favorite before kickoff' settlement backtest.

Semantics: for every match in the dataset, buy the favorite's 'to advance' YES at
the estimated pre-kickoff price with a fixed stake; the position settles at 1 if
the favorite advances (extra time and penalties count) and 0 otherwise.

Per the pm-agent build prompt §8, the report header always declares fidelity,
period, matching assumptions and data provenance, and a price-sensitivity sweep
(uniform entry-price perturbation) ships with every run — with estimated prices
the sensitivity band matters more than the point estimate.
"""
from __future__ import annotations

from typing import List

from ..data.worldcup import load_matches
from ..models import (
    EquityPoint,
    Fidelity,
    MatchRecord,
    ReportHeader,
    Sensitivity,
    StrategySpec,
    TradeRow,
    WCBacktestReport,
)

_SENSITIVITY_SHIFTS = [-0.05, -0.02, 0.0, 0.02, 0.05]


def _clamp_price(p: float) -> float:
    return max(0.02, min(0.99, p))


def _run_once(matches: List[MatchRecord], stake: float, fee: float, price_shift: float) -> float:
    """Total return for a uniform shift applied to every entry price."""
    total_pnl = 0.0
    staked = 0.0
    for m in matches:
        entry = _clamp_price(m.favorite_price_est + price_shift)
        cost = stake * (1 + fee)
        shares = stake / entry
        payoff = shares if m.advancer == m.favorite else 0.0
        total_pnl += payoff - cost
        staked += cost
    return total_pnl / staked if staked else 0.0


def run_wc_favorite(spec: StrategySpec) -> WCBacktestReport:
    params = spec.wc_favorite
    assert params is not None, "wc_favorite spec requires params"
    matches, meta = load_matches(params.stage)

    stake, fee = params.stake_usd, params.fee
    trades: List[TradeRow] = []
    equity_curve: List[EquityPoint] = [EquityPoint(timestamp="start", equity=0.0)]
    cumulative = 0.0
    upsets = 0

    for m in matches:
        entry = _clamp_price(m.favorite_price_est)
        cost = stake * (1 + fee)
        shares = stake / entry
        won = m.advancer == m.favorite
        payoff = shares if won else 0.0
        pnl = payoff - cost
        cumulative += pnl
        if not won:
            upsets += 1
        trades.append(
            TradeRow(
                match_id=m.match_id,
                label=f"{m.home} vs {m.away}",
                kickoff_utc=m.kickoff_utc,
                side=m.favorite,
                entry_price=entry,
                stake=round(cost, 2),
                shares=round(shares, 4),
                payoff=round(payoff, 4),
                pnl=round(pnl, 4),
                won=won,
                confidence=m.confidence,
                notes=m.notes,
            )
        )
        equity_curve.append(EquityPoint(timestamp=m.kickoff_utc, equity=round(cumulative, 4)))

    total_staked = stake * (1 + fee) * len(matches)
    total_return = cumulative / total_staked if total_staked else 0.0
    wins = sum(1 for t in trades if t.won)

    sensitivities = [
        Sensitivity(price_shift=s, total_return=round(_run_once(matches, stake, fee, s), 6))
        for s in _SENSITIVITY_SHIFTS
    ]

    low_conf = [t.label for t in trades if t.confidence == "low"]
    caveats = [
        "入场价为估算收盘概率，非真实市场成交价——总收益率应读作区间（见敏感性），不是精确值。",
        "真实 T-1min 价格获取路径：①付费赔率历史（The Odds API 付费档）②自录（Phase 2 起）。"
        "Polymarket 已结算市场历史仅 ≥12h 粒度，无法回补。",
        "样本 = 32 强淘汰赛完整 16 场（无挑选偏差），但单轮样本量小，胜率估计方差大。",
    ]
    if low_conf:
        caveats.append(
            f"低置信热门认定 {len(low_conf)} 场（{'；'.join(low_conf)}）——"
            "若真实盘口热门与估算相反，结果会明显变化。"
        )

    header = ReportHeader(
        fidelity=Fidelity.L0_DEMO,
        fidelity_note="L0-DEMO：赛果真实（多源新闻核验），入场价为估算。仅验证管道，非投资结论。",
        period="2026-06-28 → 2026-07-03（世界杯 32 强淘汰赛，全部 16 场）",
        matching_assumptions=(
            f"按估算的开赛前 'to advance' YES 价全额成交；每笔 ${stake:.0f}；"
            f"手续费 {fee:.1%}；不叠加滑点（避免在估算价上制造假精度）；持有到结算，含加时与点球。"
        ),
        data_provenance=f"{meta.get('result_provenance','')} / {meta.get('price_provenance','')}",
    )

    return WCBacktestReport(
        header=header,
        spec=spec,
        total_staked=round(total_staked, 2),
        total_pnl=round(cumulative, 2),
        total_return=round(total_return, 6),
        win_rate=round(wins / len(trades), 4) if trades else 0.0,
        num_trades=len(trades),
        num_upsets=upsets,
        trades=trades,
        equity_curve=equity_curve,
        sensitivities=sensitivities,
        caveats=caveats,
    )
