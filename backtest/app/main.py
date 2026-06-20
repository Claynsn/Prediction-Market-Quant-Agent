"""Clay Quant OS — backtest service.

Exposes two endpoints:
  POST /strategy/generate  fuzzy idea            -> concrete StrategyConfig
  POST /backtest           StrategyConfig        -> BacktestResult (on mock data)

The data source is injected here, so swapping mock for real Polymarket data
(swap point #1) is a one-line change.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .data.base import MarketDataSource
from .data.mock_polymarket import MockPolymarketDataSource
from .data.polymarket import PolymarketDataSource
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


def _build_data_source() -> MarketDataSource:
    """Swap point #1.

    DATA_SOURCE=polymarket uses the real Polymarket API, falling back to mock data
    if Polymarket is unreachable (e.g. egress not allowlisted). Anything else (the
    default) uses mock data. POLYMARKET_LIMIT tunes how many markets to pull.
    """
    if os.getenv("DATA_SOURCE", "mock").lower() == "polymarket":
        return PolymarketDataSource(
            limit=int(os.getenv("POLYMARKET_LIMIT", "20")),
            fallback=MockPolymarketDataSource(),
        )
    return MockPolymarketDataSource()


DATA_SOURCE = _build_data_source()


@app.get("/health")
def health() -> dict:
    mode = getattr(DATA_SOURCE, "last_mode", None)
    return {
        "status": "ok",
        "data_source": DATA_SOURCE.__class__.__name__,
        "mode": mode,  # live / fallback / error / uninitialized (polymarket only)
    }


@app.post("/strategy/generate", response_model=GenerateResponse)
def generate_strategy(req: IdeaRequest) -> GenerateResponse:
    config, assumptions, missing = parse_idea(req.idea)
    return GenerateResponse(strategy=config, assumptions=assumptions, missing=missing)


@app.post("/backtest", response_model=BacktestResult)
def backtest(req: BacktestRequest) -> BacktestResult:
    return run_backtest(DATA_SOURCE, req.strategy)
