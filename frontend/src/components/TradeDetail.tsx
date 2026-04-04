import { useEffect, useState, useRef, useCallback } from 'react';
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

const STORAGE_KEY = 'cexdex-viewer-pane-sizes';
const DEFAULT_SIZES = [0.45, 0.25, 0.30]; // pricing, graph, logs

function loadSizes(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((n: any) => typeof n === 'number')) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_SIZES;
}

function saveSizes(sizes: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
}

function ResizeHandle({ onDrag }: { onDrag: (deltaY: number) => void }) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const onMouseMove = (ev: MouseEvent) => {
      onDrag(ev.clientY - startY);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        height: 5,
        cursor: 'row-resize',
        background: '#2d3548',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 30, height: 3, borderRadius: 2, background: '#4a5168',
      }} />
    </div>
  );
}

export function TradeDetail({ trade, hostname }: Props) {
  const { rows, markets, loading: pricingLoading, fetchPricing } = usePricingData();
  const { logs, loading: logsLoading, fetchLogs } = useLogData();
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [sizes, setSizes] = useState(loadSizes);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;

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

  const makeResizer = (index: number) => {
    // index=0: handle between pane 0 and 1
    // index=1: handle between pane 1 and 2
    let startSizes: number[] | null = null;
    return (deltaY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const totalHeight = container.clientHeight - 10; // minus 2 handles
      if (!startSizes) {
        startSizes = [...sizesRef.current];
        // Reset on next frame if delta is 0
      }
      const deltaFrac = deltaY / totalHeight;
      const newSizes = [...startSizes];
      const minSize = 0.08;

      newSizes[index] = Math.max(minSize, startSizes[index] + deltaFrac);
      newSizes[index + 1] = Math.max(minSize, startSizes[index + 1] - deltaFrac);

      // Normalize
      const total = newSizes.reduce((a, b) => a + b, 0);
      for (let i = 0; i < newSizes.length; i++) newSizes[i] /= total;

      setSizes(newSizes);
      saveSizes(newSizes);
    };
  };

  // We need stable references for resizers, but they need access to current sizes on mousedown
  // The trick: on mousedown we snapshot sizes; on mousemove we apply delta from snapshot
  const [resizer0] = useState(() => {
    let snapshot: number[] | null = null;
    return (deltaY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const totalHeight = container.clientHeight - 10;
      if (deltaY === 0) {
        // This is actually never called with 0 during drag, but reset on new drag
      }
      if (!snapshot || Math.abs(deltaY) < 2) {
        snapshot = [...sizesRef.current];
      }
      const deltaFrac = deltaY / totalHeight;
      const newSizes = [...snapshot];
      newSizes[0] = Math.max(0.08, snapshot[0] + deltaFrac);
      newSizes[1] = Math.max(0.08, snapshot[1] - deltaFrac);
      const total = newSizes.reduce((a, b) => a + b, 0);
      for (let i = 0; i < newSizes.length; i++) newSizes[i] /= total;
      setSizes(newSizes);
      saveSizes(newSizes);
    };
  });

  const [resizer1] = useState(() => {
    let snapshot: number[] | null = null;
    return (deltaY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const totalHeight = container.clientHeight - 10;
      if (!snapshot || Math.abs(deltaY) < 2) {
        snapshot = [...sizesRef.current];
      }
      const deltaFrac = deltaY / totalHeight;
      const newSizes = [...snapshot];
      newSizes[1] = Math.max(0.08, snapshot[1] + deltaFrac);
      newSizes[2] = Math.max(0.08, snapshot[2] - deltaFrac);
      const total = newSizes.reduce((a, b) => a + b, 0);
      for (let i = 0; i < newSizes.length; i++) newSizes[i] /= total;
      setSizes(newSizes);
      saveSizes(newSizes);
    };
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
      <div style={{ height: `${sizes[0] * 100}%`, overflow: 'hidden', flexShrink: 0 }}>
        <PricingTable rows={rows} markets={markets} loading={pricingLoading} referenceTime={trade.timestamp} onRowClick={ts => setSelectedTimestamp(ts)} selectedTimestamp={selectedTimestamp} />
      </div>

      <ResizeHandle onDrag={resizer0} />

      {/* Graph Panel */}
      <div style={{ height: `${sizes[1] * 100}%`, overflow: 'hidden', flexShrink: 0 }}>
        <GraphPanel rows={rows} markets={markets} />
      </div>

      <ResizeHandle onDrag={resizer1} />

      {/* Raw Log Panel */}
      <div style={{ height: `${sizes[2] * 100}%`, overflow: 'hidden', flexShrink: 0 }}>
        <RawLogPanel logs={logs} loading={logsLoading} selectedTimestamp={selectedTimestamp} referenceTime={trade.timestamp} onLogClick={ts => {
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
    flexShrink: 0,
  } as React.CSSProperties,
};
