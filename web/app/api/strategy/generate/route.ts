import { NextResponse } from "next/server";
import { generateStrategy } from "@/lib/backtestClient";

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();
    if (!idea || typeof idea !== "string") {
      return NextResponse.json({ error: "缺少 idea 字段" }, { status: 400 });
    }
    const data = await generateStrategy(idea);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
