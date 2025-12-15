'use client';

import { useCallback, useRef, useEffect, useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaItem } from '@/types/media';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import { useRegion } from '@/app/lib/context/RegionContext';
import { RegionSelector } from '@/components/ui/RegionSelector';

interface CategoryData {
  items: MediaItem[];
  total: number;
}

interface SeriesData {
  popular: CategoryData;
  topRated: CategoryData;
  onAir: CategoryData;
  airingToday: CategoryData;
  drama: CategoryData;
  crime: CategoryData;
  sciFi: CategoryData;
  comedy: CategoryData;
  mystery: CategoryData;
  thriller: CategoryData;
  documentary: CategoryData;
  reality: CategoryData;
  family: CategoryData;
  western: CategoryData;
  war: CategoryData;
}

const emptyCategory: CategoryData = { items: [], total: 0 };
const initialData: SeriesData = {
  popular: emptyCategory, topRated: emptyCategory, onAir: emptyCategory, airingToday: emptyCategory,
  drama: emptyCategory, crime: emptyCategory, sciFi: emptyCategory, comedy: emptyCategory,
  mystery: emptyCategory, thriller: emptyCategory, documentary: emptyCategory, reality: emptyCategory,
  family: emptyCategory, western: emptyCategory, war: emptyCategory,
};

export default function SeriesPageClient() {
  const router = useRouter();
  const { trackEvent } = useAnalytics();
  const presenceContext = usePresenceContext();
  const { region } = useRegion();
  const [data, setData] = useState<SeriesData>(initialData);
  const [loading, setLoading] = useState(true);

  // Track browsing activity - run once on mount
  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('TV Series');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/content/series?region=${region.code}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch series:', error);
      }
      setLoading(false);
    }
    fetchData();
  }, [region.code]);

  const handleContentClick = useCallback((item: MediaItem, source: string) => {
    trackEvent('content_clicked', { content_id: item.id, source });
    router.push(`/details/${item.id}?type=tv`);
  }, [router, trackEvent]);

  const handleSearch = useCallback((query: string) => {
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query)}`);
  }, [router]);

  const handleSeeAll = useCallback((filter: string, genre?: string) => {
    const params = new URLSearchParams({ type: 'tv' });
    if (genre) params.set('genre', genre);
    else params.set('filter', filter);
    if (region.code) params.set('region', region.code);
    router.push(`/browse?${params.toString()}`);
  }, [router, region.code]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#080810] overflow-x-hidden flex flex-col">
        <Navigation onSearch={handleSearch} />
        
        {/* Cool Blue Hero */}
        <section className="relative pt-24 pb-16 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/20 via-transparent to-[#080810]" />
            <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[150px]" />
            <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-teal-500/8 rounded-full blur-[100px]" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400">Loading series...</p>
              </div>
            ) : (
              <div className="text-center max-w-4xl mx-auto series-hero">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 mb-6 shadow-lg shadow-cyan-500/25 series-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM9 10l5 3-5 3v-6z"/>
                  </svg>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-4">
                  <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-teal-400 bg-clip-text text-transparent">TV Series</span>
                </h1>
                <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
                  Binge-worthy dramas, thrilling mysteries, and epic sagas await
                </p>

                <div className="flex items-center justify-center gap-8 mt-8 series-stats">
                  <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    <span className="text-sm text-cyan-400 font-medium">{(data.airingToday?.total ?? 0).toLocaleString()} Airing Today</span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">{(data.onAir?.total ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">On The Air</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">15</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Categories</div>
                  </div>
                </div>

                {/* Region Selector */}
                <div className="flex justify-center mt-8">
                  <RegionSelector />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Spacer to push footer down while loading */}
        {loading && <div className="flex-grow" />}

        {/* Content Sections */}
        {!loading && (
          <main className="pb-20 space-y-2 flex-grow">
            <ContentRow title="📺 Airing Today" data={data.airingToday} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('airing_today')} accentColor="cyan" isLive />
            <ContentRow title="📡 On The Air" data={data.onAir} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('on_the_air')} accentColor="teal" />
            <ContentRow title="🔥 Popular Now" data={data.popular} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('popular')} accentColor="blue" />
            <ContentRow title="⭐ Top Rated" data={data.topRated} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('top_rated')} accentColor="indigo" />
            <ContentRow title="🎭 Drama" data={data.drama} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '18')} accentColor="purple" />
            <ContentRow title="🔍 Crime" data={data.crime} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '80')} accentColor="red" />
            <ContentRow title="🔎 Mystery" data={data.mystery} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '9648')} accentColor="slate" />
            <ContentRow title="💥 Action & Adventure" data={data.thriller} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10759')} accentColor="orange" />
            <ContentRow title="🚀 Sci-Fi & Fantasy" data={data.sciFi} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10765')} accentColor="violet" />
            <ContentRow title="😂 Comedy" data={data.comedy} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '35')} accentColor="green" />
            <ContentRow title="📹 Documentary" data={data.documentary} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '99')} accentColor="gray" />
            <ContentRow title="📺 Reality" data={data.reality} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10764')} accentColor="pink" />
            <ContentRow title="👨‍👩‍👧‍👦 Family" data={data.family} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10751')} accentColor="amber" />
            <ContentRow title="🤠 Western" data={data.western} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '37')} accentColor="yellow" />
            <ContentRow title="⚔️ War & Politics" data={data.war} onItemClick={handleContentClick} onSeeAll={() => handleSeeAll('', '10768')} accentColor="rose" />
          </main>
        )}

        <Footer />

        {/* CSS Animations for hero */}
        <style jsx>{`
          .series-hero {
            animation: heroFadeIn 0.6s ease-out;
          }
          .series-icon {
            animation: iconPop 0.5s ease-out 0.2s both;
          }
          .series-stats {
            animation: statsFadeIn 0.4s ease-out 0.4s both;
          }
          @keyframes heroFadeIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes iconPop {
            from { opacity: 0; transform: scale(0); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes statsFadeIn {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </PageTransition>
  );
}

const accentColors: Record<string, { bg: string; text: string; border: string }> = {
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500/30' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500/30' },
  red: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/30' },
  green: { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-400', border: 'border-slate-500/30' },
  gray: { bg: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500/30' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500/30' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30' },
};

// Memoized ContentRow for better performance
const ContentRow = memo(function ContentRow({ title, data, onItemClick, onSeeAll, accentColor = 'cyan', isLive = false }: { 
  title: string; data: CategoryData; onItemClick: (item: MediaItem, source: string) => void; onSeeAll: () => void; accentColor?: string; isLive?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colors = accentColors[accentColor] || accentColors.cyan;
  const scroll = useCallback((dir: 'left' | 'right') => scrollRef.current?.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' }), []);

  if (!data?.items?.length) return null;

  return (
    <section className="py-6 px-6">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-5">
          <button onClick={onSeeAll} className="text-xl md:text-2xl font-bold text-white flex items-center gap-3 hover:opacity-80 transition-opacity group" data-tv-focusable="true" data-tv-group={`series-header-${title.toLowerCase().replace(/[^a-z]/g, '')}`}>
            {title}
            {isLive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-xs font-medium text-cyan-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
                </span>
                LIVE
              </span>
            )}
            <span className={`text-sm font-normal ${colors.text}`}>({(data?.total ?? data?.items?.length ?? 0).toLocaleString()})</span>
            <span className={`${colors.text} opacity-0 group-hover:opacity-100 transition-opacity`}>→</span>
          </button>
          <div className="flex gap-2">
            <button onClick={() => scroll('left')} className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 text-lg font-bold" data-tv-skip="true" tabIndex={-1}>‹</button>
            <button onClick={() => scroll('right')} className="w-9 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 text-lg font-bold" data-tv-skip="true" tabIndex={-1}>›</button>
          </div>
        </div>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} data-tv-scroll-container="true" data-tv-group={`series-${title.toLowerCase().replace(/[^a-z]/g, '')}`}>
          {data.items.map((item, index) => (
            <SeriesCard key={item.id} item={item} index={index} title={title} colors={colors} isLive={isLive} onItemClick={onItemClick} />
          ))}
        </div>
      </div>
    </section>
  );
});

// Memoized SeriesCard for better performance
const SeriesCard = memo(function SeriesCard({ item, index, title, colors, isLive, onItemClick }: {
  item: MediaItem; index: number; title: string; colors: { bg: string; text: string; border: string }; isLive: boolean; onItemClick: (item: MediaItem, source: string) => void;
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
      <div className={`relative rounded-xl overflow-hidden bg-gray-900 shadow-lg group-hover:shadow-xl transition-all duration-200 transform group-hover:scale-105 group-hover:-translate-y-2 group-focus-within:scale-105 group-focus-within:-translate-y-2 ${isLive ? `border ${colors.border}` : ''}`}>
        <img src={item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : '/placeholder-poster.jpg'} alt={item.title || item.name || ''} className="w-full aspect-[2/3] object-cover" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center shadow-lg`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
        {(item.vote_average ?? 0) > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-xs font-semibold text-cyan-400 flex items-center gap-1">
            ★ {(item.vote_average ?? 0).toFixed(1)}
          </div>
        )}
        {isLive && <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-cyan-500/90 rounded text-[10px] font-bold text-white uppercase">New EP</div>}
      </div>
      <div className="mt-2.5 px-1">
        <h3 className="text-white font-medium text-sm line-clamp-1 group-hover:text-cyan-300 transition-colors">{item.title || item.name}</h3>
        <p className="text-gray-500 text-xs mt-0.5">{item.first_air_date ? new Date(item.first_air_date).getFullYear() : ''}</p>
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
