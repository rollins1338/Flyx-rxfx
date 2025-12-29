/**
 * Provider Tabs Component
 * Main provider selection tabs (DLHD, CDN Live, PPV, Streamed)
 */

import { memo } from 'react';
import styles from '../LiveTV.module.css';

export type Provider = 'dlhd' | 'cdnlive' | 'ppv' | 'streamed';

interface ProviderTabsProps {
  selectedProvider: Provider;
  onProviderChange: (provider: Provider) => void;
  stats: {
    dlhd: { events: number; channels: number };
    cdnlive: { channels: number };
    ppv: { events: number };
    streamed: { events: number };
  };
  loading?: boolean;
}

const PROVIDERS: Array<{
  id: Provider;
  label: string;
  icon: string;
}> = [
  { id: 'dlhd', label: 'DaddyLive HD', icon: '📡' },
  { id: 'cdnlive', label: 'CDN Live', icon: '🌐' },
  { id: 'ppv', label: 'PPV', icon: '🥊' },
  { id: 'streamed', label: 'Streamed', icon: '🎬' },
];

export const ProviderTabs = memo(function ProviderTabs({
  selectedProvider,
  onProviderChange,
  stats,
  loading = false,
}: ProviderTabsProps) {
  const getCount = (id: Provider): number => {
    switch (id) {
      case 'dlhd':
        return stats.dlhd.events + stats.dlhd.channels;
      case 'cdnlive':
        return stats.cdnlive.channels;
      case 'ppv':
        return stats.ppv.events;
      case 'streamed':
        return stats.streamed.events;
      default:
        return 0;
    }
  };

  return (
    <div className={styles.providerTabs}>
      {PROVIDERS.map(({ id, label, icon }) => {
        const count = getCount(id);
        const isActive = selectedProvider === id;
        
        return (
          <button
            key={id}
            onClick={() => onProviderChange(id)}
            className={`${styles.providerTab} ${isActive ? styles.active : ''}`}
            disabled={loading}
          >
            <span className={styles.providerIcon}>{icon}</span>
            <div className={styles.providerInfo}>
              <span className={styles.providerLabel}>{label}</span>
              <span className={styles.providerDesc}>
                {loading ? '...' : `${count} items`}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
});
