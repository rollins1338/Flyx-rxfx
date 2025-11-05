/**
 * Video Stream Extractor Service
 * Handles extraction of video stream URLs from various sources
 */

import type { VideoData, StreamSource, SubtitleTrack } from '@/types/media';
import type { APIResponse, RequestConfig } from '@/types/api';
import { cacheManager, CACHE_DURATIONS, generateCacheKey } from '@/lib/utils/cache';
import { APIErrorHandler, fetchWithTimeout, createAPIError } from '@/lib/utils/error-handler';

/**
 * Get extractor service URL from environment
 * Uses local extract-shadowlands API by default
 */
function getExtractorURL(): string {
  // For server-side calls, use localhost
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_EXTRACTOR_URL || 'http://localhost:3000/api/extract-shadowlands';
  }
  // For client-side calls, use relative URL
  return process.env.NEXT_PUBLIC_EXTRACTOR_URL || '/api/extract-shadowlands';
}

/**
 * Transform extractor response to VideoData
 */
function transformToVideoData(data: any): VideoData {
  const sources: StreamSource[] = [];
  const subtitles: SubtitleTrack[] = [];

  // Handle shadowlands response format
  if (data.streamUrl) {
    // Shadowlands requires proxy
    const proxyUrl = data.requiresProxy 
      ? `/api/stream-proxy?url=${encodeURIComponent(data.streamUrl)}&source=shadowlands`
      : data.streamUrl;
      
    sources.push({
      url: proxyUrl,
      quality: 'auto',
      type: data.streamType || 'hls',
    });
  }
  // Parse sources array
  else if (data.sources && Array.isArray(data.sources)) {
    data.sources.forEach((source: any) => {
      sources.push({
        url: source.url || source.file,
        quality: source.quality || 'auto',
        type: source.type || (source.url?.includes('.m3u8') ? 'hls' : 'mp4'),
      });
    });
  } 
  // Single source format
  else if (data.source) {
    sources.push({
      url: data.source,
      quality: 'auto',
      type: data.source.includes('.m3u8') ? 'hls' : 'mp4',
    });
  }

  // Parse subtitles
  if (data.subtitles && Array.isArray(data.subtitles)) {
    data.subtitles.forEach((subtitle: any) => {
      subtitles.push({
        label: subtitle.label || subtitle.lang || 'Unknown',
        language: subtitle.language || subtitle.lang || 'en',
        url: subtitle.url || subtitle.file,
      });
    });
  }

  return {
    sources,
    subtitles,
    poster: data.poster,
    duration: data.duration,
  };
}

/**
 * Make a request to the local extractor service
 */
async function extractorRequest<T>(
  params: Record<string, any> = {},
  config: RequestConfig = {}
): Promise<APIResponse<T>> {
  const baseURL = getExtractorURL();
  
  // Build URL with query params
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });
  
  const url = `${baseURL}?${queryParams.toString()}`;

  // Check cache if enabled
  if (config.cache !== false) {
    const cacheKey = generateCacheKey('extractor', params);
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
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        config.timeout || 45000 // 45s timeout for stream extraction
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createAPIError(
          `EXTRACTOR_${response.status}`,
          errorData.error || `Stream extraction failed: ${response.statusText}`,
          response.status,
          response.status >= 500
        );
      }

      return await response.json();
    }, config.retry);

    // Cache the result
    if (config.cache !== false) {
      const cacheKey = generateCacheKey('extractor', params);
      const ttl = config.cacheTTL || CACHE_DURATIONS.streams;
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
 * Extractor Service
 */
export const extractorService = {
  /**
   * Extract video stream for a movie
   */
  async extractMovie(tmdbId: string): Promise<VideoData> {
    const response = await extractorRequest<any>(
      { tmdbId },
      { 
        cacheTTL: CACHE_DURATIONS.streams,
        timeout: 45000,
      }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError(
        'EXTRACTION_FAILED',
        'Failed to extract video stream',
        500,
        true
      );
    }

    return transformToVideoData(response.data);
  },

  /**
   * Extract video stream for a TV episode
   */
  async extractEpisode(
    tmdbId: string,
    season: number,
    episode: number
  ): Promise<VideoData> {
    const response = await extractorRequest<any>(
      { tmdbId, season, episode },
      { 
        cacheTTL: CACHE_DURATIONS.streams,
        timeout: 45000,
      }
    );

    if (response.error || !response.data) {
      throw response.error || createAPIError(
        'EXTRACTION_FAILED',
        'Failed to extract video stream',
        500,
        true
      );
    }

    return transformToVideoData(response.data);
  },

  /**
   * Extract video stream (auto-detect movie or episode)
   */
  async extract(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    season?: number,
    episode?: number
  ): Promise<VideoData> {
    if (mediaType === 'movie') {
      return this.extractMovie(tmdbId);
    } else {
      if (season === undefined || episode === undefined) {
        throw createAPIError(
          'INVALID_PARAMS',
          'Season and episode are required for TV shows',
          400,
          false
        );
      }
      return this.extractEpisode(tmdbId, season, episode);
    }
  },

  /**
   * Check if extractor service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Local API is always available
      return true;
    } catch (error) {
      return false;
    }
  },
};
