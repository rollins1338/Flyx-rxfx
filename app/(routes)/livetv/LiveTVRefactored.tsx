/**
 * Refactored LiveTV Component
 * Modern, intuitive live TV experience with improved UX
 */

'use client';

import { useState, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useLiveTVData, LiveEvent, DLHDChannel } from './hooks/useLiveTVData';
import { LiveTVHeader } from './components/LiveTVHeader';
import { SourceTabs } from './components/SourceTabs';
import { CategoryFilters } from './components/CategoryFilters';
import { EventsGrid } from './components/EventsGrid';
import { CableChannelsGrid } from './components/CableChannelsGrid';
import { VideoPlayer } from './components/VideoPlayer';
import styles from './LiveTV.module.css';

export default function LiveTVRefactored() {
  const {
    events,
    dlhdChannels,
    categories,
    loading,
    error,
    selectedSource,
    selectedCategory,
    searchQuery,
    showLiveOnly,
    stats,
    setSelectedSource,
    setSelectedCategory,
    setSearchQuery,
    setShowLiveOnly,
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

  return (
    <div className={styles.liveTVPage}>
      <Navigation />
      
      <main className={styles.mainContent}>
        {/* Header Section */}
        <LiveTVHeader
          stats={stats}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={refresh}
          loading={loading}
        />

        {/* Source Navigation */}
        <SourceTabs
          selectedSource={selectedSource}
          onSourceChange={setSelectedSource}
          stats={stats}
        />

        {/* Category Filters */}
        <CategoryFilters
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          showLiveOnly={showLiveOnly}
          onLiveOnlyChange={setShowLiveOnly}
        />

        {/* Content based on selected source */}
        {selectedSource === 'channels' ? (
          <CableChannelsGrid
            channels={dlhdChannels}
            onChannelPlay={handlePlayChannel}
            loading={loading}
          />
        ) : (
          <EventsGrid
            events={events}
            onPlayEvent={handlePlayEvent}
            loading={loading}
            error={error}
          />
        )}
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