'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { MediaItem } from '@/types/media';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

interface SearchPageClientProps {
  initialQuery: string;
  initialContentType: string;
  initialGenre: string;
}

interface SearchFilters {
  contentType: 'all' | 'movie' | 'tv';
  genre: string;
  year: string;
  sortBy: 'relevance' | 'rating' | 'release_date' | 'popularity';
}

export default function SearchPageClient({
  initialQuery,
  initialContentType,
  initialGenre,
}: SearchPageClientProps) {
  const router = useRouter();
  const { trackEvent, trackPageView } = useAnalytics();
  
  // State management
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    contentType: (initialContentType as any) || 'all',
    genre: initialGenre,
    year: '',
    sortBy: 'relevance'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2)}`);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fallback popular searches (used if API fails)
  const fallbackPopularSearches = [
    'Marvel', 'DC Comics', 'Star Wars', 'Harry Potter', 'Game of Thrones',
    'Breaking Bad', 'Stranger Things', 'The Office', 'Friends', 'Netflix Originals',
    'Action Movies', 'Comedy Series', 'Horror Films', 'Documentaries', 'Anime'
  ];

  // Analytics tracking
  useEffect(() => {
    trackPageView('/search');
    if (initialQuery) {
      trackEvent('search_page_loaded', {
        initial_query: initialQuery,
        content_type: initialContentType,
        genre: initialGenre
      });
    }
  }, [trackPageView, trackEvent, initialQuery, initialContentType, initialGenre]);

  // Load recent searches from localStorage and popular searches from API
  useEffect(() => {
    // Load recent searches
    const saved = localStorage.getItem('flyx_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }

    // Load popular searches from API
    const loadPopularSearches = async () => {
      try {
        const response = await fetch('/api/search/popular');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPopularSearches(data.data.popular.map((item: any) => item.display_query));
            setTrendingSearches(data.data.trending.map((item: any) => item.display_query));
          }
        }
      } catch (error) {
        console.error('Failed to load popular searches:', error);
        // Use fallback searches
        setPopularSearches(fallbackPopularSearches);
      }
    };

    loadPopularSearches();
  }, []);

  // Perform search
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      trackEvent('search_performed', {
        query: searchQuery,
        content_type: searchFilters.contentType,
        genre: searchFilters.genre,
        year: searchFilters.year,
        sort_by: searchFilters.sortBy
      });

      // Build search URL with parameters
      const searchUrl = new URL('/api/content/search', window.location.origin);
      searchUrl.searchParams.set('query', searchQuery);
      searchUrl.searchParams.set('page', '1');
      searchUrl.searchParams.set('sessionId', sessionId);
      
      if (searchFilters.contentType !== 'all') {
        searchUrl.searchParams.set('type', searchFilters.contentType);
      }

      // Get search results from API
      const response = await fetch(searchUrl.toString());
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Search failed');
      }
      
      const searchResults = data.data || [];
      
      // Filter results based on content type
      let filteredResults = searchResults;
      if (searchFilters.contentType !== 'all') {
        filteredResults = searchResults.filter((item: any) => 
          item.mediaType === searchFilters.contentType
        );
      }

      // Convert to MediaItem format and sort
      const mediaItems: MediaItem[] = filteredResults.map((item: any) => ({
        ...item,
        mediaType: item.mediaType || 'movie'
      }));

      // Apply sorting
      const sortedResults = sortResults(mediaItems, searchFilters.sortBy);
      
      setResults(sortedResults);

      // Save to recent searches
      const updatedRecent = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
      setRecentSearches(updatedRecent);
      localStorage.setItem('flyx_recent_searches', JSON.stringify(updatedRecent));

      // Update URL
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      if (searchFilters.contentType !== 'all') params.set('type', searchFilters.contentType);
      if (searchFilters.genre) params.set('genre', searchFilters.genre);
      router.replace(`/search?${params.toString()}`);

    } catch (error) {
      console.error('Search error:', error);
      trackEvent('search_error', { 
        query: searchQuery, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [recentSearches, router, trackEvent]);

  // Sort results
  const sortResults = (items: MediaItem[], sortBy: string): MediaItem[] => {
    switch (sortBy) {
      case 'rating':
        return [...items].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      case 'release_date':
        return [...items].sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || '').getTime();
          const dateB = new Date(b.release_date || b.first_air_date || '').getTime();
          return dateB - dateA;
        });
      case 'popularity':
        return [...items].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
      default:
        return items;
    }
  };

  // Handle search input
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    performSearch(searchQuery, filters);
  }, [filters, performSearch]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilters: Partial<SearchFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    if (query) {
      performSearch(query, updatedFilters);
    }
  }, [filters, query, performSearch]);

  // Handle content click
  const handleContentClick = useCallback(async (item: MediaItem) => {
    trackEvent('search_result_clicked', {
      content_id: item.id,
      content_type: item.mediaType,
      content_title: item.title || item.name,
      search_query: query,
      result_position: results.indexOf(item) + 1
    });

    // Track that user clicked on a search result
    if (query) {
      try {
        await fetch('/api/search/popular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            sessionId,
            resultsCount: results.length,
            clickedResult: true
          })
        });
      } catch (error) {
        console.error('Failed to track result click:', error);
      }
    }

    router.push(`/details/${item.id}?type=${item.mediaType}`);
  }, [router, trackEvent, query, results, sessionId]);

  // Handle category search
  const handleCategorySearch = useCallback(async (category: string, categoryType: string) => {
    setLoading(true);
    setHasSearched(true);
    setQuery(category);

    try {
      trackEvent('category_search_performed', {
        category,
        category_type: categoryType,
        content_type: filters.contentType
      });

      // Build category search URL
      const searchUrl = new URL('/api/content/search', window.location.origin);
      searchUrl.searchParams.set('category', categoryType);
      searchUrl.searchParams.set('page', '1');
      searchUrl.searchParams.set('sessionId', sessionId);
      
      if (filters.contentType !== 'all') {
        searchUrl.searchParams.set('type', filters.contentType);
      }

      const response = await fetch(searchUrl.toString());
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Category search failed');
      }
      
      const searchResults = data.data || [];

      // Convert to MediaItem format and sort
      const mediaItems: MediaItem[] = searchResults.map((item: any) => ({
        ...item,
        mediaType: item.mediaType || 'movie'
      }));

      const sortedResults = sortResults(mediaItems, filters.sortBy);
      setResults(sortedResults);

      // Update URL
      const params = new URLSearchParams();
      params.set('q', category);
      if (filters.contentType !== 'all') params.set('type', filters.contentType);
      router.replace(`/search?${params.toString()}`);

    } catch (error) {
      console.error('Category search error:', error);
      trackEvent('search_error', { 
        query: category, 
        error: error instanceof Error ? error.message : 'Unknown error',
        search_type: 'category'
      });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sessionId, router, trackEvent]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion, filters);
    trackEvent('search_suggestion_clicked', { suggestion, source: 'popular' });
  }, [filters, performSearch, trackEvent]);

  // Handle recent search click
  const handleRecentClick = useCallback((recent: string) => {
    setQuery(recent);
    performSearch(recent, filters);
    trackEvent('search_suggestion_clicked', { suggestion: recent, source: 'recent' });
  }, [filters, performSearch, trackEvent]);

  // Initial search if query provided
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, filters);
    }
  }, []);

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Navigation onSearch={handleSearch} />
        
        {/* Search Header */}
        <section className="pt-24 pb-12 px-6">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  Discover
                </span>
                <br />
                <span className="text-white/90">Your Next Favorite</span>
              </h1>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Search through millions of movies and TV shows to find exactly what you're looking for
              </p>
            </motion.div>

            {/* Enhanced Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mb-8"
            >
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch(query)}
                  placeholder="Search movies, TV shows, actors, directors..."
                  className="w-full px-6 py-5 pl-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-gray-400 text-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300"
                />
                <svg 
                  className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400" 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5"
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                {query && (
                  <button
                    onClick={() => handleSearch(query)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="M21 21l-4.35-4.35"/>
                    </svg>
                    Search
                  </button>
                )}
              </div>

              {/* Filters Toggle */}
              <div className="flex justify-between items-center mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-all duration-300 border border-white/10"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
                  </svg>
                  Filters
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </motion.button>

                {hasSearched && (
                  <div className="text-gray-400 text-sm">
                    {loading ? 'Searching...' : `${results.length} results found`}
                  </div>
                )}
              </div>

              {/* Filters Panel */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 p-6 bg-white/5 backdrop-blur-md rounded-xl border border-white/10"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Content Type */}
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">Content Type</label>
                        <select
                          value={filters.contentType}
                          onChange={(e) => handleFilterChange({ contentType: e.target.value as any })}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="all">All Content</option>
                          <option value="movie">Movies</option>
                          <option value="tv">TV Shows</option>
                        </select>
                      </div>

                      {/* Year */}
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">Year</label>
                        <input
                          type="number"
                          placeholder="e.g. 2023"
                          value={filters.year}
                          onChange={(e) => handleFilterChange({ year: e.target.value })}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Sort By */}
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">Sort By</label>
                        <select
                          value={filters.sortBy}
                          onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        >
                          <option value="relevance">Relevance</option>
                          <option value="rating">Rating</option>
                          <option value="release_date">Release Date</option>
                          <option value="popularity">Popularity</option>
                        </select>
                      </div>

                      {/* Clear Filters */}
                      <div className="flex items-end">
                        <button
                          onClick={() => handleFilterChange({ contentType: 'all', genre: '', year: '', sortBy: 'relevance' })}
                          className="w-full px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all duration-300 border border-red-600/30"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>       
 {/* Main Content */}
        <main className="px-6 pb-20">
          <div className="container mx-auto max-w-7xl">
            {!hasSearched ? (
              /* Search Suggestions */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                      </svg>
                      Recent Searches
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {recentSearches.map((recent, index) => (
                        <motion.button
                          key={recent}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleRecentClick(recent)}
                          className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all duration-300 border border-white/10"
                        >
                          {recent}
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Trending Searches */}
                {trendingSearches.length > 0 && (
                  <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18"/>
                        <path d="M9 9l1.5-1.5L16 13l4-4"/>
                      </svg>
                      Trending Now
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {trendingSearches.slice(0, 8).map((search, index) => (
                        <motion.button
                          key={search}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSuggestionClick(search)}
                          className="px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-md rounded-full text-white hover:from-red-500/30 hover:to-orange-500/30 transition-all duration-300 border border-white/10 flex items-center gap-2"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                          {search}
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Popular Searches */}
                {popularSearches.length > 0 && (
                  <section className="mb-12">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                      </svg>
                      Popular Searches
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {popularSearches.slice(0, 10).map((search, index) => (
                        <motion.button
                          key={search}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.05, y: -5 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSuggestionClick(search)}
                          className="p-4 bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-xl text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/10 text-left"
                        >
                          <div className="font-semibold">{search}</div>
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Quick Categories */}
                <section>
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    Browse by Category
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { name: 'Action Movies', query: 'Action Movies', categoryType: 'action', gradient: 'from-red-500 to-orange-500', icon: '⚡' },
                      { name: 'Comedy Series', query: 'Comedy Shows', categoryType: 'comedy', gradient: 'from-yellow-400 to-pink-500', icon: '😂' },
                      { name: 'Horror Films', query: 'Horror Movies', categoryType: 'horror', gradient: 'from-gray-800 to-red-900', icon: '👻' },
                      { name: 'Documentaries', query: 'Documentaries', categoryType: 'documentary', gradient: 'from-green-500 to-blue-500', icon: '📚' },
                      { name: 'Anime Series', query: 'Anime', categoryType: 'anime', gradient: 'from-purple-500 to-pink-500', icon: '🎌' },
                      { name: 'Marvel Movies', query: 'Marvel', categoryType: 'marvel', gradient: 'from-red-600 to-blue-600', icon: '🦸' },
                      { name: 'Sci-Fi Shows', query: 'Science Fiction', categoryType: 'sci-fi', gradient: 'from-cyan-500 to-blue-600', icon: '🚀' },
                      { name: 'Romance Films', query: 'Romance', categoryType: 'romance', gradient: 'from-pink-500 to-rose-500', icon: '💕' },
                    ].map((category, index) => (
                      <motion.button
                        key={category.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.05, y: -8 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCategorySearch(category.query, category.categoryType)}
                        className={`relative p-6 rounded-2xl bg-gradient-to-br ${category.gradient} text-white font-semibold text-center overflow-hidden group`}
                      >
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all duration-300" />
                        <div className="relative z-10">
                          <div className="text-3xl mb-2">{category.icon}</div>
                          <div className="text-sm">{category.name}</div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </section>
              </motion.div>
            ) : (
              /* Search Results */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                ref={resultsRef}
              >
                {loading ? (
                  /* Loading State */
                  <div className="flex flex-col items-center justify-center py-20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-16 h-16 border-4 border-purple-600/30 border-t-purple-600 rounded-full mb-6"
                    />
                    <h3 className="text-2xl font-semibold text-white mb-2">Searching...</h3>
                    <p className="text-gray-400">Finding the best results for "{query}"</p>
                  </div>
                ) : results.length > 0 ? (
                  /* Results Grid */
                  <div>
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-bold text-white">
                        Search Results for "{query}"
                      </h2>
                      <div className="text-gray-400">
                        {results.length} results
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {results.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ y: -8 }}
                          onClick={() => handleContentClick(item)}
                          className="cursor-pointer group"
                        >
                          <div className="relative rounded-xl overflow-hidden bg-gray-800 shadow-2xl">
                            <div className="aspect-[2/3] overflow-hidden">
                              <img
                                src={`https://image.tmdb.org/t/p/w500${item.poster_path || item.posterPath || ''}`}
                                alt={item.title || item.name || 'Content'}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                loading="lazy"
                              />
                            </div>
                            
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            
                            {/* Play Button */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <motion.div 
                                whileHover={{ scale: 1.1 }}
                                className="w-16 h-16 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/20"
                              >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </motion.div>
                            </div>

                            {/* Rating Badge */}
                            <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-md rounded-full text-white text-xs font-bold flex items-center gap-1 shadow-lg">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              {(item.vote_average || item.rating || 0).toFixed(1)}
                            </div>

                            {/* Content Type Badge */}
                            <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-full text-white text-xs font-semibold uppercase">
                              {item.mediaType === 'movie' ? 'Movie' : 'TV'}
                            </div>
                          </div>

                          {/* Content Info */}
                          <div className="p-4">
                            <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                              {item.title || item.name || 'Untitled'}
                            </h3>
                            <p className="text-gray-400 text-xs">
                              {new Date(item.release_date || item.first_air_date || item.releaseDate || '').getFullYear()}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* No Results */
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-20"
                  >
                    <div className="text-6xl mb-6">🔍</div>
                    <h3 className="text-2xl font-semibold text-white mb-4">No results found</h3>
                    <p className="text-gray-400 mb-8 max-w-md mx-auto">
                      We couldn't find anything matching "{query}". Try adjusting your search terms or filters.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={() => {
                          setQuery('');
                          setHasSearched(false);
                          setResults([]);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
                      >
                        Start New Search
                      </button>
                      <button
                        onClick={() => handleSuggestionClick('trending')}
                        className="px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-lg font-semibold hover:bg-white/20 transition-all duration-300 border border-white/20"
                      >
                        Browse Trending
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </PageTransition>
  );
}