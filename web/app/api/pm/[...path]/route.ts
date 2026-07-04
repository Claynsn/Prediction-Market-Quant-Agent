import { NextResponse } from "next/server";

// Thin proxy to the pm-agent service so the browser only ever talks to Next.js.
const BASE = process.env.PMAGENT_URL ?? "http://127.0.0.1:8001";

async function forward(req: Request, path: string[]) {
  const url = `${BASE}/${path.join("/")}`;
  try {
    const init: RequestInit = {
      method: req.method,
      headers: { "content-type": "application/json" },
      cache: "no-store",
    };
    if (req.method !== "GET") init.body = await req.text();
    const res = await fetch(url, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json(
      { error: `pm-agent 服务不可达 (${url}): ${message}` },
      { status: 502 },
    );
  }
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
