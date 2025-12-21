/**
 * Stream Extract API - Multi-Provider Stream Extraction
 * 
 * Provider Priority:
 * - For ANIME content: AnimeKai (PRIMARY) → Videasy (fallback)
 * - For other content: VidSrc (PRIMARY if enabled) → Flixer → 1movies → Videasy → SmashyStream → MultiMovies → MultiEmbed
 * 
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=videasy
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=animekai
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=vidsrc
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=flixer
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=1movies
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=smashystream
 * GET /api/stream/extract?tmdbId=507089&type=movie&provider=multimovies
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractOneMoviesStreams, fetchOneMoviesSourceByName, ONEMOVIES_ENABLED } from '@/app/lib/services/onemovies-extractor';
import { extractVidSrcStreams, VIDSRC_ENABLED } from '@/app/lib/services/vidsrc-extractor';
import { extractVideasyStreams, fetchVideasySourceByName } from '@/app/lib/services/videasy-extractor';
import { extractAnimeKaiStreams, fetchAnimeKaiSourceByName, isAnimeContent, ANIMEKAI_ENABLED } from '@/app/lib/services/animekai-extractor';
import { extractMultiEmbedStreams, fetchMultiEmbedSourceByName, MULTI_EMBED_ENABLED } from '@/app/lib/services/multi-embed-extractor';
import { extractSmashyStreamStreams, fetchSmashyStreamSourceByName, SMASHYSTREAM_ENABLED } from '@/app/lib/services/smashystream-extractor';
import { extractMultiMoviesStreams, fetchMultiMoviesSourceByName, MULTIMOVIES_ENABLED } from '@/app/lib/services/multimovies-extractor';
import { extractFlixerStreams, fetchFlixerSourceByName, FLIXER_ENABLED } from '@/app/lib/services/flixer-extractor';
import { performanceMonitor } from '@/app/lib/utils/performance-monitor';
import { getStreamProxyUrl, getAnimeKaiProxyUrl, isMegaUpCdnUrl, is1moviesCdnUrl, isAnimeKaiSource } from '@/app/lib/proxy-config';

// Node.js runtime (default) - required for fetch

// Helper to conditionally proxy URLs based on requiresSegmentProxy flag
// AnimeKai sources use the /animekai route which goes through RPI residential proxy
// Other sources use the /stream route with optional noreferer mode
function maybeProxyUrl(source: any, provider: string): string {
  if (!source.url) return '';
  // Only proxy if requiresSegmentProxy is true (default behavior for most sources)
  if (source.requiresSegmentProxy === false) {
    return source.url; // Return direct URL - browser will fetch directly
  }
  
  // ALL AnimeKai sources need to go through /animekai route -> RPI residential proxy
  // This is because ALL AnimeKai CDNs block:
  //   1. Datacenter IPs (Cloudflare, AWS, Vercel, etc.)
  //   2. Requests with Origin header (browser XHR always adds this)
  // 
  // The RPI proxy fetches from a residential IP without Origin header
  const isAnimeKai = provider === 'animekai';
  const isAnimeKaiSrc = isAnimeKaiSource(source);
  const isMegaUpCdn = isMegaUpCdnUrl(source.url);
  
  // 1movies CDN (p.XXXXX.workers.dev) also blocks datacenter IPs
  // Route through /animekai -> RPI residential proxy
  const is1moviesCdn = is1moviesCdnUrl(source.url);
  const is1movies = provider === '1movies';
  
  console.log(`[maybeProxyUrl] provider=${provider}, isAnimeKai=${isAnimeKai}, isAnimeKaiSrc=${isAnimeKaiSrc}, isMegaUpCdn=${isMegaUpCdn}, is1moviesCdn=${is1moviesCdn}, url=${source.url.substring(0, 60)}`);
  
  // Route through residential proxy for CDNs that block datacenter IPs
  if (isAnimeKai || isAnimeKaiSrc || isMegaUpCdn || is1moviesCdn || is1movies) {
    const proxiedUrl = getAnimeKaiProxyUrl(source.url);
    console.log(`[maybeProxyUrl] → Using /animekai route (residential proxy): ${proxiedUrl.substring(0, 80)}...`);
    return proxiedUrl;
  }
  
  // Other sources use the standard /stream route
  // Pass skipOrigin flag for sources that block requests with Origin header
  const proxiedUrl = getStreamProxyUrl(source.url, provider, source.referer, source.skipOrigin || false);
  console.log(`[maybeProxyUrl] → Using /stream route: ${proxiedUrl.substring(0, 80)}...`);
  return proxiedUrl;
}

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
    const provider = searchParams.get('provider') || 'auto';
    const sourceName = searchParams.get('source'); // Optional: fetch specific source by name
    
    // MAL info for anime - used to get correct episode from AnimeKai
    // When MAL splits a TMDB season into multiple parts, we need to use the MAL ID
    // and calculate the episode number within that MAL part
    const malId = searchParams.get('malId') ? parseInt(searchParams.get('malId')!) : undefined;
    const malTitle = searchParams.get('malTitle') || undefined;

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
        source = await fetchAnimeKaiSourceByName(sourceName, tmdbId, type, season, episode, malId, malTitle);
        usedProvider = 'animekai';
      } else if (sourceName.includes('1movies') || provider === '1movies') {
        source = await fetchOneMoviesSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = '1movies';
      } else if (provider === 'flixer' || sourceName.includes('Flixer')) {
        source = await fetchFlixerSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'flixer';
      } else if (provider === 'smashystream' || sourceName.includes('SmashyStream')) {
        source = await fetchSmashyStreamSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'smashystream';
      } else if (provider === 'multimovies' || sourceName.includes('MultiMovies')) {
        source = await fetchMultiMoviesSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'multimovies';
      } else if (provider === 'multiembed' || ['Cloudy', 'XPrime', 'Hexa'].includes(sourceName)) {
        source = await fetchMultiEmbedSourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'multiembed';
      } else if (provider === 'videasy' || sourceName.includes('(')) {
        source = await fetchVideasySourceByName(sourceName, tmdbId, type, season, episode);
        usedProvider = 'videasy';
      }
      
      if (source) {
        const executionTime = Date.now() - startTime;
        const proxiedSource = {
          quality: source.quality,
          title: source.title,
          url: maybeProxyUrl(source, usedProvider),
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
    let cached = cache.get(cacheKey);

    // TEMPORARY: Force clear cache for animekai to pick up new proxy routing
    if (provider === 'animekai' && cached) {
      console.log('[EXTRACT] Clearing animekai cache to use new /animekai route');
      cache.delete(cacheKey);
      cached = undefined;
    }
    
    // TEMPORARY: Force clear cache for 1movies to pick up new extraction
    if (provider === '1movies' && cached) {
      console.log('[EXTRACT] Clearing 1movies cache to use new extraction');
      cache.delete(cacheKey);
      cached = undefined;
    }

    // Only use cache if it has valid sources with URLs
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.sources.length > 0 && cached.sources[0]?.url) {
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
        url: maybeProxyUrl(source, provider),
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
        url: maybeProxyUrl(source, provider),
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
      // If explicitly requesting animekai, use it directly (no fallback to preserve tab separation)
      if (provider === 'animekai') {
        console.log('[EXTRACT] Using AnimeKai (explicit request)...');
        if (malId) {
          console.log(`[EXTRACT] MAL info provided: ID=${malId}, Title="${malTitle}"`);
        }
        if (!ANIMEKAI_ENABLED) {
          throw new Error('AnimeKai provider is disabled');
        }
        
        const animekaiResult = await extractAnimeKaiStreams(tmdbId, type, season, episode, malId, malTitle);
        
        if (animekaiResult.sources.length > 0) {
          console.log(`[EXTRACT] ✓ AnimeKai: ${animekaiResult.sources.length} sources`);
          return { sources: animekaiResult.sources, provider: 'animekai' };
        }
        
        throw new Error(animekaiResult.error || 'AnimeKai returned no sources');
      }
      
      // If content is anime (auto-detected) and not explicitly requesting a provider, try AnimeKai first
      if (isAnime) {
        console.log('[EXTRACT] Detected ANIME - trying AnimeKai first...');
        if (malId) {
          console.log(`[EXTRACT] MAL info provided: ID=${malId}, Title="${malTitle}"`);
        }
        if (ANIMEKAI_ENABLED) {
          try {
            const animekaiResult = await extractAnimeKaiStreams(tmdbId, type, season, episode, malId, malTitle);
            
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
        
        // Fallback to Videasy for anime if AnimeKai fails (only for auto-detected anime, not explicit requests)
        console.log('[EXTRACT] Falling back to Videasy for anime...');
        const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode, true);
        const workingSources = videasyResult.sources.filter(s => s.status === 'working');
        
        if (workingSources.length > 0) {
          console.log(`[EXTRACT] ✓ Videasy (anime fallback): ${workingSources.length} working`);
          return { sources: videasyResult.sources, provider: 'videasy' };
        }
        
        throw new Error(videasyResult.error || 'All anime sources failed');
      }
      
      // If explicitly requesting 1movies, use it directly (no fallback to preserve tab separation)
      if (provider === '1movies') {
        if (!ONEMOVIES_ENABLED) {
          throw new Error('1movies provider is disabled');
        }
        
        console.log('[EXTRACT] Using 1movies (explicit request)...');
        const onemoviesResult = await extractOneMoviesStreams(tmdbId, type, season, episode);
        
        if (onemoviesResult.sources.length > 0) {
          console.log(`[EXTRACT] ✓ 1movies: ${onemoviesResult.sources.length} sources`);
          return { sources: onemoviesResult.sources, provider: '1movies' };
        }
        
        throw new Error(onemoviesResult.error || '1movies returned no sources');
      }
      
      // If explicitly requesting flixer, use it directly
      if (provider === 'flixer') {
        if (!FLIXER_ENABLED) {
          throw new Error('Flixer provider is disabled');
        }
        
        console.log('[EXTRACT] Using Flixer (explicit request)...');
        const flixerResult = await extractFlixerStreams(tmdbId, type, season, episode);
        
        if (flixerResult.sources.length > 0) {
          console.log(`[EXTRACT] ✓ Flixer: ${flixerResult.sources.length} sources`);
          return { sources: flixerResult.sources, provider: 'flixer' };
        }
        
        throw new Error(flixerResult.error || 'Flixer returned no sources');
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
      
      // If explicitly requesting vidsrc, use it directly (no fallback to preserve tab separation)
      if (provider === 'vidsrc') {
        if (!VIDSRC_ENABLED) {
          throw new Error('VidSrc provider is disabled. Set ENABLE_VIDSRC_PROVIDER=true to enable.');
        }
        
        console.log('[EXTRACT] Using VidSrc (explicit request)...');
        const vidsrcResult = await extractVidSrcStreams(tmdbId, type, season, episode);
        
        if (vidsrcResult.sources.length > 0) {
          console.log(`[EXTRACT] ✓ VidSrc: ${vidsrcResult.sources.length} sources`);
          return { sources: vidsrcResult.sources, provider: 'vidsrc' };
        }
        
        throw new Error(vidsrcResult.error || 'VidSrc returned no sources');
      }
      
      // If explicitly requesting smashystream, use it directly
      if (provider === 'smashystream') {
        if (!SMASHYSTREAM_ENABLED) {
          throw new Error('SmashyStream provider is disabled');
        }
        
        console.log('[EXTRACT] Using SmashyStream (explicit request)...');
        const smashyResult = await extractSmashyStreamStreams(tmdbId, type, season, episode);
        
        if (smashyResult.sources.length > 0) {
          console.log(`[EXTRACT] ✓ SmashyStream: ${smashyResult.sources.length} sources`);
          return { sources: smashyResult.sources, provider: 'smashystream' };
        }
        
        throw new Error(smashyResult.error || 'SmashyStream returned no sources');
      }
      
      // If explicitly requesting multimovies, use it directly
      if (provider === 'multimovies') {
        if (!MULTIMOVIES_ENABLED) {
          throw new Error('MultiMovies provider is disabled');
        }
        
        console.log('[EXTRACT] Using MultiMovies (explicit request)...');
        const multiMoviesResult = await extractMultiMoviesStreams(tmdbId, type, season, episode);
        
        if (multiMoviesResult.sources.length > 0) {
          console.log(`[EXTRACT] ✓ MultiMovies: ${multiMoviesResult.sources.length} sources`);
          return { sources: multiMoviesResult.sources, provider: 'multimovies' };
        }
        
        throw new Error(multiMoviesResult.error || 'MultiMovies returned no sources');
      }
      
      // If explicitly requesting multiembed, use it directly
      if (provider === 'multiembed') {
        if (!MULTI_EMBED_ENABLED) {
          throw new Error('MultiEmbed provider is disabled');
        }
        
        console.log('[EXTRACT] Using MultiEmbed (explicit request)...');
        const multiEmbedResult = await extractMultiEmbedStreams(tmdbId, type, season, episode);
        
        if (multiEmbedResult.sources.length > 0) {
          const workingSources = multiEmbedResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ MultiEmbed: ${workingSources.length} working, ${multiEmbedResult.sources.length} total`);
            return { sources: multiEmbedResult.sources, provider: 'multiembed' };
          }
        }
        
        throw new Error(multiEmbedResult.error || 'MultiEmbed returned no sources');
      }
      
      // Default behavior: VidSrc FIRST (if enabled), then Flixer, then 1movies, then others
      
      // Try VidSrc FIRST if enabled - it's the primary source
      if (VIDSRC_ENABLED) {
        console.log('[EXTRACT] Trying PRIMARY source: VidSrc...');
        try {
          const vidsrcResult = await extractVidSrcStreams(tmdbId, type, season, episode);
          const workingVidsrc = vidsrcResult.sources.filter(s => s.status === 'working');
          
          if (workingVidsrc.length > 0) {
            console.log(`[EXTRACT] ✓ VidSrc succeeded with ${workingVidsrc.length} working source(s)`);
            return { sources: vidsrcResult.sources, provider: 'vidsrc' };
          }
          console.log(`[EXTRACT] VidSrc: ${vidsrcResult.error || 'No working sources'}`);
        } catch (vidsrcError) {
          console.warn('[EXTRACT] VidSrc failed:', vidsrcError instanceof Error ? vidsrcError.message : vidsrcError);
        }
      } else {
        console.log('[EXTRACT] VidSrc is DISABLED, skipping...');
      }
      
      // Try Flixer as SECOND option (pure fetch via Cloudflare Worker)
      if (FLIXER_ENABLED) {
        console.log('[EXTRACT] Trying fallback source: Flixer...');
        try {
          const flixerResult = await extractFlixerStreams(tmdbId, type, season, episode);
          const workingFlixer = flixerResult.sources.filter(s => s.status === 'working');
          
          if (workingFlixer.length > 0) {
            console.log(`[EXTRACT] ✓ Flixer succeeded with ${workingFlixer.length} working source(s)`);
            return { sources: flixerResult.sources, provider: 'flixer' };
          }
          console.log(`[EXTRACT] Flixer: ${flixerResult.error || 'No working sources'}`);
        } catch (flixerError) {
          console.warn('[EXTRACT] Flixer failed:', flixerError instanceof Error ? flixerError.message : flixerError);
        }
      }
      
      // Try 1movies as third option
      if (ONEMOVIES_ENABLED) {
        console.log('[EXTRACT] Trying fallback source: 1movies...');
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
      
      // Try Videasy as fourth option (multi-language support)
      console.log('[EXTRACT] Trying fallback source: Videasy (multi-language)...');
      try {
        const videasyResult = await extractVideasyStreams(tmdbId, type, season, episode, true);
        const workingVideasy = videasyResult.sources.filter(s => s.status === 'working');
        
        if (workingVideasy.length > 0) {
          console.log(`[EXTRACT] ✓ Videasy succeeded with ${workingVideasy.length} working source(s)`);
          return { sources: videasyResult.sources, provider: 'videasy' };
        }
        console.log(`[EXTRACT] Videasy: ${videasyResult.error || 'No working sources'}`);
      } catch (videasyError) {
        console.warn('[EXTRACT] Videasy failed:', videasyError instanceof Error ? videasyError.message : videasyError);
      }
      
      // Try SmashyStream
      if (SMASHYSTREAM_ENABLED) {
        console.log('[EXTRACT] Trying fallback source: SmashyStream...');
        try {
          const smashyResult = await extractSmashyStreamStreams(tmdbId, type, season, episode);
          const workingSmashy = smashyResult.sources.filter(s => s.status === 'working');
          
          if (workingSmashy.length > 0) {
            console.log(`[EXTRACT] ✓ SmashyStream succeeded with ${workingSmashy.length} working source(s)`);
            return { sources: smashyResult.sources, provider: 'smashystream' };
          }
        } catch (smashyError) {
          console.warn('[EXTRACT] SmashyStream failed:', smashyError instanceof Error ? smashyError.message : smashyError);
        }
      }
      
      // Try MultiMovies
      if (MULTIMOVIES_ENABLED) {
        console.log('[EXTRACT] Trying fallback source: MultiMovies...');
        try {
          const multiMoviesResult = await extractMultiMoviesStreams(tmdbId, type, season, episode);
          const workingMultiMovies = multiMoviesResult.sources.filter(s => s.status === 'working');
          
          if (workingMultiMovies.length > 0) {
            console.log(`[EXTRACT] ✓ MultiMovies succeeded with ${workingMultiMovies.length} working source(s)`);
            return { sources: multiMoviesResult.sources, provider: 'multimovies' };
          }
        } catch (multiMoviesError) {
          console.warn('[EXTRACT] MultiMovies failed:', multiMoviesError instanceof Error ? multiMoviesError.message : multiMoviesError);
        }
      }
      
      // Try MultiEmbed sources (Cloudy, XPrime, Hexa, Flixer)
      if (MULTI_EMBED_ENABLED) {
        console.log('[EXTRACT] Trying fallback source: MultiEmbed...');
        try {
          const multiEmbedResult = await extractMultiEmbedStreams(tmdbId, type, season, episode);
          const workingMultiEmbed = multiEmbedResult.sources.filter(s => s.status === 'working');
          
          if (workingMultiEmbed.length > 0) {
            console.log(`[EXTRACT] ✓ MultiEmbed succeeded with ${workingMultiEmbed.length} working source(s)`);
            return { sources: multiEmbedResult.sources, provider: 'multiembed' };
          }
        } catch (multiEmbedError) {
          console.warn('[EXTRACT] MultiEmbed failed:', multiEmbedError instanceof Error ? multiEmbedError.message : multiEmbedError);
        }
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

      // Only cache if we have valid sources with URLs
      if (sources.length > 0 && sources[0]?.url) {
        cache.set(cacheKey, {
          sources,
          timestamp: Date.now(),
          hits: 1
        });
      } else {
        console.log(`[EXTRACT] Not caching - no valid sources with URLs`);
      }

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
      // MegaUp CDN sources have requiresSegmentProxy: false and won't be proxied
      const proxiedSources = sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: maybeProxyUrl(source, usedProvider),
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
