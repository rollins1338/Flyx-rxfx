/**
 * LiveTV Component
 * Provider-based live TV experience with DLHD, CDN Live, PPV, and Streamed
 */

'use client';

import { useState, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useLiveTVData, LiveEvent, DLHDChannel } from './hooks/useLiveTVData';
import { LiveTVHeader } from './components/LiveTVHeader';
import { ProviderTabs } from './components/ProviderTabs';
import { ProviderContent } from './components/ProviderContent';
import { VideoPlayer } from './components/VideoPlayer';
import styles from './LiveTV.module.css';

export default function LiveTVRefactored() {
  const {
    selectedProvider,
    setSelectedProvider,
    events,
    channels,
    categories,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    stats,
    refresh,
  } = useLiveTVData();

  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<DLHDChannel | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Handle event play
  const handlePlayEvent = useCallback((event: LiveEvent) => {
    setSelectedEvent(event);
    setSelectedChannel(null);
    setIsPlayerOpen(true);
  }, []);

  // Handle DLHD channel play
  const handlePlayChannel = useCallback((channel: DLHDChannel) => {
    setSelectedChannel(channel);
    setSelectedEvent(null);
    setIsPlayerOpen(true);
  }, []);

  // Handle player close
  const handleClosePlayer = useCallback(() => {
    setIsPlayerOpen(false);
    setSelectedEvent(null);
    setSelectedChannel(null);
  }, []);

  // Calculate total stats for header
  const totalStats = {
    live: stats.dlhd.live + stats.ppv.live + stats.streamed.live + stats.cdnlive.channels,
    total: stats.dlhd.events + stats.dlhd.channels + stats.cdnlive.channels + stats.ppv.events + stats.streamed.events,
    sources: {
      channels: stats.dlhd.channels,
      dlhd: stats.dlhd.events,
      ppv: stats.ppv.events,
      cdnlive: stats.cdnlive.channels,
      streamed: stats.streamed.events,
    },
  };

  return (
    <div className={styles.liveTVPage}>
      <Navigation />
      
      <main className={styles.mainContent}>
        {/* Header Section */}
        <LiveTVHeader
          stats={totalStats}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={refresh}
          loading={loading}
        />

        {/* Provider Tabs */}
        <ProviderTabs
          selectedProvider={selectedProvider}
          onProviderChange={setSelectedProvider}
          stats={stats}
          loading={loading}
        />

        {/* Provider Content */}
        <ProviderContent
          provider={selectedProvider}
          events={events}
          channels={channels}
          categories={categories}
          onPlayEvent={handlePlayEvent}
          onPlayChannel={handlePlayChannel}
          loading={loading}
          error={error}
        />
      </main>

      {/* Video Player Modal */}
      <VideoPlayer
        event={selectedEvent}
        channel={selectedChannel}
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
      />

      <Footer />
    </div>
  );
}
