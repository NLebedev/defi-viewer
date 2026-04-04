import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { LogEntry } from '../types';

export function useLogData() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (params: {
    hostname: string; start: string; end: string;
    pair?: string; tag?: string; search?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLogs(params);
      setLogs(data as LogEntry[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, loading, error, fetchLogs };
}
