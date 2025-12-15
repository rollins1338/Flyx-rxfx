/**
 * DLHD Proxy - Direct Auth Token Method
 * 
 * Proxies DLHD.dad live streams directly through Cloudflare Workers.
 * No RPI proxy needed! Uses auth token method discovered via reverse engineering.
 * 
 * Key Discovery (Dec 2024):
 *   - DLHD key server requires: Authorization: Bearer <token>
 *   - Token is generated server-side and embedded in player page
 *   - Token is fetched from: https://epicplayplay.cfd/premiumtv/daddyhd.php?id=<channel>
 *   - This works from ANY IP (datacenter or residential)!
 * 
 * Architecture:
 *   Cloudflare Worker → DLHD CDN (with auth token)
 * 
 * Routes:
 *   GET /?channel=<id>           - Get proxied M3U8 playlist
 *   GET /key?url=<encoded_url>   - Proxy encryption key (with auth token)
 *   GET /segment?url=<encoded_url> - Proxy video segment
 *   GET /health                  - Health check
 */

import { createLogger, type LogLevel } from './logger';

export interface Env {
  LOG_LEVEL?: string;
  // Raspberry Pi proxy
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
}

// DLHD player domains for server lookup - epicplayplay.cfd is the actual player domain
const PLAYER_DOMAINS = ['epicplayplay.cfd', 'dlhd.dad', 'daddyhd.com'];

// CDN URL patterns - based on actual browser trace
// Server key "zeko" → zekonew.kiko2.ru/zeko/premium51/mono.css
// Server key "chevy" → chevynew.kiko2.ru/chevy/premium51/mono.css
const CDN_PATTERNS = {
  // New kiko2.ru format (current)
  kiko2: (serverKey: string, channelKey: string) =>
    `https://${serverKey}new.kiko2.ru/${serverKey}/${channelKey}/mono.css`,
  // Legacy giokko.ru format (fallback)
  giokko: (serverKey: string, channelKey: string) =>
    `https://${serverKey}new.giokko.ru/${serverKey}/${channelKey}/mono.css`,
  // top1/cdn special case
  top1cdn: (channelKey: string) =>
    `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`,
};

// In-memory cache for server keys
const serverKeyCache = new Map<string, { serverKey: string; playerDomain: string; fetchedAt: number }>();
const SERVER_KEY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// In-memory cache for auth tokens (per channel)
const authTokenCache = new Map<string, { token: string; fetchedAt: number }>();
const AUTH_TOKEN_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (tokens valid for ~5 hours)

/**
 * Fetch auth token from the player page for a given channel
 * This is the key discovery - the token allows key fetching from any IP!
 */
async function fetchAuthToken(channel: string, logger: any): Promise<string | null> {
  const cached = authTokenCache.get(channel);
  if (cached && (Date.now() - cached.fetchedAt) < AUTH_TOKEN_CACHE_TTL_MS) {
    logger.debug('Using cached auth token', { channel });
    return cached.token;
  }
  
  logger.info('Fetching fresh auth token', { channel });
  
  try {
    const url = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    });
    
    if (!response.ok) {
      logger.warn('Failed to fetch player page', { status: response.status });
      return null;
    }
    
    const html = await response.text();
    
    // Extract AUTH_TOKEN from the page
    const match = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
    if (match) {
      const token = match[1];
      authTokenCache.set(channel, { token, fetchedAt: Date.now() });
      logger.info('Got auth token', { channel, tokenPreview: token.substring(0, 20) + '...' });
      return token;
    }
    
    logger.warn('No auth token found in player page', { channel });
    return null;
  } catch (error) {
    logger.error('Error fetching auth token', error as Error);
    return null;
  }
}

/**
 * Extract channel number from key URL
 * e.g., https://chevy.kiko2.ru/key/premium51/5886102 -> "51"
 */
function extractChannelFromKeyUrl(keyUrl: string): string | null {
  const match = keyUrl.match(/premium(\d+)/);
  return match ? match[1] : null;
}

export async function handleDLHDRequest(request: Request, env: Env): Promise<Response> {
  const logLevel = (env.LOG_LEVEL || 'info') as LogLevel;
  const logger = createLogger(request, logLevel);
  
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/dlhd/, '') || '/';
  const origin = request.headers.get('origin');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders(origin) });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, origin);
  }

  try {
    if (path === '/health') {
      return handleHealthCheck(env, origin);
    }

    if (path === '/key') {
      return handleKeyProxy(url, env, logger, origin);
    }

    if (path === '/segment') {
      return handleSegmentProxy(url, env, logger, origin);
    }
    
    // Debug endpoint to test key proxying
    if (path === '/debug-key') {
      const testKeyUrl = url.searchParams.get('url');
      if (!testKeyUrl) {
        return jsonResponse({
          error: 'Missing url parameter',
          usage: 'GET /dlhd/debug-key?url=<encoded_key_url>',
          hint: 'Use this to test key proxying without HLS.js'
        }, 400, origin);
      }
      
      try {
        let keyUrl = testKeyUrl;
        if (keyUrl.includes('%')) {
          try { keyUrl = decodeURIComponent(keyUrl); } catch {}
        }
        
        logger.info('Debug key request', { keyUrl: keyUrl.substring(0, 80) });
        
        const response = await fetchViaRpiProxy(keyUrl, env, logger);
        const keyData = await response.arrayBuffer();
        
        // Return debug info instead of raw key
        const keyBytes = new Uint8Array(keyData);
        const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        return jsonResponse({
          success: true,
          keyUrl: keyUrl,
          keySize: keyData.byteLength,
          keyHex: keyHex.substring(0, 64) + (keyHex.length > 64 ? '...' : ''),
          isValidAES128: keyData.byteLength === 16,
          timestamp: new Date().toISOString()
        }, 200, origin);
      } catch (error) {
        return jsonResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          keyUrl: testKeyUrl
        }, 500, origin);
      }
    }

    // Schedule endpoint - fetches live events from DLHD via RPI proxy
    if (path === '/schedule') {
      return handleScheduleRequest(url, env, logger, origin);
    }

    const channel = url.searchParams.get('channel');
    if (!channel) {
      return jsonResponse({
        error: 'Missing channel parameter',
        usage: 'GET /dlhd?channel=325',
      }, 400, origin);
    }

    return handlePlaylistRequest(channel, url.origin, env, logger, origin);

  } catch (error) {
    logger.error('DLHD Proxy error', error as Error);
    return jsonResponse({
      error: 'DLHD proxy error',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, 500, origin);
  }
}


function handleHealthCheck(env: Env, origin: string | null): Response {
  // RPI proxy is no longer required! We use direct auth token method.
  const hasRpiProxy = !!(env.RPI_PROXY_URL && env.RPI_PROXY_KEY);
  
  return jsonResponse({
    status: 'healthy',
    method: 'direct-auth-token',
    description: 'DLHD keys fetched directly using auth token (no RPI proxy needed)',
    rpiProxy: {
      configured: hasRpiProxy,
      note: 'RPI proxy is optional - direct auth token method is preferred',
    },
    authTokenCache: {
      size: authTokenCache.size,
      channels: Array.from(authTokenCache.keys()),
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
  
  // Get server key (may fall back to known keys if lookup is blocked)
  const { serverKey: initialServerKey, playerDomain } = await getServerKey(channelKey, logger);
  logger.info('Server key found', { serverKey: initialServerKey, playerDomain });
  
  // Try the initial server key, then fall back to other known keys
  const serverKeysToTry = [initialServerKey, ...KNOWN_SERVER_KEYS.filter(k => k !== initialServerKey)];
  
  let lastError = '';
  for (const serverKey of serverKeysToTry) {
    try {
      // Fetch M3U8 directly (no RPI proxy needed for M3U8)
      const m3u8Url = constructM3U8Url(serverKey, channelKey);
      logger.info('Trying M3U8 URL', { serverKey, url: m3u8Url });
      
      const response = await fetch(`${m3u8Url}?_t=${Date.now()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://epicplayplay.cfd/',
        },
      });
      const content = await response.text();
      
      if (content.includes('#EXTM3U') || content.includes('#EXT-X-')) {
        // Valid M3U8 found - cache this server key for future requests
        serverKeyCache.set(channelKey, {
          serverKey,
          playerDomain,
          fetchedAt: Date.now(),
        });
        
        // Rewrite M3U8 to proxy key and segments
        // Pass the M3U8 URL as base for resolving relative URLs
        const { keyUrl, iv } = parseM3U8(content);
        const proxiedM3U8 = generateProxiedM3U8(content, keyUrl, proxyOrigin, m3u8Url);
        
        // Log the key URL transformation for debugging
        const keyLineMatch = proxiedM3U8.match(/#EXT-X-KEY[^\n]*/);
        logger.info('M3U8 processed', { 
          hasKey: !!keyUrl, 
          originalKeyUrl: keyUrl?.substring(0, 80),
          iv: iv?.substring(0, 16),
          rewrittenKeyLine: keyLineMatch?.[0]?.substring(0, 120)
        });

        return new Response(proxiedM3U8, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            ...corsHeaders(origin),
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-DLHD-Channel': channel,
            'X-DLHD-Server-Key': serverKey,
            'X-DLHD-IV': iv || '',
          },
        });
      }
      
      lastError = `Invalid M3U8 from ${serverKey}: ${content.substring(0, 100)}`;
      logger.warn('Invalid M3U8 content, trying next server key', { serverKey, preview: content.substring(0, 100) });
    } catch (err) {
      lastError = `Error from ${serverKey}: ${(err as Error).message}`;
      logger.warn('M3U8 fetch failed, trying next server key', { serverKey, error: (err as Error).message });
    }
  }
  
  // All server keys failed
  logger.error('All server keys failed', { lastError });
  return jsonResponse({ 
    error: 'Failed to fetch M3U8 from any server', 
    details: lastError,
    triedKeys: serverKeysToTry 
  }, 502, origin);
}

async function handleKeyProxy(url: URL, env: Env, logger: any, origin: string | null): Promise<Response> {
  const keyUrlParam = url.searchParams.get('url');
  if (!keyUrlParam) {
    logger.warn('Key proxy called without url parameter');
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  try {
    // Decode URL parameter
    let keyUrl = keyUrlParam;
    if (keyUrl.includes('%')) {
      try { keyUrl = decodeURIComponent(keyUrl); } catch {}
    }
    
    logger.info('Key proxy request', { keyUrl: keyUrl.substring(0, 80) });
    
    // Extract channel from key URL
    const channel = extractChannelFromKeyUrl(keyUrl);
    if (!channel) {
      logger.warn('Could not extract channel from key URL', { keyUrl });
      return jsonResponse({ error: 'Invalid key URL format' }, 400, origin);
    }
    
    // Fetch auth token for this channel
    const authToken = await fetchAuthToken(channel, logger);
    if (!authToken) {
      logger.error('Failed to get auth token', { channel });
      return jsonResponse({ 
        error: 'Failed to get auth token',
        channel,
        hint: 'Could not fetch auth token from player page',
      }, 502, origin);
    }
    
    // Fetch key directly with Authorization header (no RPI proxy needed!)
    logger.info('Fetching key with auth token', { channel, tokenPreview: authToken.substring(0, 20) + '...' });
    
    const keyResponse = await fetch(keyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
        'Authorization': `Bearer ${authToken}`,
        'X-Channel-Key': `premium${channel}`,
      },
    });
    
    const keyData = await keyResponse.arrayBuffer();
    
    // Check if we got a valid key
    if (keyData.byteLength === 16) {
      const keyText = new TextDecoder().decode(keyData);
      if (keyText.includes('error') || keyText.includes('E3')) {
        // Token might be expired, clear cache
        authTokenCache.delete(channel);
        logger.error('Key server returned error', { response: keyText, channel });
        return jsonResponse({ 
          error: 'Key server returned error',
          response: keyText,
          hint: 'Auth token may be expired, will retry with fresh token',
        }, 502, origin);
      }
      
      // Valid 16-byte key!
      logger.info('Key fetched successfully (direct)', { size: keyData.byteLength, channel });
      return new Response(keyData, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': '16',
          ...corsHeaders(origin),
          // Keys are valid for a short time, allow brief caching to reduce load
          'Cache-Control': 'private, max-age=30',
          'X-Fetched-By': 'direct-auth-token',
        },
      });
    }
    
    // Invalid key size
    logger.warn('Invalid key size', { size: keyData.byteLength, status: keyResponse.status });
    const preview = new TextDecoder().decode(keyData).substring(0, 200);
    return jsonResponse({ 
      error: 'Invalid key data', 
      size: keyData.byteLength,
      expected: 16,
      preview,
    }, 502, origin);
    
  } catch (error) {
    logger.error('Key proxy failed', error as Error);
    return jsonResponse({
      error: 'Key fetch failed',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, 502, origin);
  }
}

async function handleSegmentProxy(url: URL, env: Env, logger: any, origin: string | null): Promise<Response> {
  const segmentUrl = url.searchParams.get('url');
  if (!segmentUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  const decodedUrl = decodeURIComponent(segmentUrl);
  
  // Try direct fetch first for segments (CDNs like DigitalOcean/Google don't block)
  const response = await fetchSegment(decodedUrl, env, logger);
  const segmentData = await response.arrayBuffer();

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

// Known server keys - based on actual browser traces
// These are the server names returned by server_lookup.js
const KNOWN_SERVER_KEYS = ['zeko', 'chevy', 'top1/cdn'];

async function getServerKey(channelKey: string, logger: any): Promise<{ serverKey: string; playerDomain: string }> {
  // Check cache
  const cached = serverKeyCache.get(channelKey);
  if (cached && (Date.now() - cached.fetchedAt) < SERVER_KEY_CACHE_TTL_MS) {
    return { serverKey: cached.serverKey, playerDomain: cached.playerDomain };
  }

  // Try server lookup from each domain
  for (const domain of PLAYER_DOMAINS) {
    try {
      const response = await fetch(`https://${domain}/server_lookup.js?channel_id=${channelKey}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': `https://${domain}/`,
        },
      });

      if (response.ok) {
        const text = await response.text();
        
        // Check if we got HTML (anti-bot challenge) instead of JSON
        if (text.startsWith('<') || text.includes('<!DOCTYPE')) {
          logger.warn('Server lookup returned HTML challenge', { domain });
          continue;
        }
        
        try {
          const data = JSON.parse(text) as { server_key?: string };
          if (data.server_key) {
            serverKeyCache.set(channelKey, {
              serverKey: data.server_key,
              playerDomain: domain,
              fetchedAt: Date.now(),
            });
            return { serverKey: data.server_key, playerDomain: domain };
          }
        } catch (parseErr) {
          logger.warn('Server lookup JSON parse failed', { domain, error: (parseErr as Error).message });
        }
      }
    } catch (err) {
      logger.warn('Server lookup failed', { domain, error: (err as Error).message });
    }
  }

  // Fallback to known server keys (most channels use top1/cdn)
  logger.warn('Server lookup blocked, using fallback server key', { fallback: KNOWN_SERVER_KEYS[0] });
  return { serverKey: KNOWN_SERVER_KEYS[0], playerDomain: PLAYER_DOMAINS[0] };
}

function constructM3U8Url(serverKey: string, channelKey: string): string {
  if (serverKey === 'top1/cdn') return CDN_PATTERNS.top1cdn(channelKey);
  // Use kiko2.ru domain (current active CDN based on browser trace)
  return CDN_PATTERNS.kiko2(serverKey, channelKey);
}


/**
 * Fetch via Raspberry Pi proxy (residential IP)
 * Required for M3U8 playlists and encryption keys
 */
async function fetchViaRpiProxy(url: string, env: Env, logger: any): Promise<Response> {
  if (!env.RPI_PROXY_URL || !env.RPI_PROXY_KEY) {
    throw new Error('RPI proxy not configured. Set RPI_PROXY_URL and RPI_PROXY_KEY secrets.');
  }

  let rpiBaseUrl = env.RPI_PROXY_URL;
  if (!rpiBaseUrl.startsWith('http://') && !rpiBaseUrl.startsWith('https://')) {
    rpiBaseUrl = `http://${rpiBaseUrl}`;
  }

  logger.debug('Fetching via RPI proxy', { url: url.substring(0, 80) });

  const proxyUrl = `${rpiBaseUrl}/proxy?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl, {
    headers: { 'X-API-Key': env.RPI_PROXY_KEY },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('RPI proxy failed', { status: response.status, error: errorText.substring(0, 200) });
    throw new Error(`RPI proxy error: ${response.status} - ${errorText.substring(0, 100)}`);
  }

  logger.info('RPI proxy succeeded');
  return response;
}

/**
 * Fetch video segment - try direct first, fallback to RPI proxy
 * Segments on public CDNs (DigitalOcean, Google Cloud) usually work direct
 */
async function fetchSegment(url: string, env: Env, logger: any): Promise<Response> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Referer': 'https://epicplayplay.cfd/',
  };

  // Try direct fetch first (works for CDN-hosted segments)
  try {
    const response = await fetch(url, { headers });
    if (response.ok) {
      logger.debug('Segment fetched direct');
      return response;
    }
    logger.warn('Direct segment fetch failed', { status: response.status });
  } catch (err) {
    logger.warn('Direct segment fetch error', { error: (err as Error).message });
  }

  // Fallback to RPI proxy
  return fetchViaRpiProxy(url, env, logger);
}

function parseM3U8(content: string): { keyUrl: string | null; iv: string | null } {
  const keyMatch = content.match(/URI="([^"]+)"/);
  const ivMatch = content.match(/IV=0x([a-fA-F0-9]+)/);
  return { keyUrl: keyMatch?.[1] || null, iv: ivMatch?.[1] || null };
}

/**
 * Generate proxied M3U8 with key and segment URLs rewritten to go through our proxy
 * 
 * @param originalM3U8 - The original M3U8 content
 * @param keyUrl - The extracted key URL (may be relative or absolute)
 * @param proxyOrigin - The origin of our proxy (e.g., https://cf-worker.example.com)
 * @param m3u8BaseUrl - The base URL of the original M3U8 (for resolving relative URLs)
 */
function generateProxiedM3U8(
  originalM3U8: string, 
  keyUrl: string | null, 
  proxyOrigin: string,
  m3u8BaseUrl?: string
): string {
  let modified = originalM3U8;

  // Proxy the key URL (MUST go through RPI proxy)
  if (keyUrl) {
    // Resolve relative key URLs to absolute
    let absoluteKeyUrl = keyUrl;
    if (!keyUrl.startsWith('http://') && !keyUrl.startsWith('https://')) {
      if (m3u8BaseUrl) {
        // Resolve relative URL against M3U8 base URL
        try {
          const base = new URL(m3u8BaseUrl);
          absoluteKeyUrl = new URL(keyUrl, base.origin + base.pathname.replace(/\/[^/]*$/, '/')).toString();
        } catch {
          // If URL parsing fails, try simple concatenation
          const baseWithoutFile = m3u8BaseUrl.replace(/\/[^/]*$/, '/');
          absoluteKeyUrl = baseWithoutFile + keyUrl;
        }
      }
    }
    
    const proxiedKeyUrl = `${proxyOrigin}/dlhd/key?url=${encodeURIComponent(absoluteKeyUrl)}`;
    // Simple replacement - just replace the original key URL with the proxied one
    modified = modified.replace(`URI="${keyUrl}"`, `URI="${proxiedKeyUrl}"`);
  }

  // Remove ENDLIST for live streams
  modified = modified.replace(/\n?#EXT-X-ENDLIST\s*$/m, '');

  // Proxy segment URLs - handle both absolute and relative URLs
  const lines = modified.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Skip empty lines, comments, and M3U8 tags
    if (!trimmed || trimmed.startsWith('#')) return line;
    
    // Skip if it's already a proxied URL
    if (trimmed.includes('/dlhd/segment?')) return line;
    
    // Check if it's a segment URL (absolute or relative)
    const isAbsoluteUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const isSegmentFile = trimmed.endsWith('.ts') || trimmed.includes('.ts?') || 
                          trimmed.includes('redirect.giokko.ru') || 
                          trimmed.includes('whalesignal.ai');
    
    if (isAbsoluteUrl && isSegmentFile) {
      // Don't proxy the M3U8 playlist URL itself
      if (trimmed.includes('mono.css')) return line;
      return `${proxyOrigin}/dlhd/segment?url=${encodeURIComponent(trimmed)}`;
    }
    
    // Handle relative segment URLs
    if (!isAbsoluteUrl && (trimmed.endsWith('.ts') || trimmed.includes('.ts?'))) {
      if (m3u8BaseUrl) {
        try {
          const base = new URL(m3u8BaseUrl);
          const absoluteUrl = new URL(trimmed, base.origin + base.pathname.replace(/\/[^/]*$/, '/')).toString();
          return `${proxyOrigin}/dlhd/segment?url=${encodeURIComponent(absoluteUrl)}`;
        } catch {
          // If URL parsing fails, return original
          return line;
        }
      }
    }
    
    return line;
  });

  return processedLines.join('\n');
}

/**
 * Handle schedule request - fetches live events HTML from DLHD via RPI proxy
 * This ensures the request comes from a residential IP
 */
async function handleScheduleRequest(
  url: URL,
  env: Env,
  logger: any,
  origin: string | null
): Promise<Response> {
  const source = url.searchParams.get('source');
  
  try {
    let dlhdUrl: string;
    let isJson = false;
    
    if (source) {
      // Fetch from schedule API endpoint
      dlhdUrl = `https://dlhd.dad/schedule-api.php?source=${source}`;
      isJson = true;
    } else {
      // Fetch main page HTML
      dlhdUrl = 'https://dlhd.dad/';
    }
    
    logger.info('Fetching DLHD schedule via RPI proxy', { url: dlhdUrl });
    
    const response = await fetchViaRpiProxy(dlhdUrl, env, logger);
    const content = await response.text();
    
    if (isJson) {
      // Parse JSON response and extract HTML
      try {
        const json = JSON.parse(content);
        if (json.success && json.html) {
          return new Response(json.html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              ...corsHeaders(origin),
              'Cache-Control': 'public, max-age=60',
            },
          });
        }
      } catch {
        // Fall through to return raw content
      }
    }
    
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders(origin),
        'Cache-Control': 'public, max-age=60',
      },
    });
    
  } catch (error) {
    logger.error('Schedule fetch failed', error as Error);
    return jsonResponse({
      error: 'Schedule fetch failed',
      message: error instanceof Error ? error.message : String(error),
    }, 502, origin);
  }
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
