'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { MediaItem } from '@/types/media';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import ContinueWatching from '@/components/home/ContinueWatching';
import { shouldReduceAnimations } from '@/lib/utils/performance';
import { WatchlistButton } from '@/components/ui/WatchlistButton';
import React from 'react';

interface HomePageClientProps {
  heroContent: MediaItem | null;
  trendingToday: MediaItem[];
  trendingWeek: MediaItem[];
  popularMovies: MediaItem[];
  popularTV: MediaItem[];
  topRated: MediaItem[];
  actionMovies: MediaItem[];
  comedyMovies: MediaItem[];
  horrorMovies: MediaItem[];
  sciFiTV: MediaItem[];
  anime: MediaItem[];
  documentaries: MediaItem[];
  error: string | null;
}

/**
 * FlyX Homepage - The Most Stunning Landing Page Ever
 * Features immersive hero sections, smooth animations, and comprehensive analytics
 */
export default function HomePageClient({
  heroContent,
  trendingToday,
  trendingWeek: _trendingWeek,
  popularMovies,
  popularTV,
  topRated,
  actionMovies,
  comedyMovies,
  horrorMovies,
  sciFiTV,
  anime,
  documentaries,
  error,
}: HomePageClientProps) {
  const router = useRouter();
  const { trackEvent, trackPageView } = useAnalytics();

  // State management
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Refs
  const searchRef = useRef<HTMLInputElement>(null);

  // Check for reduced motion preference on mount
  useEffect(() => {
    setReduceMotion(shouldReduceAnimations());
  }, []);

  // Hero carousel content - filter out duplicates
  const heroItems = React.useMemo(() => {
    const items: MediaItem[] = [];
    const seenIds = new Set<number | string>();
    
    // Add heroContent first if it exists
    if (heroContent) {
      items.push(heroContent);
      seenIds.add(heroContent.id);
    }
    
    // Add trending items, skipping duplicates
    for (const item of trendingToday.slice(0, 5)) {
      if (!seenIds.has(item.id)) {
        items.push(item);
        seenIds.add(item.id);
      }
      if (items.length >= 5) break;
    }
    
    return items;
  }, [heroContent, trendingToday]);

  // Get presence context for browsing tracking
  const presenceContext = usePresenceContext();

  // Analytics tracking - run once on mount
  useEffect(() => {
    trackPageView('/');
    trackEvent('homepage_loaded', {
      hero_content: heroContent?.title || heroContent?.name || 'unknown',
      trending_count: trendingToday.length,
      popular_movies_count: popularMovies.length,
      popular_tv_count: popularTV.length
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Set browsing context once on mount
  useEffect(() => {
    if (presenceContext?.setBrowsingContext) {
      presenceContext.setBrowsingContext('Home');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll tracking - throttled for performance, disabled on low-end devices
  useEffect(() => {
    // Skip scroll tracking entirely on low-end devices (parallax is disabled anyway)
    if (reduceMotion) return;
    
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [reduceMotion]);

  // Hero carousel auto-rotation
  useEffect(() => {
    if (heroItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroItems.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [heroItems.length]);

  // Handle content interaction
  const handleContentClick = useCallback((item: MediaItem, source: string) => {
    trackEvent('content_clicked', {
      content_id: item.id,
      content_type: item.mediaType,
      content_title: item.title || item.name,
      source_section: source,
      vote_average: item.vote_average
    });
    // Store navigation origin so details page can return here with scroll position
    sessionStorage.setItem('flyx_navigation_origin', JSON.stringify({
      type: 'home',
      scrollY: window.scrollY,
      source: source,
    }));
    router.push(`/details/${item.id}?type=${item.mediaType}`);
  }, [router, trackEvent]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      trackEvent('search_initiated', {
        query: query.trim(),
        source: 'homepage'
      });
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  }, [router, trackEvent]);

  // Handle hero navigation
  const handleHeroNavigation = useCallback((direction: 'prev' | 'next') => {
    trackEvent('hero_navigation', { direction });
    if (direction === 'next') {
      setCurrentHeroIndex((prev) => (prev + 1) % heroItems.length);
    } else {
      setCurrentHeroIndex((prev) => (prev - 1 + heroItems.length) % heroItems.length);
    }
  }, [heroItems.length, trackEvent]);

  // Current hero item
  const currentHero = heroItems[currentHeroIndex];

  if (error) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 bg-black/20 backdrop-blur-lg rounded-2xl border border-white/10"
          >
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-2xl font-bold text-white mb-2">Oops! Something went wrong</h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
            >
              Try Again
            </button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-black overflow-hidden">
        {/* Navigation */}
        <Navigation onSearch={handleSearch} />

        {/* Immersive Hero Section */}
        {currentHero && (
          <section className="relative h-[100svh] sm:h-[85vh] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHeroIndex}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {/* Background Image with Parallax (disabled on low-end devices) */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(https://image.tmdb.org/t/p/original${currentHero.backdrop_path || currentHero.backdropPath || ''})`,
                    transform: reduceMotion ? undefined : `translateY(${scrollY * 0.5}px)`,
                  }}
                />

                {/* Gradient Overlays - stronger on mobile for readability */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30 sm:from-black/80 sm:via-black/40 sm:to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30 sm:via-transparent" />

                {/* Subtle gradient overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none" />
              </motion.div>
            </AnimatePresence>

            {/* Hero Content */}
            <div className="relative z-10 h-full flex items-end sm:items-center pb-32 sm:pb-0">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl">
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    {/* Featured Content Marquee */}
                    <div className="mb-4 sm:mb-8">
                      <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                      >
                        <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4 flex-wrap">
                          <div className="px-2 py-0.5 sm:px-3 sm:py-1 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full text-white text-xs sm:text-sm font-semibold">
                            NOW FEATURED
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 text-yellow-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="sm:w-4 sm:h-4">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            <span className="text-white text-xs sm:text-sm font-medium">
                              {(currentHero.vote_average || currentHero.rating || 0).toFixed(1)}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] sm:text-xs uppercase tracking-wide text-white/80">
                            {currentHero.mediaType === 'movie' ? 'Movie' : 'Series'}
                          </span>
                        </div>

                        {/* Animated Title */}
                        <div className="relative mb-3 sm:mb-6">
                          <motion.h1
                            key={currentHeroIndex}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white"
                            style={{ lineHeight: 1.1 }}
                          >
                            {currentHero.title || currentHero.name || 'Featured Content'}
                          </motion.h1>
                        </div>

                        {/* Description - hidden on very small screens */}
                        <motion.div
                          key={`desc-${currentHeroIndex}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.6, delay: 0.3 }}
                          className="mb-4 sm:mb-6 hidden xs:block"
                        >
                          <p className="text-sm sm:text-lg md:text-xl text-gray-300 max-w-3xl leading-relaxed line-clamp-2 sm:line-clamp-3">
                            {currentHero.overview || 'Experience premium entertainment with stunning visuals and immersive storytelling.'}
                          </p>
                        </motion.div>
                      </motion.div>
                    </div>

                    {/* Action Buttons - horizontal on mobile */}
                    <div className="flex flex-row gap-2 sm:gap-4 mb-4 sm:mb-8">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleContentClick(currentHero, 'hero_play')}
                        className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full text-sm sm:text-lg shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3"
                        data-tv-focusable="true"
                        data-tv-group="hero-actions"
                        data-tv-primary="true"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="sm:w-6 sm:h-6">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span className="hidden xs:inline">Watch Now</span>
                        <span className="xs:hidden">Play</span>
                      </motion.button>

                      <WatchlistButton item={currentHero} variant="icon" className="sm:hidden" />
                      <div className="hidden sm:block">
                        <WatchlistButton item={currentHero} variant="full" />
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleContentClick(currentHero, 'hero_info')}
                        className="px-4 sm:px-8 py-3 sm:py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-full text-sm sm:text-lg border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3"
                        data-tv-focusable="true"
                        data-tv-group="hero-actions"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-6 sm:h-6">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                        <span className="hidden sm:inline">More Info</span>
                        <span className="sm:hidden">Info</span>
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Hero Navigation - hidden on mobile, shown on tablet+ */}
              {heroItems.length > 1 && (
                <div className="absolute bottom-24 sm:bottom-8 right-4 sm:right-8 hidden sm:flex gap-3 sm:gap-6">
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleHeroNavigation('prev')}
                    className="w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-white/20 hover:to-white/10 transition-all duration-300 border border-white/30 shadow-2xl"
                    data-tv-focusable="true"
                    data-tv-group="hero-nav"
                    aria-label="Previous slide"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="sm:w-8 sm:h-8">
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleHeroNavigation('next')}
                    className="w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-white/20 hover:to-white/10 transition-all duration-300 border border-white/30 shadow-2xl"
                    data-tv-focusable="true"
                    data-tv-group="hero-nav"
                    aria-label="Next slide"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="sm:w-8 sm:h-8">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                  </motion.button>
                </div>
              )}

              {/* Hero Indicators - repositioned for mobile */}
              {heroItems.length > 1 && (
                <div className="absolute bottom-20 sm:bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 sm:gap-3">
                  {heroItems.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentHeroIndex(index)}
                      className={`h-2 sm:h-3 rounded-full transition-all duration-300 ${index === currentHeroIndex ? 'bg-white w-6 sm:w-12' : 'bg-white/40 w-2 sm:w-3'
                        }`}
                      data-tv-skip="true"
                      tabIndex={-1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Scroll Indicator - hidden on mobile */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute bottom-8 left-8 text-white/60 hidden md:block"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium">Scroll to explore</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M19 12l-7 7-7-7" />
                </svg>
              </div>
            </motion.div>
          </section>
        )}

        {/* Main Content */}
        <main className="relative z-10 bg-gradient-to-b from-black via-gray-900 to-black">
          {/* Search Section - smaller on mobile */}
          <section className="py-10 sm:py-20 px-4 sm:px-6">
            <div className="container mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
                  What do you want to watch?
                </h2>
                <div className="max-w-2xl mx-auto relative">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch(searchQuery);
                      }
                    }}
                    placeholder="Search movies, TV shows..."
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 pl-11 sm:pl-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white placeholder-gray-400 text-base sm:text-lg focus:outline-none focus:border-purple-500 transition-all duration-300"
                    style={{ fontSize: '16px' }} // Prevent iOS zoom
                    data-tv-focusable="true"
                    data-tv-group="search"
                  />
                  <svg
                    className="absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-gray-400"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => handleSearch(searchQuery)}
                      className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 px-4 sm:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm sm:text-base font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
                    >
                      Search
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </section>

          {/* Continue Watching Section */}
          <ContinueWatching />

          {/* Content Sections */}
          <div className="space-y-6 sm:space-y-12 mb-12 sm:mb-20">
            <ContentSection
              title="Trending Now"
              items={trendingToday}
              onItemClick={(item) => handleContentClick(item, 'trending_today')}
            />
            <ContentSection
              title="Blockbuster Movies"
              items={popularMovies}
              onItemClick={(item) => handleContentClick(item, 'popular_movies')}
            />
            <ContentSection
              title="Binge-Worthy TV"
              items={popularTV}
              onItemClick={(item) => handleContentClick(item, 'popular_tv')}
            />
            <ContentSection
              title="Critically Acclaimed"
              items={topRated}
              onItemClick={(item) => handleContentClick(item, 'top_rated')}
            />
            <ContentSection
              title="High-Octane Action"
              items={actionMovies}
              onItemClick={(item) => handleContentClick(item, 'action_movies')}
            />
            <ContentSection
              title="Laugh Out Loud"
              items={comedyMovies}
              onItemClick={(item) => handleContentClick(item, 'comedy_movies')}
            />
            <ContentSection
              title="Sci-Fi & Fantasy Worlds"
              items={sciFiTV}
              onItemClick={(item) => handleContentClick(item, 'scifi_tv')}
            />
            <ContentSection
              title="Chills & Thrills"
              items={horrorMovies}
              onItemClick={(item) => handleContentClick(item, 'horror_movies')}
            />
            <ContentSection
              title="Anime Hits"
              items={anime}
              onItemClick={(item) => handleContentClick(item, 'anime')}
            />
            <ContentSection
              title="Real Stories"
              items={documentaries}
              onItemClick={(item) => handleContentClick(item, 'documentaries')}
            />
          </div>

          {/* Explore by Genre */}
          <section className="py-10 sm:py-20 px-4 sm:px-6">
            <div className="container mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-6 sm:mb-12 text-center">
                  Explore by Genre
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
                  {[
                    {
                      name: 'Action',
                      gradient: 'from-red-500 to-orange-500',
                      icon: '⚡'
                    },
                    {
                      name: 'Comedy',
                      gradient: 'from-yellow-400 to-pink-500',
                      icon: '😂'
                    },
                    {
                      name: 'Drama',
                      gradient: 'from-purple-500 to-blue-500',
                      icon: '🎭'
                    },
                    {
                      name: 'Horror',
                      gradient: 'from-gray-800 to-red-900',
                      icon: '👻'
                    },
                    {
                      name: 'Sci-Fi',
                      gradient: 'from-cyan-500 to-blue-600',
                      icon: '🚀'
                    },
                    {
                      name: 'Romance',
                      gradient: 'from-pink-500 to-rose-500',
                      icon: '💕'
                    },
                  ].map((genre, index) => (
                    <motion.button
                      key={genre.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        trackEvent('genre_clicked', { genre: genre.name });
                        handleSearch(genre.name);
                      }}
                      className={`relative p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br ${genre.gradient} text-white font-semibold text-center overflow-hidden group min-h-[70px] sm:min-h-0`}
                    >
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 group-active:bg-black/30 transition-all duration-300" />
                      <div className="relative z-10">
                        <div className="text-xl sm:text-3xl mb-1 sm:mb-2">{genre.icon}</div>
                        <div className="text-xs sm:text-sm font-semibold">{genre.name}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>

          {/* Features Showcase - hidden on mobile for cleaner experience */}
          <section className="hidden sm:block py-12 sm:py-20 px-4 sm:px-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
            <div className="container mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center mb-10 sm:mb-16"
              >
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
                  Why Choose FlyX?
                </h2>
                <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto px-4">
                  Experience entertainment like never before with our cutting-edge platform
                </p>
              </motion.div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
                {[
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4" />
                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
                        <path d="M13 12h3" />
                        <path d="M8 12H5" />
                      </svg>
                    ),
                    title: 'AI-Powered Recommendations',
                    description: 'Smart algorithms learn your preferences to suggest content you\'ll love'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    ),
                    title: 'Lightning Fast Streaming',
                    description: 'Instant playback with adaptive quality for your connection speed'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    ),
                    title: '4K Ultra HD Quality',
                    description: 'Crystal clear picture quality with HDR support on compatible devices'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <rect x="7" y="8" width="10" height="8" rx="1" ry="1" />
                        <path d="M7 16h10" />
                        <path d="M12 8v8" />
                      </svg>
                    ),
                    title: 'Multi-Device Sync',
                    description: 'Start watching on one device, continue seamlessly on another'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    ),
                    title: 'No Ads, No Interruptions',
                    description: 'Enjoy uninterrupted viewing with zero advertisements'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    ),
                    title: 'Secure & Private',
                    description: 'Your data is protected with enterprise-grade security'
                  }
                ].map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -10 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="p-8 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all duration-300"
                  >
                    <div className="text-purple-400 mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-300 leading-relaxed">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="py-20 px-6">
            <div className="container mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto"
              >
                <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
                  Ready to Start Your Journey?
                </h2>
                <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
                  Join millions of users who have already discovered the future of entertainment
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 15px 35px rgba(120, 119, 198, 0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      trackEvent('cta_clicked', { action: 'start_exploring' });
                      handleSearch('trending');
                    }}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full text-lg shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 flex items-center gap-3"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    Start Exploring
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 255, 255, 0.1)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      trackEvent('cta_clicked', { action: 'browse_content' });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-full text-lg border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-3"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6l2 13h7l4-8H9" />
                      <circle cx="9" cy="20" r="1" />
                      <circle cx="20" cy="20" r="1" />
                    </svg>
                    Browse Content
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </PageTransition>
  );
}

// Content Section Component
function ContentSection({
  title,
  items,
  onItemClick
}: {
  title: string;
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Check for reduced motion preference on mount
  useEffect(() => {
    setReduceMotion(shouldReduceAnimations());
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth < 640 ? 280 : 600;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Get icon for title
  const getIcon = () => {
    if (title.includes('Trending')) return <span className="text-xl sm:text-3xl">🔥</span>;
    if (title.includes('Blockbuster')) return <span className="text-xl sm:text-3xl">🎬</span>;
    if (title.includes('TV')) return <span className="text-xl sm:text-3xl">📺</span>;
    if (title.includes('Acclaimed')) return <span className="text-xl sm:text-3xl">⭐</span>;
    if (title.includes('Action')) return <span className="text-xl sm:text-3xl">⚡</span>;
    if (title.includes('Laugh')) return <span className="text-xl sm:text-3xl">😂</span>;
    if (title.includes('Sci-Fi')) return <span className="text-xl sm:text-3xl">🚀</span>;
    if (title.includes('Chills')) return <span className="text-xl sm:text-3xl">👻</span>;
    if (title.includes('Anime')) return <span className="text-xl sm:text-3xl">🎌</span>;
    if (title.includes('Real')) return <span className="text-xl sm:text-3xl">🌍</span>;
    return null;
  };

  return (
    <section className="py-4 sm:py-12 px-3 sm:px-6">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-8">
            <h2 className="text-base sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
              {getIcon()}
              <span>{title}</span>
            </h2>
            {/* Hide scroll buttons on mobile - users swipe instead */}
            <div className="hidden sm:flex gap-2 sm:gap-4">
              {reduceMotion ? (
                <>
                  <button
                    onClick={() => scroll('left')}
                    className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
                    data-tv-skip="true"
                    tabIndex={-1}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="sm:w-8 sm:h-8">
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => scroll('right')}
                    className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
                    data-tv-skip="true"
                    tabIndex={-1}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="sm:w-8 sm:h-8">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => scroll('left')}
                    className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
                    data-tv-skip="true"
                    tabIndex={-1}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="sm:w-8 sm:h-8">
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => scroll('right')}
                    className="w-10 h-10 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
                    data-tv-skip="true"
                    tabIndex={-1}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="sm:w-8 sm:h-8">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                  </motion.button>
                </>
              )}
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-2.5 sm:gap-6 overflow-x-auto scrollbar-hide pb-4 sm:pb-8 pt-2 sm:pt-4 px-1 sm:px-2 snap-x snap-mandatory sm:snap-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            data-tv-scroll-container="true"
            data-tv-group={`content-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {items.map((item, index) => {
              // Card content shared between both versions
              const cardContent = (
                <>
                  <div className={`relative rounded-lg sm:rounded-xl bg-gray-800 shadow-lg sm:shadow-2xl overflow-hidden ${reduceMotion ? 'transition-transform duration-200 hover:scale-[1.02] hover:-translate-y-1' : ''}`}>
                    <div className="overflow-hidden rounded-lg sm:rounded-xl">
                      <img
                        src={`https://image.tmdb.org/t/p/w500${item.poster_path || item.posterPath || ''}`}
                        alt={item.title || item.name || 'Content'}
                        className={`w-full aspect-[2/3] object-cover ${reduceMotion ? '' : 'group-hover:scale-110'} transition-transform duration-500`}
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Play Button Overlay - smaller on mobile */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                      <div className="w-12 h-12 sm:w-20 sm:h-20 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/20">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" strokeWidth="0" className="sm:w-7 sm:h-7">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>

                    {/* Rating Badge - smaller on mobile */}
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 px-1.5 py-0.5 sm:px-3 sm:py-2 bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-md rounded-full text-white text-[10px] sm:text-sm font-bold flex items-center gap-1 sm:gap-2 shadow-lg border border-white/20">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="sm:w-3.5 sm:h-3.5">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {(item.vote_average || item.rating || 0).toFixed(1)}
                    </div>
                  </div>

                  <div className="p-1.5 sm:p-4">
                    <h3 className="text-white font-medium sm:font-semibold text-xs sm:text-lg mb-0.5 sm:mb-2 line-clamp-1 sm:line-clamp-2">
                      {item.title || item.name || 'Untitled'}
                    </h3>
                    <p className="text-gray-400 text-[10px] sm:text-sm">
                      {new Date(item.release_date || item.first_air_date || item.releaseDate || '').getFullYear()}
                    </p>
                  </div>
                </>
              );

              const handleKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onItemClick(item);
                }
              };

              return reduceMotion ? (
                // Simple version for low-end devices
                <div
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  onKeyDown={handleKeyDown}
                  className="flex-shrink-0 w-28 sm:w-56 md:w-64 cursor-pointer group snap-start"
                  data-tv-focusable="true"
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.title || item.name}`}
                >
                  {cardContent}
                </div>
              ) : (
                // Full animation version for capable devices
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onItemClick(item)}
                  onKeyDown={handleKeyDown}
                  className="flex-shrink-0 w-28 sm:w-56 md:w-64 cursor-pointer group snap-start"
                  data-tv-focusable="true"
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.title || item.name}`}
                  whileHover={{ scale: 1.02, y: -4 }}
                >
                  {cardContent}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}