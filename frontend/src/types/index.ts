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

export interface PricingRow {
  timestamp: string;
  slot: number | null;
  bid_price: number | null;
  bid_vol: number | null;
  ask_price: number | null;
  ask_vol: number | null;
  pool_price: number | null;
  fee_adj_bid: number | null;
  fee_adj_ask: number | null;
  bid_theo: number | null;
  ask_theo: number | null;
  pool_trade: string | null;
  own_trade: string | null;
}

export interface LogEntry {
  timestamp: string;
  tag: string;
  loglevel: string;
  message: string;
  pair: string;
  market: string;
}
