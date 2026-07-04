"use client";

import type { EquityPoint } from "@/lib/types";
import LineChart from "./LineChart";

export default function EquityChart({ data }: { data: EquityPoint[] }) {
  const values = data.map((p) => p.equity);
  const start = values.length ? values[0] : undefined;
  return (
    <div className="rounded-xl border border-slate-800 bg-panel/60 p-4">
      <div className="mb-2 text-sm font-medium text-slate-300">净值曲线 (USDC)</div>
      <LineChart
        values={values}
        color="#5eead4"
        fill="rgba(94,234,212,0.12)"
        baseline={start}
        formatY={(v) => v.toFixed(0)}
      />
    </div>
  );
}
