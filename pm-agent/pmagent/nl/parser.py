"""NL idea -> StrategySpec (rule-based placeholder for the Claude two-stage flow).

Detects the World Cup favorite pattern and extracts its parameters; anything else
is routed to the legacy threshold engine (backtest/ service). When the Claude
integration lands (user provides ANTHROPIC_API_KEY), this module keeps the same
signature: parse(idea) -> StrategySpec with assumptions/missing for follow-up
questions, plus the pre-run echo the prompt §8 requires.
"""
from __future__ import annotations

import re

from ..models import Fidelity, StrategySpec, WCFavoriteParams

_WC_PATTERN = re.compile(r"世界杯|world\s*cup|wc\s*2026", re.IGNORECASE)
_FAVORITE_PATTERN = re.compile(r"胜率高|热门|夺冠热门|favorite|更强|赢面大", re.IGNORECASE)


def _extract_stake(text: str) -> float | None:
    m = re.search(r"(?:每笔|单笔|每场|per\s*bet)[^\d]{0,6}(\d+(?:\.\d+)?)\s*(?:刀|美元|美金|usd[ct]?|u\b|\$)?", text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    m = re.search(r"\$?(\d+(?:\.\d+)?)\s*(?:刀|美元|美金|usdc?)\b", text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


def _extract_entry_minutes(text: str) -> int | None:
    m = re.search(r"(?:开赛|开球|kick\s*off)[^\d]{0,6}前?[^\d]{0,4}(\d+)\s*分钟", text)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*分钟(?:前)?(?:买|入场|建仓)", text)
    if m:
        return int(m.group(1))
    return None


def parse(idea: str) -> StrategySpec:
    text = idea.strip()
    assumptions: list[str] = []
    missing: list[str] = []

    if _WC_PATTERN.search(text) and _FAVORITE_PATTERN.search(text):
        stake = _extract_stake(text)
        if stake is None:
            stake = 10.0
            assumptions.append("未指定每笔金额，默认 $10")
            missing.append("stake_usd")

        minutes = _extract_entry_minutes(text)
        if minutes is None:
            minutes = 1
            assumptions.append("未指定入场时点，默认开赛前 1 分钟")
            missing.append("entry_minutes_before_kickoff")

        assumptions.append(
            "当前数据集覆盖 32 强淘汰赛完整 16 场（结果真实、入场价估算，L0-DEMO）；"
            "小组赛为三向市场（有平局），待补充数据后纳入"
        )

        params = WCFavoriteParams(stake_usd=stake, entry_minutes_before_kickoff=minutes)
        return StrategySpec(
            kind="wc_favorite",
            name="世界杯：开赛前买热门晋级",
            description=(
                f"每场比赛开赛前 {minutes} 分钟，买入市场胜率更高一方的 'to advance' YES，"
                f"每笔 ${stake:.0f}，持有到结算（含加时与点球）。"
            ),
            required_fidelity=Fidelity.L0_DEMO,
            wc_favorite=params,
            assumptions=assumptions,
            missing=missing,
        )

    # 非世界杯热门类想法 → 路由到旧的阈值引擎（web 端据 kind 调旧服务）
    return StrategySpec(
        kind="legacy_threshold",
        name="通用阈值策略（旧引擎）",
        description="未命中世界杯热门模式，路由到通用阈值回测引擎。",
        required_fidelity=Fidelity.L1,
        assumptions=["由 backtest/ 旧服务解析并执行"],
        missing=[],
    )
