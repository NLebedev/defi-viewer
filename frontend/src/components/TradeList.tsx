import { useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import type { Trade } from '../types';
import { PairSelector } from './PairSelector';
import { TimeRangeSelector } from './TimeRangeSelector';
import { useTrades } from '../hooks/useTrades';

interface Props {
  hostname: string;
  onTradeSelect: (trade: Trade) => void;
}

const col = createColumnHelper<Trade>();

const columns = [
  col.accessor('timestamp', {
    header: 'Time',
    cell: info => {
      const v = info.getValue();
      if (!v) return '';
      const d = new Date(v);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) + ' ' +
        d.toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 as any });
    },
    size: 140,
  }),
  col.accessor('pair_display', { header: 'Pair', size: 140 }),
  col.accessor('market', { header: 'Market', size: 120 }),
  col.accessor('successful', {
    header: 'Success',
    cell: info => {
      const v = info.getValue();
      return <span style={{ color: v ? '#4ade80' : '#f87171' }}>{v ? 'YES' : 'NO'}</span>;
    },
    size: 60,
  }),
  col.accessor('error_reason', { header: 'Error', size: 160 }),
  col.accessor('side', { header: 'Side', size: 50 }),
  col.accessor('slot_delay', { header: 'Slot Delay', size: 70 }),
  col.accessor('provider', { header: 'Provider', size: 90 }),
  col.accessor('strategy_id', {
    header: 'Strategy',
    cell: info => {
      const v = info.getValue();
      return v ? v.substring(0, 8) + '...' : '';
    },
    size: 100,
  }),
];

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function TradeList({ hostname, onTradeSelect }: Props) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [pair, setPair] = useState('');
  const [start, setStart] = useState(toLocalDatetime(yesterday));
  const [end, setEnd] = useState(toLocalDatetime(now));
  const [successFilter, setSuccessFilter] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const { trades, loading, error, fetchTrades } = useTrades();

  const handleLoad = () => {
    if (!hostname || !start || !end) return;
    const startISO = new Date(start).toISOString();
    const endISO = new Date(end).toISOString();
    fetchTrades({
      hostname,
      start: startISO,
      end: endISO,
      pair: pair || undefined,
      successful: successFilter || undefined,
    });
  };

  // Auto-load last 24h on mount when hostname is set
  useEffect(() => {
    if (hostname) handleLoad();
  }, [hostname]);

  const table = useReactTable({
    data: trades,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <PairSelector hostname={hostname} value={pair} onChange={setPair} />
        <TimeRangeSelector start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <select
          value={successFilter}
          onChange={e => setSuccessFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">All</option>
          <option value="true">Successful</option>
          <option value="false">Failed</option>
        </select>
        <button onClick={handleLoad} disabled={loading} style={styles.button}>
          {loading ? 'Loading...' : 'Load Trades'}
        </button>
        <span style={{ color: '#8892a4', fontSize: 11 }}>
          {trades.length > 0 && `${trades.length} trades`}
        </span>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}

      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
        <table style={styles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{
                      ...styles.th,
                      width: h.getSize(),
                      cursor: h.column.getCanSort() ? 'pointer' : 'default',
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                onClick={() => onTradeSelect(row.original)}
                style={styles.tr}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a2035')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={styles.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  select: {
    background: '#1a1f2e', color: '#e0e6ed', border: '1px solid #2d3548',
    borderRadius: 4, padding: '4px 8px', fontSize: 12,
  } as React.CSSProperties,
  button: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4,
    padding: '5px 14px', fontSize: 12, cursor: 'pointer',
  } as React.CSSProperties,
  table: {
    width: '100%', borderCollapse: 'collapse' as const, fontSize: 11,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #2d3548',
    color: '#8892a4', fontWeight: 600, position: 'sticky' as const, top: 0,
    background: '#0a0e17', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '4px 8px', borderBottom: '1px solid #151a28',
    whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
    maxWidth: 200,
  } as React.CSSProperties,
  tr: { cursor: 'pointer' } as React.CSSProperties,
};
