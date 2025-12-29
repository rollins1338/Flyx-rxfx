/**
 * Source Tabs Component
 * Simple horizontal tabs for source selection
 */

import { memo } from 'react';
import styles from '../LiveTV.module.css';

interface SourceTabsProps {
  selectedSource: 'all' | 'channels' | 'dlhd' | 'ppv' | 'cdnlive' | 'streamed';
  onSourceChange: (source: 'all' | 'channels' | 'dlhd' | 'ppv' | 'cdnlive' | 'streamed') => void;
  stats: {
    total: number;
    sources: {
      channels: number;
      dlhd: number;
      ppv: number;
      cdnlive: number;
      streamed: number;
    };
  };
}

const SOURCES = [
  { id: 'all', label: 'All', icon: '📺' },
  { id: 'channels', label: 'TV Channels', icon: '📡' },
  { id: 'dlhd', label: 'Events', icon: '🏟️' },
  { id: 'ppv', label: 'PPV', icon: '🥊' },
  { id: 'cdnlive', label: 'CDN', icon: '🌐' },
  { id: 'streamed', label: 'Streamed', icon: '🎬' },
] as const;

export const SourceTabs = memo(function SourceTabs({
  selectedSource,
  onSourceChange,
  stats,
}: SourceTabsProps) {
  const getCount = (id: string) => {
    if (id === 'all') return stats.total;
    return stats.sources[id as keyof typeof stats.sources] || 0;
  };

  return (
    <div className={styles.sourceTabs}>
      {SOURCES.map(({ id, label, icon }) => {
        const count = getCount(id);
        const isActive = selectedSource === id;
        
        return (
          <button
            key={id}
            onClick={() => onSourceChange(id as typeof selectedSource)}
            className={`${styles.sourceTab} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.sourceTabIcon}>{icon}</span>
            <span className={styles.sourceTabLabel}>{label}</span>
            <span className={styles.sourceTabCount}>{count}</span>
          </button>
        );
      })}
    </div>
  );
});
