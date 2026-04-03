import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  hostname: string;
  value: string;
  onChange: (pair: string) => void;
}

export function PairSelector({ hostname, value, onChange }: Props) {
  const [pairs, setPairs] = useState<string[]>([]);

  useEffect(() => {
    if (!hostname) return;
    api.getPairs(hostname).then(setPairs).catch(console.error);
  }, [hostname]);

  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={styles.select}>
      <option value="">Select pair...</option>
      {pairs.map(p => <option key={p} value={p}>{p}</option>)}
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
