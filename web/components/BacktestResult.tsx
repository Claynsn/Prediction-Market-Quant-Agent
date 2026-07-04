"use client";

import type { BacktestResult } from "@/lib/types";
import EquityChart from "./EquityChart";
import DrawdownChart from "./DrawdownChart";

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-ink/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default function BacktestResultView({ result }: { result: BacktestResult }) {
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-100">回测结果（mock Polymarket 数据）</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="收益"
          value={pct(result.total_return)}
          tone={result.total_return >= 0 ? "pos" : "neg"}
        />
        <Metric label="最大回撤" value={pct(result.max_drawdown)} tone="neg" />
        <Metric label="胜率" value={`${(result.win_rate * 100).toFixed(0)}%`} />
        <Metric label="交易数" value={String(result.num_trades)} />
        <Metric label="样本数" value={String(result.num_samples)} />
      </div>

      {result.failure_reason && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          失败原因：{result.failure_reason}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <EquityChart data={result.equity_curve} />
        <DrawdownChart data={result.drawdown_curve} />
      </div>

      {result.trades.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-sm font-medium text-slate-300">成交明细</div>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink/60 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">市场</th>
                  <th className="px-3 py-2 font-medium">买入价</th>
                  <th className="px-3 py-2 font-medium">份数</th>
                  <th className="px-3 py-2 font-medium">成本</th>
                  <th className="px-3 py-2 font-medium">结算</th>
                  <th className="px-3 py-2 font-medium">盈亏</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={`${t.market_id}-${i}`} className="border-t border-slate-800/70">
                    <td className="px-3 py-2 text-slate-300">{t.question}</td>
                    <td className="px-3 py-2 text-slate-400">{t.entry_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-400">{t.shares.toFixed(1)}</td>
                    <td className="px-3 py-2 text-slate-400">{t.cost.toFixed(1)}</td>
                    <td className="px-3 py-2 text-slate-400">{t.payoff.toFixed(1)}</td>
                    <td
                      className={`px-3 py-2 font-medium ${
                        t.won ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {t.pnl >= 0 ? "+" : ""}
                      {t.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
