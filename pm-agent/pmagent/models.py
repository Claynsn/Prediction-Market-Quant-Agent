"""pm-agent core contracts.

StrategySpec is the restricted, schema-validated strategy description that the NL
layer produces and every runner consumes (per the pm-agent build prompt §8: the
LLM parses natural language into this; anything beyond its expressive power falls
back to code-gen, which we do NOT do yet).

Fidelity levels are a hard constraint baked into every report (prompt §8):
  L0_DEMO  — sample/estimated inputs; pipeline-verification only, never a trading
             conclusion (below the prompt's L1; exists because current egress
             blocks live data and resolved-market history is >=12h granularity)
  L1       — mid/last price series (backfillable); coarse eval of taker/threshold
  L2       — top-of-book (self-recorded only)
  L3       — depth (self-recorded only); maker/slippage-sensitive strategies
"""
from __future__ import annotations

from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class Fidelity(str, Enum):
    L0_DEMO = "L0_DEMO"
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"


class WCFavoriteParams(BaseModel):
    """'Buy the favorite shortly before kickoff, hold to settlement.'"""

    stake_usd: float = Field(10.0, gt=0, description="固定每笔投入（USD/USDC）")
    entry_minutes_before_kickoff: int = Field(1, ge=0)
    stage: Literal["round_of_32"] = "round_of_32"  # 目前数据集覆盖的完整轮次
    fee: float = 0.0
    slippage: float = 0.0  # 入场价本身是估算时不再叠加滑点，避免假精度


class StrategySpec(BaseModel):
    kind: Literal["wc_favorite", "legacy_threshold"]
    name: str
    description: str
    required_fidelity: Fidelity = Fidelity.L0_DEMO
    wc_favorite: Optional[WCFavoriteParams] = None
    # legacy_threshold 由旧服务（backtest/, 端口 8000）执行，web 端据此路由
    assumptions: List[str] = []
    missing: List[str] = []


class MatchRecord(BaseModel):
    """One knockout match in the dataset, with per-field provenance."""

    match_id: str
    stage: str
    kickoff_utc: str            # 近似到场次日期与时段
    home: str
    away: str
    favorite: str               # 开赛前市场认定的热门（advance 口径，含加时点球）
    favorite_price_est: float   # 热门 advance YES 的估算开赛前价格 (0,1)
    advancer: str               # 实际晋级方
    score: str
    result_source: str          # "web-verified"：多源新闻核验
    price_source: str           # "estimate"：估算收盘概率，非真实市场成交价
    confidence: Literal["high", "medium", "low"] = "medium"
    notes: str = ""


class TradeRow(BaseModel):
    match_id: str
    label: str                  # "France vs Sweden"
    kickoff_utc: str
    side: str                   # 买入的一方
    entry_price: float
    stake: float
    shares: float
    payoff: float
    pnl: float
    won: bool
    confidence: str
    notes: str = ""


class EquityPoint(BaseModel):
    timestamp: str
    equity: float


class Sensitivity(BaseModel):
    """入场价整体扰动下的收益率（prompt §8 要求的敏感性输出）。"""

    price_shift: float
    total_return: float


class ReportHeader(BaseModel):
    """每份报告头部强制声明（prompt §8）。"""

    fidelity: Fidelity
    fidelity_note: str
    period: str
    matching_assumptions: str
    data_provenance: str


class WCBacktestReport(BaseModel):
    header: ReportHeader
    spec: StrategySpec
    total_staked: float
    total_pnl: float
    total_return: float
    win_rate: float
    num_trades: int
    num_upsets: int
    trades: List[TradeRow]
    equity_curve: List[EquityPoint]
    sensitivities: List[Sensitivity]
    caveats: List[str]
