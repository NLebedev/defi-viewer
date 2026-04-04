import { useRef, useMemo, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PricingRow, MarketInfo, MarketValues } from '../types';

interface Props {
  rows: PricingRow[];
  markets: MarketInfo[];
  loading: boolean;
  referenceTime?: string;
  onRowClick?: (timestamp: string) => void;
  selectedTimestamp?: string | null;
}

const fmt = (v: number | null | undefined, decimals = 8) =>
  v != null ? v.toFixed(decimals) : '';

function getDecimals(market: string): number {
  if (market.includes('BINANCE')) return 6;
  return 8;
}

interface FlatRow {
  timestamp: string;
  slot: number | null;
  tag: string;
  cells: Record<string, MarketValues>;
}

function computeChangesOnly(rows: FlatRow[], marketKeys: string[]): FlatRow[] {
  if (rows.length === 0) return rows;
  const result: FlatRow[] = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const sparse: FlatRow = { timestamp: cur.timestamp, slot: cur.slot !== prev.slot ? cur.slot : null, tag: cur.tag, cells: {} };
    for (const mk of marketKeys) {
      const pc = prev.cells[mk] || {};
      const cc = cur.cells[mk] || {};
      const diff: MarketValues = {};
      let hasDiff = false;
      for (const k of ['bid_vol', 'bid_price', 'ask_price', 'ask_vol', 'trade'] as const) {
        if (cc[k] !== undefined && cc[k] !== null && cc[k] !== pc[k]) {
          (diff as any)[k] = cc[k];
          hasDiff = true;
          if (k === 'trade') {
            diff._is_own = cc._is_own;
            diff._successful = cc._successful;
          }
        }
      }
      if (hasDiff) sparse.cells[mk] = diff;
    }
    result.push(sparse);
  }
  return result;
}

export function PricingTable({ rows, markets, loading, referenceTime, onRowClick, selectedTimestamp }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showChangesOnly, setShowChangesOnly] = useState(true);
  const [hiddenMarkets, setHiddenMarkets] = useState<Set<string>>(new Set());

  const visibleMarkets = useMemo(
    () => markets.filter(m => !hiddenMarkets.has(m.key)),
    [markets, hiddenMarkets]
  );

  const refMs = referenceTime ? new Date(referenceTime).getTime() : null;

  // Flatten rows for display
  const flatRows: FlatRow[] = useMemo(() =>
    rows.map(r => ({
      timestamp: r.timestamp,
      slot: r.slot,
      tag: (r as any).tag || '',
      cells: r.values || {},
    })),
    [rows]
  );

  const visibleKeys = useMemo(() => visibleMarkets.map(m => m.key), [visibleMarkets]);

  const displayRows = useMemo(
    () => showChangesOnly ? computeChangesOnly(flatRows, visibleKeys) : flatRows,
    [flatRows, showChangesOnly, visibleKeys]
  );

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  useEffect(() => {
    if (!selectedTimestamp) return;
    const idx = displayRows.findIndex(r => r.timestamp === selectedTimestamp);
    if (idx >= 0) {
      rowVirtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
    }
  }, [selectedTimestamp]);

  const toggleMarket = (key: string) => {
    setHiddenMarkets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) return <div style={{ padding: 16, color: '#8892a4' }}>Loading pricing data...</div>;

  // Sub-columns per market: bid_vol, bid_price, ask_price, ask_vol, trade
  const subCols = ['bid_vol', 'bid_price', 'ask_price', 'ask_vol', 'trade'] as const;
  const subHeaders = ['Bid Vol', 'Bid', 'Ask', 'Ask Vol', 'Trade'];
  const subWidths = [65, 80, 80, 65, 120];

  const totalCols = 3 + visibleMarkets.length * subCols.length; // time + slot + tag + markets

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Market filter bar */}
      <div style={{ display: 'flex', gap: 8, padding: '4px 8px', alignItems: 'center', borderBottom: '1px solid #1a1f2e', flexShrink: 0, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, color: '#8892a4', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showChangesOnly}
            onChange={e => setShowChangesOnly(e.target.checked)}
            style={{ accentColor: '#2563eb' }}
          />
          Changes only
        </label>
        <span style={{ color: '#2d3548' }}>|</span>
        {markets.map(m => (
          <label key={m.key} style={{ fontSize: 10, color: hiddenMarkets.has(m.key) ? '#4a5168' : '#e0e6ed', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!hiddenMarkets.has(m.key)}
              onChange={() => toggleMarket(m.key)}
              style={{ accentColor: '#2563eb' }}
            />
            {m.display}
          </label>
        ))}
      </div>

      <div ref={parentRef} style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <style>{`.pricing-row:hover { background: #1a2035 !important; }`}</style>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, tableLayout: 'fixed', width: (80 + 75 + 140 + visibleMarkets.length * subWidths.reduce((a, b) => a + b, 0)) }}>
          {/* Two-level header: market group + sub-columns */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            {/* Top header: Time, Slot, then market groups */}
            <tr>
              <th rowSpan={2} style={{ ...styles.th, width: 80, minWidth: 80, position: 'sticky', left: 0, zIndex: 3, background: '#0d1117', borderRight: '1px solid #2d3548' }}>
                {refMs != null ? 'Δ sec' : 'Time'}
              </th>
              <th rowSpan={2} style={{ ...styles.th, width: 75, minWidth: 75, position: 'sticky', left: 80, zIndex: 3, background: '#0d1117', borderRight: '1px solid #2d3548', boxShadow: '2px 0 4px rgba(0,0,0,0.5)' }}>
                Slot
              </th>
              <th rowSpan={2} style={{ ...styles.th, width: 140, minWidth: 140, borderRight: '1px solid #2d3548' }}>
                Tag
              </th>
              {visibleMarkets.map(m => (
                <th
                  key={m.key}
                  colSpan={subCols.length}
                  style={{
                    ...styles.th,
                    textAlign: 'center',
                    borderRight: '1px solid #2d3548',
                    borderBottom: 'none',
                    color: m.market === 'THEO' ? '#a78bfa' : m.market.includes('BINANCE') ? '#60a5fa' : '#34d399',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {m.display}
                </th>
              ))}
            </tr>
            {/* Sub-headers */}
            <tr>
              {visibleMarkets.map(m => (
                subCols.map((sc, si) => (
                  <th
                    key={`${m.key}-${sc}`}
                    style={{
                      ...styles.th,
                      width: subWidths[si],
                      minWidth: subWidths[si],
                      textAlign: 'center',
                      borderRight: si === subCols.length - 1 ? '1px solid #2d3548' : undefined,
                      color: sc.startsWith('bid') ? '#4ade80' : sc.startsWith('ask') ? '#f87171' : '#8892a4',
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {subHeaders[si]}
                  </th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().length === 0 && (
              <tr><td colSpan={totalCols} style={{ padding: 16, color: '#8892a4' }}>No data</td></tr>
            )}
            <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}><td /></tr>
            {rowVirtualizer.getVirtualItems().map(vRow => {
              const row = displayRows[vRow.index];
              if (!row) return null;
              const isSelected = selectedTimestamp && row.timestamp === selectedTimestamp;
              return (
                <tr
                  key={vRow.index}
                  className="pricing-row"
                  style={{
                    height: 24,
                    cursor: onRowClick ? 'pointer' : undefined,
                    background: isSelected ? '#1e2a45' : undefined,
                  }}
                  onClick={() => onRowClick?.(row.timestamp)}
                >
                  {/* Time */}
                  <td style={{ ...styles.td, width: 80, minWidth: 80, maxWidth: 80, overflow: 'hidden', position: 'sticky', left: 0, zIndex: 1, background: isSelected ? '#1e2a45' : '#0a0e17', borderRight: '1px solid #1a1f2e' }}>
                    {refMs != null
                      ? (() => { const d = (new Date(row.timestamp).getTime() - refMs) / 1000; return `${d >= 0 ? '+' : ''}${d.toFixed(3)}`; })()
                      : new Date(row.timestamp).toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 as any })
                    }
                  </td>
                  {/* Slot */}
                  <td style={{ ...styles.td, width: 75, minWidth: 75, maxWidth: 75, overflow: 'hidden', position: 'sticky', left: 80, zIndex: 1, background: isSelected ? '#1e2a45' : '#0a0e17', borderRight: '1px solid #1a1f2e', boxShadow: '2px 0 4px rgba(0,0,0,0.5)' }}>
                    {row.slot ?? ''}
                  </td>
                  {/* Tag */}
                  <td style={{ ...styles.td, width: 140, minWidth: 140, maxWidth: 140, borderRight: '1px solid #1a1f2e', overflow: 'hidden', color: '#60a5fa', fontSize: 10 }}>
                    {row.tag}
                  </td>
                  {/* Market sub-columns */}
                  {visibleMarkets.map(m => {
                    const vals = row.cells[m.key] || {};
                    const dec = getDecimals(m.market);
                    return subCols.map((sc, si) => {
                      let content: React.ReactNode = '';
                      const isLast = si === subCols.length - 1;
                      if (sc === 'trade') {
                        const t = vals.trade;
                        if (t) {
                          const isOwn = vals._is_own;
                          const color = isOwn ? (vals._successful === false ? '#f87171' : '#facc15') : t.startsWith('BUY') || t.startsWith('SELL') ? '#60a5fa' : '#8892a4';
                          content = <span style={{ color, fontWeight: isOwn ? 700 : 400 }}>{t}</span>;
                        }
                      } else {
                        const v = vals[sc];
                        if (v != null) {
                          const color = sc.startsWith('bid') ? '#4ade80' : '#f87171';
                          const d = sc.includes('vol') ? 1 : dec;
                          content = <span style={{ color }}>{fmt(v as number, d)}</span>;
                        }
                      }
                      return (
                        <td key={`${m.key}-${sc}`} style={{
                          ...styles.td,
                          width: subWidths[si],
                          minWidth: subWidths[si],
                          maxWidth: subWidths[si],
                          textAlign: 'right',
                          overflow: 'hidden',
                          borderRight: isLast ? '1px solid #1a1f2e' : undefined,
                        }}>
                          {content}
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
            <tr style={{
              height: rowVirtualizer.getTotalSize() -
                (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
            }}><td /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  th: {
    textAlign: 'left' as const, padding: '4px 6px', borderBottom: '1px solid #2d3548',
    color: '#8892a4', fontWeight: 600, background: '#0d1117', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '2px 6px', borderBottom: '1px solid #151a28',
    whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
};
