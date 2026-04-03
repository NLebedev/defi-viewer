import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { PricingRow, MarketInfo } from '../types';

interface Props {
  rows: PricingRow[];
  markets: MarketInfo[];
}

function toTime(ts: string): UTCTimestamp {
  return (new Date(ts).getTime() / 1000) as UTCTimestamp;
}

function dedupeByTime(data: { time: UTCTimestamp; value: number }[]): { time: UTCTimestamp; value: number }[] {
  if (data.length === 0) return data;
  const map = new Map<number, number>();
  for (const d of data) map.set(d.time as number, d.value);
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

const MARKET_COLORS: Record<string, { bid: string; ask: string }> = {
  BINANCE: { bid: '#4ade80', ask: '#f87171' },
  THEO: { bid: '#a78bfa', ask: '#f472b6' },
};
const DEFAULT_COLORS = [
  { bid: '#34d399', ask: '#fb923c' },
  { bid: '#38bdf8', ask: '#fbbf24' },
  { bid: '#6ee7b7', ask: '#f9a8d4' },
];

export function GraphPanel({ rows, markets }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || rows.length === 0 || markets.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0d1117' }, textColor: '#8892a4', fontSize: 10 },
      grid: { vertLines: { color: '#1a1f2e' }, horzLines: { color: '#1a1f2e' } },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, secondsVisible: true },
      rightPriceScale: { borderColor: '#2d3548' },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    let defaultIdx = 0;
    const seriesList: ISeriesApi<any>[] = [];

    for (const m of markets) {
      let colors: { bid: string; ask: string };
      if (m.market.includes('BINANCE')) {
        colors = MARKET_COLORS.BINANCE;
      } else if (m.market === 'THEO') {
        colors = MARKET_COLORS.THEO;
      } else {
        colors = DEFAULT_COLORS[defaultIdx % DEFAULT_COLORS.length];
        defaultIdx++;
      }

      const bidData = dedupeByTime(
        rows
          .filter(r => r.values?.[m.key]?.bid_price != null)
          .map(r => ({ time: toTime(r.timestamp), value: r.values[m.key].bid_price! }))
      );
      const askData = dedupeByTime(
        rows
          .filter(r => r.values?.[m.key]?.ask_price != null)
          .map(r => ({ time: toTime(r.timestamp), value: r.values[m.key].ask_price! }))
      );

      if (bidData.length > 0) {
        const s = chart.addLineSeries({
          color: colors.bid, lineWidth: 1,
          title: `${m.display} Bid`,
          lineStyle: m.market === 'THEO' ? 2 : 0,
        });
        try { s.setData(bidData); } catch (e) { /* ignore */ }
        seriesList.push(s);
      }
      if (askData.length > 0) {
        const s = chart.addLineSeries({
          color: colors.ask, lineWidth: 1,
          title: `${m.display} Ask`,
          lineStyle: m.market === 'THEO' ? 2 : 0,
        });
        try { s.setData(askData); } catch (e) { /* ignore */ }
        seriesList.push(s);
      }

      // Trade markers on the first bid series for this market
      const tradeRows = rows.filter(r => r.values?.[m.key]?.trade);
      if (tradeRows.length > 0 && seriesList.length > 0) {
        const seenTimes = new Set<number>();
        const markers = tradeRows
          .map(r => {
            const t = toTime(r.timestamp);
            if (seenTimes.has(t as number)) return null;
            seenTimes.add(t as number);
            const v = r.values[m.key];
            return {
              time: t,
              position: 'aboveBar' as const,
              color: v._is_own ? (v._successful === false ? '#f87171' : '#facc15') : '#60a5fa',
              shape: 'circle' as const,
              text: v._is_own ? 'T' : 't',
            };
          })
          .filter(Boolean) as any[];
        if (markers.length > 0) {
          try { seriesList[seriesList.length - 1].setMarkers(markers); } catch (e) { /* ignore */ }
        }
      }
    }

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [rows, markets]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />;
}
