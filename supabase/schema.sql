-- Clay Quant OS — schema
-- Three tables: ideas -> strategies -> backtests.
-- Apply with: supabase db push, or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- A raw, fuzzy strategy idea typed by the user.
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  raw_text    text not null,
  created_at  timestamptz not null default now()
);

-- A concrete, backtestable strategy parsed from an idea. `config` mirrors
-- StrategyConfig (backtest/app/models.py & web/lib/types.ts).
create table if not exists strategies (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid references ideas(id) on delete cascade,
  name        text not null default 'strategy',
  config      jsonb not null,
  created_at  timestamptz not null default now()
);

-- The result of running a strategy through the backtest engine. Headline metrics
-- are denormalized as columns for easy querying; `result` keeps the full payload
-- (equity curve, drawdown curve, trades).
create table if not exists backtests (
  id            uuid primary key default gen_random_uuid(),
  strategy_id   uuid references strategies(id) on delete cascade,
  total_return  double precision,
  max_drawdown  double precision,
  win_rate      double precision,
  num_trades    integer,
  num_samples   integer,
  result        jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_strategies_idea on strategies(idea_id);
create index if not exists idx_backtests_strategy on backtests(strategy_id);
