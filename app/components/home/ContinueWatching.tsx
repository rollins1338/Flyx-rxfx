'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { SYNC_DATA_CHANGED_EVENT } from '@/lib/sync';
import type { WatchProgress } from '@/lib/services/user-tracking';

interface ContentMetadata {
  id: string;
  title: string;
  posterPath: string;
  backdropPath: string;
  mediaType: 'movie' | 'tv';
}

interface ContinueWatchingItem extends WatchProgress {
  metadata?: ContentMetadata;
}

export default function ContinueWatching() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { getAllWatchProgress, removeWatchProgress, trackEvent } = analytics;
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataCache, setMetadataCache] = useState<Record<string, ContentMetadata>>({});
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll handlers
  const scrollLeft = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: -600, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: 600, behavior: 'smooth' });
  }, []);

  // Fetch metadata for content items
  const fetchMetadata = useCallback(async (contentId: string, contentType: 'movie' | 'tv'): Promise<ContentMetadata | null> => {
    if (metadataCache[contentId]) {
      return metadataCache[contentId];
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (!apiKey) return null;

      const response = await fetch(
        `https://api.themoviedb.org/3/${contentType}/${contentId}?api_key=${apiKey}`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const metadata: ContentMetadata = {
        id: contentId,
        title: data.title || data.name || 'Unknown',
        posterPath: data.poster_path || '',
        backdropPath: data.backdrop_path || '',
        mediaType: contentType,
      };

      setMetadataCache(prev => ({ ...prev, [contentId]: metadata }));
      return metadata;
    } catch (error) {
      console.error('[ContinueWatching] Failed to fetch metadata:', error);
      return null;
    }
  }, [metadataCache]);

  // Listen for sync data changes and reload
  useEffect(() => {
    const handleSyncDataChanged = () => {
      console.log('[ContinueWatching] Sync data changed, reloading...');
      // Reload watch progress from localStorage
      if (analytics.reloadWatchProgress) {
        analytics.reloadWatchProgress();
      }
      // Trigger a reload of items
      setReloadTrigger(prev => prev + 1);
    };

    window.addEventListener(SYNC_DATA_CHANGED_EVENT, handleSyncDataChanged);
    return () => window.removeEventListener(SYNC_DATA_CHANGED_EVENT, handleSyncDataChanged);
  }, [analytics]);

  // Load continue watching items
  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      try {
        const progressItems = getAllWatchProgress();
        console.log('[ContinueWatching] Loading items, found:', progressItems.length);
        const itemsWithMetadata: ContinueWatchingItem[] = [];
        
        for (const item of progressItems.slice(0, 10)) {
          const metadata = await fetchMetadata(item.contentId, item.contentType);
          itemsWithMetadata.push({
            ...item,
            metadata: metadata || undefined,
          });
        }

        setItems(itemsWithMetadata);
      } catch (error) {
        console.error('[ContinueWatching] Error loading items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [getAllWatchProgress, fetchMetadata, reloadTrigger]);

  const handleItemClick = useCallback((item: ContinueWatchingItem) => {
    trackEvent('continue_watching_clicked', {
      content_id: item.contentId,
      content_type: item.contentType,
      progress: item.completionPercentage,
      season: item.seasonNumber,
      episode: item.episodeNumber,
    });

    let url = `/watch/${item.contentId}?type=${item.contentType}`;
    if (item.contentType === 'tv' && item.seasonNumber && item.episodeNumber) {
      url += `&season=${item.seasonNumber}&episode=${item.episodeNumber}`;
    }
    if (item.metadata?.title) {
      url += `&title=${encodeURIComponent(item.metadata.title)}`;
    }

    router.push(url);
  }, [router, trackEvent]);

  const handleRemove = useCallback((e: React.MouseEvent, item: ContinueWatchingItem) => {
    e.stopPropagation();
    e.preventDefault();
    
    const success = removeWatchProgress(item.contentId, item.seasonNumber, item.episodeNumber);
    
    if (success) {
      setItems(prev => prev.filter(i => 
        !(i.contentId === item.contentId && 
          i.seasonNumber === item.seasonNumber && 
          i.episodeNumber === item.episodeNumber)
      ));
      
      trackEvent('continue_watching_removed', {
        content_id: item.contentId,
        content_type: item.contentType,
        season: item.seasonNumber,
        episode: item.episodeNumber,
      });
    }
  }, [removeWatchProgress, trackEvent]);

  const formatTimeRemaining = (currentTime: number, duration: number): string => {
    const remaining = Math.max(0, duration - currentTime);
    const minutes = Math.floor(remaining / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m left`;
    }
    return `${minutes}m left`;
  };

  if (loading) {
    return (
      <section className="py-12 px-6">
        <div className="container mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">Continue Watching</h2>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-72 h-40 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-6">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Header with scroll buttons */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Continue Watching</span>
            </h2>

            {/* Scroll Buttons - matching ContentSection style */}
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={scrollLeft}
                className="w-12 h-12 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl text-2xl font-bold"
                data-tv-skip="true"
                tabIndex={-1}
              >
                ‹
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={scrollRight}
                className="w-12 h-12 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl text-2xl font-bold"
                data-tv-skip="true"
                tabIndex={-1}
              >
                ›
              </motion.button>
            </div>
          </div>

          {/* Scrollable container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-8 pt-4 px-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            data-tv-scroll-container="true"
          >
            <AnimatePresence>
              {items.map((item, index) => (
                <motion.div
                  key={`${item.contentId}-${item.seasonNumber}-${item.episodeNumber}`}
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  className="flex-shrink-0 w-72 cursor-pointer group p-2"
                  data-tv-focusable="true"
                  data-tv-group="continue-watching"
                  tabIndex={0}
                  role="button"
                  aria-label={`Continue watching ${item.metadata?.title || 'content'}`}
                >
                  <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 transform hover:scale-[1.02]">
                    <div className="relative h-40">
                      {item.metadata?.backdropPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${item.metadata.backdropPath}`}
                          alt={item.metadata?.title || 'Content'}
                          className="w-full h-full object-cover"
                        />
                      ) : item.metadata?.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500${item.metadata.posterPath}`}
                          alt={item.metadata?.title || 'Content'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/30">
                            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                            <line x1="7" y1="2" x2="7" y2="22" />
                            <line x1="17" y1="2" x2="17" y2="22" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                          </svg>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                      {/* Remove button */}
                      <button
                        onClick={(e) => handleRemove(e, item)}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 border border-white/20 hover:border-red-500"
                        aria-label={`Remove ${item.metadata?.title || 'item'} from continue watching`}
                        data-tv-skip="true"
                        tabIndex={-1}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-white font-semibold text-sm line-clamp-1 mb-1">
                          {item.metadata?.title || `Content ${item.contentId}`}
                        </h3>
                        
                        {item.contentType === 'tv' && item.seasonNumber && item.episodeNumber && (
                          <p className="text-gray-400 text-xs mb-2">
                            S{item.seasonNumber} E{item.episodeNumber}
                          </p>
                        )}

                        <p className="text-gray-400 text-xs">
                          {formatTimeRemaining(item.currentTime, item.duration)}
                        </p>
                      </div>
                    </div>

                    <div className="h-1 bg-gray-700">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${item.completionPercentage}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
