/**
 * Source Tabs Component
 * Navigation between different stream sources
 */

import { memo } from 'react';
import styles from '../LiveTV.module.css';

interface SourceTabsProps {
  selectedSource: 'all' | 'dlhd' | 'ppv' | 'cdnlive';
  onSourceChange: (source: 'all' | 'dlhd' | 'ppv' | 'cdnlive') => void;
  stats: {
    live: number;
    total: number;
    sources: {
      dlhd: number;
      ppv: number;
      cdnlive: number;
    };
  };
}

const SOURCE_CONFIG = {
  all: {
    label: 'All Sources',
    icon: '🏆',
    description: 'All available streams',
  },
  dlhd: {
    label: 'Live Events',
    icon: '📺',
    description: 'Sports & TV events',
  },
  ppv: {
    label: 'PPV Sports',
    icon: '🥊',
    description: 'Pay-per-view events',
  },
  cdnlive: {
    label: 'CDN Live',
    icon: '🌐',
    description: 'Alternative streams',
  },
} as const;

export const SourceTabs = memo(function SourceTabs({
  selectedSource,
  onSourceChange,
  stats,
}: SourceTabsProps) {
  const getSourceCount = (source: keyof typeof SOURCE_CONFIG) => {
    if (source === 'all') return stats.total;
    return stats.sources[source as keyof typeof stats.sources] || 0;
  };

  const getLiveCount = (source: keyof typeof SOURCE_CONFIG) => {
    if (source === 'all') return stats.live;
    // For now, return a portion of live events per source
    // In a real implementation, you'd track this per source
    const ratio = stats.sources[source as keyof typeof stats.sources] / stats.total;
    return Math.round(stats.live * ratio);
  };

  return (
    <div className={styles.sourceTabs}>
      <div className={styles.sourceTabsContainer}>
        {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
          const sourceKey = key as keyof typeof SOURCE_CONFIG;
          const count = getSourceCount(sourceKey);
          const liveCount = getLiveCount(sourceKey);
          const isActive = selectedSource === sourceKey;

          return (
            <button
              key={sourceKey}
              onClick={() => onSourceChange(sourceKey)}
              className={`${styles.sourceTab} ${isActive ? styles.active : ''}`}
              aria-pressed={isActive}
            >
              <div className={styles.sourceTabContent}>
                <div className={styles.sourceTabHeader}>
                  <span className={styles.sourceTabIcon}>{config.icon}</span>
                  <span className={styles.sourceTabLabel}>{config.label}</span>
                  {liveCount > 0 && (
                    <span className={styles.liveIndicator}>
                      {liveCount} live
                    </span>
                  )}
                </div>
                <div className={styles.sourceTabMeta}>
                  <span className={styles.sourceTabDescription}>
                    {config.description}
                  </span>
                  <span className={styles.sourceTabCount}>
                    {count} streams
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});