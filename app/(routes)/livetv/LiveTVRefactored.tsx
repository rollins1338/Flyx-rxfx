/**
 * Refactored LiveTV Component
 * Modern, intuitive live TV experience with improved UX
 */

'use client';

import { useState, useCallback } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useLiveTVData, LiveEvent } from './hooks/useLiveTVData';
import { LiveTVHeader } from './components/LiveTVHeader';
import { SourceTabs } from './components/SourceTabs';
import { CategoryFilters } from './components/CategoryFilters';
import { EventsGrid } from './components/EventsGrid';
import { VideoPlayer } from './components/VideoPlayer';
import styles from './LiveTV.module.css';

export default function LiveTVRefactored() {
  const {
    events,
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
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Handle event play
  const handlePlayEvent = useCallback((event: LiveEvent) => {
    setSelectedEvent(event);
    setIsPlayerOpen(true);
  }, []);

  // Handle player close
  const handleClosePlayer = useCallback(() => {
    setIsPlayerOpen(false);
    setSelectedEvent(null);
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

        {/* Events Grid */}
        <EventsGrid
          events={events}
          onPlayEvent={handlePlayEvent}
          loading={loading}
          error={error}
        />
      </main>

      {/* Video Player Modal */}
      <VideoPlayer
        event={selectedEvent}
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
      />

      <Footer />
    </div>
  );
}