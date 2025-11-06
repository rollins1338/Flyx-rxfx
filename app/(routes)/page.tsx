import React from 'react';
import { tmdbService } from '@/lib/services/tmdb';
import type { MediaItem } from '@/types/media';
import HomePageClient from './HomePageClient';

/**
 * FlyX Homepage - Server Component
 * Fetches curated content for the most stunning landing page experience
 */
export default async function HomePage() {
  let heroContent: MediaItem | null = null;
  let trendingToday: MediaItem[] = [];
  let trendingWeek: MediaItem[] = [];
  let popularMovies: MediaItem[] = [];
  let popularTV: MediaItem[] = [];
  let topRated: MediaItem[] = [];
  let error: string | null = null;

  try {
    // Fetch premium content in parallel for optimal performance
    const [todayData, weekData, moviesData, tvData, topRatedData] = await Promise.all([
      tmdbService.getTrending('all', 'day').catch(() => []),
      tmdbService.getTrending('all', 'week').catch(() => []),
      tmdbService.getPopularMovies(1).catch(() => []),
      tmdbService.getPopularTV(1).catch(() => []),
      tmdbService.getTrending('movie', 'week').catch(() => []),
    ]);

    trendingToday = todayData.slice(0, 20);
    trendingWeek = weekData.slice(0, 20);
    popularMovies = moviesData.slice(0, 20);
    popularTV = tvData.slice(0, 20);
    topRated = topRatedData.slice(0, 12);
    
    // Select the most impressive content for hero
    heroContent = todayData.find(item => item.backdrop_path && (item.vote_average || 0) > 7) || todayData[0] || null;
  } catch (err) {
    console.error('Error fetching home page data:', err);
    error = 'Failed to load content. Please try again later.';
  }

  return (
    <HomePageClient
      heroContent={heroContent}
      trendingToday={trendingToday}
      trendingWeek={trendingWeek}
      popularMovies={popularMovies}
      popularTV={popularTV}
      topRated={topRated}
      error={error}
    />
  );
}
