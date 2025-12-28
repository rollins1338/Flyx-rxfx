/**
 * DLHD Channels Grid Component
 * Displays DLHD TV channels in a grid layout
 */

import { memo } from 'react';
import { DLHDChannel } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

const CATEGORY_INFO: Record<string, { name: string; icon: string }> = {
  sports: { name: 'Sports', icon: '⚽' },
  entertainment: { name: 'Entertainment', icon: '🎬' },
  movies: { name: 'Movies', icon: '🎥' },
  news: { name: 'News', icon: '📰' },
  kids: { name: 'Kids', icon: '🧸' },
  documentary: { name: 'Documentary', icon: '🌍' },
  music: { name: 'Music', icon: '🎵' },
};

interface CableChannelsGridProps {
  channels: DLHDChannel[];
  onChannelPlay: (channel: DLHDChannel) => void;
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
        <h3>Loading TV Channels...</h3>
        <p>Fetching available DLHD channels</p>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📺</div>
        <h3>No Channels Found</h3>
        <p>No channels match your current filters</p>
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
  }, {} as Record<string, DLHDChannel[]>);

  return (
    <div className={styles.cableChannelsContainer}>
      {Object.entries(channelsByCategory).map(([category, categoryChannels]) => {
        const categoryInfo = CATEGORY_INFO[category] || { name: category, icon: '📺' };
        
        return (
          <div key={category} className={styles.categorySection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <span>{categoryInfo.icon}</span>
                {categoryInfo.name}
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
                      {channel.countryInfo?.flag || categoryInfo.icon}
                    </div>
                    <div className={styles.channelInfo}>
                      <h4 className={styles.channelName}>{channel.name}</h4>
                      <p className={styles.channelCategory}>
                        {channel.countryInfo?.name || channel.country}
                      </p>
                    </div>
                  </div>
                  
                  <div className={styles.channelMeta}>
                    <span className={styles.channelShortName}>
                      {categoryInfo.name}
                    </span>
                    <span className={styles.hdBadge}>HD</span>
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