import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { PricingRow } from '../types';

interface Props {
  rows: PricingRow[];
}

function toTime(ts: string): UTCTimestamp {
  return (new Date(ts).getTime() / 1000) as UTCTimestamp;
}

/** Deduplicate by time: keep last value for each second (Lightweight Charts requires unique ascending times). */
function dedupeByTime(data: { time: UTCTimestamp; value: number }[]): { time: UTCTimestamp; value: number }[] {
  if (data.length === 0) return data;
  const map = new Map<number, number>();
  for (const d of data) {
    map.set(d.time as number, d.value);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export function GraphPanel({ rows }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || rows.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0d1117' }, textColor: '#8892a4', fontSize: 10 },
      grid: { vertLines: { color: '#1a1f2e' }, horzLines: { color: '#1a1f2e' } },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, secondsVisible: true },
      rightPriceScale: { borderColor: '#2d3548' },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    const bidLine = chart.addLineSeries({ color: '#4ade80', lineWidth: 1, title: 'Bin Bid' });
    const askLine = chart.addLineSeries({ color: '#f87171', lineWidth: 1, title: 'Bin Ask' });
    const poolLine = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1, title: 'Pool' });
    const feeBidLine = chart.addLineSeries({ color: '#34d399', lineWidth: 1, lineStyle: 2, title: 'Fee Bid' });
    const feeAskLine = chart.addLineSeries({ color: '#fb923c', lineWidth: 1, lineStyle: 2, title: 'Fee Ask' });
    const theoBidLine = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1, title: 'Theo Bid' });
    const theoAskLine = chart.addLineSeries({ color: '#f472b6', lineWidth: 1, title: 'Theo Ask' });

    const setData = (series: ISeriesApi<any>, key: keyof PricingRow) => {
      const raw = rows
        .filter(r => r[key] != null && r.timestamp)
        .map(r => ({ time: toTime(r.timestamp), value: r[key] as number }));
      const data = dedupeByTime(raw);
      if (data.length > 0) {
        try {
          series.setData(data);
        } catch (e) {
          console.warn(`GraphPanel: failed to set ${key} data`, e);
        }
      }
    };

    setData(bidLine, 'bid_price');
    setData(askLine, 'ask_price');
    setData(poolLine, 'pool_price');
    setData(feeBidLine, 'fee_adj_bid');
    setData(feeAskLine, 'fee_adj_ask');
    setData(theoBidLine, 'bid_theo');
    setData(theoAskLine, 'ask_theo');

    // Add trade markers (also deduped by time)
    const markersRaw = rows
      .filter(r => r.own_trade)
      .map(r => ({
        time: toTime(r.timestamp),
        position: 'aboveBar' as const,
        color: r.own_trade!.includes('[') ? '#f87171' : '#facc15',
        shape: 'circle' as const,
        text: 'T',
      }));
    const seenMarkerTimes = new Set<number>();
    const markers = markersRaw.filter(m => {
      if (seenMarkerTimes.has(m.time as number)) return false;
      seenMarkerTimes.add(m.time as number);
      return true;
    });
    if (markers.length > 0) {
      try { bidLine.setMarkers(markers); } catch (e) { /* ignore */ }
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
  }, [rows]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />;
}
