"""pm-agent API service (port 8001).

Endpoints:
  GET  /health        service liveness
  GET  /status        aggregated system status for the dashboard's 系统/数据 tabs
  GET  /dataset       the World Cup dataset with provenance
  POST /nl/parse      idea text -> StrategySpec (+ echo, assumptions, missing)
  POST /backtest      StrategySpec -> WCBacktestReport (wc_favorite only; the
                      legacy_threshold kind is executed by the old backtest/
                      service — the web layer routes on spec.kind)

Run: cd pm-agent && uvicorn pmagent.api:app --port 8001
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .data.worldcup import load_dataset, load_matches
from .engine.favorite import run_wc_favorite
from .models import StrategySpec, WCBacktestReport
from .nl import parser

app = FastAPI(title="pm-agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class IdeaRequest(BaseModel):
    idea: str


class ParseResponse(BaseModel):
    spec: StrategySpec
    echo: str  # 执行前回显（prompt §8：防误译）


class BacktestRequest(BaseModel):
    spec: StrategySpec


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "pm-agent", "version": "0.1.0"}


@app.get("/status")
def status() -> dict:
    matches, meta = load_matches()
    return {
        "service": "pm-agent 0.1.0",
        "phase": "端到端演示切片（Phase 0 已完成，Phase 1-4 见任务清单）",
        "data_sources": [
            {"name": "WorldCup2026 R32 数据集", "state": "loaded",
             "detail": f"{len(matches)} 场；赛果=真实核验，入场价=估算（L0-DEMO）"},
            {"name": "Polymarket (Gamma/CLOB/WS)", "state": "blocked",
             "detail": "egress 未放行；放行后接真实数据（deviations.md D-1）"},
            {"name": "predict.fun", "state": "pending",
             "detail": "等 mainnet API key（Discord 工单）"},
            {"name": "Kalshi", "state": "pending", "detail": "行情免鉴权，egress 放行即接"},
            {"name": "The Odds API", "state": "pending", "detail": "免费档 500 credits/月，预算待拍板"},
            {"name": "X / 社交", "state": "stub", "detail": "接口 + 本地 jsonl 回放（免费档已取消）"},
        ],
        "risk_redlines": [
            "默认 DRY_RUN；实盘需显式确认（一键 = 一次风险摘要确认页）",
            "风险闸门：单笔 ≤$5、总敞口 ≤$20（live_micro 起步值，验证后可调）",
            "每分钟下单数上限；kill switch（halt 文件即全体撤单停机）",
            "代币限额 approve；私钥只进 .env；不可逆操作前确认",
        ],
        "dataset_meta": meta,
    }


@app.get("/dataset")
def dataset() -> dict:
    return load_dataset()


@app.post("/nl/parse", response_model=ParseResponse)
def nl_parse(req: IdeaRequest) -> ParseResponse:
    if not req.idea.strip():
        raise HTTPException(400, "idea 不能为空")
    spec = parser.parse(req.idea)
    echo = f"我理解你要回测的是：{spec.description}"
    if spec.assumptions:
        echo += f"（自动补全：{'；'.join(spec.assumptions)}）"
    return ParseResponse(spec=spec, echo=echo)


@app.post("/backtest", response_model=WCBacktestReport)
def backtest(req: BacktestRequest) -> WCBacktestReport:
    if req.spec.kind != "wc_favorite":
        raise HTTPException(
            422,
            "pm-agent 目前只执行 wc_favorite 策略；legacy_threshold 请调用旧服务 (端口 8000)",
        )
    return run_wc_favorite(req.spec)
