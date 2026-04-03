import { useRef, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PricingRow } from '../types';

interface Props {
  rows: PricingRow[];
  loading: boolean;
  referenceTime?: string; // ISO timestamp of the trade; if set, Time column shows relative ms
  onRowClick?: (timestamp: string) => void;
  selectedTimestamp?: string | null;
}

const col = createColumnHelper<PricingRow>();

const fmt = (v: number | null, decimals = 8) =>
  v != null ? v.toFixed(decimals) : '';

function buildColumns(referenceTime?: string) {
  const refMs = referenceTime ? new Date(referenceTime).getTime() : null;

  return [
  col.accessor('timestamp', {
    header: refMs != null ? 'Δ sec' : 'Time',
    cell: info => {
      const v = info.getValue();
      if (!v) return '';
      if (refMs != null) {
        const deltaSec = (new Date(v).getTime() - refMs) / 1000;
        const sign = deltaSec >= 0 ? '+' : '';
        return `${sign}${deltaSec.toFixed(3)}`;
      }
      const d = new Date(v);
      return d.toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 as any });
    },
    size: refMs != null ? 80 : 100,
  }),
  col.accessor('slot', { header: 'Slot', cell: info => info.getValue() ?? '', size: 90 }),
  col.accessor('bid_price', { header: 'Bin Bid', cell: info => fmt(info.getValue(), 6), size: 80 }),
  col.accessor('bid_vol', { header: 'Bid Vol', cell: info => fmt(info.getValue(), 1), size: 70 }),
  col.accessor('ask_price', { header: 'Bin Ask', cell: info => fmt(info.getValue(), 6), size: 80 }),
  col.accessor('ask_vol', { header: 'Ask Vol', cell: info => fmt(info.getValue(), 1), size: 70 }),
  col.accessor('pool_price', { header: 'Pool Price', cell: info => fmt(info.getValue()), size: 100 }),
  col.accessor('fee_adj_bid', { header: 'Fee Bid', cell: info => fmt(info.getValue()), size: 100 }),
  col.accessor('fee_adj_ask', { header: 'Fee Ask', cell: info => fmt(info.getValue()), size: 100 }),
  col.accessor('bid_theo', { header: 'Theo Bid', cell: info => fmt(info.getValue()), size: 100 }),
  col.accessor('ask_theo', { header: 'Theo Ask', cell: info => fmt(info.getValue()), size: 100 }),
  col.accessor('pool_trade', {
    header: 'Pool Trade',
    cell: info => {
      const v = info.getValue();
      if (!v) return '';
      return <span style={{ color: v.startsWith('BUY') ? '#4ade80' : '#f87171' }}>{v}</span>;
    },
    size: 160,
  }),
  col.accessor('own_trade', {
    header: 'Own Trade',
    cell: info => {
      const v = info.getValue();
      if (!v) return '';
      const hasError = v.includes('[');
      return <span style={{ color: hasError ? '#f87171' : '#facc15', fontWeight: 600 }}>{v}</span>;
    },
    size: 180,
  }),
  ];
}

export function PricingTable({ rows, loading, referenceTime, onRowClick, selectedTimestamp }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => buildColumns(referenceTime), [referenceTime]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  if (loading) return <div style={{ padding: 16, color: '#8892a4' }}>Loading pricing data...</div>;

  return (
    <div ref={parentRef} style={{ overflow: 'auto', height: '100%', minHeight: 200 }}>
      <style>{`.pricing-row:hover { background: #1a2035 !important; }`}</style>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, width: 'max-content', minWidth: '100%' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(h => (
                <th key={h.id} style={{
                  ...styles.th, width: h.getSize(), minWidth: h.getSize(),
                }}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rowVirtualizer.getVirtualItems().length === 0 && (
            <tr><td colSpan={columns.length} style={{ padding: 16, color: '#8892a4' }}>No data</td></tr>
          )}
          <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}><td /></tr>
          {rowVirtualizer.getVirtualItems().map(vRow => {
            const row = table.getRowModel().rows[vRow.index];
            if (!row) return null;
            return (
              <tr
                key={row.id}
                className="pricing-row"
                style={{
                  height: 24,
                  cursor: onRowClick ? 'pointer' : undefined,
                  background: selectedTimestamp && row.original.timestamp === selectedTimestamp ? '#1e2a45' : undefined,
                }}
                onClick={() => onRowClick?.(row.original.timestamp)}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={styles.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
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
  );
}

const styles = {
  th: {
    textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #2d3548',
    color: '#8892a4', fontWeight: 600, background: '#0d1117', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '2px 8px', borderBottom: '1px solid #151a28',
    whiteSpace: 'nowrap' as const, fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
};
