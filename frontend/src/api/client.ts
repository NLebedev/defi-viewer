const BASE_URL = '/api';

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);
  return resp.json();
}

export const api = {
  getHostnames: () => fetchJson<string[]>('/hostnames'),
  getPairs: (hostname: string) => fetchJson<string[]>('/pairs', { hostname }),
  getTrades: (params: {
    hostname: string; start: string; end: string;
    pair?: string; successful?: string;
  }) => fetchJson<any[]>('/trades', params as Record<string, string>),
  getPricing: (params: {
    hostname: string; pair: string; start: string; end: string; raw?: string;
  }) => fetchJson<any[]>('/pricing', params as Record<string, string>),
  getLogs: (params: {
    hostname: string; start: string; end: string;
    pair?: string; tag?: string; search?: string;
  }) => fetchJson<any[]>('/logs', params as Record<string, string>),
};
