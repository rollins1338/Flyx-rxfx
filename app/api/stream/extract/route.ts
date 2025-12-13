/**
 * Stream Extract API - Multi-Provider Stream Extraction
 * 
 * Provider Priority:
 * - For ANIME content: AnimeKai (PRIMARY) → Videasy (fallback)
 * - For other content: 1movies (PRIMARY) → VidSrc → Videasy (fallback)
 * 
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=videasy
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=animekai
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractOneMoviesStreams, fetchOneMoviesSourceByName, ONEMOVIES_ENABLED } from '@/app/lib/services/onemovies-extractor';
import { extractVidSrcStreams, VIDSRC_ENABLED } from '@/app/lib/services/vidsrc-extractor';
import { extractVideasyStreams, fetchVideasySourceByName } from '@/app/lib/services/videasy-extractor';
import { extractAnimeKaiStreams, fetchAnimeKaiSourceByName, isAnimeContent, ANIMEKAI_ENABLED } from '@/app/lib/services/animekai-extractor';
import { performanceMonitor } from '@/app/lib/utils/performance-monitor';
import { getStreamProxyUrl } from '@/app/lib/proxy-config';

// Node.js runtime (default) - required for fetch

// Enhanced in-memory cache with LRU eviction
const cache = new Map<string, { sources: any[]; timestamp: number; hits: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 500; // Maximum cache entries

// Request deduplication - prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<any>>();

// Cache management - LRU eviction
function evictOldestCacheEntry() {
  if (cache.size < MAX_CACHE_SIZE) return;

  let oldestKey = '';
  let oldestTime = Date.now();
  let lowestHits = Infinity;

  // Find least recently used with lowest hits
  const entries = Array.from(cache.entries());
  for (const [key, value] of entries) {
    if (value.timestamp < oldestTime || (value.timestamp === oldestTime && value.hits < lowestHits)) {
      oldestTime = value.timestamp;
      lowestHits = value.hits;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
    console.log(`[CACHE] Evicted: ${oldestKey}`);
  }
}


/**
 * GET /api/stream/extract
 * 
 * Query params:
 * - tmdbId: TMDB ID (required)
 * - type: 'movie' or 'tv' (required)
 * - season: Season number (required for TV)
 * - episode: Episode number (required for TV)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse parameters
    const tmdbId = searchParams.get('tmdbId') || '';
    const type = searchParams.get('type') as 'movie' | 'tv';
    const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
    const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
    const provider = searchParams.get('provider') || '1movies';
    const sourceName = searchParams.get('source'); // Optional: fetch specific source by name

    // Validate parameters
    if (!tmdbId) {
      return NextResponse.json(
        { error: 'Invalid or missing tmdbId' },
        { status: 400 }
      );
    }

    if (!type || !['movie', 'tv'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing type (must be "movie" or "tv")' },
        { status: 400 }
      );
    }

    if (type === 'tv' && (!season || !episode)) {
      return NextResponse.json(
        { error: 'Season and episode required for TV shows' },
        { status: 400 }
      );
    }

    console.log('[EXTRACT] Request:', { tmdbId, type, season, episode, provider, sourceName });
    performanceMonitor.start('stream-extraction');

    // If requesting a specific source by name, fetch it directly (no cache)
    if (sourceName) {
      console.log(`[EXTRACT] Fetching specific source: ${sourceName} (provider: ${provider})`);
      
      let source = null;
      let usedProvider = provider;
      
      // Try to fetch from the appropriate provider
      if (sourceName.includes('AnimeKai') || provider === 'animekai') {
        source = await fetchAnimeKaiSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'animekai';
      } else if (sourceName.includes('1movies') || provider === '1movies') {
        source = await fetchOneMoviesSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = '1movies';
      } else if (provider === 'videasy' || sourceName.includes('(')) {
        source = await fetchVideasySourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'videasy';
      }
      
      if (source) {
        const executionTime = Date.now() - startTime;
        const proxiedSource = {
          quality: source.quality,
          title: source.title,
          url: getStreamProxyUrl(source.url, usedProvider, source.referer),
          directUrl: source.url,
          referer: source.referer,
          type: source.type,
          requiresSegmentProxy: source.requiresSegmentProxy,
          status: 'working',
          language: source.language || 'ja',
        };
        
        return NextResponse.json({
          success: true,
          sources: [proxiedSource],
          streamUrl: proxiedSource.url,
          url: proxiedSource.url,
          provider: usedProvider,
          requiresProxy: true,
          requiresSegmentProxy: true,
          cached: false,
          executionTime
        });
      } else {
        return NextResponse.json(
          { error: `Source "${sourceName}" not available`, success: false },
          { status: 404 }
        );
      }
    }

    // Check cache
    const cacheKey = `${tmdbId}-${type}-${season || ''}-${episode || ''}-${provider}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[EXTRACT] Cache hit (${cached.hits} hits)`);

      // Update cache stats
      cached.hits++;
      cached.timestamp = Date.now(); // Refresh timestamp on access

      const executionTime = Date.now() - startTime;

      // Return multiple quality sources with status and language
      // Only proxy sources that have valid URLs
      const sources = cached.sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: source.url ? getStreamProxyUrl(source.url, provider, source.referer) : '',
        directUrl: source.url || '',
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy,
        status: source.status || 'working',
        language: source.language || 'en',
      }));

      return NextResponse.json({
        success: true,
        sources,
        // Backward compatibility - return first source as default
        streamUrl: sources[0].url,
        url: sources[0].url,
        provider: provider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: true,
        cacheHits: cached.hits,
        executionTime
      });
    }

    // Check if there's already a pending request for this content
    if (pendingRequests.has(cacheKey)) {
      console.log('[EXTRACT] Waiting for existing request to complete...');
      const sources = await pendingRequests.get(cacheKey)!;

      const executionTime = Date.now() - startTime;
      // Only proxy sources that have valid URLs
      const proxiedSources = sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: source.url ? getStreamProxyUrl(source.url, provider, source.referer) : '',
        directUrl: source.url || '',
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy,
        status: source.status || 'working',
        language: source.language || 'en',
      }));

      return NextResponse.json({
        success: true,
        sources: proxiedSources,
        streamUrl: proxiedSources[0]?.url || '',
        url: proxiedSources[0]?.url || '',
        provider: provider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: false,
        deduplicated: true,
        executionTime
      });
    }

    // Check if this is anime content (for automatic provider selection)
    let isAnime = false;
    if (provider !== 'animekai') {
      // Only check if not explicitly requesting animekai
      isAnime = await isAnimeContent(tmdbId, type);
      if (isAnime) {
        console.log('[EXTRACT] Detected ANIME content - will use AnimeKai as primary');
      }
    }

    // Create extraction based on provider preference
    const extractionPromise = (async () => {
      // If explicitly requesting animekai OR content is anime, use AnimeKai first
      if (provider === 'animekai' || isAnime) {
        console.log('[EXTRACT] Using AnimeKai (primary for anime)...');
        if (ANIMEKAI_ENABLED) {
          try {
            const animekaiResult = await extractAnimeKaiStreams(tmdbId, type, season, episode);
            
            if (animekaiResult.sources.length > 0) {
              const workingSources = animekaiResult.sources.filter(s => s.status === 'working');
              
              if (workingSources.length > 0) {
                console.log(`[EXTRACT] ✓ AnimeKai: ${workingSources.length} working, ${animekaiResult.sources.length} total`);
                return { sources: animekaiResult.sources, provider: 'animekai' };
              }
            }
            console.log(`[EXTRACT] AnimeKai failed: ${animekaiResult.error || 'No working sources'}`);
          } catch (animekaiError) {
            console.warn('[EXTRACT] AnimeKai error:', animekaiError instanceof Error ? animekaiError.message : animekaiError);
          }
        }
        
        // Fallback to Videasy for anime if AnimeKai fails
        console.log('[EXTRACT] Falling back to Videasy for anime...');
        const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode, true);
        const workingSources = videasyResult.sources.filter(s => s.status === 'working');
        
        if (workingSources.length > 0) {
          console.log(`[EXTRACT] ✓ Videasy (anime fallback): ${workingSources.length} working`);
          return { sources: videasyResult.sources, provider: 'videasy' };
        }
        
        throw new Error(videasyResult.error || 'All anime sources failed');
      }
      
      // If explicitly requesting 1movies, use it directly
      if (provider === '1movies') {
        console.log('[EXTRACT] Using 1movies (primary)...');
        if (ONEMOVIES_ENABLED) {
          try {
            const onemoviesResult = await extractOneMoviesStreams(tmdbId, type, season, episode);
            
            if (onemoviesResult.sources.length > 0) {
              const workingSources = onemoviesResult.sources.filter(s => s.status === 'working');
              
              if (workingSources.length > 0) {
                console.log(`[EXTRACT] ✓ 1movies: ${workingSources.length} working, ${onemoviesResult.sources.length} total`);
                return { sources: onemoviesResult.sources, provider: '1movies' };
              }
            }
            console.log(`[EXTRACT] 1movies failed: ${onemoviesResult.error || 'No working sources'}`);
          } catch (onemoviesError) {
            console.warn('[EXTRACT] 1movies error:', onemoviesError instanceof Error ? onemoviesError.message : onemoviesError);
          }
        }
        
        // Fallback to Videasy if 1movies fails
        console.log('[EXTRACT] Falling back to Videasy...');
        const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode, true);
        const workingSources = videasyResult.sources.filter(s => s.status === 'working');
        
        if (workingSources.length > 0) {
          console.log(`[EXTRACT] ✓ Videasy (fallback): ${workingSources.length} working`);
          return { sources: videasyResult.sources, provider: 'videasy' };
        }
        
        throw new Error(videasyResult.error || 'All sources failed');
      }
      
      // If explicitly requesting videasy, use it directly
      if (provider === 'videasy') {
        console.log('[EXTRACT] Using Videasy (explicit request)...');
        const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode);
        
        if (videasyResult.sources.length > 0) {
          const workingSources = videasyResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ Videasy: ${workingSources.length} working, ${videasyResult.sources.length} total`);
            return { sources: videasyResult.sources, provider: 'videasy' };
          }
        }
        
        if (videasyResult.sources.length > 0) {
          console.log(`[EXTRACT] Videasy: ${videasyResult.sources.length} sources (none working)`);
          return { sources: videasyResult.sources, provider: 'videasy' };
        }
        
        throw new Error(videasyResult.error || 'Videasy returned no sources');
      }
      
      // If explicitly requesting vidsrc, use it directly (if enabled)
      if (provider === 'vidsrc') {
        if (!VIDSRC_ENABLED) {
          console.log('[EXTRACT] VidSrc is DISABLED, falling back to 1movies...');
          if (ONEMOVIES_ENABLED) {
            const onemoviesResult = await extractOneMoviesStreams(tmdbId, type, season, episode);
            const workingSources = onemoviesResult.sources.filter(s => s.status === 'working');
            
            if (workingSources.length > 0) {
              console.log(`[EXTRACT] ✓ 1movies (fallback): ${workingSources.length} working`);
              return { sources: onemoviesResult.sources, provider: '1movies' };
            }
          }
          
          const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode, true);
          const workingSources = videasyResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ Videasy (fallback): ${workingSources.length} working`);
            return { sources: videasyResult.sources, provider: 'videasy' };
          }
          
          throw new Error(videasyResult.error || 'All fallback sources failed');
        }
        
        console.log('[EXTRACT] Using VidSrc (explicit request)...');
        const vidsrcResult = await extractVidSrcStreams(tmdbId, type, season, episode);
        
        if (vidsrcResult.sources.length > 0) {
          const workingSources = vidsrcResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ VidSrc: ${workingSources.length} working, ${vidsrcResult.sources.length} total`);
            return { sources: vidsrcResult.sources, provider: 'vidsrc' };
          }
        }
        
        if (vidsrcResult.sources.length > 0) {
          console.log(`[EXTRACT] VidSrc: ${vidsrcResult.sources.length} sources (none working)`);
          return { sources: vidsrcResult.sources, provider: 'vidsrc' };
        }
        
        throw new Error(vidsrcResult.error || 'VidSrc returned no sources');
      }
      
      // Default behavior: 1movies FIRST (primary), then VidSrc, then Videasy as fallback
      
      // Try 1movies first - it's the primary source
      if (ONEMOVIES_ENABLED) {
        console.log('[EXTRACT] Trying PRIMARY source: 1movies...');
        try {
          const onemoviesResult = await extractOneMoviesStreams(tmdbId, type, season, episode);
          const workingOnemovies = onemoviesResult.sources.filter(s => s.status === 'working');
          
          if (workingOnemovies.length > 0) {
            console.log(`[EXTRACT] ✓ 1movies succeeded with ${workingOnemovies.length} working source(s)`);
            return { sources: onemoviesResult.sources, provider: '1movies' };
          }
          console.log(`[EXTRACT] 1movies: ${onemoviesResult.error || 'No working sources'}`);
        } catch (onemoviesError) {
          console.warn('[EXTRACT] 1movies failed:', onemoviesError instanceof Error ? onemoviesError.message : onemoviesError);
        }
      } else {
        console.log('[EXTRACT] 1movies is DISABLED, skipping...');
      }
      
      // Try VidSrc as second option
      if (VIDSRC_ENABLED) {
        console.log('[EXTRACT] Trying fallback source: VidSrc...');
        try {
          const vidsrcResult = await extractVidSrcStreams(tmdbId, type, season, episode);
          const workingVidsrc = vidsrcResult.sources.filter(s => s.status === 'working');
          
          if (workingVidsrc.length > 0) {
            console.log(`[EXTRACT] ✓ VidSrc succeeded with ${workingVidsrc.length} working source(s)`);
            return { sources: vidsrcResult.sources, provider: 'vidsrc' };
          }
        } catch (vidsrcError) {
          console.warn('[EXTRACT] VidSrc failed:', vidsrcError instanceof Error ? vidsrcError.message : vidsrcError);
        }
      }
      
      // Fallback to Videasy (multi-language support)
      console.log('[EXTRACT] Trying fallback source: Videasy (multi-language)...');
      try {
        const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode, true);
        const workingVideasy = videasyResult.sources.filter(s => s.status === 'working');
        
        if (workingVideasy.length > 0) {
          console.log(`[EXTRACT] ✓ Videasy succeeded with ${workingVideasy.length} working source(s)`);
          return { sources: videasyResult.sources, provider: 'videasy' };
        }
        throw new Error(videasyResult.error || 'Videasy returned no working sources');
      } catch (videasyError) {
        console.warn('[EXTRACT] Videasy failed:', videasyError instanceof Error ? videasyError.message : videasyError);
      }
      
      // All providers failed
      console.log('[EXTRACT] All providers failed');
      throw new Error('All providers failed - no working sources available');
    })();

    pendingRequests.set(cacheKey, extractionPromise.then(r => r.sources));

    try {
      // Extract with automatic fallback
      const result = await extractionPromise;
      const { sources, provider: usedProvider } = result;

      // Remove from pending requests
      pendingRequests.delete(cacheKey);

      // Evict old entries if cache is full
      evictOldestCacheEntry();

      // Cache result with initial hit count
      cache.set(cacheKey, {
        sources,
        timestamp: Date.now(),
        hits: 1
      });

      const executionTime = Date.now() - startTime;
      performanceMonitor.end('stream-extraction', {
        tmdbId,
        type,
        sources: sources.length,
        cached: false,
        provider: usedProvider
      });
      console.log(`[EXTRACT] Success in ${executionTime}ms - ${sources.length} qualities via ${usedProvider}`);

      // Return proxied URLs with status and language info for multi-language UI
      // Only proxy sources that have valid URLs (skip 'unknown' status sources with empty URLs)
      const proxiedSources = sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: source.url ? getStreamProxyUrl(source.url, usedProvider, source.referer) : '',
        directUrl: source.url || '',
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy,
        status: source.status || 'working',
        language: source.language || 'en',
      }));

      return NextResponse.json({
        success: true,
        sources: proxiedSources,
        // Backward compatibility - return first source as default
        streamUrl: proxiedSources[0].url,
        url: proxiedSources[0].url,
        provider: usedProvider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: false,
        executionTime
      });
    } catch (error) {
      // Remove from pending requests on error
      pendingRequests.delete(cacheKey);
      throw error;
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[EXTRACT] ERROR:', error);
    console.error('[EXTRACT] Stack:', error instanceof Error ? error.stack : 'No stack');

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCloudflareBlock = errorMessage.includes('Cloudflare') || errorMessage.includes('anti-bot') || errorMessage.includes('unavailable');
    const isDecoderFailed = errorMessage.includes('decoder') || errorMessage.includes('decoding');
    const isAllProvidersFailed = errorMessage.includes('All providers failed');

    return NextResponse.json(
      {
        error: isDecoderFailed ? 'Stream extraction temporarily unavailable' : isAllProvidersFailed ? 'No streams available' : isCloudflareBlock ? 'Stream source temporarily unavailable' : 'Failed to extract stream',
        details: errorMessage,
        suggestion: isDecoderFailed ? 'The stream provider has updated their protection. This will be fixed soon. Please try a different title for now.' : isAllProvidersFailed ? 'This content may not be available from any provider at the moment.' : isCloudflareBlock ? 'The stream provider is currently blocking automated requests. Please try again in a few minutes.' : 'Please try again or select a different title.',
        executionTime,
        isTemporary: true
      },
      { status: 503 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
