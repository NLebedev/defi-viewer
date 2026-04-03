import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  value: string;
  onChange: (hostname: string) => void;
}

export function HostnameSelector({ value, onChange }: Props) {
  const [hostnames, setHostnames] = useState<string[]>([]);

  useEffect(() => {
    api.getHostnames().then(setHostnames).catch(console.error);
  }, []);

  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={styles.select}>
      <option value="">Select hostname...</option>
      {hostnames.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  );
}

const styles = {
  select: {
    background: '#1a1f2e',
    color: '#e0e6ed',
    border: '1px solid #2d3548',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
  } as React.CSSProperties,
};
