"use client";

import type { WCBacktestReport } from "@/lib/pmTypes";
import LineChart from "./LineChart";

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-ink/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export default function WCReport({ report }: { report: WCBacktestReport }) {
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const h = report.header;

  return (
    <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
      {/* 报告头：强制声明保真度/区间/撮合假设 */}
      <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed">
        <div className="font-semibold text-amber-300">
          数据保真度：{h.fidelity} — {h.fidelity_note}
        </div>
        <div className="mt-1 text-amber-200/80">区间：{h.period}</div>
        <div className="text-amber-200/80">撮合假设：{h.matching_assumptions}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="总收益率" value={pct(report.total_return)} tone={report.total_return >= 0 ? "pos" : "neg"} />
        <Metric label="总盈亏" value={`${report.total_pnl >= 0 ? "+" : ""}$${report.total_pnl.toFixed(2)}`} tone={report.total_pnl >= 0 ? "pos" : "neg"} />
        <Metric label="总投入" value={`$${report.total_staked.toFixed(0)}`} />
        <Metric label="胜率" value={`${(report.win_rate * 100).toFixed(0)}%`} />
        <Metric label="场次" value={String(report.num_trades)} />
        <Metric label="爆冷" value={String(report.num_upsets)} tone={report.num_upsets > 0 ? "neg" : "neutral"} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-ink/40 p-3">
        <div className="mb-2 text-xs font-medium text-slate-400">
          入场价敏感性（估算价整体偏移时的总收益率——请把结果读作这个区间）
        </div>
        <div className="flex flex-wrap gap-2">
          {report.sensitivities.map((s) => (
            <span
              key={s.price_shift}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                s.price_shift === 0
                  ? "bg-accent/20 text-accent"
                  : "border border-slate-700 text-slate-300"
              }`}
            >
              {s.price_shift > 0 ? "+" : ""}{(s.price_shift * 100).toFixed(0)}¢ → {pct(s.total_return)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-panel/60 p-4">
        <div className="mb-2 text-sm font-medium text-slate-300">累计盈亏（$，按开赛时间序）</div>
        <LineChart
          values={report.equity_curve.map((p) => p.equity)}
          color="#5eead4"
          fill="rgba(94,234,212,0.12)"
          baseline={0}
          formatY={(v) => `$${v.toFixed(0)}`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-ink/60 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">日期</th>
              <th className="px-3 py-2 font-medium">比赛</th>
              <th className="px-3 py-2 font-medium">买入</th>
              <th className="px-3 py-2 font-medium">价格*</th>
              <th className="px-3 py-2 font-medium">结果</th>
              <th className="px-3 py-2 font-medium">盈亏</th>
            </tr>
          </thead>
          <tbody>
            {report.trades.map((t) => (
              <tr key={t.match_id} className="border-t border-slate-800/70">
                <td className="px-3 py-2 text-slate-500">{t.kickoff_utc.slice(5, 10)}</td>
                <td className="px-3 py-2 text-slate-300">
                  {t.label}
                  {t.confidence === "low" && (
                    <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300" title={t.notes}>
                      低置信
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">{t.side}</td>
                <td className="px-3 py-2 text-slate-400">{t.entry_price.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <span className={t.won ? "text-emerald-400" : "text-red-400"}>{t.won ? "晋级" : "爆冷"}</span>
                </td>
                <td className={`px-3 py-2 font-medium ${t.won ? "text-emerald-400" : "text-red-400"}`}>
                  {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-right text-[11px] text-slate-500">* 价格为估算收盘概率，非真实成交价</p>

      <div className="mt-4 rounded-xl border border-slate-800 bg-ink/40 p-3">
        <div className="mb-1 text-xs font-medium text-slate-400">重要说明</div>
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
          {report.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
