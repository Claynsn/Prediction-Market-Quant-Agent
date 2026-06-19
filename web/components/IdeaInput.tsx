"use client";

import { useState } from "react";

const EXAMPLES = [
  "买入概率超过 70% 的 YES，持有到结算，单笔 5%",
  "只赌赢面很大的事件，仓位激进一点",
  "阈值 80%，每笔 3%，起始资金 2000 USDC",
];

export default function IdeaInput({
  onSubmit,
  loading,
}: {
  onSubmit: (idea: string) => void;
  loading: boolean;
}) {
  const [idea, setIdea] = useState("");

  return (
    <div className="rounded-2xl border border-slate-800 bg-panel/60 p-5">
      <label className="mb-2 block text-sm font-medium text-slate-300">
        用一句话描述你的策略想法
      </label>
      <textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={3}
        placeholder="例如：买入概率超过 70% 的 YES，持有到结算"
        className="w-full resize-none rounded-xl border border-slate-700 bg-ink/70 p-3 text-sm text-slate-100 outline-none focus:border-accent"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setIdea(ex)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:border-accent hover:text-accent"
          >
            {ex}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={loading || idea.trim().length === 0}
        onClick={() => onSubmit(idea.trim())}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "生成中…" : "生成策略并回测"}
      </button>
    </div>
  );
}
