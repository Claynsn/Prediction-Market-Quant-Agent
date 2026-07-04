// Supabase persistence with graceful degradation.
//
// If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured, we persist to the
// ideas / strategies / backtests tables (see supabase/schema.sql). If not, the
// helper is a no-op that reports `saved: false` with a reason, so the whole MVP
// runs locally without any Supabase project. This is the "real Supabase" swap
// point: set the env vars and it persists for real, no code change needed.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { BacktestResult, StrategyConfig, SaveResult } from "./types";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export async function persistRun(
  idea: string,
  strategy: StrategyConfig,
  result: BacktestResult,
): Promise<SaveResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      saved: false,
      reason: "Supabase 未配置（设置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 即可启用持久化）",
    };
  }

  const { data: ideaRow, error: ideaErr } = await supabase
    .from("ideas")
    .insert({ raw_text: idea })
    .select("id")
    .single();
  if (ideaErr) return { saved: false, reason: `ideas insert 失败: ${ideaErr.message}` };

  const ideaId = ideaRow.id as string;

  const { data: stratRow, error: stratErr } = await supabase
    .from("strategies")
    .insert({ idea_id: ideaId, config: strategy, name: strategy.name })
    .select("id")
    .single();
  if (stratErr) return { saved: false, reason: `strategies insert 失败: ${stratErr.message}` };

  const { error: btErr } = await supabase.from("backtests").insert({
    strategy_id: stratRow.id as string,
    total_return: result.total_return,
    max_drawdown: result.max_drawdown,
    win_rate: result.win_rate,
    num_trades: result.num_trades,
    num_samples: result.num_samples,
    result,
  });
  if (btErr) return { saved: false, reason: `backtests insert 失败: ${btErr.message}` };

  return { saved: true, idea_id: ideaId };
}
