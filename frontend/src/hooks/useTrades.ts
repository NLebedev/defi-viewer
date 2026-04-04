import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Trade } from '../types';

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async (params: {
    hostname: string; start: string; end: string;
    pair?: string; successful?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTrades(params);
      setTrades(data as Trade[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { trades, loading, error, fetchTrades };
}
