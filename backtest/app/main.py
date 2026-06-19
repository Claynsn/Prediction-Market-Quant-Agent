"""Clay Quant OS — backtest service.

Exposes two endpoints:
  POST /strategy/generate  fuzzy idea            -> concrete StrategyConfig
  POST /backtest           StrategyConfig        -> BacktestResult (on mock data)

The data source is injected here, so swapping mock for real Polymarket data
(swap point #1) is a one-line change.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .data.mock_polymarket import MockPolymarketDataSource
from .engine.backtester import run_backtest
from .models import (
    BacktestRequest,
    BacktestResult,
    GenerateResponse,
    IdeaRequest,
)
from .nlp.parser import parse_idea

app = FastAPI(title="Clay Quant OS — Backtest Service", version="0.1.0")

# Allow the Next.js dev server (and its server-side route handlers) to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Swap point #1: replace with PolymarketDataSource() to go live on real data.
DATA_SOURCE = MockPolymarketDataSource()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "data_source": DATA_SOURCE.__class__.__name__}


@app.post("/strategy/generate", response_model=GenerateResponse)
def generate_strategy(req: IdeaRequest) -> GenerateResponse:
    config, assumptions, missing = parse_idea(req.idea)
    return GenerateResponse(strategy=config, assumptions=assumptions, missing=missing)


@app.post("/backtest", response_model=BacktestResult)
def backtest(req: BacktestRequest) -> BacktestResult:
    return run_backtest(DATA_SOURCE, req.strategy)
