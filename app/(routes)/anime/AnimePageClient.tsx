'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { MALAnimeListItem } from '@/lib/services/mal-listings';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';

interface CategoryData {
  items: MALAnimeListItem[];
  total: number;
}

interface AnimePageClientProps {
  popular: CategoryData;
  topRated: CategoryData;
  airing: CategoryData;
  action: CategoryData;
  fantasy: CategoryData;
  romance: CategoryData;
  movies: CategoryData;
}

export default function AnimePageClient({
  popular, topRated, airing, action, fantasy, romance, movies,
}: AnimePageClientProps) {
  const router = useRouter();
  const { trackEvent } = useAnalytics();
  const presenceContext = usePresenceContext();

  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('Anime');
    }
  }, []);

  const handleContentClick = useCallback((item: MALAnimeListItem, source: string) => {
    trackEvent('content_clicked', { content_id: item.mal_id, source });
    router.push(`/anime/${item.mal_id}`);
  }, [router, trackEvent]);

  const handleSeeAll = useCallback((filter: string, genre?: string) => {
    const params = new URLSearchParams({ type: filter === 'movies' ? 'anime-movies' : 'anime' });
    if (filter && filter !== 'movies') params.set('filter', filter);
    if (genre) params.set('genre', genre);
    router.push(`/browse?${params.toString()}`);
  }, [router]);

  const contentSections = [
    { title: 'Currently Airing', data: airing, filter: 'airing', accentColor: 'pink' as const },
    { title: 'Popular Anime', data: popular, filter: 'popular', accentColor: 'fuchsia' as const },
    { title: 'Top Rated', data: topRated, filter: 'top_rated', accentColor: 'purple' as const },
    { title: 'Action', data: action, filter: '', genre: 'action', accentColor: 'red' as const },
    { title: 'Fantasy', data: fantasy, filter: '', genre: 'fantasy', accentColor: 'violet' as const },
    { title: 'Romance', data: romance, filter: '', genre: 'romance', accentColor: 'rose' as const },
    { title: 'Anime Movies', data: movies, filter: 'movies', accentColor: 'amber' as const },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0a0812] overflow-x-hidden">
        <section className="relative pt-16 md:pt-20 pb-12 md:pb-16 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-black mb-3 md:mb-4">
                <span className="bg-gradient-to-r from-pink-300 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent">Anime</span>
              </h1>
              <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto">From shonen epics to slice-of-life gems</p>
            </motion.div>
          </div>
        </section>
        <main className="pb-20 space-y-2">
          {contentSections.filter(s => s.data?.items?.length > 0).map((section) => (
            <ContentRow key={section.title} title={section.title} data={section.data} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll(section.filter, section.genre)} accentColor={section.accentColor} />
          ))}
        </main>
      </div>
    </PageTransition>
  );
}

const accentColors: Record<string, { bg: string; text: string; gradient: string }> = {
  pink: { bg: 'bg-pink-500', text: 'text-pink-400', gradient: 'from-pink-600/20 to-pink-600/40' },
  fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-400', gradient: 'from-fuchsia-600/20 to-fuchsia-600/40' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-400', gradient: 'from-purple-600/20 to-purple-600/40' },
  red: { bg: 'bg-red-500', text: 'text-red-400', gradient: 'from-red-600/20 to-red-600/40' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-400', gradient: 'from-violet-600/20 to-violet-600/40' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-400', gradient: 'from-rose-600/20 to-rose-600/40' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-400', gradient: 'from-amber-600/20 to-amber-600/40' },
};

function ContentRow({ title, data, onItemClick, onSeeAll, accentColor = 'pink' }: { 
  title: string; data: CategoryData; onItemClick: (item: MALAnimeListItem, source: string) => void; onSeeAll: () => void; accentColor?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colors = accentColors[accentColor] || accentColors.pink;
  
  if (!data?.items?.length) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-4 md:py-6 px-3 md:px-6 group/section">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-3 md:mb-5">
          <button onClick={onSeeAll} className="text-base sm:text-lg md:text-2xl font-bold text-white flex items-center gap-2 hover:opacity-80 transition-opacity">
            {title} <span className={`text-xs sm:text-sm font-normal ${colors.text}`}>({data.total.toLocaleString()})</span>
          </button>
          
          {/* Scroll Buttons */}
          <div className="hidden md:flex gap-1.5 md:gap-2">
            <button 
              onClick={() => scroll('left')} 
              className="w-8 h-8 md:w-9 md:h-9 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-full flex items-center justify-center text-white transition-all text-base md:text-lg font-bold" 
              data-tv-skip="true" 
              tabIndex={-1}
            >
              ‹
            </button>
            <button 
              onClick={() => scroll('right')} 
              className="w-8 h-8 md:w-9 md:h-9 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-full flex items-center justify-center text-white transition-all text-base md:text-lg font-bold" 
              data-tv-skip="true" 
              tabIndex={-1}
            >
              ›
            </button>
          </div>
        </div>
        
        <div className="relative">
          <div 
            ref={scrollRef} 
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-4" 
            style={{ scrollbarWidth: 'none' }}
          >
            {data.items.map((item) => (
              <motion.div 
                key={item.mal_id} 
                initial={{ opacity: 0 }} 
                whileInView={{ opacity: 1 }} 
                viewport={{ once: true }} 
                onClick={() => onItemClick(item, title)} 
                className="flex-shrink-0 w-[120px] sm:w-32 md:w-36 lg:w-44 cursor-pointer group"
              >
                <div className="relative rounded-lg overflow-hidden bg-gray-900 shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-pink-500/20">
                  <img 
                    src={item.images?.jpg?.large_image_url || '/placeholder-poster.jpg'} 
                    alt={item.title || ''} 
                    className="w-full aspect-[2/3] object-cover transition-transform duration-300 group-hover:scale-110" 
                    loading="lazy" 
                  />
                  
                  {/* Hover overlay with play button */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${colors.gradient} backdrop-blur-sm flex items-center justify-center border border-white/20 transform scale-0 group-hover:scale-100 transition-transform duration-300`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Score badge */}
                  {(item.score ?? 0) > 0 && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] font-semibold text-yellow-400 flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {item.score?.toFixed(1)}
                    </div>
                  )}
                </div>
                <div className="mt-2 px-0.5">
                  <h3 className="text-white font-medium text-xs sm:text-sm line-clamp-1 group-hover:text-pink-300 transition-colors">{item.title_english || item.title}</h3>
                  <p className="text-gray-500 text-[10px] mt-0.5">{item.year || ''}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
