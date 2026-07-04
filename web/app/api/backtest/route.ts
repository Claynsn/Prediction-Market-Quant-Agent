import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtestClient";
import type { StrategyConfig } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { strategy } = (await req.json()) as { strategy: StrategyConfig };
    if (!strategy) {
      return NextResponse.json({ error: "缺少 strategy 字段" }, { status: 400 });
    }
    const result = await runBacktest(strategy);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
