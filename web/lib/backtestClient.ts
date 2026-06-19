// Thin client for the Python backtest service. Used only from server-side route
// handlers, so BACKTEST_URL stays a server env var (no NEXT_PUBLIC_ needed).
import type { BacktestResult, GenerateResponse, StrategyConfig } from "./types";

const BASE = process.env.BACKTEST_URL ?? "http://127.0.0.1:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backtest service ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export function generateStrategy(idea: string): Promise<GenerateResponse> {
  return post<GenerateResponse>("/strategy/generate", { idea });
}

export function runBacktest(strategy: StrategyConfig): Promise<BacktestResult> {
  return post<BacktestResult>("/backtest", { strategy });
}
