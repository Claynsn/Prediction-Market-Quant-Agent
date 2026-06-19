"use client";

import type { DrawdownPoint } from "@/lib/types";
import LineChart from "./LineChart";

export default function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  // Plot drawdown as a percentage (negative = below peak).
  const values = data.map((p) => p.drawdown * 100);
  return (
    <div className="rounded-xl border border-slate-800 bg-panel/60 p-4">
      <div className="mb-2 text-sm font-medium text-slate-300">回撤曲线 (%)</div>
      <LineChart
        values={values}
        color="#f87171"
        fill="rgba(248,113,113,0.12)"
        baseline={0}
        formatY={(v) => `${v.toFixed(1)}%`}
      />
    </div>
  );
}
