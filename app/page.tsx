import React from 'react';
import { tmdbService } from '@/lib/services/tmdb';
import type { MediaItem } from '@/types/media';
import HomePageClient from './(routes)/HomePageClient';

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
  let actionMovies: MediaItem[] = [];
  let comedyMovies: MediaItem[] = [];
  let horrorMovies: MediaItem[] = [];
  let sciFiTV: MediaItem[] = [];
  let anime: MediaItem[] = [];
  let documentaries: MediaItem[] = [];
  let error: string | null = null;

  try {
    // Fetch premium content in parallel for optimal performance
    const [
      todayData,
      weekData,
      moviesData,
      tvData,
      topRatedData,
      actionData,
      comedyData,
      horrorData,
      sciFiData,
      animeData,
      docsData
    ] = await Promise.all([
      tmdbService.getTrending('all', 'day').catch(() => []),
      tmdbService.getTrending('all', 'week').catch(() => []),
      tmdbService.getPopularMovies(1).catch(() => []),
      tmdbService.getPopularTV(1).catch(() => []),
      tmdbService.getTrending('movie', 'week').catch(() => []),
      tmdbService.searchByCategory('action', 'movie').catch(() => []),
      tmdbService.searchByCategory('comedy', 'movie').catch(() => []),
      tmdbService.searchByCategory('horror', 'movie').catch(() => []),
      tmdbService.searchByCategory('sci-fi', 'tv').catch(() => []),
      tmdbService.searchByCategory('anime', 'all').catch(() => []),
      tmdbService.searchByCategory('documentary', 'all').catch(() => []),
    ]);

    trendingToday = todayData.slice(0, 20);
    trendingWeek = weekData.slice(0, 20);
    popularMovies = moviesData.slice(0, 20);
    popularTV = tvData.slice(0, 20);
    topRated = topRatedData.slice(0, 20);
    actionMovies = actionData.slice(0, 20);
    comedyMovies = comedyData.slice(0, 20);
    horrorMovies = horrorData.slice(0, 20);
    sciFiTV = sciFiData.slice(0, 20);
    anime = animeData.slice(0, 20);
    documentaries = docsData.slice(0, 20);

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
      actionMovies={actionMovies}
      comedyMovies={comedyMovies}
      horrorMovies={horrorMovies}
      sciFiTV={sciFiTV}
      anime={anime}
      documentaries={documentaries}
      error={error}
    />
  );
}