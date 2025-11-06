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
  async searchByCategory(category: string, contentType: 'all' | 'movie' | 'tv' = 'all', page: number = 1): Promise<MediaItem[]> {
    const categoryMappings: Record<string, { movieGenre?: number; tvGenre?: number; searchQuery?: string }> = {
      'action': { movieGenre: 28, tvGenre: 10759 }, // Action for movies, Action & Adventure for TV
      'comedy': { movieGenre: 35, tvGenre: 35 }, // Comedy for both
      'horror': { movieGenre: 27, searchQuery: 'horror' }, // Horror movies only, use search for TV horror shows
      'romance': { movieGenre: 10749, searchQuery: 'romance' }, // Romance movies, search for TV romance
      'sci-fi': { movieGenre: 878, tvGenre: 10765 }, // Science Fiction for movies, Sci-Fi & Fantasy for TV
      'drama': { movieGenre: 18, tvGenre: 18 }, // Drama for both
      'documentary': { movieGenre: 99, tvGenre: 99 }, // Documentary for both
      'anime': { movieGenre: 16, tvGenre: 16, searchQuery: 'anime' }, // Animation genre for both + anime search
      'marvel': { searchQuery: 'Marvel' },
      'dc': { searchQuery: 'DC Comics' },
      'thriller': { movieGenre: 53, searchQuery: 'thriller' }, // Thriller movies, search for TV thrillers
      'crime': { movieGenre: 80, tvGenre: 80 }, // Crime for both
      'family': { movieGenre: 10751, tvGenre: 10751 }, // Family for both
      'fantasy': { movieGenre: 14, tvGenre: 10765 }, // Fantasy for movies, Sci-Fi & Fantasy for TV
      'mystery': { movieGenre: 9648, tvGenre: 9648 }, // Mystery for both
      'war': { movieGenre: 10752, tvGenre: 10768 }, // War for movies, War & Politics for TV
      'western': { movieGenre: 37, tvGenre: 37 } // Western for both
    };

    const mapping = categoryMappings[category.toLowerCase()];
    if (!mapping) {
      // Fallback to regular search
      const searchResults = await this.search(category, page);
      return searchResults.map(item => ({
        id: item.id,
        title: item.title,
        name: item.title,
        overview: '', // SearchResult doesn't have overview
        poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
        posterPath: item.posterPath || '',
        release_date: item.releaseDate,
        releaseDate: item.releaseDate,
        vote_average: item.rating,
        rating: item.rating,
        mediaType: item.mediaType || 'movie',
        genres: [],
        vote_count: 0,
        voteCount: 0
      }));
    }

    let results: MediaItem[] = [];

    // Handle special search queries (Marvel, DC, anime, etc.)
    if (mapping.searchQuery) {
      const searchResults = await this.search(mapping.searchQuery, page);
      
      // Convert SearchResult[] to MediaItem[]
      let filteredResults: MediaItem[] = searchResults.map(item => ({
        id: item.id,
        title: item.title,
        name: item.title,
        overview: '', // SearchResult doesn't have overview, will be empty
        poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
        posterPath: item.posterPath || '',
        release_date: item.releaseDate,
        releaseDate: item.releaseDate,
        vote_average: item.rating,
        rating: item.rating,
        mediaType: item.mediaType,
        genres: [],
        vote_count: 0,
        voteCount: 0
      }));
      
      // For anime, also get by genre to ensure we get animated content
      if (category.toLowerCase() === 'anime') {
        const genrePromises: Promise<MediaItem[]>[] = [];
        
        if (contentType === 'all' || contentType === 'movie') {
          genrePromises.push(this.searchMoviesByGenre(16, page)); // Animation genre
        }
        if (contentType === 'all' || contentType === 'tv') {
          genrePromises.push(this.searchTVByGenre(16, page)); // Animation genre
        }
        
        const genreResults = await Promise.all(genrePromises);
        const combinedResults = [...filteredResults, ...genreResults.flat()];
        
        // Remove duplicates and filter for anime-related content
        const uniqueResults = combinedResults.filter((item, index, self) => 
          self.findIndex(i => i.id === item.id) === index
        );
        
        filteredResults = uniqueResults.filter(item => {
          const title = (item.title || item.name || '').toLowerCase();
          const overview = (item.overview || '').toLowerCase();
          return title.includes('anime') || 
                 overview.includes('anime') || 
                 overview.includes('animation') ||
                 title.includes('dragon ball') ||
                 title.includes('naruto') ||
                 title.includes('one piece') ||
                 title.includes('attack on titan') ||
                 overview.includes('japanese');
        });
      }
      
      return filteredResults;
    }

    // Handle genre-based discovery
    if (contentType === 'all') {
      // Get both movies and TV shows
      const promises: Promise<MediaItem[]>[] = [];
      
      if (mapping.movieGenre) {
        // Use primary genre filtering for comedy, romance, and horror to get more relevant results
        const usePrimaryGenre = ['comedy', 'romance', 'horror'].includes(category.toLowerCase());
        promises.push(this.searchMoviesByGenre(mapping.movieGenre, page, usePrimaryGenre));
      }
      
      if (mapping.tvGenre) {
        // Use primary genre filtering for comedy, romance, and horror to get more relevant results
        const usePrimaryGenre = ['comedy', 'romance', 'horror'].includes(category.toLowerCase());
        promises.push(this.searchTVByGenre(mapping.tvGenre, page, usePrimaryGenre));
      }
      
      // If no TV genre but we have a search query, search for TV shows
      if (!mapping.tvGenre && mapping.searchQuery) {
        const searchResults = await this.search(`${mapping.searchQuery} tv show`, page);
        const tvResults: MediaItem[] = searchResults
          .filter(item => item.mediaType === 'tv')
          .map(item => ({
            id: item.id,
            title: item.title,
            name: item.title,
            overview: '',
            poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
            posterPath: item.posterPath || '',
            release_date: item.releaseDate,
            releaseDate: item.releaseDate,
            first_air_date: item.releaseDate,
            vote_average: item.rating,
            rating: item.rating,
            mediaType: 'tv' as const,
            genres: [],
            vote_count: 0,
            voteCount: 0
          }));
        promises.push(Promise.resolve(tvResults));
      }

      const allResults = await Promise.all(promises);
      results = allResults.flat();
      
      // Remove duplicates based on ID
      const uniqueResults = results.filter((item, index, self) => 
        self.findIndex(i => i.id === item.id) === index
      );
      
      // Sort by popularity score (rating * log of vote count for better distribution)
      uniqueResults.sort((a, b) => {
        const scoreA = (a.vote_average || a.rating || 0) * Math.log((a.vote_count || a.voteCount || 1) + 1);
        const scoreB = (b.vote_average || b.rating || 0) * Math.log((b.vote_count || b.voteCount || 1) + 1);
        return scoreB - scoreA;
      });
      
      results = uniqueResults;
      
    } else if (contentType === 'movie' && mapping.movieGenre) {
      const usePrimaryGenre = ['comedy', 'romance', 'horror'].includes(category.toLowerCase());
      results = await this.searchMoviesByGenre(mapping.movieGenre, page, usePrimaryGenre);
    } else if (contentType === 'tv' && mapping.tvGenre) {
      const usePrimaryGenre = ['comedy', 'romance', 'horror'].includes(category.toLowerCase());
      results = await this.searchTVByGenre(mapping.tvGenre, page, usePrimaryGenre);
    } else if (contentType === 'tv' && !mapping.tvGenre && mapping.searchQuery) {
      // Search for TV shows when no TV genre is available
      const searchResults = await this.search(`${mapping.searchQuery} tv show`, page);
      results = searchResults
        .filter(item => item.mediaType === 'tv')
        .map(item => ({
          id: item.id,
          title: item.title,
          name: item.title,
          overview: '',
          poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
          posterPath: item.posterPath || '',
          release_date: item.releaseDate,
          releaseDate: item.releaseDate,
          first_air_date: item.releaseDate,
          vote_average: item.rating,
          rating: item.rating,
          mediaType: 'tv' as const,
          genres: [],
          vote_count: 0,
          voteCount: 0
        }));
    } else if (contentType === 'movie' && !mapping.movieGenre && mapping.searchQuery) {
      // Search for movies when no movie genre is available
      const searchResults = await this.search(`${mapping.searchQuery} movie`, page);
      results = searchResults
        .filter(item => item.mediaType === 'movie')
        .map(item => ({
          id: item.id,
          title: item.title,
          name: item.title,
          overview: '',
          poster_path: item.posterPath?.replace(`${TMDB_IMAGE_BASE_URL}/w500`, '') || '',
          posterPath: item.posterPath || '',
          release_date: item.releaseDate,
          releaseDate: item.releaseDate,
          vote_average: item.rating,
          rating: item.rating,
          mediaType: 'movie' as const,
          genres: [],
          vote_count: 0,
          voteCount: 0
        }));
    }

    return results.slice(0, 20); // Limit to 20 results
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
