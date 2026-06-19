"use client";

import { useState } from "react";
import IdeaInput from "@/components/IdeaInput";
import StrategyCard from "@/components/StrategyCard";
import BacktestResultView from "@/components/BacktestResult";
import PaperTradingPanel from "@/components/PaperTradingPanel";
import type { BacktestResult, GenerateResponse, SaveResult } from "@/lib/types";

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  async function postJSON<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `请求失败 (${res.status})`);
    return data as T;
  }

  async function handleSubmit(text: string) {
    setLoading(true);
    setError(null);
    setGenerated(null);
    setResult(null);
    setSaveResult(null);
    setIdea(text);
    try {
      const gen = await postJSON<GenerateResponse>("/api/strategy/generate", { idea: text });
      setGenerated(gen);
      const bt = await postJSON<BacktestResult>("/api/backtest", { strategy: gen.strategy });
      setResult(bt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!generated || !result) return;
    setSaving(true);
    try {
      const res = await postJSON<SaveResult>("/api/save", {
        idea,
        strategy: generated.strategy,
        result,
      });
      setSaveResult(res);
    } catch (err) {
      setSaveResult({ saved: false, reason: err instanceof Error ? err.message : "未知错误" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Clay Quant OS</h1>
        <p className="mt-1 text-sm text-slate-400">
          一句模糊想法 → 具体策略 → 回测 → Paper Trading。你的个人量化系统。
        </p>
      </header>

      <div className="space-y-6">
        <IdeaInput onSubmit={handleSubmit} loading={loading} />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
            出错了：{error}
            <div className="mt-1 text-xs text-red-300/70">
              （确认回测服务已启动：backtest 目录下 uvicorn app.main:app --port 8000）
            </div>
          </div>
        )}

        {generated && <StrategyCard data={generated} />}

        {result && (
          <>
            <BacktestResultView result={result} />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl border border-slate-700 bg-ink/50 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-accent disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存策略与回测"}
              </button>
              {saveResult && (
                <span
                  className={`text-xs ${saveResult.saved ? "text-emerald-400" : "text-slate-400"}`}
                >
                  {saveResult.saved
                    ? "✓ 已保存到 Supabase"
                    : `未持久化：${saveResult.reason ?? ""}`}
                </span>
              )}
            </div>

            <PaperTradingPanel strategy={generated!.strategy} result={result} />
          </>
        )}
      </div>

      <footer className="mt-12 text-center text-xs text-slate-600">
        Clay Quant OS · MVP · 数据为 mock Polymarket，仅供研究，非投资建议。
      </footer>
    </main>
  );
}
