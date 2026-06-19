"use client";

import { useState } from "react";
import type { BacktestResult, StrategyConfig } from "@/lib/types";

// Paper trading is a stub for the MVP: it simply "deploys" the strategy in
// simulated mode. The live executor (swap point #3) plugs in behind the same
// interface later, gated by a pre-launch risk-control confirmation flow
// (position caps, daily loss circuit breaker, second confirmation).

export default function PaperTradingPanel({
  strategy,
  result,
}: {
  strategy: StrategyConfig;
  result: BacktestResult;
}) {
  const [deployed, setDeployed] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
      <h2 className="text-base font-semibold text-slate-100">Paper Trading</h2>
      <p className="mt-1 text-sm text-slate-400">
        在模拟环境中部署 <span className="text-slate-200">{strategy.name}</span>
        ，不动用真实资金。
      </p>

      {!deployed ? (
        <button
          type="button"
          onClick={() => setDeployed(true)}
          className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:opacity-90"
        >
          启动 Paper Trading
        </button>
      ) : (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
          ✓ 已在模拟环境部署，回测净值参考：
          {result.final_equity.toFixed(0)} USDC（{(result.total_return * 100).toFixed(2)}%）。
        </div>
      )}

      <div className="mt-5 border-t border-slate-800 pt-4">
        <button
          type="button"
          disabled
          title="实盘执行下一阶段开放"
          className="w-full cursor-not-allowed rounded-xl border border-slate-700 bg-ink/40 px-4 py-2.5 text-sm font-semibold text-slate-500"
        >
          确认实盘
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          实盘执行下一阶段开放（需先通过仓位上限、日亏损熔断与二次确认风控流程）。
        </p>
      </div>
    </div>
  );
}
