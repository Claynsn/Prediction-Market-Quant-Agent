"use client";

import { useEffect, useState } from "react";
import type { SystemStatus } from "@/lib/pmTypes";

const STATE_STYLE: Record<string, string> = {
  loaded: "bg-emerald-500/15 text-emerald-300",
  live: "bg-emerald-500/15 text-emerald-300",
  blocked: "bg-red-500/15 text-red-300",
  pending: "bg-amber-500/15 text-amber-300",
  stub: "bg-slate-700/40 text-slate-300",
};

export default function SystemPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pm/status")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setStatus(d)))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>;
  }
  if (!status) return <div className="p-4 text-sm text-slate-500">加载系统状态…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">{status.service}</h2>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs text-accent">{status.phase}</span>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-sm font-medium text-slate-300">数据源</div>
          <div className="space-y-2">
            {status.data_sources.map((s) => (
              <div key={s.name} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-ink/40 p-3">
                <span className={`mt-0.5 rounded px-2 py-0.5 text-[10px] font-medium ${STATE_STYLE[s.state] ?? STATE_STYLE.stub}`}>
                  {s.state}
                </span>
                <div>
                  <div className="text-sm text-slate-200">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-panel/60 p-5">
        <div className="mb-2 text-sm font-medium text-red-300">实盘风控红线（不可协商，OMS 内强制）</div>
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
          {status.risk_redlines.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5 text-xs text-slate-500">
        能力矩阵与偏差记录见仓库 <code className="text-slate-400">pm-agent/docs/venue-capabilities.md</code>、
        <code className="text-slate-400">pm-agent/docs/deviations.md</code>。
      </div>
    </div>
  );
}
