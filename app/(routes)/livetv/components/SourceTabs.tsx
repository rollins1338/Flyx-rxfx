/**
 * Source Tabs Component
 * Clean dropdown menu for stream source selection
 */

import { memo, useState, useRef, useEffect } from 'react';
import styles from '../LiveTV.module.css';

interface SourceTabsProps {
  selectedSource: 'all' | 'cable' | 'dlhd' | 'ppv' | 'cdnlive';
  onSourceChange: (source: 'all' | 'cable' | 'dlhd' | 'ppv' | 'cdnlive') => void;
  stats: {
    live: number;
    total: number;
    sources: {
      cable: number;
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
  cable: {
    label: 'Cable TV',
    icon: '📺',
    description: 'Standard cable channels',
  },
  dlhd: {
    label: 'Live Events',
    icon: '🏟️',
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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getSourceCount = (source: keyof typeof SOURCE_CONFIG) => {
    if (source === 'all') return stats.total;
    return stats.sources[source as keyof typeof stats.sources] || 0;
  };

  const getLiveCount = (source: keyof typeof SOURCE_CONFIG) => {
    if (source === 'all') return stats.live;
    const ratio = stats.sources[source as keyof typeof stats.sources] / stats.total;
    return Math.round(stats.live * ratio);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedConfig = SOURCE_CONFIG[selectedSource];
  const selectedCount = getSourceCount(selectedSource);
  const selectedLiveCount = getLiveCount(selectedSource);

  const handleSourceSelect = (source: keyof typeof SOURCE_CONFIG) => {
    onSourceChange(source);
    setIsOpen(false);
  };

  return (
    <div className={styles.sourceDropdownWrapper} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        className={styles.sourceDropdownTrigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.sourceDropdownIcon}>{selectedConfig.icon}</span>
        <div className={styles.sourceDropdownInfo}>
          <span className={styles.sourceDropdownLabel}>{selectedConfig.label}</span>
          <span className={styles.sourceDropdownMeta}>
            {selectedCount} streams {selectedLiveCount > 0 && `• ${selectedLiveCount} live`}
          </span>
        </div>
        <svg 
          className={`${styles.sourceDropdownChevron} ${isOpen ? styles.open : ''}`}
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={styles.sourceDropdownMenu} role="listbox">
          {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
            const sourceKey = key as keyof typeof SOURCE_CONFIG;
            const count = getSourceCount(sourceKey);
            const liveCount = getLiveCount(sourceKey);
            const isActive = selectedSource === sourceKey;

            return (
              <button
                key={sourceKey}
                onClick={() => handleSourceSelect(sourceKey)}
                className={`${styles.sourceDropdownItem} ${isActive ? styles.active : ''}`}
                role="option"
                aria-selected={isActive}
              >
                <span className={styles.sourceDropdownItemIcon}>{config.icon}</span>
                <div className={styles.sourceDropdownItemInfo}>
                  <span className={styles.sourceDropdownItemLabel}>{config.label}</span>
                  <span className={styles.sourceDropdownItemDesc}>{config.description}</span>
                </div>
                <div className={styles.sourceDropdownItemStats}>
                  <span className={styles.sourceDropdownItemCount}>{count}</span>
                  {liveCount > 0 && (
                    <span className={styles.sourceDropdownItemLive}>{liveCount} live</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});