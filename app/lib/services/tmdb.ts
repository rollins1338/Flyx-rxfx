/**
 * TMDB API Service Adapter
 * Handles all interactions with The Movie Database API
 */

import type { MediaItem, SearchResult, Genre, Season, Episode } from '@/types/media';
import type { APIResponse, RequestConfig } from '@/types/api';
import { cacheManager, CACHE_DURATIONS, generateCacheKey } from '@/lib/utils/cache';
import { APIErrorHandler, fetchWithTimeout, createAPIError } from '@/lib/utils/error-handler';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Get TMDB API key from environment
 */
function getAPIKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) {
    throw createAPIError(
      'MISSING_API_KEY',
      'TMDB API key is not configured',
      500,
      false
    );
  }
  return apiKey;
}

/**
 * Transform TMDB movie/TV response to MediaItem
 */
function transformToMediaItem(item: any, mediaType: 'movie' | 'tv'): MediaItem {
  return {
    id: item.id.toString(),
    title: mediaType === 'movie' ? item.title : item.name,
    overview: item.overview || '',
    posterPath: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` : '',
    backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/original${item.backdrop_path}` : '',
    releaseDate: mediaType === 'movie' ? item.release_date : item.first_air_date,
    rating: item.vote_average || 0,
    voteCount: item.vote_count || 0,
    mediaType,
    genres: item.genres || [],
    runtime: item.runtime,
    seasons: item.seasons ? item.seasons.map(transformToSeason) : undefined,
  };
}

/**
 * Transform TMDB season to Season
 */
function transformToSeason(season: any): Season {
  return {
    seasonNumber: season.season_number,
    episodeCount: season.episode_count,
    episodes: [],
  };
}

/**
 * Transform TMDB episode to Episode
 */
function transformToEpisode(episode: any): Episode {
  return {
    id: episode.id.toString(),
    episodeNumber: episode.episode_number,
    seasonNumber: episode.season_number,
    title: episode.name,
    overview: episode.overview || '',
    stillPath: episode.still_path ? `${TMDB_IMAGE_BASE_URL}/w500${episode.still_path}` : '',
    airDate: episode.air_date || '',
    runtime: episode.runtime || 0,
  };
}

/**
 * Transform search result
 */
function transformToSearchResult(item: any): SearchResult {
  const mediaType = item.media_type === 'movie' ? 'movie' : 'tv';
  return {
    id: item.id.toString(),
    title: mediaType === 'movie' ? item.title : item.name,
    posterPath: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` : '',
    mediaType,
    releaseDate: mediaType === 'movie' ? item.release_date : item.first_air_date,
    rating: item.vote_average || 0,
  };
}

/**
 * Make a request to TMDB API
 */
async function tmdbRequest<T>(
  endpoint: string,
  params: Record<string, any> = {},
  config: RequestConfig = {}
): Promise<APIResponse<T>> {
  const apiKey = getAPIKey();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  
  // Add API key and params
  url.searchParams.append('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  // Check cache if enabled
  if (config.cache !== false) {
    const cacheKey = generateCacheKey(endpoint, params);
    const cached = await cacheManager.get<T>(cacheKey);
    if (cached) {
      return {
        data: cached,
        cached: true,
        timestamp: Date.now(),
      };
    }
  }

  // Make request with retry logic
  try {
    const data = await APIErrorHandler.executeWithRetry(async () => {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        config.timeout || 10000
      );

      if (!response.ok) {
        throw createAPIError(
          `TMDB_${response.status}`,
          `TMDB API error: ${response.statusText}`,
          response.status,
          response.status >= 500
        );
      }

      return await response.json();
    }, config.retry);

    // Cache the result
    if (config.cache !== false) {
      const cacheKey = generateCacheKey(endpoint, params);
      const ttl = config.cacheTTL || CACHE_DURATIONS.trending;
      await cacheManager.set(cacheKey, data, ttl);
    }

    return {
      data,
      cached: false,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      error: APIErrorHandler.handle(error),
      timestamp: Date.now(),
    };
  }
}

/**
 * TMDB Service
 */
export const tmdbService = {
  /**
   * Get trending movies and TV shows
   */
  async getTrending(
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<MediaItem[]> {
    const response = await tmdbRequest<any>(
      `/trending/${mediaType}/${timeWindow}`,
      {},
      { cacheTTL: CACHE_DURATIONS.trending }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return response.data.results.map((item: any) =>
      transformToMediaItem(item, item.media_type === 'movie' ? 'movie' : 'tv')
    );
  },

  /**
   * Search for movies and TV shows
   */
  async search(query: string, page: number = 1): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const response = await tmdbRequest<any>(
      '/search/multi',
      { query, page },
      { cacheTTL: CACHE_DURATIONS.search }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return response.data.results
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .map(transformToSearchResult);
  },

  /**
   * Get movie details
   */
  async getMovieDetails(movieId: string): Promise<MediaItem> {
    const response = await tmdbRequest<any>(
      `/movie/${movieId}`,
      { append_to_response: 'credits,videos' },
      { cacheTTL: CACHE_DURATIONS.details }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return transformToMediaItem(response.data, 'movie');
  },

  /**
   * Get TV show details
   */
  async getTVDetails(tvId: string): Promise<MediaItem> {
    const response = await tmdbRequest<any>(
      `/tv/${tvId}`,
      { append_to_response: 'credits,videos' },
      { cacheTTL: CACHE_DURATIONS.details }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return transformToMediaItem(response.data, 'tv');
  },

  /**
   * Get TV season details with episodes
   */
  async getSeasonDetails(tvId: string, seasonNumber: number): Promise<Season> {
    const response = await tmdbRequest<any>(
      `/tv/${tvId}/season/${seasonNumber}`,
      {},
      { cacheTTL: CACHE_DURATIONS.details }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return {
      seasonNumber: response.data.season_number,
      episodeCount: response.data.episodes.length,
      episodes: response.data.episodes.map(transformToEpisode),
    };
  },

  /**
   * Get content details (auto-detect movie or TV)
   */
  async getDetails(id: string, mediaType: 'movie' | 'tv'): Promise<MediaItem> {
    if (mediaType === 'movie') {
      return this.getMovieDetails(id);
    } else {
      return this.getTVDetails(id);
    }
  },

  /**
   * Get popular movies
   */
  async getPopularMovies(page: number = 1): Promise<MediaItem[]> {
    const response = await tmdbRequest<any>(
      '/movie/popular',
      { page },
      { cacheTTL: CACHE_DURATIONS.trending }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return response.data.results.map((item: any) => transformToMediaItem(item, 'movie'));
  },

  /**
   * Get popular TV shows
   */
  async getPopularTV(page: number = 1): Promise<MediaItem[]> {
    const response = await tmdbRequest<any>(
      '/tv/popular',
      { page },
      { cacheTTL: CACHE_DURATIONS.trending }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return response.data.results.map((item: any) => transformToMediaItem(item, 'tv'));
  },

  /**
   * Get genres for movies or TV
   */
  async getGenres(mediaType: 'movie' | 'tv'): Promise<Genre[]> {
    const response = await tmdbRequest<any>(
      `/genre/${mediaType}/list`,
      {},
      { cacheTTL: CACHE_DURATIONS.details }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return response.data.genres;
  },
};
