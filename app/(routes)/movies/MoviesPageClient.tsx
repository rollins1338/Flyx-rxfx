'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { MediaItem } from '@/types/media';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import { useRegion } from '@/app/lib/context/RegionContext';
import { RegionSelector } from '@/components/ui/RegionSelector';

interface CategoryData {
  items: MediaItem[];
  total: number;
}

interface MoviesData {
  popular: CategoryData;
  topRated: CategoryData;
  nowPlaying: CategoryData;
  action: CategoryData;
  comedy: CategoryData;
  horror: CategoryData;
  sciFi: CategoryData;
  thriller: CategoryData;
  romance: CategoryData;
  drama: CategoryData;
  documentary: CategoryData;
  fantasy: CategoryData;
  mystery: CategoryData;
  adventure: CategoryData;
  family: CategoryData;
}

const emptyCategory: CategoryData = { items: [], total: 0 };
const initialData: MoviesData = {
  popular: emptyCategory, topRated: emptyCategory, nowPlaying: emptyCategory,
  action: emptyCategory, comedy: emptyCategory, horror: emptyCategory, sciFi: emptyCategory,
  thriller: emptyCategory, romance: emptyCategory, drama: emptyCategory, documentary: emptyCategory,
  fantasy: emptyCategory, mystery: emptyCategory, adventure: emptyCategory, family: emptyCategory,
};

export default function MoviesPageClient() {
  const router = useRouter();
  const { trackEvent } = useAnalytics();
  const presenceContext = usePresenceContext();
  const { region } = useRegion();
  const [data, setData] = useState<MoviesData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track browsing activity - run once on mount
  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('Movies');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    async function fetchData(attempt = 1) {
      if (attempt === 1) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/content/movies?region=${region.code}`);
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (!json.error) {
            setData(json);
          } else {
            throw new Error(json.error);
          }
        } else if (res.status === 429 && attempt < 3) {
          // Rate limited - retry with backoff
          await new Promise(r => setTimeout(r, attempt * 2000));
          if (!cancelled) return fetchData(attempt + 1);
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch movies:', err);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1500));
          if (!cancelled) return fetchData(attempt + 1);
        }
        setError('Failed to load movies. Please try refreshing the page.');
      }
      if (!cancelled) setLoading(false);
    }
    fetchData();

    return () => { cancelled = true; };
  }, [region.code]);

  const handleContentClick = useCallback((item: MediaItem, source: string) => {
    trackEvent('content_clicked', { content_id: item.id, source });
    router.push(`/details/${item.id}?type=movie`);
  }, [router, trackEvent]);

  const handleSeeAll = useCallback((filter: string, genre?: string) => {
    const params = new URLSearchParams({ type: 'movie' });
    if (genre) params.set('genre', genre);
    else params.set('filter', filter);
    if (region.code) params.set('region', region.code);
    router.push(`/browse?${params.toString()}`);
  }, [router, region.code]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden flex flex-col">
        
        {/* Cinematic Hero */}
        <section className="relative pt-20 md:pt-24 pb-12 md:pb-16 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-900/20 via-transparent to-[#0a0a0f]" />
            <div className="absolute top-0 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute top-20 right-1/4 w-48 md:w-80 h-48 md:h-80 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 md:py-20">
                <div className="w-10 h-10 md:w-12 md:h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400 text-sm md:text-base">Loading movies...</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center max-w-4xl mx-auto">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }} className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4 md:mb-6 shadow-lg shadow-amber-500/25">
                  <svg width="32" height="32" className="md:w-10 md:h-10" viewBox="0 0 24 24" fill="white">
                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
                  </svg>
                </motion.div>

                <h1 className="text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-black mb-3 md:mb-4">
                  <span className="bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 bg-clip-text text-transparent">Movies</span>
                </h1>
                <p className="text-base md:text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto px-4">
                  Blockbusters, indie gems, and timeless classics
                </p>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center justify-center gap-4 md:gap-8 mt-6 md:mt-8 flex-wrap px-4">
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-amber-400">{(data.nowPlaying?.total ?? 0).toLocaleString()}</div>
                    <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Now Playing</div>
                  </div>
                  <div className="w-px h-6 md:h-8 bg-gray-700" />
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-amber-400">{(data.topRated?.total ?? 0).toLocaleString()}</div>
                    <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Top Rated</div>
                  </div>
                  <div className="w-px h-6 md:h-8 bg-gray-700" />
                  <div className="text-center">
                    <div className="text-xl md:text-2xl font-bold text-amber-400">15</div>
                    <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Categories</div>
                  </div>
                </motion.div>

                {/* Region Selector */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex justify-center mt-6 md:mt-8">
                  <RegionSelector />
                </motion.div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Spacer to push footer down while loading */}
        {loading && <div className="flex-grow" />}

        {/* Error State */}
        {!loading && error && (
          <div className="flex-grow flex items-center justify-center px-4">
            <div className="text-center py-20">
              <div className="text-5xl mb-4">😕</div>
              <p className="text-gray-400 text-lg mb-4">{error}</p>
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors">
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Content Sections */}
        {!loading && !error && (
          <main className="pb-20 space-y-2 flex-grow">
            <ContentRow title="🔥 Popular Now" data={data.popular} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('popular')} accentColor="amber" />
            <ContentRow title="🎬 Now Playing" data={data.nowPlaying} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('now_playing')} accentColor="amber" />
            <ContentRow title="⭐ Top Rated" data={data.topRated} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('top_rated')} accentColor="yellow" />
            <ContentRow title="💥 Action" data={data.action} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '28')} accentColor="red" />
            <ContentRow title="🗡️ Adventure" data={data.adventure} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '12')} accentColor="orange" />
            <ContentRow title="😂 Comedy" data={data.comedy} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '35')} accentColor="green" />
            <ContentRow title="🎭 Drama" data={data.drama} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '18')} accentColor="indigo" />
            <ContentRow title="👻 Horror" data={data.horror} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '27')} accentColor="purple" />
            <ContentRow title="😱 Thriller" data={data.thriller} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '53')} accentColor="slate" />
            <ContentRow title="🚀 Sci-Fi" data={data.sciFi} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '878')} accentColor="blue" />
            <ContentRow title="✨ Fantasy" data={data.fantasy} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '14')} accentColor="violet" />
            <ContentRow title="💕 Romance" data={data.romance} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10749')} accentColor="pink" />
            <ContentRow title="🔍 Mystery" data={data.mystery} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '9648')} accentColor="teal" />
            <ContentRow title="👨‍👩‍👧‍👦 Family" data={data.family} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10751')} accentColor="cyan" />
            <ContentRow title="📹 Documentary" data={data.documentary} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '99')} accentColor="gray" />
          </main>
        )}
      </div>
    </PageTransition>
  );
}

const accentColors: Record<string, { bg: string; text: string }> = {
  amber: { bg: 'bg-amber-500', text: 'text-amber-400' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-400' },
  red: { bg: 'bg-red-500', text: 'text-red-400' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-400' },
  green: { bg: 'bg-emerald-500', text: 'text-emerald-400' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-400' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-400' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-400' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-400' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-400' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-400' },
  gray: { bg: 'bg-gray-500', text: 'text-gray-400' },
};

function ContentRow({ title, data, onItemClick, onSeeAll, accentColor = 'amber' }: { 
  title: string; data: CategoryData; onItemClick: (item: MediaItem, source: string) => void; onSeeAll: () => void; accentColor?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colors = accentColors[accentColor] || accentColors.amber;
  const scroll = (dir: 'left' | 'right') => scrollRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });

  if (!data?.items?.length) return null;

  return (
    <section className="py-4 md:py-6 px-3 md:px-6">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-3 md:mb-5">
          <button onClick={onSeeAll} className="text-lg md:text-xl lg:text-2xl font-bold text-white flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity group active:scale-95" data-tv-focusable="true" data-tv-group={`movies-header-${title.toLowerCase().replace(/[^a-z]/g, '')}`}>
            {title}
            <span className={`text-xs md:text-sm font-normal ${colors.text}`}>({(data?.total ?? data?.items?.length ?? 0).toLocaleString()})</span>
            <span className={`${colors.text} opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline`}>→</span>
          </button>
          <div className="flex gap-1.5 md:gap-2">
            <button onClick={() => scroll('left')} className="w-8 h-8 md:w-9 md:h-9 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-full flex items-center justify-center text-white transition-all text-base md:text-lg font-bold" data-tv-skip="true" tabIndex={-1}>‹</button>
            <button onClick={() => scroll('right')} className="w-8 h-8 md:w-9 md:h-9 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-full flex items-center justify-center text-white transition-all text-base md:text-lg font-bold" data-tv-skip="true" tabIndex={-1}>›</button>
          </div>
        </div>
        <div ref={scrollRef} className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-3 md:pb-4 -mx-1 px-1 md:-mx-2 md:px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }} data-tv-scroll-container="true" data-tv-group={`movies-${title.toLowerCase().replace(/[^a-z]/g, '')}`}>
          {data.items.map((item, index) => (
            <motion.div key={`${item.mediaType || 'movie'}-${item.id}`} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-50px' }} transition={{ delay: Math.min(index * 0.03, 0.3) }} whileTap={{ scale: 0.95 }} onClick={() => onItemClick(item, title)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(item, title); } }} className="flex-shrink-0 w-[120px] sm:w-32 md:w-36 lg:w-44 cursor-pointer group" data-tv-focusable="true" tabIndex={0} role="button" aria-label={item.title || item.name || ''}>
              <motion.div whileHover={{ scale: 1.05, y: -8 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="relative rounded-lg md:rounded-xl overflow-hidden bg-gray-900 shadow-lg group-hover:shadow-xl transition-shadow">
                <img src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '/placeholder-poster.jpg'} alt={item.title || item.name || ''} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 md:transition-opacity md:duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 md:transition-all md:duration-300">
                  <motion.div whileHover={{ scale: 1.1 }} className={`w-10 h-10 md:w-12 md:h-12 ${colors.bg} rounded-full flex items-center justify-center shadow-lg`}>
                    <svg width="16" height="16" className="md:w-5 md:h-5" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </motion.div>
                </div>
                {(item.vote_average ?? 0) > 0 && (
                  <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 px-1 md:px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] md:text-xs font-semibold text-amber-400 flex items-center gap-0.5 md:gap-1">
                    ★ {(item.vote_average ?? 0).toFixed(1)}
                  </div>
                )}
              </motion.div>
              <div className="mt-2 md:mt-2.5 px-0.5 md:px-1">
                <h3 className="text-white font-medium text-xs md:text-sm line-clamp-1 group-hover:text-amber-300 transition-colors">{item.title || item.name}</h3>
                <p className="text-gray-500 text-[10px] md:text-xs mt-0.5">{item.release_date ? new Date(item.release_date).getFullYear() : ''}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
