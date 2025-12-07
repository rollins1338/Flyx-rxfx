/**
 * TV Proxy Cloudflare Worker
 * 
 * Proxies DLHD.dad live streams with automatic server lookup.
 * Handles M3U8 playlists, encryption keys, and video segments.
 * 
 * Routes:
 *   GET /?channel=<id>           - Get proxied M3U8 playlist
 *   GET /key?url=<encoded_url>   - Proxy encryption key
 *   GET /segment?url=<encoded_url> - Proxy video segment
 */

import { createLogger, type LogLevel } from './logger';

export interface Env {
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
  LOG_LEVEL?: string;
}

// Allowed origins for anti-leech protection
const ALLOWED_ORIGINS = [
  'https://tv.vynx.cc',
  'https://flyx.tv',
  'https://www.flyx.tv',
  'http://localhost:3000',
  'http://localhost:3001',
  // Allow any origin for testing - remove in production
  '*',
];

const PLAYER_DOMAINS = ['epicplayplay.cfd', 'daddyhd.com'];

const CDN_PATTERNS = {
  standard: (serverKey: string, channelKey: string) =>
    `https://${serverKey}new.giokko.ru/${serverKey}/${channelKey}/mono.css`,
  top1cdn: (channelKey: string) =>
    `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`,
};

// In-memory cache for server keys
const serverKeyCache = new Map<string, { serverKey: string; playerDomain: string; fetchedAt: number }>();
const SERVER_KEY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logLevel = (env.LOG_LEVEL || 'debug') as LogLevel;
    const logger = createLogger(request, logLevel);

    const requestOrigin = request.headers.get('origin');
    const requestReferer = request.headers.get('referer');

    if (request.method === 'OPTIONS') {
      logger.info('CORS preflight');
      if (!isAllowedOrigin(requestOrigin, requestReferer)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 200, headers: corsHeaders(requestOrigin) });
    }

    if (request.method !== 'GET') {
      logger.warn('Method not allowed', { method: request.method });
      return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ANTI-LEECH: Block requests from unauthorized origins
    if (!isAllowedOrigin(requestOrigin, requestReferer)) {
      logger.warn('Blocked leecher request', { origin: requestOrigin, referer: requestReferer });
      return new Response(JSON.stringify({
        error: 'Access denied',
        message: 'This proxy only serves requests from authorized domains',
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Route: /key - Proxy encryption key
      if (path === '/key') {
        logger.info('Handling key proxy request');
        return handleKeyProxy(url, env, logger);
      }

      // Route: /segment - Proxy video segment
      if (path === '/segment') {
        logger.debug('Handling segment proxy request');
        return handleSegmentProxy(url, env, logger);
      }

      // Route: / - Get M3U8 playlist
      const channel = url.searchParams.get('channel');
      if (!channel) {
        logger.warn('Missing channel parameter');
        return jsonResponse({
          error: 'Missing channel parameter',
          usage: 'GET /?channel=325',
          routes: {
            playlist: '/?channel=<id>',
            key: '/key?url=<encoded_url>',
            segment: '/segment?url=<encoded_url>',
          },
        }, 400);
      }

      logger.info('Handling playlist request', { channel });
      return handlePlaylistRequest(channel, url.origin, env, logger);

    } catch (error) {
      logger.error('TV Proxy error', error as Error);
      return jsonResponse({
        error: 'Proxy error',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }, 500);
    }
  },
};

async function handlePlaylistRequest(channel: string, proxyOrigin: string, env: Env, logger: any): Promise<Response> {
  const channelKey = `premium${channel}`;
  
  // Get server key
  logger.debug('Looking up server key', { channelKey });
  const { serverKey, playerDomain } = await getServerKey(channelKey, env, logger);
  logger.info('Server key found', { serverKey, playerDomain });
  
  const m3u8Url = constructM3U8Url(serverKey, channelKey);
  logger.debug('Constructed M3U8 URL', { m3u8Url });
  
  // Fetch M3U8 with cache-busting
  const cacheBustUrl = `${m3u8Url}?_t=${Date.now()}`;
  const fetchStart = Date.now();
  const response = await fetchViaProxy(cacheBustUrl, env, logger);
  const content = await response.text();
  logger.debug('M3U8 fetched', { 
    duration: Date.now() - fetchStart,
    contentLength: content.length,
  });
  
  if (!content.includes('#EXTM3U') && !content.includes('#EXT-X-')) {
    logger.error('Invalid M3U8 content', { preview: content.substring(0, 200) });
    return jsonResponse({ error: 'Invalid M3U8 content' }, 502);
  }

  // Parse and rewrite M3U8
  const { keyUrl, iv } = parseM3U8(content);
  logger.debug('M3U8 parsed', { hasKey: !!keyUrl, hasIV: !!iv });
  
  const proxiedM3U8 = generateProxiedM3U8(content, keyUrl, proxyOrigin);

  const res = new Response(proxiedM3U8, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      ...corsHeaders(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-DLHD-Channel': channel,
      'X-DLHD-IV': iv || '',
    },
  });

  logger.requestEnd(res);
  return res;
}

async function handleKeyProxy(url: URL, env: Env, logger: any): Promise<Response> {
  const keyUrl = url.searchParams.get('url');
  if (!keyUrl) {
    logger.warn('Missing url parameter for key');
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  const decodedUrl = decodeURIComponent(keyUrl);
  logger.debug('Fetching encryption key', { url: decodedUrl });
  
  const fetchStart = Date.now();
  const response = await fetchViaProxy(decodedUrl, env, logger);
  const keyData = await response.arrayBuffer();
  
  logger.info('Key fetched', { 
    duration: Date.now() - fetchStart,
    size: keyData.byteLength,
  });

  const res = new Response(keyData, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      ...corsHeaders(),
      'Cache-Control': 'no-store',
    },
  });

  logger.requestEnd(res);
  return res;
}

async function handleSegmentProxy(url: URL, env: Env, logger: any): Promise<Response> {
  const segmentUrl = url.searchParams.get('url');
  if (!segmentUrl) {
    logger.warn('Missing url parameter for segment');
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  const decodedUrl = decodeURIComponent(segmentUrl);
  logger.debug('Fetching segment', { url: decodedUrl.substring(0, 100) });
  
  const fetchStart = Date.now();
  const response = await fetchViaProxy(decodedUrl, env, logger);
  const segmentData = await response.arrayBuffer();
  
  logger.debug('Segment fetched', { 
    duration: Date.now() - fetchStart,
    size: segmentData.byteLength,
  });

  const res = new Response(segmentData, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp2t',
      ...corsHeaders(),
      'Cache-Control': 'public, max-age=300',
      'Content-Length': segmentData.byteLength.toString(),
    },
  });

  return res;
}


async function getServerKey(channelKey: string, env: Env, logger: any): Promise<{ serverKey: string; playerDomain: string }> {
  // Check cache
  const cached = serverKeyCache.get(channelKey);
  if (cached && (Date.now() - cached.fetchedAt) < SERVER_KEY_CACHE_TTL_MS) {
    logger.debug('Server key cache hit', { channelKey });
    return { serverKey: cached.serverKey, playerDomain: cached.playerDomain };
  }

  logger.debug('Server key cache miss, fetching', { channelKey });

  for (const domain of PLAYER_DOMAINS) {
    const lookupUrl = `https://${domain}/server_lookup.js?channel_id=${channelKey}`;
    try {
      logger.debug('Trying server lookup', { domain, lookupUrl });
      
      const response = await fetch(lookupUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `https://${domain}/`,
          'Origin': `https://${domain}`,
        },
      });

      if (response.ok) {
        const data = await response.json() as { server_key?: string };
        if (data.server_key) {
          logger.info('Server key found', { domain, serverKey: data.server_key });
          serverKeyCache.set(channelKey, {
            serverKey: data.server_key,
            playerDomain: domain,
            fetchedAt: Date.now(),
          });
          return { serverKey: data.server_key, playerDomain: domain };
        }
      }
    } catch (err) {
      logger.warn('Server lookup failed', { domain, error: (err as Error).message });
    }
  }

  logger.error('All server lookups failed', { channelKey });
  throw new Error('All server lookups failed');
}

function constructM3U8Url(serverKey: string, channelKey: string): string {
  if (serverKey === 'top1/cdn') return CDN_PATTERNS.top1cdn(channelKey);
  return CDN_PATTERNS.standard(serverKey, channelKey);
}

async function fetchViaProxy(url: string, env: Env, logger: any): Promise<Response> {
  // Try direct fetch first - giokko.ru doesn't block based on IP, only headers!
  // This saves bandwidth and latency by not going through RPI proxy
  logger.debug('Trying direct fetch', { url: url.substring(0, 100) });
  
  try {
    const directResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://epicplayplay.cfd/',
        'Origin': 'https://epicplayplay.cfd',
      },
    });
    
    if (directResponse.ok) {
      logger.info('Direct fetch succeeded');
      return directResponse;
    }
    
    logger.warn('Direct fetch failed, status:', { status: directResponse.status });
  } catch (err) {
    logger.warn('Direct fetch error:', { error: (err as Error).message });
  }

  // Fallback to RPI proxy if direct fetch fails
  if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
    const proxyUrl = `${env.RPI_PROXY_URL}/proxy?url=${encodeURIComponent(url)}`;
    logger.debug('Falling back to RPI proxy', { proxyUrl: proxyUrl.substring(0, 100) });
    
    const response = await fetch(proxyUrl, {
      headers: { 'X-API-Key': env.RPI_PROXY_KEY },
    });
    
    if (!response.ok) {
      logger.error('RPI proxy failed', { status: response.status });
      throw new Error(`RPI proxy failed: ${response.status}`);
    }
    return response;
  }

  throw new Error('Direct fetch failed and no RPI proxy configured');
}

function parseM3U8(content: string): { keyUrl: string | null; iv: string | null } {
  const keyMatch = content.match(/URI="([^"]+)"/);
  const ivMatch = content.match(/IV=0x([a-fA-F0-9]+)/);
  return { keyUrl: keyMatch?.[1] || null, iv: ivMatch?.[1] || null };
}

function generateProxiedM3U8(originalM3U8: string, keyUrl: string | null, proxyOrigin: string): string {
  let modified = originalM3U8;

  // Proxy the key URL
  if (keyUrl) {
    const proxiedKeyUrl = `${proxyOrigin}/tv/key?url=${encodeURIComponent(keyUrl)}`;
    modified = modified.replace(/URI="[^"]+"/, `URI="${proxiedKeyUrl}"`);
  }

  // Remove ENDLIST for live streams
  modified = modified.replace(/\n?#EXT-X-ENDLIST\s*$/m, '');

  // Proxy segment URLs
  modified = modified.replace(
    /^(https?:\/\/(?:[^\s]+\.(ts|css)|whalesignal\.ai\/[^\s]+))$/gm,
    (segmentUrl) => `${proxyOrigin}/tv/segment?url=${encodeURIComponent(segmentUrl)}`
  );

  return modified;
}

function isAllowedOrigin(origin: string | null, referer: string | null): boolean {
  // Allow all origins for now - the TV proxy is public
  // TODO: Re-enable origin checking in production if needed
  if (ALLOWED_ORIGINS.includes('*')) return true;
  
  const checkOrigin = (o: string): boolean => {
    return ALLOWED_ORIGINS.some(allowed => {
      if (allowed.includes('localhost')) return o.includes('localhost');
      try {
        const allowedHost = new URL(allowed).hostname;
        const originHost = new URL(o).hostname;
        return originHost === allowedHost || originHost.endsWith(`.${allowedHost}`);
      } catch { return false; }
    });
  };

  if (origin && checkOrigin(origin)) return true;
  if (referer) {
    try {
      return checkOrigin(new URL(referer).origin);
    } catch { return false; }
  }
  return false;
}

function corsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin, null) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function jsonResponse(data: object, status: number, origin?: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
