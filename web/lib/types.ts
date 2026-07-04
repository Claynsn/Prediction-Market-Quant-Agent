// Shared types — keep in sync with backtest/app/models.py.

export interface StrategyConfig {
  name: string;
  description: string;
  strategy_type: string;
  side: string;
  threshold: number;
  starting_capital: number;
  bet_fraction: number;
  max_market_fraction: number;
  fee: number;
  slippage: number;
  hold_to_settlement: boolean;
}

export interface GenerateResponse {
  strategy: StrategyConfig;
  assumptions: string[];
  missing: string[];
}

export interface Trade {
  market_id: string;
  question: string;
  entry_timestamp: string;
  entry_price: number;
  shares: number;
  cost: number;
  payoff: number;
  pnl: number;
  won: boolean;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
}

export interface DrawdownPoint {
  timestamp: string;
  drawdown: number;
}

export interface BacktestResult {
  total_return: number;
  final_equity: number;
  max_drawdown: number;
  win_rate: number;
  num_trades: number;
  num_samples: number;
  failure_reason: string | null;
  equity_curve: EquityPoint[];
  drawdown_curve: DrawdownPoint[];
  trades: Trade[];
}

export interface SaveResult {
  saved: boolean;
  reason?: string;
  idea_id?: string;
}
