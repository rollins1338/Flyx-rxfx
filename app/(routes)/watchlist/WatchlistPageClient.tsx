'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import type { MediaItem } from '@/types/media';

interface RecommendedItem extends MediaItem {
  matchReason?: string;
}

export default function WatchlistPageClient() {
  const router = useRouter();
  const { items, removeFromWatchlist, clearWatchlist } = useWatchlist();
  const { trackEvent } = useAnalytics();
  const presenceContext = usePresenceContext();
  
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track browsing activity
  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('Watchlist');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recommendations based on watchlist
  useEffect(() => {
    if (items.length > 0) {
      fetchRecommendations();
    } else {
      setRecommendations([]);
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecommendations = async () => {
    if (items.length === 0) return;
    
    setLoadingRecs(true);
    try {
      // Get recommendations based on ALL items (up to 5) for better results
      const sampleItems = items.slice(0, 5);
      const allRecs: RecommendedItem[] = [];
      const seenIds = new Set(items.map(i => String(i.id)));
      
      // Fetch recommendations for each item in parallel
      const fetchPromises = sampleItems.map(async (item) => {
        try {
          const response = await fetch(
            `/api/content/recommendations?id=${item.id}&type=${item.mediaType}`
          );
          if (response.ok) {
            const data = await response.json();
            return { item, recs: data.results || [] };
          }
        } catch (err) {
          console.error('[Watchlist] Error fetching recs for', item.id, err);
        }
        return { item, recs: [] };
      });
      
      const results = await Promise.all(fetchPromises);
      
      // Process all results
      for (const { item, recs } of results) {
        for (const rec of recs.slice(0, 10)) {
          const recId = String(rec.id);
          if (!seenIds.has(recId)) {
            seenIds.add(recId);
            allRecs.push({
              ...rec,
              matchReason: `Because you added "${item.title}"`,
            });
          }
        }
      }
      
      // Shuffle and limit recommendations
      const shuffled = allRecs.sort(() => Math.random() - 0.5).slice(0, 20);
      setRecommendations(shuffled);
    } catch (err) {
      console.error('[Watchlist] Error fetching recommendations:', err);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleContentClick = useCallback((item: WatchlistItem | RecommendedItem) => {
    trackEvent('watchlist_item_clicked', { content_id: item.id });
    router.push(`/details/${item.id}?type=${item.mediaType}`);
  }, [router, trackEvent]);

  const handleRemove = useCallback((e: React.MouseEvent, id: number | string) => {
    e.stopPropagation();
    removeFromWatchlist(id);
    trackEvent('watchlist_item_removed', { content_id: id });
  }, [removeFromWatchlist, trackEvent]);

  const handleClearAll = useCallback(() => {
    clearWatchlist();
    trackEvent('watchlist_cleared', { item_count: items.length });
    setShowClearConfirm(false);
  }, [clearWatchlist, items.length, trackEvent]);

  const handleSearch = useCallback((query: string) => {
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`);
  }, [router]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth < 640 ? 280 : 600;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden">
        <Navigation onSearch={handleSearch} />
        
        {/* Hero Section */}
        <section className="relative pt-16 md:pt-20 pb-12 md:pb-16 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-purple-900/10 to-[#0a0a0f]" />
            <div className="absolute top-0 left-1/4 w-64 md:w-[500px] h-64 md:h-[500px] bg-violet-500/10 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute top-20 right-1/3 w-48 md:w-80 h-48 md:h-80 bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-0 right-1/4 w-40 md:w-72 h-40 md:h-72 bg-pink-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-4xl mx-auto"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-600 mb-4 md:mb-6 shadow-lg shadow-violet-500/30"
              >
                <span className="text-3xl md:text-4xl">📋</span>
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-3 md:mb-4">
                <span className="bg-gradient-to-r from-violet-300 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
                  My Watchlist
                </span>
              </h1>
              <p className="text-base md:text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto px-4">
                Your personal collection of must-watch content
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-3 md:gap-6 mt-6 md:mt-8 flex-wrap px-4"
              >
                <div className="px-3 md:px-4 py-1.5 md:py-2 bg-violet-500/10 border border-violet-500/20 rounded-full">
                  <span className="text-xs md:text-sm text-violet-400 font-medium">
                    📺 {items.filter(i => i.mediaType === 'tv').length} Shows
                  </span>
                </div>
                <div className="px-3 md:px-4 py-1.5 md:py-2 bg-purple-500/10 border border-purple-500/20 rounded-full">
                  <span className="text-xs md:text-sm text-purple-400 font-medium">
                    🎬 {items.filter(i => i.mediaType === 'movie').length} Movies
                  </span>
                </div>
                <div className="px-3 md:px-4 py-1.5 md:py-2 bg-pink-500/10 border border-pink-500/20 rounded-full">
                  <span className="text-xs md:text-sm text-pink-400 font-medium">
                    ✨ {items.length} Total
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <main className="pb-20">
          {/* My Watchlist Section */}
          <section className="py-4 md:py-6 px-3 md:px-6">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <span>📋</span> My List
                  <span className="text-sm font-normal text-violet-400">({items.length})</span>
                </h2>
                {items.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="px-3 py-1.5 text-xs md:text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16 md:py-24"
                >
                  <div className="text-6xl md:text-8xl mb-4">🎬</div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Your watchlist is empty</h3>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto px-4">
                    Start adding movies and shows you want to watch later. Look for the + button on any content!
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-full hover:from-violet-700 hover:to-purple-700 transition-all"
                  >
                    Browse Content
                  </motion.button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <WatchlistCard
                        key={item.id}
                        item={item}
                        index={index}
                        onClick={() => handleContentClick(item)}
                        onRemove={(e) => handleRemove(e, item.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </section>

          {/* Recommendations Section */}
          {items.length > 0 && (
            <section className="py-4 md:py-6 px-3 md:px-6 mt-8">
              <div className="container mx-auto">
                <div className="flex items-center justify-between mb-3 md:mb-5">
                  <h2 className="text-base sm:text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
                    <span>✨</span> Based on Your List
                  </h2>
                  {recommendations.length > 0 && (
                    <div className="hidden sm:flex gap-2">
                      <button
                        onClick={() => scroll('left')}
                        className="w-8 h-8 md:w-9 md:h-9 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-full flex items-center justify-center text-white transition-all"
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => scroll('right')}
                        className="w-8 h-8 md:w-9 md:h-9 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-full flex items-center justify-center text-white transition-all"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>

                {loadingRecs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-400 text-sm">Finding recommendations...</p>
                    </div>
                  </div>
                ) : recommendations.length > 0 ? (
                  <div
                    ref={scrollRef}
                    className="flex gap-2.5 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2 snap-x snap-mandatory md:snap-none"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                  >
                    {recommendations.map((item, index) => (
                      <RecommendationCard
                        key={item.id}
                        item={item}
                        index={index}
                        onClick={() => handleContentClick(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 px-4">
                    <p className="text-gray-400 mb-2">
                      No recommendations found for your current list.
                    </p>
                    <p className="text-gray-500 text-sm">
                      Try adding different movies or shows to get personalized suggestions!
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* Clear Confirmation Modal */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={() => setShowClearConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-white mb-2">Clear Watchlist?</h3>
                <p className="text-gray-400 mb-6">
                  This will remove all {items.length} items from your watchlist. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Footer />
      </div>
    </PageTransition>
  );
}


// Watchlist Card Component
function WatchlistCard({
  item,
  index,
  onClick,
  onRemove,
}: {
  item: WatchlistItem;
  index: number;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="cursor-pointer group relative"
    >
      <motion.div
        whileHover={{ scale: 1.03, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative rounded-lg md:rounded-xl overflow-hidden bg-gray-900 shadow-lg"
      >
        <img
          src={item.posterPath || '/placeholder-poster.jpg'}
          alt={item.title}
          className="w-full aspect-[2/3] object-cover"
          loading="lazy"
        />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.div>
        </div>

        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 md:w-8 md:h-8 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
          aria-label="Remove from watchlist"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Rating Badge */}
        {item.rating && item.rating > 0 && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] md:text-xs font-semibold text-yellow-400 flex items-center gap-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            {item.rating.toFixed(1)}
          </div>
        )}

        {/* Media Type Badge */}
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-violet-500/80 rounded text-[8px] md:text-[10px] font-bold text-white uppercase">
          {item.mediaType === 'movie' ? 'Movie' : 'Series'}
        </div>
      </motion.div>

      <div className="mt-2 px-0.5">
        <h3 className="text-white font-medium text-xs sm:text-sm line-clamp-1 group-hover:text-violet-300 transition-colors">
          {item.title}
        </h3>
        <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">
          {item.releaseDate ? new Date(item.releaseDate).getFullYear() : ''}
        </p>
      </div>
    </motion.div>
  );
}

// Recommendation Card Component
function RecommendationCard({
  item,
  index,
  onClick,
}: {
  item: RecommendedItem;
  index: number;
  onClick: () => void;
}) {
  const posterUrl = item.posterPath || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/placeholder-poster.jpg');
  const title = item.title || item.name || 'Unknown';
  const rating = item.rating || item.vote_average || 0;
  const releaseDate = item.releaseDate || item.release_date || item.first_air_date;
  const mediaType = item.mediaType || item.media_type || 'movie';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex-shrink-0 w-28 sm:w-32 md:w-36 lg:w-44 cursor-pointer group snap-start"
    >
      <motion.div
        whileHover={{ scale: 1.05, y: -8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative rounded-lg md:rounded-xl overflow-hidden bg-gray-900 shadow-lg"
      >
        <img
          src={posterUrl}
          alt={title}
          className="w-full aspect-[2/3] object-cover"
          loading="lazy"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-violet-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" className="md:w-5 md:h-5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.div>
        </div>

        {rating > 0 && (
          <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 px-1 md:px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] md:text-xs font-semibold text-yellow-400 flex items-center gap-0.5">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="md:w-2.5 md:h-2.5">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            {rating.toFixed(1)}
          </div>
        )}

        <div className="absolute bottom-1.5 left-1.5 md:bottom-2 md:left-2 px-1 md:px-1.5 py-0.5 bg-purple-500/80 rounded text-[8px] md:text-[10px] font-bold text-white uppercase">
          {mediaType === 'movie' ? 'Movie' : 'Series'}
        </div>
      </motion.div>

      <div className="mt-2 md:mt-2.5 px-0.5 md:px-1">
        <h3 className="text-white font-medium text-xs sm:text-sm line-clamp-1 group-hover:text-purple-300 transition-colors">
          {title}
        </h3>
        <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">
          {releaseDate ? new Date(releaseDate).getFullYear() : ''}
        </p>
        {item.matchReason && (
          <p className="text-violet-400/70 text-[9px] sm:text-[10px] mt-0.5 line-clamp-1">
            {item.matchReason}
          </p>
        )}
      </div>
    </motion.div>
  );
}
