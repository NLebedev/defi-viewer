import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { PricingRow, MarketInfo } from '../types';

export function usePricingData() {
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPricing = useCallback(async (params: {
    hostname: string; pair: string; start: string; end: string; raw?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPricing(params);
      setMarkets((data as any).markets || []);
      setRows((data as any).rows || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, markets, loading, error, fetchPricing };
}
