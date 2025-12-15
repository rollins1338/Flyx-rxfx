'use client';

import { useCallback, useRef, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaItem } from '@/types/media';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';

interface CategoryData {
  items: MediaItem[];
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

  // Track browsing activity - run once on mount
  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('Anime');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentClick = useCallback((item: MediaItem, source: string) => {
    trackEvent('content_clicked', { content_id: item.id, source });
    router.push(`/details/${item.id}?type=${item.mediaType || 'tv'}`);
  }, [router, trackEvent]);

  const handleSearch = useCallback((query: string) => {
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`);
  }, [router]);

  const handleSeeAll = useCallback((filter: string, genre?: string) => {
    const params = new URLSearchParams({ type: filter === 'movies' ? 'anime-movies' : 'anime' });
    if (filter && filter !== 'movies') params.set('filter', filter);
    if (genre) params.set('genre', genre);
    router.push(`/browse?${params.toString()}`);
  }, [router]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0a0812] overflow-x-hidden">
        <Navigation onSearch={handleSearch} />
        
        {/* Vibrant Anime Hero */}
        <section className="relative pt-20 pb-16 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-pink-900/20 via-purple-900/10 to-[#0a0812]" />
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-[180px] animate-pulse" />
            <div className="absolute top-20 right-1/3 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            
            <div className="absolute top-20 left-10 opacity-10">
              <svg width="120" height="120" viewBox="0 0 100 100" className="text-pink-400">
                <polygon points="50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40" fill="currentColor"/>
              </svg>
            </div>
            <div className="absolute bottom-20 right-10 opacity-10">
              <svg width="80" height="80" viewBox="0 0 100 100" className="text-fuchsia-400">
                <polygon points="50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40" fill="currentColor"/>
              </svg>
            </div>
            
            {/* Floating particles - CSS only */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-pink-400/40 rounded-full animate-float"
                style={{ 
                  left: `${15 + i * 15}%`, 
                  top: `${20 + (i % 3) * 20}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${3 + i * 0.5}s`
                }}
              />
            ))}
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center max-w-4xl mx-auto anime-hero">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 mb-6 shadow-lg shadow-pink-500/30 anime-icon">
                <span className="text-4xl">🎌</span>
              </div>

              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-4">
                <span className="bg-gradient-to-r from-pink-300 via-fuchsia-400 to-purple-400 bg-clip-text text-transparent drop-shadow-2xl">
                  Anime
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
                From shonen epics to slice-of-life gems — Japanese animation at its finest
              </p>

              <div className="flex items-center justify-center gap-6 mt-8 flex-wrap anime-stats">
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/20 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                  </span>
                  <span className="text-sm text-pink-400 font-medium">{(airing?.total ?? 0).toLocaleString()} Currently Airing</span>
                </div>
                <div className="px-4 py-2 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full">
                  <span className="text-sm text-fuchsia-400 font-medium">🎬 {(movies?.total ?? 0).toLocaleString()} Movies</span>
                </div>
                <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full">
                  <span className="text-sm text-purple-400 font-medium">⭐ {(topRated?.total ?? 0).toLocaleString()} Top Rated</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Content Sections */}
        <main className="pb-20 space-y-2">
          <ContentRow title="📺 Currently Airing" data={airing} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('airing')} accentColor="pink" isAiring />
          <ContentRow title="🔥 Popular Anime" data={popular} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('popular')} accentColor="fuchsia" />
          <ContentRow title="⭐ Top Rated" data={topRated} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('top_rated')} accentColor="purple" />
          <ContentRow title="⚔️ Action & Adventure" data={action} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', 'action')} accentColor="red" />
          <ContentRow title="✨ Fantasy & Sci-Fi" data={fantasy} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', 'fantasy')} accentColor="violet" />
          <ContentRow title="💕 Romance" data={romance} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', 'romance')} accentColor="rose" />
          <ContentRow title="🎬 Anime Movies" data={movies} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('movies')} accentColor="amber" isMovie />
        </main>

        <Footer />

        {/* CSS Animations */}
        <style jsx>{`
          .anime-hero {
            animation: heroFadeIn 0.6s ease-out;
          }
          .anime-icon {
            animation: iconPop 0.5s ease-out 0.2s both;
          }
          .anime-stats {
            animation: statsFadeIn 0.4s ease-out 0.4s both;
          }
          @keyframes heroFadeIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes iconPop {
            from { opacity: 0; transform: scale(0) rotate(-180deg); }
            to { opacity: 1; transform: scale(1) rotate(0deg); }
          }
          @keyframes statsFadeIn {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(-10px); opacity: 0.3; }
            50% { transform: translateY(10px); opacity: 0.7; }
          }
          :global(.animate-float) {
            animation: float 3s ease-in-out infinite;
          }
        `}</style>
      </div>
    </PageTransition>
  );
}

const accentColors: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  pink: { bg: 'bg-pink-500', text: 'text-pink-400', glow: 'shadow-pink-500/50', border: 'border-pink-500/30' },
  fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-400', glow: 'shadow-fuchsia-500/50', border: 'border-fuchsia-500/30' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/50', border: 'border-purple-500/30' },
  red: { bg: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/50', border: 'border-red-500/30' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-400', glow: 'shadow-violet-500/50', border: 'border-violet-500/30' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-400', glow: 'shadow-rose-500/50', border: 'border-rose-500/30' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/50', border: 'border-amber-500/30' },
};

// Memoized ContentRow for better performance
const ContentRow = memo(function ContentRow({ 
  title, 
  data, 
  onItemClick,
  onSeeAll,
  accentColor = 'pink',
  isAiring = false,
  isMovie = false
}: { 
  title: string; 
  data: CategoryData; 
  onItemClick: (item: MediaItem, source: string) => void;
  onSeeAll: () => void;
  accentColor?: string;
  isAiring?: boolean;
  isMovie?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colors = accentColors[accentColor] || accentColors.pink;

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -600 : 600,
        behavior: 'smooth',
      });
    }
  }, []);

  if (!data?.items?.length) return null;

  return (
    <section className="py-6 px-6">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onSeeAll}
            className="text-xl md:text-2xl font-bold text-white flex items-center gap-3 hover:opacity-80 transition-opacity group"
            data-tv-focusable="true"
            data-tv-group={`anime-header-${title.toLowerCase().replace(/[^a-z]/g, '')}`}
          >
            {title}
            {isAiring && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-pink-500/20 border border-pink-500/30 rounded-full text-xs font-medium text-pink-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-400"></span>
                </span>
                AIRING
              </span>
            )}
            {isMovie && (
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs font-medium text-amber-400">
                FILMS
              </span>
            )}
            <span className={`text-sm font-normal ${colors.text}`}>({(data?.total ?? data?.items?.length ?? 0).toLocaleString()})</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={`${colors.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 text-lg font-bold"
              data-tv-skip="true"
              tabIndex={-1}
            >
              ‹
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 text-lg font-bold"
              data-tv-skip="true"
              tabIndex={-1}
            >
              ›
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          data-tv-scroll-container="true"
          data-tv-group={`anime-${title.toLowerCase().replace(/[^a-z]/g, '')}`}
        >
          {data.items.map((item, index) => (
            <AnimeCard key={item.id} item={item} index={index} title={title} colors={colors} isAiring={isAiring} isMovie={isMovie} onItemClick={onItemClick} />
          ))}
        </div>
      </div>
    </section>
  );
});

// Memoized AnimeCard for better performance
const AnimeCard = memo(function AnimeCard({ item, index, title, colors, isAiring, isMovie, onItemClick }: {
  item: MediaItem; index: number; title: string; colors: { bg: string; text: string; glow: string; border: string }; isAiring: boolean; isMovie: boolean; onItemClick: (item: MediaItem, source: string) => void;
}) {
  const handleClick = useCallback(() => onItemClick(item, title), [item, title, onItemClick]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(item, title); }
  }, [item, title, onItemClick]);

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex-shrink-0 w-36 md:w-44 cursor-pointer group"
      style={{ animation: index < 12 ? `cardFadeIn 0.3s ease-out ${Math.min(index * 0.03, 0.3)}s both` : 'none' }}
      data-tv-focusable="true"
      tabIndex={0}
      role="button"
      aria-label={item.title || item.name || ''}
    >
      <div className={`relative rounded-xl overflow-hidden bg-gray-900 shadow-lg group-hover:shadow-xl transition-all duration-200 transform group-hover:scale-105 group-hover:-translate-y-2 group-focus-within:scale-105 group-focus-within:-translate-y-2 ${isAiring ? `border ${colors.border}` : ''}`}>
        <img
          src={item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '/placeholder-poster.jpg'}
          alt={item.title || item.name || ''}
          className="w-full aspect-[2/3] object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center shadow-lg`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {(item.vote_average ?? 0) > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs font-semibold text-pink-400 flex items-center gap-1">
            ★ {(item.vote_average ?? 0).toFixed(1)}
          </div>
        )}
        {isAiring && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-pink-500/90 rounded text-[10px] font-bold text-white uppercase">
            New EP
          </div>
        )}
        {isMovie && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500/90 rounded text-[10px] font-bold text-white uppercase">
            Film
          </div>
        )}
      </div>
      <div className="mt-2.5 px-1">
        <h3 className="text-white font-medium text-sm line-clamp-1 group-hover:text-pink-300 transition-colors">
          {item.title || item.name}
        </h3>
        <p className="text-gray-500 text-xs mt-0.5">
          {(item.first_air_date || item.release_date) ? new Date(item.first_air_date || item.release_date || '').getFullYear() : ''}
        </p>
      </div>
      <style jsx>{`
        @keyframes cardFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
});
