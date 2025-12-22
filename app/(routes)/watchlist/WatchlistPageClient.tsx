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
import { getTMDBRecommendationsUrl } from '@/lib/utils/tmdb-endpoints';
import type { MediaItem } from '@/types/media';

interface RecommendedItem extends MediaItem {
  matchReason?: string;
  matchScore?: number;
}

// WatchlistCard Component
function WatchlistCard({ 
  item, 
  index, 
  onClick, 
  onRemove 
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
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.03 }}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800">
        {item.posterPath ? (
          <img
            src={item.posterPath}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/50 to-purple-900/50">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Remove Button */}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-8 h-8 bg-red-600/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 z-10"
          title="Remove from watchlist"
        >
          <span className="text-white text-sm">✕</span>
        </button>
        
        {/* Media Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] font-medium text-white uppercase">
          {item.mediaType === 'tv' ? '📺 TV' : '🎬 Movie'}
        </div>
        
        {/* Info on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{item.title}</h3>
          {item.rating && (
            <div className="flex items-center gap-1 text-yellow-400 text-xs">
              <span>⭐</span>
              <span>{item.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Title below card (mobile) */}
      <div className="mt-2 md:hidden">
        <h3 className="text-white text-xs font-medium line-clamp-1">{item.title}</h3>
      </div>
    </motion.div>
  );
}

// RecommendationCard Component
function RecommendationCard({ 
  item, 
  index, 
  onClick 
}: { 
  item: RecommendedItem; 
  index: number; 
  onClick: () => void;
}) {
  const posterUrl = item.posterPath || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null);
  const title = item.title || item.name || 'Unknown';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex-shrink-0 w-[140px] sm:w-[150px] md:w-[180px] group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-800">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/50 to-purple-900/50">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Match Score Badge */}
        {item.matchScore && item.matchScore > 30 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-violet-600/90 backdrop-blur-sm rounded text-[10px] font-bold text-white">
            {Math.round(item.matchScore)}% Match
          </div>
        )}
        
        {/* Media Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] font-medium text-white uppercase">
          {item.mediaType === 'tv' ? '📺' : '🎬'}
        </div>
        
        {/* Info on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white font-semibold text-xs line-clamp-2">{title}</h3>
        </div>
      </div>
      
      {/* Title and reason below */}
      <div className="mt-2">
        <h3 className="text-white text-xs font-medium line-clamp-1">{title}</h3>
        {item.matchReason && (
          <p className="text-violet-400 text-[10px] line-clamp-1 mt-0.5">{item.matchReason}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function WatchlistPageClient() {
  const router = useRouter();
  const { items, removeFromWatchlist, clearWatchlist } = useWatchlist();
  const { trackEvent } = useAnalytics();
  const presenceContext = usePresenceContext();
  
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recProfile, setRecProfile] = useState<{ topGenres: Array<{ name: string; count: number }>; itemCount: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track browsing activity
  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('Watchlist');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback simple recommendations
  const fetchSimpleRecommendations = useCallback(async () => {
    console.log('[Watchlist] Using fallback simple recommendations');
    try {
      const sampleItems = items.slice(0, 5);
      const allRecs: RecommendedItem[] = [];
      const seenIds = new Set(items.map(i => String(i.id)));
      
      for (const item of sampleItems) {
        try {
          const url = getTMDBRecommendationsUrl(item.id, item.mediaType as 'movie' | 'tv');
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            const recs = data.results || [];
            
            for (const rec of recs.slice(0, 8)) {
              const recId = String(rec.id);
              if (!seenIds.has(recId)) {
                seenIds.add(recId);
                allRecs.push({
                  ...rec,
                  mediaType: item.mediaType,
                  matchReason: `Because you added "${item.title}"`,
                });
              }
            }
          }
        } catch (err) {
          console.error('[Watchlist] Error fetching recs for', item.id, err);
        }
      }
      
      const shuffled = allRecs.sort(() => Math.random() - 0.5).slice(0, 20);
      setRecommendations(shuffled);
    } catch (err) {
      console.error('[Watchlist] Error in fallback recommendations:', err);
    }
  }, [items]);

  // Fetch recommendations based on watchlist
  const fetchRecommendations = useCallback(async () => {
    if (items.length === 0) return;
    
    setLoadingRecs(true);
    console.log('[Watchlist] Fetching recommendations for', items.length, 'items');
    
    try {
      const response = await fetch('/api/recommendations/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            mediaType: item.mediaType,
            title: item.title,
          })),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.recommendations && data.recommendations.length > 0) {
          const recs: RecommendedItem[] = data.recommendations.map((rec: any) => ({
            id: rec.id,
            title: rec.title || rec.name,
            name: rec.name,
            posterPath: rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : null,
            poster_path: rec.poster_path,
            backdrop_path: rec.backdrop_path,
            overview: rec.overview,
            vote_average: rec.vote_average,
            rating: rec.vote_average,
            release_date: rec.release_date,
            first_air_date: rec.first_air_date,
            releaseDate: rec.release_date || rec.first_air_date,
            mediaType: rec.mediaType,
            media_type: rec.mediaType,
            matchReason: rec.primaryReason,
            matchScore: rec.matchScore,
          }));
          setRecommendations(recs);
          setRecProfile(data.profile || null);
        } else {
          await fetchSimpleRecommendations();
        }
      } else {
        await fetchSimpleRecommendations();
      }
    } catch (err) {
      console.error('[Watchlist] Error fetching recommendations:', err);
      await fetchSimpleRecommendations();
    } finally {
      setLoadingRecs(false);
    }
  }, [items, fetchSimpleRecommendations]);

  // Fetch recommendations when items change (only if 5+ items)
  useEffect(() => {
    if (items.length >= 5) {
      fetchRecommendations();
    } else {
      setRecommendations([]);
      setRecProfile(null);
    }
  }, [items.length, fetchRecommendations]);

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
          <section className="py-4 md:py-6 px-3 md:px-6 mt-8">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-3 md:mb-5">
                <div>
                  <h2 className="text-base sm:text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
                    <span>✨</span> Based on Your List
                  </h2>
                  {items.length >= 5 && recProfile && recProfile.topGenres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {recProfile.topGenres.slice(0, 4).map((genre) => (
                        <span 
                          key={genre.name}
                          className="px-2 py-0.5 text-[10px] sm:text-xs rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        >
                          {genre.name} ({genre.count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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

              {/* Minimum items requirement message */}
              {items.length > 0 && items.length < 5 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12 px-4"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-4">
                    <span className="text-3xl">🎯</span>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                    Add {5 - items.length} more {5 - items.length === 1 ? 'item' : 'items'} to unlock recommendations
                  </h3>
                  <p className="text-gray-400 mb-4 max-w-md mx-auto">
                    We need at least <span className="text-violet-400 font-semibold">5 items</span> in your watchlist to analyze your taste and curate personalized recommendations.
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full transition-all ${
                          i <= items.length 
                            ? 'bg-violet-500 shadow-lg shadow-violet-500/50' 
                            : 'bg-gray-700 border border-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push('/')}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-full hover:from-violet-700 hover:to-purple-700 transition-all text-sm"
                  >
                    Browse More Content
                  </motion.button>
                </motion.div>
              ) : loadingRecs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Analyzing your taste...</p>
                  </div>
                </div>
              ) : recommendations.length > 0 ? (
                <div
                  ref={scrollRef}
                  className="flex gap-3 sm:gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                  {recommendations.map((item, index) => (
                    <RecommendationCard
                      key={`${item.mediaType}-${item.id}`}
                      item={item}
                      index={index}
                      onClick={() => handleContentClick(item)}
                    />
                  ))}
                </div>
              ) : items.length >= 5 ? (
                <div className="text-center py-8 px-4">
                  <p className="text-gray-400 mb-2">
                    No recommendations found for your current list.
                  </p>
                  <p className="text-gray-500 text-sm">
                    Try adding different movies or shows to get personalized suggestions!
                  </p>
                </div>
              ) : null}
            </div>
          </section>
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
