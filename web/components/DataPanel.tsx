"use client";

import { useEffect, useState } from "react";
import type { WCDataset } from "@/lib/pmTypes";

export default function DataPanel() {
  const [data, setData] = useState<WCDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pm/dataset")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>;
  }
  if (!data) return <div className="p-4 text-sm text-slate-500">加载数据集…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
        <h2 className="text-base font-semibold text-slate-100">{data.dataset}</h2>
        <div className="mt-3 space-y-2 text-xs leading-relaxed">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-emerald-200/90">
            <span className="font-semibold text-emerald-300">赛果来源：</span>
            {data.result_provenance}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-amber-200/90">
            <span className="font-semibold text-amber-300">价格来源：</span>
            {data.price_provenance}
          </div>
          <div className="text-slate-400">市场口径：{data.market_convention}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-ink/60 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">开赛 (UTC)</th>
              <th className="px-3 py-2 font-medium">比赛</th>
              <th className="px-3 py-2 font-medium">热门</th>
              <th className="px-3 py-2 font-medium">估算价</th>
              <th className="px-3 py-2 font-medium">比分</th>
              <th className="px-3 py-2 font-medium">晋级</th>
              <th className="px-3 py-2 font-medium">置信</th>
              <th className="px-3 py-2 font-medium">备注</th>
            </tr>
          </thead>
          <tbody>
            {data.matches.map((m) => (
              <tr key={m.match_id} className="border-t border-slate-800/70">
                <td className="px-3 py-2 text-slate-500">{m.kickoff_utc.slice(5, 16).replace("T", " ")}</td>
                <td className="px-3 py-2 text-slate-300">{m.home} vs {m.away}</td>
                <td className="px-3 py-2 text-slate-300">{m.favorite}</td>
                <td className="px-3 py-2 text-slate-400">{m.favorite_price_est.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-400">{m.score}</td>
                <td className={`px-3 py-2 font-medium ${m.advancer === m.favorite ? "text-emerald-400" : "text-red-400"}`}>
                  {m.advancer}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      m.confidence === "high"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : m.confidence === "low"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-slate-700/40 text-slate-300"
                    }`}
                  >
                    {m.confidence}
                  </span>
                </td>
                <td className="max-w-[16rem] px-3 py-2 text-slate-500">{m.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
