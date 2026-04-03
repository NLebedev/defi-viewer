import { useState } from 'react';
import { HostnameSelector } from './components/HostnameSelector';
import { TradeList } from './components/TradeList';
import { TradeDetail } from './components/TradeDetail';
import { BrowseView } from './components/BrowseView';
import type { Trade } from './types';

type Tab = 'trades' | 'analysis' | 'browse';

export default function App() {
  const [hostname, setHostname] = useState('PROD-DEFI-CEXDEX-SOLANA-1');
  const [activeTab, setActiveTab] = useState<Tab>('trades');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const handleTradeSelect = (trade: Trade) => {
    setSelectedTrade(trade);
    setActiveTab('analysis');
  };

  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: 'trades', label: 'Trades', enabled: true },
    { key: 'analysis', label: selectedTrade ? `Analysis: ${selectedTrade.pair_display}` : 'Analysis', enabled: !!selectedTrade },
    { key: 'browse', label: 'Browse', enabled: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#60a5fa' }}>CEX-DEX Viewer</span>
        <HostnameSelector value={hostname} onChange={setHostname} />
        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.activeTab : {}),
                ...(!tab.enabled ? styles.disabledTab : {}),
              }}
            >
              {tab.label}
              {tab.key === 'analysis' && selectedTrade && (
                <span
                  onClick={e => { e.stopPropagation(); setSelectedTrade(null); if (activeTab === 'analysis') setActiveTab('trades'); }}
                  style={styles.closeBtn}
                  title="Close analysis"
                >
                  x
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'trades' && (
          <TradeList hostname={hostname} onTradeSelect={handleTradeSelect} />
        )}
        {activeTab === 'analysis' && selectedTrade && (
          <TradeDetail trade={selectedTrade} hostname={hostname} />
        )}
        {activeTab === 'browse' && (
          <BrowseView hostname={hostname} />
        )}
      </div>
    </div>
  );
}

const styles = {
  topBar: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid #2d3548',
    background: '#0d1117',
    flexShrink: 0,
  } as React.CSSProperties,
  tab: {
    background: 'transparent',
    color: '#8892a4',
    border: '1px solid transparent',
    borderRadius: '4px 4px 0 0',
    padding: '5px 14px',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,
  activeTab: {
    color: '#e0e6ed',
    borderColor: '#2d3548',
    borderBottomColor: '#0a0e17',
    background: '#1a1f2e',
  } as React.CSSProperties,
  disabledTab: {
    color: '#4a5168',
    cursor: 'default',
  } as React.CSSProperties,
  closeBtn: {
    color: '#8892a4',
    fontSize: 10,
    cursor: 'pointer',
    padding: '0 2px',
    borderRadius: 2,
    lineHeight: 1,
  } as React.CSSProperties,
};
