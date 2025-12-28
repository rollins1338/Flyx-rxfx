/**
 * Cable Channels Grid Component
 * Displays standard cable TV channels in a grid layout
 */

import { memo } from 'react';
import { CableChannel, CHANNEL_CATEGORIES } from '@/app/lib/data/cable-channels';
import styles from '../LiveTV.module.css';

interface CableChannelsGridProps {
  channels: CableChannel[];
  onChannelPlay: (channel: CableChannel) => void;
  loading?: boolean;
}

export const CableChannelsGrid = memo(function CableChannelsGrid({
  channels,
  onChannelPlay,
  loading = false,
}: CableChannelsGridProps) {
  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner}></div>
        <h3>Loading Cable Channels...</h3>
        <p>Fetching available cable TV channels</p>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📺</div>
        <h3>No Cable Channels Found</h3>
        <p>No cable channels match your current filters</p>
      </div>
    );
  }

  // Group channels by category
  const channelsByCategory = channels.reduce((acc, channel) => {
    if (!acc[channel.category]) {
      acc[channel.category] = [];
    }
    acc[channel.category].push(channel);
    return acc;
  }, {} as Record<string, CableChannel[]>);

  return (
    <div className={styles.cableChannelsContainer}>
      {Object.entries(channelsByCategory).map(([category, categoryChannels]) => {
        const categoryInfo = CHANNEL_CATEGORIES[category as keyof typeof CHANNEL_CATEGORIES];
        
        return (
          <div key={category} className={styles.categorySection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <span>{categoryInfo?.icon || '📺'}</span>
                {categoryInfo?.name || category}
                <span className={styles.sectionCount}>
                  {categoryChannels.length} channels
                </span>
              </h3>
            </div>
            
            <div className={styles.channelsGrid}>
              {categoryChannels.map((channel) => (
                <div
                  key={channel.id}
                  className={styles.channelCard}
                  onClick={() => onChannelPlay(channel)}
                >
                  <div className={styles.channelHeader}>
                    <div className={styles.channelIcon}>
                      {categoryInfo?.icon || '📺'}
                    </div>
                    <div className={styles.channelInfo}>
                      <h4 className={styles.channelName}>{channel.name}</h4>
                      <p className={styles.channelCategory}>
                        {categoryInfo?.name || category}
                      </p>
                    </div>
                  </div>
                  
                  <div className={styles.channelMeta}>
                    <span className={styles.channelShortName}>
                      {channel.shortName}
                    </span>
                    {channel.hdVariants && channel.hdVariants.length > 0 && (
                      <span className={styles.hdBadge}>
                        {channel.hdVariants.includes('FHD') ? 'FHD' : 
                         channel.hdVariants.includes('HD') ? 'HD' : 
                         channel.hdVariants[0]}
                      </span>
                    )}
                  </div>
                  
                  <div className={styles.channelOverlay}>
                    <button className={styles.playButton}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});