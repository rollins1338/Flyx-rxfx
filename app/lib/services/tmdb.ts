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
function transformToMediaItem(item: any, mediaType: 'movie' | 'tv' | 'person'): MediaItem {
  if (mediaType === 'person') {
    return {
      id: item.id.toString(),
      title: item.name,
      name: item.name,
      overview: item.biography || '',
      posterPath: item.profile_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.profile_path}` : '',
      poster_path: item.profile_path,
      profile_path: item.profile_path,
      mediaType: 'person',
      rating: item.popularity || 0,
      vote_average: 0,
      voteCount: 0,
      vote_count: 0,
      known_for: item.known_for ? item.known_for.map((k: any) => transformToMediaItem(k, k.media_type)) : [],
    };
  }

  return {
    id: item.id.toString(),
    title: mediaType === 'movie' ? item.title : item.name,
    name: mediaType === 'tv' ? item.name : item.title, // Add name field for TV shows
    overview: item.overview || '',
    posterPath: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` : '',
    poster_path: item.poster_path, // Keep original field too
    backdropPath: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/original${item.backdrop_path}` : '',
    releaseDate: mediaType === 'movie' ? item.release_date : item.first_air_date,
    first_air_date: mediaType === 'tv' ? item.first_air_date : undefined, // Keep original field
    release_date: mediaType === 'movie' ? item.release_date : undefined, // Keep original field
    rating: item.vote_average || 0,
    vote_average: item.vote_average || 0, // Keep original field
    voteCount: item.vote_count || 0,
    vote_count: item.vote_count || 0, // Keep original field
    mediaType,
    genres: item.genres || [],
    genre_ids: item.genre_ids || [], // Keep original genre_ids for filtering
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
  const mediaType = item.media_type || 'movie';

  if (mediaType === 'person') {
    return {
      id: item.id.toString(),
      title: item.name,
      posterPath: item.profile_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.profile_path}` : '',
      mediaType: 'person',
      releaseDate: '',
      rating: item.popularity || 0,
    };
  }

  return {
    id: item.id.toString(),
    title: mediaType === 'movie' ? item.title : item.name,
    posterPath: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` : '',
    mediaType: mediaType === 'movie' ? 'movie' : 'tv',
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
    timeWindow: 'day' | 'week' = 'week',
    page: number = 1
  ): Promise<MediaItem[]> {
    const response = await tmdbRequest<any>(
      `/trending/${mediaType}/${timeWindow}`,
      { page },
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
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || item.media_type === 'person')
      .map(transformToSearchResult);
  },

  /**
   * Search movies by genre
   */
  async searchMoviesByGenre(genreId: number, page: number = 1, primaryGenreOnly: boolean = false): Promise<MediaItem[]> {
    const response = await tmdbRequest<any>(
      '/discover/movie',
      {
        with_genres: genreId,
        page,
        sort_by: 'popularity.desc'
      },
      { cacheTTL: CACHE_DURATIONS.trending }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    let rawResults = response.data.results;

    // If primaryGenreOnly is true, filter to only include items where the requested genre is the first genre
    if (primaryGenreOnly) {
      rawResults = rawResults.filter((item: any) => {
        // Check if the genre is the first in the genre_ids array (primary genre)
        const genreIds = item.genre_ids || [];
        return genreIds.length > 0 && genreIds[0] === genreId;
      });
    }

    return rawResults.map((item: any) => transformToMediaItem(item, 'movie'));
  },

  /**
   * Search TV shows by genre
   */
  async searchTVByGenre(genreId: number, page: number = 1, primaryGenreOnly: boolean = false): Promise<MediaItem[]> {
    const response = await tmdbRequest<any>(
      '/discover/tv',
      {
        with_genres: genreId,
        page,
        sort_by: 'popularity.desc'
      },
      { cacheTTL: CACHE_DURATIONS.trending }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    let rawResults = response.data.results;

    // If primaryGenreOnly is true, filter to only include items where the requested genre is the first genre
    if (primaryGenreOnly) {
      rawResults = rawResults.filter((item: any) => {
        // Check if the genre is the first in the genre_ids array (primary genre)
        const genreIds = item.genre_ids || [];
        return genreIds.length > 0 && genreIds[0] === genreId;
      });
    }

    return rawResults.map((item: any) => transformToMediaItem(item, 'tv'));
  },

  /**
   * Enhanced search with category support
   */
  /**
   * Enhanced search with category support
   */
  async searchByCategory(category: string, contentType: 'all' | 'movie' | 'tv' = 'all', page: number = 1): Promise<MediaItem[]> {
    const categoryMappings: Record<string, { movieGenre?: number; tvGenre?: number; searchQuery?: string }> = {
      'action': { movieGenre: 28, tvGenre: 10759 },
      'comedy': { movieGenre: 35, tvGenre: 35 },
      'horror': { movieGenre: 27, tvGenre: 10765 }, // Use Sci-Fi & Fantasy (includes supernatural) or just search for TV
      'romance': { movieGenre: 10749, tvGenre: 10766 }, // Soap for TV often has romance, but no direct mapping. 
      'sci-fi': { movieGenre: 878, tvGenre: 10765 },
      'drama': { movieGenre: 18, tvGenre: 18 },
      'documentary': { movieGenre: 99, tvGenre: 99 },
      'anime': { movieGenre: 16, tvGenre: 16 }, // Animation, will filter by language 'ja'
      'marvel': { searchQuery: 'Marvel' },
      'dc': { searchQuery: 'DC Comics' },
      'thriller': { movieGenre: 53, tvGenre: 80 }, // Crime often overlaps with Thriller for TV
      'crime': { movieGenre: 80, tvGenre: 80 },
      'family': { movieGenre: 10751, tvGenre: 10751 },
      'fantasy': { movieGenre: 14, tvGenre: 10765 },
      'mystery': { movieGenre: 9648, tvGenre: 9648 },
      'war': { movieGenre: 10752, tvGenre: 10768 },
      'western': { movieGenre: 37, tvGenre: 37 }
    };

    const mapping = categoryMappings[category.toLowerCase()];

    // Special handling for Anime
    if (category.toLowerCase() === 'anime') {
      const promises: Promise<APIResponse<any>>[] = [];

      if (contentType === 'all' || contentType === 'movie') {
        promises.push(tmdbRequest('/discover/movie', {
          with_genres: 16,
          with_original_language: 'ja',
          sort_by: 'popularity.desc',
          page
        }, { cacheTTL: CACHE_DURATIONS.trending }));
      }

      if (contentType === 'all' || contentType === 'tv') {
        promises.push(tmdbRequest('/discover/tv', {
          with_genres: 16,
          with_original_language: 'ja',
          sort_by: 'popularity.desc',
          page
        }, { cacheTTL: CACHE_DURATIONS.trending }));
      }

      const responses = await Promise.all(promises);
      const results = responses
        .flatMap(r => r.data?.results || [])
        .map((item: any) => transformToMediaItem(item, item.title ? 'movie' : 'tv'));

      return results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 20);
    }

    if (!mapping) {
      // Fallback to regular search
      const searchResults = await this.search(category, page);
      return searchResults.map(item => ({
        ...item,
        name: item.title,
        overview: '',
        poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
        posterPath: item.posterPath || '',
        release_date: item.releaseDate,
        first_air_date: item.releaseDate,
        vote_average: item.rating,
        vote_count: 0,
        genres: [],
        genre_ids: []
      } as MediaItem));
    }

    // If we have a search query and NO genre mapping, use search
    if (mapping.searchQuery && !mapping.movieGenre && !mapping.tvGenre) {
      const searchResults = await this.search(mapping.searchQuery, page);
      return searchResults.map(item => ({
        ...item,
        name: item.title,
        overview: '',
        poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
        posterPath: item.posterPath || '',
        release_date: item.releaseDate,
        first_air_date: item.releaseDate,
        vote_average: item.rating,
        vote_count: 0,
        genres: [],
        genre_ids: []
      } as MediaItem));
    }

    // Genre-based fetching
    const promises: Promise<MediaItem[]>[] = [];

    if (contentType === 'all' || contentType === 'movie') {
      if (mapping.movieGenre) {
        promises.push(this.searchMoviesByGenre(mapping.movieGenre, page));
      } else if (mapping.searchQuery) {
        // Fallback to search if no genre but has query
        const searchResults = await this.search(`${mapping.searchQuery} movie`, page);
        promises.push(Promise.resolve(searchResults
          .filter(i => i.mediaType === 'movie')
          .map(item => ({
            ...item,
            name: item.title,
            overview: '',
            poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
            posterPath: item.posterPath || '',
            release_date: item.releaseDate,
            first_air_date: item.releaseDate,
            vote_average: item.rating,
            vote_count: 0,
            genres: [],
            genre_ids: []
          } as MediaItem))));
      }
    }

    if (contentType === 'all' || contentType === 'tv') {
      if (mapping.tvGenre) {
        promises.push(this.searchTVByGenre(mapping.tvGenre, page));
      } else if (mapping.searchQuery) {
        // Fallback to search if no genre but has query
        const searchResults = await this.search(`${mapping.searchQuery} tv show`, page);
        promises.push(Promise.resolve(searchResults
          .filter(i => i.mediaType === 'tv')
          .map(item => ({
            ...item,
            name: item.title,
            overview: '',
            poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
            posterPath: item.posterPath || '',
            release_date: item.releaseDate,
            first_air_date: item.releaseDate,
            vote_average: item.rating,
            vote_count: 0,
            genres: [],
            genre_ids: []
          } as MediaItem))));
      }
    }

    const results = (await Promise.all(promises)).flat();

    // Remove duplicates
    const uniqueResults = results.filter((item, index, self) =>
      self.findIndex(i => i.id === item.id) === index
    );

    return uniqueResults.slice(0, 20);
  },

  /**
   * Get genres for movies or TV shows
   */
  async getGenres(type: 'movie' | 'tv'): Promise<Genre[]> {
    const response = await tmdbRequest<any>(
      `/genre/${type}/list`,
      {},
      { cacheTTL: CACHE_DURATIONS.details }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError('NO_DATA', 'No data received', 500, false);
    }

    return response.data.genres;
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


};
