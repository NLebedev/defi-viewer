import { useState } from 'react';
import { PairSelector } from './PairSelector';
import { TimeRangeSelector } from './TimeRangeSelector';
import { PricingTable } from './PricingTable';
import { RawLogPanel } from './RawLogPanel';
import { GraphPanel } from './GraphPanel';
import { usePricingData } from '../hooks/usePricingData';
import { useLogData } from '../hooks/useLogData';

interface Props {
  hostname: string;
}

export function BrowseView({ hostname }: Props) {
  const [pair, setPair] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const { rows, markets, loading: pricingLoading, fetchPricing } = usePricingData();
  const { logs, loading: logsLoading, fetchLogs } = useLogData();

  const handleLoad = () => {
    if (!hostname || !pair || !start || !end) return;
    const startISO = new Date(start).toISOString();
    const endISO = new Date(end).toISOString();
    fetchPricing({ hostname, pair, start: startISO, end: endISO });
    fetchLogs({ hostname, pair, start: startISO, end: endISO });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 50px)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #2d3548', flexWrap: 'wrap' }}>
        <PairSelector hostname={hostname} value={pair} onChange={setPair} />
        <TimeRangeSelector start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button onClick={handleLoad} disabled={pricingLoading} style={styles.button}>
          {pricingLoading ? 'Loading...' : 'Load Data'}
        </button>
        {rows.length > 0 && <span style={{ color: '#8892a4', fontSize: 11 }}>{rows.length} rows</span>}
      </div>

      <div style={{ flex: 2, borderBottom: '1px solid #2d3548', overflow: 'hidden' }}>
        <PricingTable rows={rows} markets={markets} loading={pricingLoading} />
      </div>

      <div style={{ flex: 1, borderBottom: '1px solid #2d3548', minHeight: 200 }}>
        <GraphPanel rows={rows} markets={markets} />
      </div>

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 150 }}>
        <RawLogPanel logs={logs} loading={logsLoading} />
      </div>
    </div>
  );
}

const styles = {
  button: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4,
    padding: '5px 14px', fontSize: 12, cursor: 'pointer',
  } as React.CSSProperties,
};
