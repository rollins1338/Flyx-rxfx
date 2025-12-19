/**
 * DLHD Proxy - Session-Based Authentication
 * 
 * Proxies DLHD.dad live streams through Cloudflare Workers with proper auth.
 * No RPI proxy needed! Uses session-based auth discovered via reverse engineering.
 * 
 * Authentication Flow (Dec 2024):
 *   1. Fetch player page → Get AUTH_TOKEN and CHANNEL_KEY
 *   2. Call heartbeat endpoint → Establish session (returns expiry timestamp)
 *   3. Fetch key with session → Use Authorization: Bearer <token> + X-Channel-Key
 * 
 * Key Endpoints:
 *   - Player: https://epicplayplay.cfd/premiumtv/daddyhd.php?id=<channel>
 *   - Heartbeat: https://<server>.kiko2.ru/heartbeat (GET with auth headers)
 *   - Key: https://<server>.kiko2.ru/key/premium<channel>/<key_id>
 * 
 * Error Codes:
 *   - E2: "Session must be created via heartbeat first" → Call heartbeat
 *   - E3: Token expired → Refresh from player page
 * 
 * Architecture:
 *   Browser → CF Worker → DLHD CDN (with session auth)
 * 
 * Routes:
 *   GET /?channel=<id>           - Get proxied M3U8 playlist
 *   GET /key?url=<encoded_url>   - Proxy encryption key (handles auth)
 *   GET /segment?url=<encoded_url> - Proxy video segment
 *   GET /health                  - Health check with session info
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
  // New kiko2.ru format (current) - based on actual player page
  kiko2: (serverKey: string, channelKey: string) =>
    `https://${serverKey}new.kiko2.ru/${serverKey}/${channelKey}/mono.css`,
  // Legacy giokko.ru format (fallback)
  giokko: (serverKey: string, channelKey: string) =>
    `https://${serverKey}new.giokko.ru/${serverKey}/${channelKey}/mono.css`,
  // top1/cdn special case - MUST use kiko2.ru (not giokko.ru!)
  top1cdn: (channelKey: string) =>
    `https://top1.kiko2.ru/top1/cdn/${channelKey}/mono.css`,
};

// In-memory cache for server keys only (NOT auth tokens - those must be fresh)
const serverKeyCache = new Map<string, { serverKey: string; playerDomain: string; fetchedAt: number }>();
const SERVER_KEY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// NO SESSION CACHING - always fetch fresh auth tokens
// Stale tokens cause E2/E3 errors and break playback

/**
 * Generate CLIENT_TOKEN for heartbeat authentication
 * This mimics the browser's generateClientToken() function
 * 
 * Format: base64(channelKey|country|timestamp|userAgent|fingerprint)
 * Where fingerprint = userAgent|screen|timezone|language
 */
function generateClientToken(channelKey: string, country: string, timestamp: string, userAgent: string): string {
  // Simulate browser fingerprint
  const screen = '1920x1080'; // Common resolution
  const tz = 'America/New_York'; // Common timezone
  const lang = 'en-US';
  const fingerprint = `${userAgent}|${screen}|${tz}|${lang}`;
  const signData = `${channelKey}|${country}|${timestamp}|${userAgent}|${fingerprint}`;
  return btoa(signData);
}

// btoa is available globally in Cloudflare Workers
// This is just a type declaration to make TypeScript happy
declare function btoa(str: string): string;

/**
 * Fetch FRESH session data from the player page
 * NO CACHING - always fetch fresh to avoid stale token issues
 * 
 * DLHD now requires: 1) Get auth token, 2) Call heartbeat to establish session, 3) Fetch key
 */
async function getSessionForChannel(channel: string, logger: any, preferredServer?: string): Promise<{ token: string; channelKey: string; country: string; timestamp: string; success: boolean } | null> {
  // NO CACHING - always fetch fresh auth token
  logger.info('Fetching FRESH session for channel (no cache)', { channel, preferredServer });
  
  try {
    // Step 1: Fetch player page to get AUTH_TOKEN
    const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
    const playerResponse = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    });
    
    if (!playerResponse.ok) {
      logger.warn('Failed to fetch player page', { status: playerResponse.status });
      return null;
    }
    
    const html = await playerResponse.text();
    
    // Extract AUTH_TOKEN
    const tokenMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
    if (!tokenMatch) {
      logger.warn('No auth token found in player page', { channel });
      return null;
    }
    const token = tokenMatch[1];
    
    // Extract CHANNEL_KEY
    const channelKeyMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
    const channelKey = channelKeyMatch ? channelKeyMatch[1] : `premium${channel}`;
    
    // Extract AUTH_COUNTRY
    const countryMatch = html.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
    const country = countryMatch ? countryMatch[1] : 'US';
    
    // Extract AUTH_TS (timestamp)
    const tsMatch = html.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);
    const timestamp = tsMatch ? tsMatch[1] : String(Math.floor(Date.now() / 1000));
    
    logger.info('Got player data', { 
      channel, 
      tokenPreview: token.substring(0, 20) + '...', 
      channelKey,
      country,
      timestamp
    });
    
    // NOTE: Heartbeat calls from Cloudflare Workers are blocked (403)
    // The heartbeat endpoint requires residential IP / browser origin
    // Key fetching will be done via RPI proxy which handles auth internally
    // We just need the token for the key request
    const sessionEstablished = true; // RPI proxy will handle session
    const sessionExpiry = Math.floor(Date.now() / 1000) + 3600; // Default 1 hour
    
    logger.info('Got FRESH session (no caching)', { channel, preferredServer });
    
    // NO CACHING - return fresh data directly
    return { token, channelKey, country, timestamp, success: sessionEstablished };
  } catch (error) {
    logger.error('Error establishing session', error as Error);
    return null;
  }
}

// No session cache to clear - we don't cache sessions anymore

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
  return jsonResponse({
    status: 'healthy',
    method: 'fresh-auth-every-request',
    description: 'DLHD keys fetched via RPI proxy with fresh auth token every request (no caching)',
    rpiProxyConfigured: !!(env.RPI_PROXY_URL && env.RPI_PROXY_KEY),
    timestamp: new Date().toISOString(),
  }, 200, origin);
}

// Both CDN domains to try (some servers work on one but not the other)
const CDN_DOMAINS = ['kiko2.ru', 'giokko.ru'];

function constructM3U8UrlWithDomain(serverKey: string, channelKey: string, domain: string): string {
  if (serverKey === 'top1/cdn') {
    return `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
  }
  return `https://${serverKey}new.${domain}/${serverKey}/${channelKey}/mono.css`;
}

async function handlePlaylistRequest(
  channel: string, 
  proxyOrigin: string, 
  env: Env, 
  logger: any,
  origin: string | null
): Promise<Response> {
  const channelKey = `premium${channel}`;
  
  // Get server key from lookup (may fail if blocked)
  const { serverKey: initialServerKey, playerDomain } = await getServerKey(channelKey, logger);
  logger.info('Server key from lookup', { serverKey: initialServerKey, playerDomain });
  
  // Build list of ALL servers to try:
  // 1. First try the server from lookup (if we got one)
  // 2. Then try ALL other known servers
  const serverKeysToTry = [
    initialServerKey,
    ...ALL_SERVER_KEYS.filter(k => k !== initialServerKey)
  ];
  
  logger.info('Will try servers in order', { servers: serverKeysToTry, domains: CDN_DOMAINS });
  
  const triedCombinations: string[] = [];
  let lastError = '';
  
  // Try each server with BOTH domains before moving to next server
  for (const serverKey of serverKeysToTry) {
    for (const domain of CDN_DOMAINS) {
      const combo = `${serverKey}@${domain}`;
      triedCombinations.push(combo);
      
      try {
        const m3u8Url = constructM3U8UrlWithDomain(serverKey, channelKey, domain);
        logger.info('Trying M3U8 URL', { serverKey, domain, url: m3u8Url, attempt: triedCombinations.length });
        
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
          
          logger.info('Found working server!', { serverKey, domain, channel, triedCount: triedCombinations.length });
          
          // Rewrite M3U8 to proxy key and segments
          // IMPORTANT: Rewrite key URL to use the SAME server that served the M3U8
          // The M3U8 might contain a key URL pointing to a different server (e.g., chevy)
          // but the session is established with the server that served the M3U8 (e.g., zeko)
          const { keyUrl, iv } = parseM3U8(content);
          const rewrittenKeyUrl = rewriteKeyUrlToServer(keyUrl, serverKey, domain);
          const proxiedM3U8 = generateProxiedM3U8(content, keyUrl, proxyOrigin, m3u8Url, rewrittenKeyUrl);
          
          // Log the key URL transformation for debugging
          const keyLineMatch = proxiedM3U8.match(/#EXT-X-KEY[^\n]*/);
          logger.info('M3U8 processed', { 
            hasKey: !!keyUrl, 
            originalKeyUrl: keyUrl?.substring(0, 80),
            rewrittenKeyUrl: rewrittenKeyUrl?.substring(0, 80),
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
              'X-DLHD-Domain': domain,
              'X-DLHD-IV': iv || '',
              'X-Combinations-Tried': triedCombinations.length.toString(),
            },
          });
        }
        
        lastError = `Invalid M3U8 from ${serverKey}@${domain}: ${content.substring(0, 100)}`;
        logger.warn('Invalid M3U8 content', { serverKey, domain, status: response.status, preview: content.substring(0, 50) });
      } catch (err) {
        lastError = `Error from ${serverKey}@${domain}: ${(err as Error).message}`;
        logger.warn('M3U8 fetch failed', { serverKey, domain, error: (err as Error).message });
      }
    }
  }
  
  // ALL server/domain combinations failed
  logger.error('ALL combinations failed!', { channel, triedCombinations, lastError });
  return jsonResponse({ 
    error: 'Failed to fetch M3U8 from any server', 
    details: lastError,
    triedCombinations,
    totalCombinationsTried: triedCombinations.length,
    hint: 'All known DLHD server/domain combinations returned errors. The channel may be offline or DLHD infrastructure may have changed.',
  }, 502, origin);
}

/**
 * Extract server and domain from key URL
 * e.g., https://zeko.kiko2.ru/key/premium51/5886978 -> { server: 'zeko', domain: 'kiko2.ru' }
 */
function extractServerFromKeyUrl(keyUrl: string): { server: string; domain: string } | null {
  try {
    const url = new URL(keyUrl);
    const hostname = url.hostname; // e.g., zeko.kiko2.ru
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const server = parts[0]; // zeko
      const domain = parts.slice(1).join('.'); // kiko2.ru
      return { server, domain };
    }
  } catch {}
  return null;
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
    
    // Extract channel and server info
    const channel = extractChannelFromKeyUrl(keyUrl);
    const serverInfo = extractServerFromKeyUrl(keyUrl);
    
    if (!channel) {
      return jsonResponse({ error: 'Could not extract channel from key URL' }, 400, origin);
    }
    
    if (!serverInfo) {
      return jsonResponse({ error: 'Could not extract server from key URL' }, 400, origin);
    }
    
    // Get session (auth token) for this channel
    const session = await getSessionForChannel(channel, logger, serverInfo.server);
    if (!session) {
      logger.error('Failed to get session for key fetch', { channel });
      return jsonResponse({ error: 'Failed to get auth token for channel' }, 502, origin);
    }
    
    // Generate CLIENT_TOKEN for authentication
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const clientToken = generateClientToken(session.channelKey, session.country, session.timestamp, userAgent);
    
    logger.info('Generated client token', { 
      channelKey: session.channelKey,
      country: session.country,
      timestamp: session.timestamp,
      clientTokenPreview: clientToken.substring(0, 30) + '...'
    });
    
    // Step 1: Call heartbeat via RPI proxy (residential IP required)
    // The heartbeat endpoint blocks datacenter IPs (returns anti-bot challenge)
    // RPI proxy has /heartbeat endpoint that handles auth and CLIENT_TOKEN
    logger.info('Calling heartbeat via RPI proxy', { channel, server: 'chevy' });
    
    let hbSuccess = false;
    let hbStatus = 0;
    let hbResponseText = '';
    
    if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
      try {
        let rpiBaseUrl = env.RPI_PROXY_URL;
        if (!rpiBaseUrl.startsWith('http://') && !rpiBaseUrl.startsWith('https://')) {
          rpiBaseUrl = `http://${rpiBaseUrl}`;
        }
        
        const hbProxyUrl = `${rpiBaseUrl}/heartbeat?channel=${channel}&server=chevy&domain=kiko2.ru`;
        const hbResponse = await fetch(hbProxyUrl, {
          headers: { 'X-API-Key': env.RPI_PROXY_KEY },
        });
        
        hbStatus = hbResponse.status;
        hbResponseText = await hbResponse.text();
        hbSuccess = hbResponse.ok && hbResponseText.includes('"success":true');
        logger.info('Heartbeat via RPI proxy', { status: hbStatus, success: hbSuccess, response: hbResponseText.substring(0, 150) });
      } catch (hbError) {
        logger.warn('Heartbeat via RPI proxy failed', { error: (hbError as Error).message });
      }
    } else {
      logger.warn('RPI proxy not configured - heartbeat will fail, key fetch will return E2');
    }
    
    if (!hbSuccess) {
      logger.warn('Heartbeat failed - key fetch may fail with E2', { hbStatus, hbResponse: hbResponseText.substring(0, 100) });
    }
    
    // Step 2: Fetch key via RPI proxy (CRITICAL: session is IP-bound!)
    // The heartbeat session is bound to RPI's residential IP, so the key fetch
    // MUST also come from RPI's IP. Fetching directly from CF Worker fails
    // because the key server sees a different IP than the heartbeat session.
    logger.info('Fetching key via RPI proxy (session is IP-bound)', { 
      channel, 
      server: serverInfo.server,
      keyUrl: keyUrl.substring(0, 80)
    });
    
    let keyData: ArrayBuffer;
    let keyText: string;
    
    if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
      try {
        let rpiBaseUrl = env.RPI_PROXY_URL;
        if (!rpiBaseUrl.startsWith('http://') && !rpiBaseUrl.startsWith('https://')) {
          rpiBaseUrl = `https://${rpiBaseUrl}`;
        }
        
        // Use /proxy endpoint which handles key auth internally via fetchKeyWithAuth()
        const keyProxyUrl = `${rpiBaseUrl}/proxy?url=${encodeURIComponent(keyUrl)}`;
        const keyResponse = await fetch(keyProxyUrl, {
          headers: { 'X-API-Key': env.RPI_PROXY_KEY },
        });
        
        keyData = await keyResponse.arrayBuffer();
        keyText = new TextDecoder().decode(keyData);
        
        logger.info('Key response via RPI proxy', { 
          status: keyResponse.status, 
          size: keyData.byteLength,
          preview: keyText.substring(0, 50)
        });
      } catch (rpiError) {
        logger.error('RPI proxy key fetch failed', rpiError as Error);
        return jsonResponse({
          error: 'RPI proxy key fetch failed',
          message: rpiError instanceof Error ? rpiError.message : String(rpiError),
        }, 502, origin);
      }
    } else {
      // Fallback to direct fetch (will likely fail with E2)
      logger.warn('RPI proxy not configured - falling back to direct fetch (may fail)');
      
      const keyResponse = await fetch(keyUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': '*/*',
          'Origin': 'https://epicplayplay.cfd',
          'Referer': 'https://epicplayplay.cfd/',
          'Authorization': `Bearer ${session.token}`,
          'X-Channel-Key': session.channelKey,
          'X-Client-Token': clientToken,
          'X-User-Agent': userAgent,
        },
      });
      
      keyData = await keyResponse.arrayBuffer();
      keyText = new TextDecoder().decode(keyData);
    }
    
    // Check for E2 error (session not established)
    if (keyText.includes('"E2"') || keyText.includes('Session must be created')) {
      logger.warn('E2 error - heartbeat failed to establish session', { channel, hbStatus });
      return jsonResponse({ 
        error: 'Session not established (E2)',
        hint: 'Heartbeat was called but session not established. Server may be blocking CF IPs.',
        heartbeatStatus: hbStatus,
        heartbeatResponse: hbResponseText.substring(0, 100),
        response: keyText,
      }, 502, origin);
    }
    
    // Check for E3 error (token expired)
    if (keyText.includes('"E3"') || keyText.includes('Token expired')) {
      logger.warn('E3 error - token expired', { channel });
      return jsonResponse({ 
        error: 'Token expired (E3)',
        hint: 'Auth token expired. Retry to get fresh token.',
        response: keyText,
      }, 502, origin);
    }
    
    // Check if we got a valid key (AES-128 keys are exactly 16 bytes)
    if (keyData.byteLength === 16) {
      // Make sure it's not JSON error that happens to be 16 bytes
      if (keyText.startsWith('{') || keyText.startsWith('[')) {
        logger.error('Got JSON error instead of key', { response: keyText });
        return jsonResponse({ error: 'Key server returned error', response: keyText }, 502, origin);
      }
      
      logger.info('Key fetched successfully via RPI proxy', { size: keyData.byteLength, channel, server: serverInfo.server });
      return new Response(keyData, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': '16',
          ...corsHeaders(origin),
          'Cache-Control': 'private, max-age=30',
          'X-Fetched-By': 'rpi-proxy-residential',
        },
      });
    }
    
    // Invalid key size - might be an error response
    logger.warn('Invalid key size', { size: keyData.byteLength, preview: keyText.substring(0, 100) });
    return jsonResponse({ 
      error: 'Invalid key data', 
      size: keyData.byteLength,
      expected: 16,
      preview: keyText.substring(0, 200),
      heartbeatStatus: hbStatus,
      heartbeatResponse: hbResponseText.substring(0, 100),
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

// ALL known server keys - discovered from server_lookup responses
// Different channels are assigned to different servers, so we try them all
// Servers discovered: zeko, wind, nfs, ddy6, chevy, top1/cdn
const ALL_SERVER_KEYS = ['zeko', 'wind', 'nfs', 'ddy6', 'chevy', 'top1/cdn'];

async function getServerKey(channelKey: string, logger: any): Promise<{ serverKey: string; playerDomain: string }> {
  // Check cache
  const cached = serverKeyCache.get(channelKey);
  if (cached && (Date.now() - cached.fetchedAt) < SERVER_KEY_CACHE_TTL_MS) {
    return { serverKey: cached.serverKey, playerDomain: cached.playerDomain };
  }

  // Server lookup endpoint is at chevy.giokko.ru (discovered via browser trace)
  // This is the ONLY working lookup endpoint as of Dec 2024
  const lookupUrl = `https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`;
  
  try {
    logger.info('Fetching server key', { channelKey, lookupUrl });
    
    const response = await fetch(lookupUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://epicplayplay.cfd/',
      },
    });

    if (response.ok) {
      const text = await response.text();
      
      // Check if we got HTML (anti-bot challenge) instead of JSON
      if (text.startsWith('<') || text.includes('<!DOCTYPE')) {
        logger.warn('Server lookup returned HTML challenge');
      } else {
        try {
          const data = JSON.parse(text) as { server_key?: string };
          if (data.server_key) {
            logger.info('Got server key from lookup', { channelKey, serverKey: data.server_key });
            serverKeyCache.set(channelKey, {
              serverKey: data.server_key,
              playerDomain: PLAYER_DOMAINS[0],
              fetchedAt: Date.now(),
            });
            return { serverKey: data.server_key, playerDomain: PLAYER_DOMAINS[0] };
          }
        } catch (parseErr) {
          logger.warn('Server lookup JSON parse failed', { error: (parseErr as Error).message, response: text.substring(0, 100) });
        }
      }
    } else {
      logger.warn('Server lookup HTTP error', { status: response.status });
    }
  } catch (err) {
    logger.warn('Server lookup failed', { error: (err as Error).message });
  }

  // Fallback to zeko (most common server) - handlePlaylistRequest will try all others anyway
  logger.warn('Server lookup failed, using fallback server key', { fallback: ALL_SERVER_KEYS[0] });
  return { serverKey: ALL_SERVER_KEYS[0], playerDomain: PLAYER_DOMAINS[0] };
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
 * Rewrite key URL to ALWAYS use chevy.kiko2.ru
 * 
 * IMPORTANT: Only chevy.kiko2.ru has a working heartbeat endpoint!
 * Other servers (zeko, wind, nfs, ddy6) return 404 for /heartbeat.
 * Since we need heartbeat to establish session before fetching keys,
 * we MUST use chevy for all key requests.
 * 
 * Example:
 *   Original: https://zeko.giokko.ru/key/premium51/5886978
 *   Rewritten: https://chevy.kiko2.ru/key/premium51/5886978
 */
function rewriteKeyUrlToServer(keyUrl: string | null, _serverKey: string, _domain: string): string | null {
  if (!keyUrl) return null;
  
  // Extract the path part (e.g., /key/premium51/5886978)
  const pathMatch = keyUrl.match(/\/key\/premium\d+\/\d+/);
  if (!pathMatch) return keyUrl; // Can't parse, return original
  
  // ALWAYS use chevy.kiko2.ru - it's the only server with working heartbeat
  return `https://chevy.kiko2.ru${pathMatch[0]}`;
}

/**
 * Generate proxied M3U8 with key and segment URLs rewritten to go through our proxy
 * 
 * @param originalM3U8 - The original M3U8 content
 * @param keyUrl - The extracted key URL (may be relative or absolute)
 * @param proxyOrigin - The origin of our proxy (e.g., https://cf-worker.example.com)
 * @param m3u8BaseUrl - The base URL of the original M3U8 (for resolving relative URLs)
 * @param rewrittenKeyUrl - The key URL rewritten to use the correct server (optional)
 */
function generateProxiedM3U8(
  originalM3U8: string, 
  _keyUrl: string | null, 
  proxyOrigin: string,
  m3u8BaseUrl?: string,
  _rewrittenKeyUrl?: string | null
): string {
  let modified = originalM3U8;

  // Rewrite ALL key URLs in the M3U8 to go through our proxy
  // Live streams can have multiple #EXT-X-KEY tags with different key IDs
  // We need to rewrite ALL of them, not just the first one
  // Also, ALWAYS rewrite to use chevy.kiko2.ru since it's the only server with working heartbeat
  modified = modified.replace(/URI="([^"]+)"/g, (match, originalKeyUrl) => {
    let absoluteKeyUrl = originalKeyUrl;
    
    // Resolve relative URLs
    if (!absoluteKeyUrl.startsWith('http://') && !absoluteKeyUrl.startsWith('https://')) {
      if (m3u8BaseUrl) {
        try {
          const base = new URL(m3u8BaseUrl);
          absoluteKeyUrl = new URL(absoluteKeyUrl, base.origin + base.pathname.replace(/\/[^/]*$/, '/')).toString();
        } catch {
          const baseWithoutFile = m3u8BaseUrl.replace(/\/[^/]*$/, '/');
          absoluteKeyUrl = baseWithoutFile + absoluteKeyUrl;
        }
      }
    }
    
    // Rewrite key URL to use chevy.kiko2.ru (only server with working heartbeat)
    const keyPathMatch = absoluteKeyUrl.match(/\/key\/premium\d+\/\d+/);
    if (keyPathMatch) {
      absoluteKeyUrl = `https://chevy.kiko2.ru${keyPathMatch[0]}`;
    }
    
    const proxiedKeyUrl = `${proxyOrigin}/dlhd/key?url=${encodeURIComponent(absoluteKeyUrl)}`;
    return `URI="${proxiedKeyUrl}"`;
  });

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
    
    // DLHD segment URLs are base64-encoded paths on giokko.ru/kiko2.ru domains
    // They DON'T end in .ts - they're long encoded strings like:
    // https://chevy.giokko.ru/X0VASEVfSxdQB1oeUF9LVwtCBgVBRBlbXQkcVRBHAAJfXFFWQhZLCQ...
    const isDlhdSegment = trimmed.includes('.giokko.ru/') || trimmed.includes('.kiko2.ru/');
    const isSegmentFile = trimmed.endsWith('.ts') || trimmed.includes('.ts?') || 
                          trimmed.includes('redirect.giokko.ru') || 
                          trimmed.includes('whalesignal.ai') ||
                          isDlhdSegment;
    
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
