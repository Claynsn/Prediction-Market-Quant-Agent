"use client";

import type { GenerateResponse } from "@/lib/types";

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-ink/50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}

export default function StrategyCard({ data }: { data: GenerateResponse }) {
  const s = data.strategy;
  return (
    <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
          策略
        </span>
        <h2 className="text-base font-semibold text-slate-100">{s.name}</h2>
      </div>
      <p className="mt-2 text-sm text-slate-400">{s.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Param label="买入阈值" value={`${(s.threshold * 100).toFixed(0)}%`} />
        <Param label="方向" value={s.side} />
        <Param label="起始资金" value={`${s.starting_capital.toFixed(0)} USDC`} />
        <Param label="单笔仓位" value={`${(s.bet_fraction * 100).toFixed(1)}%`} />
        <Param label="单市场上限" value={`${(s.max_market_fraction * 100).toFixed(0)}%`} />
        <Param label="滑点" value={`${(s.slippage * 100).toFixed(1)}%`} />
      </div>

      {data.assumptions.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="text-xs font-medium text-amber-300">
            自动补全的默认值（未来可由 AI 追问你确认）
          </div>
          <ul className="mt-1 list-inside list-disc text-xs text-amber-200/80">
            {data.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
