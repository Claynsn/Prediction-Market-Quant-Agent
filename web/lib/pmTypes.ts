// Mirrors pm-agent/pmagent/models.py — keep in sync.

export interface WCFavoriteParams {
  stake_usd: number;
  entry_minutes_before_kickoff: number;
  stage: string;
  fee: number;
  slippage: number;
}

export interface StrategySpec {
  kind: "wc_favorite" | "legacy_threshold";
  name: string;
  description: string;
  required_fidelity: string;
  wc_favorite: WCFavoriteParams | null;
  assumptions: string[];
  missing: string[];
}

export interface ParseResponse {
  spec: StrategySpec;
  echo: string;
}

export interface TradeRow {
  match_id: string;
  label: string;
  kickoff_utc: string;
  side: string;
  entry_price: number;
  stake: number;
  shares: number;
  payoff: number;
  pnl: number;
  won: boolean;
  confidence: string;
  notes: string;
}

export interface Sensitivity {
  price_shift: number;
  total_return: number;
}

export interface ReportHeader {
  fidelity: string;
  fidelity_note: string;
  period: string;
  matching_assumptions: string;
  data_provenance: string;
}

export interface WCBacktestReport {
  header: ReportHeader;
  spec: StrategySpec;
  total_staked: number;
  total_pnl: number;
  total_return: number;
  win_rate: number;
  num_trades: number;
  num_upsets: number;
  trades: TradeRow[];
  equity_curve: { timestamp: string; equity: number }[];
  sensitivities: Sensitivity[];
  caveats: string[];
}

export interface MatchRecord {
  match_id: string;
  stage: string;
  kickoff_utc: string;
  home: string;
  away: string;
  favorite: string;
  favorite_price_est: number;
  advancer: string;
  score: string;
  result_source: string;
  price_source: string;
  confidence: string;
  notes: string;
}

export interface WCDataset {
  dataset: string;
  generated: string;
  result_provenance: string;
  price_provenance: string;
  market_convention: string;
  matches: MatchRecord[];
}

export interface DataSourceStatus {
  name: string;
  state: string;
  detail: string;
}

export interface SystemStatus {
  service: string;
  phase: string;
  data_sources: DataSourceStatus[];
  risk_redlines: string[];
  dataset_meta: Record<string, string>;
}
