import { NextResponse } from "next/server";
import { persistRun } from "@/lib/supabase";
import type { BacktestResult, StrategyConfig } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { idea, strategy, result } = (await req.json()) as {
      idea: string;
      strategy: StrategyConfig;
      result: BacktestResult;
    };
    if (!idea || !strategy || !result) {
      return NextResponse.json({ error: "缺少 idea / strategy / result" }, { status: 400 });
    }
    const saveResult = await persistRun(idea, strategy, result);
    return NextResponse.json(saveResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ saved: false, reason: message }, { status: 200 });
  }
}
