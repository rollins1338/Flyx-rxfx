/**
 * DLHD Proxy with Oxylabs Residential ISP Rotation
 * 
 * Proxies DLHD.dad live streams through Oxylabs residential IPs
 * to bypass geo-restrictions and CDN blocks.
 * 
 * Routes:
 *   GET /?channel=<id>           - Get proxied M3U8 playlist
 *   GET /key?url=<encoded_url>   - Proxy encryption key
 *   GET /segment?url=<encoded_url> - Proxy video segment
 *   GET /health                  - Health check
 * 
 * Oxylabs Configuration:
 *   Set these secrets via wrangler:
 *   - OXYLABS_USERNAME: Your Oxylabs username
 *   - OXYLABS_PASSWORD: Your Oxylabs password
 *   - OXYLABS_ENDPOINT: Proxy endpoint (default: pr.oxylabs.io:7777)
 */

import { createLogger, type LogLevel } from './logger';

export interface Env {
  LOG_LEVEL?: string;
  // Oxylabs credentials
  OXYLABS_USERNAME?: string;
  OXYLABS_PASSWORD?: string;
  OXYLABS_ENDPOINT?: string;
  // Optional: specific country/city targeting
  OXYLABS_COUNTRY?: string; // e.g., 'us', 'uk', 'de'
  OXYLABS_CITY?: string;    // e.g., 'new_york', 'london'
  // Fallback RPI proxy
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
}

// DLHD player domains for server lookup
const PLAYER_DOMAINS = ['dlhd.dad', 'daddyhd.com', 'epicplayplay.cfd'];

// CDN URL patterns
const CDN_PATTERNS = {
  standard: (serverKey: string, channelKey: string) =>
    `https://${serverKey}new.giokko.ru/${serverKey}/${channelKey}/mono.css`,
  top1cdn: (channelKey: string) =>
    `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`,
};

// In-memory cache for server keys
const serverKeyCache = new Map<string, { serverKey: string; playerDomain: string; fetchedAt: number }>();
const SERVER_KEY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Session ID for sticky sessions (rotates every 10 minutes)
let currentSessionId = generateSessionId();
let sessionCreatedAt = Date.now();
const SESSION_ROTATION_MS = 10 * 60 * 1000; // 10 minutes

function generateSessionId(): string {
  return `dlhd_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function getSessionId(): string {
  // Rotate session every 10 minutes for IP rotation
  if (Date.now() - sessionCreatedAt > SESSION_ROTATION_MS) {
    currentSessionId = generateSessionId();
    sessionCreatedAt = Date.now();
  }
  return currentSessionId;
}

export async function handleDLHDRequest(request: Request, env: Env): Promise<Response> {
  const logLevel = (env.LOG_LEVEL || 'info') as LogLevel;
  const logger = createLogger(request, logLevel);
  
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/dlhd/, '') || '/';
  const origin = request.headers.get('origin');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders(origin) 
    });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  try {
    // Health check
    if (path === '/health') {
      return handleHealthCheck(env, logger, origin);
    }

    // Route: /key - Proxy encryption key
    if (path === '/key') {
      return handleKeyProxy(url, env, logger, origin);
    }

    // Route: /segment - Proxy video segment
    if (path === '/segment') {
      return handleSegmentProxy(url, env, logger, origin);
    }

    // Route: / - Get M3U8 playlist
    const channel = url.searchParams.get('channel');
    if (!channel) {
      return jsonResponse({
        error: 'Missing channel parameter',
        usage: 'GET /dlhd?channel=325',
        routes: {
          playlist: '/dlhd?channel=<id>',
          key: '/dlhd/key?url=<encoded_url>',
          segment: '/dlhd/segment?url=<encoded_url>',
          health: '/dlhd/health',
        },
      }, 400, origin);
    }

    return handlePlaylistRequest(channel, url.origin, env, logger, origin);

  } catch (error) {
    logger.error('DLHD Proxy error', error as Error);
    return jsonResponse({
      error: 'Proxy error',
      details: error instanceof Error ? error.message : String(error),
    }, 500, origin);
  }
}

async function handleHealthCheck(env: Env, logger: any, origin: string | null): Promise<Response> {
  const hasOxylabs = !!(env.OXYLABS_USERNAME && env.OXYLABS_PASSWORD);
  const hasRpiProxy = !!(env.RPI_PROXY_URL && env.RPI_PROXY_KEY);
  
  return jsonResponse({
    status: 'healthy',
    proxy: {
      oxylabs: hasOxylabs ? 'configured' : 'not configured',
      rpiProxy: hasRpiProxy ? 'configured' : 'not configured',
      country: env.OXYLABS_COUNTRY || 'auto',
      city: env.OXYLABS_CITY || 'auto',
    },
    session: {
      id: getSessionId(),
      age: Math.floor((Date.now() - sessionCreatedAt) / 1000) + 's',
      rotatesIn: Math.floor((SESSION_ROTATION_MS - (Date.now() - sessionCreatedAt)) / 1000) + 's',
    },
    timestamp: new Date().toISOString(),
  }, 200, origin);
}

async function handlePlaylistRequest(
  channel: string, 
  proxyOrigin: string, 
  env: Env, 
  logger: any,
  origin: string | null
): Promise<Response> {
  const channelKey = `premium${channel}`;
  
  logger.debug('Looking up server key', { channelKey });
  const { serverKey, playerDomain } = await getServerKey(channelKey, env, logger);
  logger.info('Server key found', { serverKey, playerDomain });
  
  const m3u8Url = constructM3U8Url(serverKey, channelKey);
  logger.debug('Constructed M3U8 URL', { m3u8Url });
  
  // Fetch M3U8 with cache-busting
  const cacheBustUrl = `${m3u8Url}?_t=${Date.now()}`;
  const fetchStart = Date.now();
  const response = await fetchViaOxylabs(cacheBustUrl, env, logger, playerDomain);
  const content = await response.text();
  
  logger.debug('M3U8 fetched', { 
    duration: Date.now() - fetchStart,
    contentLength: content.length,
  });
  
  if (!content.includes('#EXTM3U') && !content.includes('#EXT-X-')) {
    logger.error('Invalid M3U8 content', { preview: content.substring(0, 200) });
    return jsonResponse({ error: 'Invalid M3U8 content', preview: content.substring(0, 200) }, 502, origin);
  }

  // Parse and rewrite M3U8
  const { keyUrl, iv } = parseM3U8(content);
  logger.debug('M3U8 parsed', { hasKey: !!keyUrl, hasIV: !!iv });
  
  const proxiedM3U8 = generateProxiedM3U8(content, keyUrl, proxyOrigin);

  return new Response(proxiedM3U8, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      ...corsHeaders(origin),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-DLHD-Channel': channel,
      'X-DLHD-IV': iv || '',
      'X-Proxy-Session': getSessionId(),
    },
  });
}

async function handleKeyProxy(url: URL, env: Env, logger: any, origin: string | null): Promise<Response> {
  const keyUrl = url.searchParams.get('url');
  if (!keyUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  const decodedUrl = decodeURIComponent(keyUrl);
  logger.debug('Fetching encryption key', { url: decodedUrl });
  
  const fetchStart = Date.now();
  const response = await fetchViaOxylabs(decodedUrl, env, logger);
  const keyData = await response.arrayBuffer();
  
  logger.info('Key fetched', { 
    duration: Date.now() - fetchStart,
    size: keyData.byteLength,
  });

  return new Response(keyData, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      ...corsHeaders(origin),
      'Cache-Control': 'no-store',
    },
  });
}

async function handleSegmentProxy(url: URL, env: Env, logger: any, origin: string | null): Promise<Response> {
  const segmentUrl = url.searchParams.get('url');
  if (!segmentUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  const decodedUrl = decodeURIComponent(segmentUrl);
  logger.debug('Fetching segment', { url: decodedUrl.substring(0, 100) });
  
  const fetchStart = Date.now();
  const response = await fetchViaOxylabs(decodedUrl, env, logger);
  const segmentData = await response.arrayBuffer();
  
  logger.debug('Segment fetched', { 
    duration: Date.now() - fetchStart,
    size: segmentData.byteLength,
  });

  return new Response(segmentData, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp2t',
      ...corsHeaders(origin),
      'Cache-Control': 'public, max-age=300',
      'Content-Length': segmentData.byteLength.toString(),
    },
  });
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
      logger.debug('Trying server lookup', { domain });
      
      // Server lookup doesn't need proxy - it's just metadata
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

  throw new Error('All server lookups failed');
}

function constructM3U8Url(serverKey: string, channelKey: string): string {
  if (serverKey === 'top1/cdn') return CDN_PATTERNS.top1cdn(channelKey);
  return CDN_PATTERNS.standard(serverKey, channelKey);
}

/**
 * Fetch via Oxylabs Residential Proxy
 * 
 * Uses Oxylabs' Proxy API with session-based sticky IPs for streaming.
 * Falls back to direct fetch or RPI proxy if Oxylabs fails.
 */
async function fetchViaOxylabs(url: string, env: Env, logger: any, refererDomain?: string): Promise<Response> {
  const referer = refererDomain ? `https://${refererDomain}/` : 'https://epicplayplay.cfd/';
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': referer,
    'Origin': referer.replace(/\/$/, ''),
  };

  // If Oxylabs is configured, use their proxy
  if (env.OXYLABS_USERNAME && env.OXYLABS_PASSWORD) {
    logger.debug('Using Oxylabs proxy', { url: url.substring(0, 80) });
    
    try {
      const response = await fetchWithOxylabsProxy(url, headers, env, logger);
      if (response.ok) {
        logger.info('Oxylabs fetch succeeded');
        return response;
      }
      logger.warn('Oxylabs fetch failed', { status: response.status });
    } catch (err) {
      logger.warn('Oxylabs error', { error: (err as Error).message });
    }
  }

  // Try direct fetch as fallback
  logger.debug('Trying direct fetch', { url: url.substring(0, 80) });
  try {
    const directResponse = await fetch(url, { headers });
    if (directResponse.ok) {
      logger.info('Direct fetch succeeded');
      return directResponse;
    }
    logger.warn('Direct fetch failed', { status: directResponse.status });
  } catch (err) {
    logger.warn('Direct fetch error', { error: (err as Error).message });
  }

  // Fallback to RPI proxy
  if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
    logger.debug('Falling back to RPI proxy');
    const proxyUrl = `${env.RPI_PROXY_URL}/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      headers: { 'X-API-Key': env.RPI_PROXY_KEY },
    });
    if (response.ok) {
      logger.info('RPI proxy succeeded');
      return response;
    }
    throw new Error(`RPI proxy failed: ${response.status}`);
  }

  throw new Error('All fetch methods failed');
}

/**
 * Oxylabs Proxy Integration
 * 
 * Cloudflare Workers don't support traditional HTTP CONNECT proxies,
 * so we use Oxylabs' Web Scraper API which handles the proxy internally.
 * 
 * For streaming content, we use their "universal" source which returns
 * raw content without parsing.
 */
async function fetchWithOxylabsProxy(
  targetUrl: string, 
  headers: Record<string, string>, 
  env: Env, 
  logger: any
): Promise<Response> {
  // Oxylabs Web Scraper API endpoint
  const endpoint = env.OXYLABS_ENDPOINT || 'https://realtime.oxylabs.io/v1/queries';
  const auth = btoa(`${env.OXYLABS_USERNAME}:${env.OXYLABS_PASSWORD}`);
  
  // Build geo-targeting
  let geoLocation: string | undefined;
  if (env.OXYLABS_COUNTRY) {
    geoLocation = env.OXYLABS_COUNTRY.toUpperCase();
  }

  // Determine content type for proper handling
  const isBinary = targetUrl.includes('.ts') || 
                   targetUrl.includes('.key') || 
                   targetUrl.includes('wmsxx.php') ||
                   targetUrl.includes('whalesignal.ai/');

  const payload: Record<string, any> = {
    source: 'universal',
    url: targetUrl,
    user_agent_type: 'desktop_chrome',
    render: 'html',
    // Session ID for sticky IP (same IP for duration of session)
    session_id: getSessionId(),
    // Custom headers
    headers: headers,
  };

  // Add geo-targeting if specified
  if (geoLocation) {
    payload.geo_location = geoLocation;
  }

  // For binary content, request base64 encoding
  if (isBinary) {
    payload.content_encoding = 'base64';
  }

  logger.debug('Oxylabs request', { 
    url: targetUrl.substring(0, 80),
    geo: geoLocation || 'auto',
    session: getSessionId(),
    binary: isBinary,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Oxylabs API error', { status: response.status, error: errorText.substring(0, 200) });
    throw new Error(`Oxylabs API error: ${response.status}`);
  }

  const result = await response.json() as { 
    results?: Array<{ 
      content?: string; 
      body?: string;
      status_code?: number;
    }> 
  };
  
  if (!result.results?.[0]) {
    throw new Error('No results from Oxylabs');
  }

  const resultData = result.results[0];
  
  // Check if upstream returned an error
  if (resultData.status_code && resultData.status_code >= 400) {
    throw new Error(`Upstream error: ${resultData.status_code}`);
  }

  const content = resultData.content || resultData.body || '';
  
  // Handle binary content (base64 encoded)
  if (isBinary && content) {
    try {
      // Decode base64 content
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Response(bytes, {
        headers: {
          'Content-Type': targetUrl.includes('.ts') ? 'video/mp2t' : 'application/octet-stream',
        },
      });
    } catch (e) {
      // If base64 decode fails, return as-is
      logger.warn('Base64 decode failed, returning raw content');
      return new Response(content);
    }
  }

  return new Response(content, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
    },
  });
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
    const proxiedKeyUrl = `${proxyOrigin}/dlhd/key?url=${encodeURIComponent(keyUrl)}`;
    modified = modified.replace(/URI="[^"]+"/, `URI="${proxiedKeyUrl}"`);
  }

  // Remove ENDLIST for live streams
  modified = modified.replace(/\n?#EXT-X-ENDLIST\s*$/m, '');

  // Proxy segment URLs
  modified = modified.replace(
    /^(https?:\/\/(?:[^\s]+\.(ts|css)|whalesignal\.ai\/[^\s]+))$/gm,
    (segmentUrl) => `${proxyOrigin}/dlhd/segment?url=${encodeURIComponent(segmentUrl)}`
  );

  return modified;
}

function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  };
}

function jsonResponse(data: object, status: number, origin?: string | null): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  fetch: handleDLHDRequest,
};
