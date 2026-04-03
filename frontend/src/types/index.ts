export interface Trade {
  txid: string;
  timestamp: string;
  pair: string;
  pair_display: string;
  market: string;
  successful: boolean;
  error_reason: string | null;
  side: string | null;
  cid: string | null;
  cid_base: string | null;
  strategy_id: string | null;
  slot: number | null;
  slot_delay: number | null;
  send_slot: number | null;
  processed_slot: number | null;
  provider: string | null;
  gas_paid: number | null;
  gas_paid_usd: number | null;
  tag: string;
}

export interface MarketInfo {
  key: string;
  market: string;
  pair: string;
  display: string;
}

export interface MarketValues {
  bid_price?: number | null;
  bid_vol?: number | null;
  ask_price?: number | null;
  ask_vol?: number | null;
  trade?: string | null;
  _is_own?: boolean;
  _successful?: boolean;
}

export interface PricingRow {
  timestamp: string;
  slot: number | null;
  values: Record<string, MarketValues>;
}

export interface PricingResponse {
  markets: MarketInfo[];
  rows: PricingRow[];
}

export interface LogEntry {
  timestamp: string;
  tag: string;
  loglevel: string;
  message: string;
  pair: string;
  market: string;
}
