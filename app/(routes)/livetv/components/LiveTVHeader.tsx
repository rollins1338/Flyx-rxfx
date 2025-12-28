/**
 * LiveTV Header Component
 * Contains title, stats, search, and main navigation
 */

import { memo } from 'react';
import styles from '../LiveTV.module.css';

interface LiveTVHeaderProps {
  stats: {
    live: number;
    total: number;
    sources: {
      dlhd: number;
      ppv: number;
      cdnlive: number;
    };
  };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const LiveTVHeader = memo(function LiveTVHeader({
  stats,
  searchQuery,
  onSearchChange,
  onRefresh,
  loading,
}: LiveTVHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Live TV</h1>
          <p className={styles.subtitle}>
            {stats.live} live events • {stats.total} total streams
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <svg 
                className={styles.searchIcon} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" 
                  clipRule="evenodd" 
                />
              </svg>
              <input
                type="text"
                placeholder="Search events, sports, teams..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className={styles.clearSearch}
                  aria-label="Clear search"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path 
                      fillRule="evenodd" 
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className={styles.refreshButton}
            aria-label="Refresh events"
          >
            <svg 
              className={`${styles.refreshIcon} ${loading ? styles.spinning : ''}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});