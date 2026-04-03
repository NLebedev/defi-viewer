import { useEffect, useState } from 'react';
import type { Trade } from '../types';
import { PricingTable } from './PricingTable';
import { RawLogPanel } from './RawLogPanel';
import { GraphPanel } from './GraphPanel';
import { usePricingData } from '../hooks/usePricingData';
import { useLogData } from '../hooks/useLogData';

interface Props {
  trade: Trade;
  hostname: string;
}

export function TradeDetail({ trade, hostname }: Props) {
  const { rows, markets, loading: pricingLoading, fetchPricing } = usePricingData();
  const { logs, loading: logsLoading, fetchLogs } = useLogData();
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const ts = new Date(trade.timestamp);
    const start = new Date(ts.getTime() - 30000).toISOString();
    const end = new Date(ts.getTime() + 30000).toISOString();
    const pair = trade.pair_display || trade.pair;

    if (hostname && pair) {
      fetchPricing({ hostname, pair, start, end });
      fetchLogs({ hostname, pair, start, end });
    }
  }, [trade, hostname]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{trade.pair_display}</span>
        <span style={{ color: trade.successful ? '#4ade80' : '#f87171' }}>
          {trade.successful ? 'SUCCESS' : 'FAILED'}
        </span>
        {trade.error_reason && <span style={{ color: '#f87171' }}>[{trade.error_reason}]</span>}
        <span style={{ color: '#8892a4' }}>
          {new Date(trade.timestamp).toLocaleString('en-GB', { hour12: false })}
        </span>
        <span style={{ color: '#8892a4' }}>Slot: {trade.slot}</span>
        {trade.provider && <span style={{ color: '#a78bfa' }}>{trade.provider}</span>}
        <span style={{ color: '#8892a4', fontSize: 10 }}>{rows.length} pricing rows</span>
      </div>

      {/* Pricing Table */}
      <div style={{ flex: 2, borderBottom: '1px solid #2d3548', overflow: 'hidden' }}>
        <PricingTable rows={rows} markets={markets} loading={pricingLoading} referenceTime={trade.timestamp} onRowClick={ts => setSelectedTimestamp(ts)} selectedTimestamp={selectedTimestamp} />
      </div>

      {/* Graph Panel */}
      <div style={{ flex: 1, borderBottom: '1px solid #2d3548', minHeight: 200 }}>
        <GraphPanel rows={rows} markets={markets} />
      </div>

      {/* Raw Log Panel */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 150 }}>
        <RawLogPanel logs={logs} loading={logsLoading} selectedTimestamp={selectedTimestamp} referenceTime={trade.timestamp} onLogClick={ts => {
          // Find the closest pricing row to this log timestamp
          if (rows.length === 0) return;
          const logMs = new Date(ts).getTime();
          let closest = rows[0].timestamp;
          let minDiff = Infinity;
          for (const r of rows) {
            const diff = Math.abs(new Date(r.timestamp).getTime() - logMs);
            if (diff < minDiff) { minDiff = diff; closest = r.timestamp; }
          }
          setSelectedTimestamp(closest);
        }} />
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex', gap: 12, alignItems: 'center', padding: '8px 16px',
    borderBottom: '1px solid #2d3548', fontSize: 12, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
};
