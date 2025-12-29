/**
 * Cable Channels Grid Component
 * Simple flat grid layout - no category grouping to prevent layout shifts
 */

import { memo, useState, useEffect, useRef } from 'react';
import { DLHDChannel } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

interface CableChannelsGridProps {
  channels: DLHDChannel[];
  onChannelPlay: (channel: DLHDChannel) => void;
  loading?: boolean;
}

const ITEMS_PER_PAGE = 48;

export const CableChannelsGrid = memo(function CableChannelsGrid({
  channels,
  onChannelPlay,
  loading = false,
}: CableChannelsGridProps) {
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset display count when channels change significantly
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [channels.length > 0 ? channels[0]?.id : null]);

  // Infinite scroll observer
  useEffect(() => {
    const loadMoreEl = loadMoreRef.current;
    if (!loadMoreEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount(prev => {
            if (prev >= channels.length) return prev;
            return Math.min(prev + ITEMS_PER_PAGE, channels.length);
          });
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(loadMoreEl);

    return () => {
      observer.unobserve(loadMoreEl);
      observer.disconnect();
    };
  }, [channels.length]);

  const displayedChannels = channels.slice(0, displayCount);
  const hasMore = displayCount < channels.length;

  return (
    <div className={styles.contentContainer}>
      {/* Header */}
      <div className={styles.contentHeader}>
        <h2 className={styles.contentTitle}>
          {loading ? 'Loading...' : `${channels.length} Channels`}
        </h2>
      </div>

      {/* Loading State */}
      {loading && channels.length === 0 && (
        <div className={styles.gridPlaceholder}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && channels.length === 0 && (
        <div className={styles.messageBox}>
          <span className={styles.messageIcon}>📺</span>
          <p>No channels found. Try adjusting your filters.</p>
        </div>
      )}

      {/* Channels Grid - Flat layout, no category grouping */}
      {displayedChannels.length > 0 && (
        <div className={styles.channelGrid}>
          {displayedChannels.map((channel) => (
            <div
              key={channel.id}
              className={styles.channelItem}
              onClick={() => onChannelPlay(channel)}
            >
              <div className={styles.channelFlag}>
                {channel.countryInfo?.flag || '📺'}
              </div>
              <div className={styles.channelDetails}>
                <span className={styles.channelTitle}>{channel.name}</span>
                <span className={styles.channelSub}>
                  {channel.countryInfo?.name || channel.category}
                </span>
              </div>
              <div className={styles.channelPlayIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
          <div className={styles.loadingSpinner} />
          <p>Loading more...</p>
        </div>
      )}
    </div>
  );
});
