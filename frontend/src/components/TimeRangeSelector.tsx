interface Props {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

export function TimeRangeSelector({ start, end, onStartChange, onEndChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label style={styles.label}>From:</label>
      <input
        type="datetime-local"
        value={start}
        onChange={e => onStartChange(e.target.value)}
        step="1"
        style={styles.input}
      />
      <label style={styles.label}>To:</label>
      <input
        type="datetime-local"
        value={end}
        onChange={e => onEndChange(e.target.value)}
        step="1"
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  label: { color: '#8892a4', fontSize: 11 } as React.CSSProperties,
  input: {
    background: '#1a1f2e',
    color: '#e0e6ed',
    border: '1px solid #2d3548',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
  } as React.CSSProperties,
};
