import { useState, useEffect, useRef } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs: LogEntry[];
  loading: boolean;
  selectedTimestamp?: string | null;
}

export function RawLogPanel({ logs, loading, selectedTimestamp }: Props) {
  const [tagFilter, setTagFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  const tags = [...new Set(logs.map(l => l.tag).filter(Boolean))].sort();

  const filtered = logs.filter(l => {
    if (tagFilter && l.tag !== tagFilter) return false;
    if (searchFilter && !l.message.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // Find logs closest to the selected pricing row timestamp
  const selectedMs = selectedTimestamp ? new Date(selectedTimestamp).getTime() : null;
  const isSelected = (log: LogEntry) => {
    if (!selectedMs) return false;
    const logMs = new Date(log.timestamp).getTime();
    return Math.abs(logMs - selectedMs) < 2; // within 2ms
  };

  // Scroll to first highlighted log when selection changes
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedTimestamp]);

  if (loading) return <div style={{ padding: 16, color: '#8892a4' }}>Loading logs...</div>;

  let firstHighlightSet = false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid #2d3548' }}>
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={styles.select}>
          <option value="">All tags</option>
          {tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search messages..."
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          style={styles.input}
        />
        <span style={{ color: '#8892a4', fontSize: 10, alignSelf: 'center' }}>
          {filtered.length} / {logs.length}
        </span>
      </div>
      <div ref={scrollRef} style={{ overflow: 'auto', flex: 1, fontSize: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Pair</th>
              <th style={styles.th}>Market</th>
              <th style={styles.th}>Tag</th>
              <th style={styles.th}>Level</th>
              <th style={{ ...styles.th, width: '100%' }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log, i) => {
              const highlighted = isSelected(log);
              const setRef = highlighted && !firstHighlightSet;
              if (setRef) firstHighlightSet = true;
              return (
                <tr
                  key={i}
                  ref={setRef ? highlightRef : undefined}
                  style={{ background: highlighted ? '#1e2a45' : undefined }}
                >
                  <td style={styles.td}>
                    {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 as any })}
                  </td>
                  <td style={{ ...styles.td, color: '#a78bfa' }}>{log.pair}</td>
                  <td style={styles.td}>{log.market}</td>
                  <td style={{ ...styles.td, color: '#60a5fa' }}>{log.tag}</td>
                  <td style={styles.td}>{log.loglevel}</td>
                  <td style={{ ...styles.td, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 600 }}>
                    {log.message}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  select: {
    background: '#1a1f2e', color: '#e0e6ed', border: '1px solid #2d3548',
    borderRadius: 4, padding: '3px 6px', fontSize: 11,
  } as React.CSSProperties,
  input: {
    background: '#1a1f2e', color: '#e0e6ed', border: '1px solid #2d3548',
    borderRadius: 4, padding: '3px 8px', fontSize: 11, flex: 1,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '4px 6px', borderBottom: '1px solid #2d3548',
    color: '#8892a4', fontWeight: 600, background: '#0d1117', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '2px 6px', borderBottom: '1px solid #151a28',
    whiteSpace: 'nowrap' as const, verticalAlign: 'top',
  } as React.CSSProperties,
};
