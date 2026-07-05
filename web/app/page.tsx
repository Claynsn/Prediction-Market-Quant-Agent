"use client";

import { useState } from "react";
import IdeaInput from "@/components/IdeaInput";
import StrategyCard from "@/components/StrategyCard";
import BacktestResultView from "@/components/BacktestResult";
import PaperTradingPanel from "@/components/PaperTradingPanel";
import WCReport from "@/components/WCReport";
import DataPanel from "@/components/DataPanel";
import SystemPanel from "@/components/SystemPanel";
import type { BacktestResult, GenerateResponse } from "@/lib/types";
import type { ParseResponse, WCBacktestReport } from "@/lib/pmTypes";

type Tab = "backtest" | "data" | "system";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? data?.detail ?? `请求失败 (${res.status})`);
  return data as T;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("backtest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pm-agent 路径（世界杯热门策略）
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [wcReport, setWcReport] = useState<WCBacktestReport | null>(null);

  // 旧引擎路径（通用阈值策略）
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [legacyResult, setLegacyResult] = useState<BacktestResult | null>(null);

  async function handleSubmit(text: string) {
    setLoading(true);
    setError(null);
    setParsed(null);
    setWcReport(null);
    setGenerated(null);
    setLegacyResult(null);
    try {
      const p = await postJSON<ParseResponse>("/api/pm/nl/parse", { idea: text });
      setParsed(p);
      if (p.spec.kind === "wc_favorite") {
        const report = await postJSON<WCBacktestReport>("/api/pm/backtest", { spec: p.spec });
        setWcReport(report);
      } else {
        // 未命中世界杯模式 → 旧阈值引擎闭环
        const gen = await postJSON<GenerateResponse>("/api/strategy/generate", { idea: text });
        setGenerated(gen);
        const bt = await postJSON<BacktestResult>("/api/backtest", { strategy: gen.strategy });
        setLegacyResult(bt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "backtest", label: "策略回测" },
    { id: "data", label: "数据" },
    { id: "system", label: "系统" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">PM Quant</h1>
        <p className="mt-1 text-sm text-slate-400">
          个人预测市场量化系统 · 想法 → 回测 → （风控确认后）实盘
        </p>
      </header>

      <nav className="mb-6 flex gap-1 rounded-xl border border-slate-800 bg-panel/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-accent/15 text-accent" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "backtest" && (
        <div className="space-y-6">
          <IdeaInput onSubmit={handleSubmit} loading={loading} />

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
              出错了：{error}
              <div className="mt-1 text-xs text-red-300/70">
                （确认服务已启动：pm-agent 端口 8001，旧回测服务端口 8000）
              </div>
            </div>
          )}

          {parsed && (
            <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                  {parsed.spec.kind === "wc_favorite" ? "pm-agent" : "旧引擎"}
                </span>
                <h2 className="text-base font-semibold text-slate-100">{parsed.spec.name}</h2>
              </div>
              <p className="mt-2 text-sm text-slate-300">{parsed.echo}</p>
              {parsed.spec.missing.length > 0 && (
                <p className="mt-2 text-xs text-amber-300/80">
                  可补充的参数：{parsed.spec.missing.join("、")}（未来由 AI 追问）
                </p>
              )}
            </div>
          )}

          {wcReport && <WCReport report={wcReport} />}

          {generated && <StrategyCard data={generated} />}
          {legacyResult && (
            <>
              <BacktestResultView result={legacyResult} />
              <PaperTradingPanel strategy={generated!.strategy} result={legacyResult} />
            </>
          )}

          {wcReport && (
            <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
              <h2 className="text-base font-semibold text-slate-100">部署</h2>
              <p className="mt-1 text-sm text-slate-400">
                实盘部署将经过：风险摘要确认页（策略、限额、当前敞口）→ OMS 风险闸门
                （单笔 ≤$5、总敞口 ≤$20 起步）→ kill switch 全程可停。
              </p>
              <button
                type="button"
                disabled
                title="执行层（Phase 3）完成后开放"
                className="mt-3 w-full cursor-not-allowed rounded-xl border border-slate-700 bg-ink/40 px-4 py-2.5 text-sm font-semibold text-slate-500"
              >
                部署实盘（Phase 3 后开放）
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "data" && <DataPanel />}
      {tab === "system" && <SystemPanel />}

      <footer className="mt-10 text-center text-xs text-slate-600">
        PM Quant · pm-agent 架构 · 仅供研究，非投资建议。
      </footer>
    </main>
  );
}
