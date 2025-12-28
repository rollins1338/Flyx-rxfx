/**
 * TV Proxy Cloudflare Worker
 *
 * DLHD ONLY - NO IPTV/STALKER PROVIDERS!
 * 
 * Proxies DLHD live streams with automatic server lookup.
 * Uses proper channel routing to differentiate from other providers.
 *
 * Routes:
 *   GET /?channel=<id>           - Get proxied M3U8 playlist (DLHD channels only)
 *   GET /key?url=<encoded_url>   - Proxy encryption key (with auth)
 *   GET /segment?url=<encoded_url> - Proxy video segment
 * 
 * PROVIDER DIFFERENTIATION:
 * - This proxy handles DLHD channels ONLY (numeric IDs: 1-850)
 * - CDN-Live.tv channels use /cdn-live/* routes
 * - PPV.to channels use /ppv/* routes
 * - NO IPTV/Stalker providers are used here
 */

import { createLogger, type LogLevel } from './logger';

export interface Env {
  LOG_LEVEL?: string;
}

// Allowed origins for anti-leech protection
const ALLOWED_ORIGINS = [
  'https://tv.vynx.cc',
  'https://flyx.tv',
  'https://www.flyx.tv',
  'http://localhost:3000',
  'http://localhost:3001',
  '*', // Allow any for testing
];

const PLAYER_DOMAIN = 'epicplayplay.cfd';
const PARENT_DOMAIN = 'daddyhd.com';

// URL path variants on daddyhd.com that embed the player
const DADDYHD_PATH_VARIANTS = ['stream', 'cast', 'watch', 'plus', 'casting', 'player'];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ALL_SERVER_KEYS = ['zeko', 'wind', 'nfs', 'ddy6', 'chevy', 'top1/cdn'];
const CDN_DOMAINS = ['kiko2.ru', 'giokko.ru'];

// Caches
const serverKeyCache = new Map<string, { serverKey: string; fetchedAt: number }>();
const SERVER_KEY_CACHE_TTL_MS = 10 * 60 * 1000; // Reduced to 10 minutes

// Token pool per channel - rotate between multiple tokens to handle more concurrent users
// DLHD limits ~4 concurrent channels per token, so we maintain a pool
const TOKEN_POOL_SIZE = 5; // 5 tokens × 4 channels = ~20 concurrent streams per channel
const SESSION_CACHE_TTL_MS = 2 * 60 * 1000; // Reduced to 2 min TTL (refresh more often)

interface SessionData {
  token: string;
  channelKey: string;
  country: string;
  timestamp: string;
  fetchedAt: number;
  useCount: number; // Track usage to rotate
}

// Map of channel -> array of session tokens
const sessionPool = new Map<string, SessionData[]>();

// Round-robin index per channel
const sessionIndex = new Map<string, number>();

/**
 * Get a session from the pool, rotating between available tokens
 */
function getSessionFromPool(channel: string): SessionData | null {
  const pool = sessionPool.get(channel);
  if (!pool || pool.length === 0) return null;

  // Filter out expired sessions
  const now = Date.now();
  const validSessions = pool.filter(
    (s) => now - s.fetchedAt < SESSION_CACHE_TTL_MS
  );

  if (validSessions.length === 0) {
    sessionPool.delete(channel);
    return null;
  }

  // Update pool with only valid sessions
  sessionPool.set(channel, validSessions);

  // Round-robin selection
  let idx = sessionIndex.get(channel) || 0;
  idx = idx % validSessions.length;
  sessionIndex.set(channel, idx + 1);

  const session = validSessions[idx];
  session.useCount++;

  return session;
}

/**
 * Add a new session to the pool
 */
function addSessionToPool(channel: string, session: SessionData): void {
  let pool = sessionPool.get(channel);
  if (!pool) {
    pool = [];
    sessionPool.set(channel, pool);
  }

  // Remove expired sessions
  const now = Date.now();
  pool = pool.filter((s) => now - s.fetchedAt < SESSION_CACHE_TTL_MS);

  // Check if we already have this token
  const existingIdx = pool.findIndex((s) => s.token === session.token);
  if (existingIdx >= 0) {
    pool[existingIdx] = session; // Update existing
  } else if (pool.length < TOKEN_POOL_SIZE) {
    pool.push(session); // Add new
  } else {
    // Replace oldest/most used
    pool.sort((a, b) => b.useCount - a.useCount || a.fetchedAt - b.fetchedAt);
    pool[pool.length - 1] = session;
  }

  sessionPool.set(channel, pool);
}

/**
 * Generate CLIENT_TOKEN for auth
 */
function generateClientToken(
  channelKey: string,
  country: string,
  timestamp: string,
  userAgent: string
): string {
  const screen = '1920x1080';
  const tz = 'America/New_York';
  const lang = 'en-US';
  const fingerprint = `${userAgent}|${screen}|${tz}|${lang}`;
  const signData = `${channelKey}|${country}|${timestamp}|${userAgent}|${fingerprint}`;
  return btoa(signData);
}

declare function btoa(str: string): string;

/**
 * Get auth session for a channel
 * Uses token pool with rotation for better scalability
 */
async function getSession(
  channel: string,
  logger: any,
  forceNew: boolean = false
): Promise<{
  token: string;
  channelKey: string;
  country: string;
  timestamp: string;
} | null> {
  // Try to get from pool first (unless forcing new)
  if (!forceNew) {
    const pooled = getSessionFromPool(channel);
    if (pooled) {
      logger.debug('Session from pool', { channel, useCount: pooled.useCount });
      return pooled;
    }
  }

  logger.info('Fetching fresh session', { channel });

  // Try different referer paths
  const refererPaths = DADDYHD_PATH_VARIANTS.map(
    (path) => `https://${PARENT_DOMAIN}/${path}/stream-${channel}.php`
  );
  refererPaths.unshift(`https://${PARENT_DOMAIN}/watch.php?id=${channel}`);

  for (const referer of refererPaths) {
    try {
      const playerUrl = `https://${PLAYER_DOMAIN}/premiumtv/daddyhd.php?id=${channel}`;
      const response = await fetch(playerUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: referer,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        logger.debug('Player page fetch failed', { status: response.status, referer });
        continue;
      }

      const html = await response.text();

      // Note: The xx.html redirect is CLIENT-SIDE JavaScript.
      // Server-side fetch gets the full page with AUTH_TOKEN regardless.

      const tokenMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
      const channelKeyMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
      const countryMatch = html.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
      const tsMatch = html.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);

      if (!tokenMatch) {
        logger.debug('No AUTH_TOKEN found', { referer });
        continue;
      }

      const session: SessionData = {
        token: tokenMatch[1],
        channelKey: channelKeyMatch?.[1] || `premium${channel}`,
        country: countryMatch?.[1] || 'US',
        timestamp: tsMatch?.[1] || String(Math.floor(Date.now() / 1000)),
        fetchedAt: Date.now(),
        useCount: 0,
      };

      // Add to pool
      addSessionToPool(channel, session);

      const poolSize = sessionPool.get(channel)?.length || 0;
      logger.info('Session fetched and pooled', {
        channel,
        channelKey: session.channelKey,
        poolSize,
        referer,
      });

      return session;
    } catch (error) {
      logger.debug('Session fetch error', { referer, error: (error as Error).message });
      continue;
    }
  }

  logger.warn('All referer paths failed', { channel });
  return null;
}

/**
 * Call heartbeat to establish session
 */
async function callHeartbeat(
  session: { token: string; channelKey: string; country: string; timestamp: string },
  logger: any
): Promise<boolean> {
  const clientToken = generateClientToken(
    session.channelKey,
    session.country,
    session.timestamp,
    USER_AGENT
  );

  try {
    const response = await fetch('https://chevy.kiko2.ru/heartbeat', {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Origin: `https://${PLAYER_DOMAIN}`,
        Referer: `https://${PLAYER_DOMAIN}/`,
        Authorization: `Bearer ${session.token}`,
        'X-Channel-Key': session.channelKey,
        'X-Client-Token': clientToken,
      },
    });

    const text = await response.text();
    logger.info('Heartbeat response', { status: response.status, body: text.substring(0, 80) });

    return (
      response.ok &&
      (text.includes('Session created') ||
        text.includes('Session extended') ||
        text.includes('"status":"ok"'))
    );
  } catch (error) {
    logger.warn('Heartbeat failed', { error: (error as Error).message });
    return false;
  }
}

/**
 * Fetch key directly with auth headers
 */
async function fetchKeyDirect(
  keyUrl: string,
  session: { token: string; channelKey: string; country: string; timestamp: string },
  logger: any
): Promise<{ data: ArrayBuffer; success: boolean; error?: string }> {
  const clientToken = generateClientToken(
    session.channelKey,
    session.country,
    session.timestamp,
    USER_AGENT
  );

  try {
    const response = await fetch(keyUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Origin: `https://${PLAYER_DOMAIN}`,
        Referer: `https://${PLAYER_DOMAIN}/`,
        Authorization: `Bearer ${session.token}`,
        'X-Channel-Key': session.channelKey,
        'X-Client-Token': clientToken,
      },
    });

    const data = await response.arrayBuffer();
    const text = new TextDecoder().decode(data);

    if (text.includes('"E2"') || text.includes('Session must be created')) {
      return { data, success: false, error: 'E2: Session not established' };
    }
    if (text.includes('"E3"') || text.includes('Token expired')) {
      return { data, success: false, error: 'E3: Token expired' };
    }

    if (data.byteLength === 16 && !text.startsWith('{') && !text.startsWith('[')) {
      return { data, success: true };
    }

    return { data, success: false, error: `Invalid key: ${data.byteLength} bytes` };
  } catch (error) {
    return { data: new ArrayBuffer(0), success: false, error: (error as Error).message };
  }
}

function extractChannelFromKeyUrl(keyUrl: string): string | null {
  const match = keyUrl.match(/premium(\d+)/);
  return match ? match[1] : null;
}

async function getServerKey(channelKey: string, logger: any): Promise<string> {
  const cached = serverKeyCache.get(channelKey);
  if (cached && Date.now() - cached.fetchedAt < SERVER_KEY_CACHE_TTL_MS) {
    return cached.serverKey;
  }

  try {
    const response = await fetch(
      `https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: `https://${PLAYER_DOMAIN}/`,
        },
      }
    );

    if (response.ok) {
      const text = await response.text();
      if (!text.startsWith('<')) {
        const data = JSON.parse(text) as { server_key?: string };
        if (data.server_key) {
          serverKeyCache.set(channelKey, { serverKey: data.server_key, fetchedAt: Date.now() });
          return data.server_key;
        }
      }
    }
  } catch {}

  return 'zeko';
}

function constructM3U8Url(serverKey: string, channelKey: string, domain: string): string {
  if (serverKey === 'top1/cdn') {
    return `https://top1.${domain}/top1/cdn/${channelKey}/mono.css`;
  }
  return `https://${serverKey}new.${domain}/${serverKey}/${channelKey}/mono.css`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const logLevel = (env.LOG_LEVEL || 'info') as LogLevel;
    const logger = createLogger(request, logLevel);

    const requestOrigin = request.headers.get('origin');
    const requestReferer = request.headers.get('referer');

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(requestOrigin, requestReferer)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 200, headers: corsHeaders(requestOrigin) });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (!isAllowedOrigin(requestOrigin, requestReferer)) {
      logger.warn('Blocked leecher', { origin: requestOrigin });
      return jsonResponse({ error: 'Access denied' }, 403, requestOrigin);
    }

    try {
      if (path === '/key') {
        return handleKeyProxy(url, logger, requestOrigin);
      }

      if (path === '/segment') {
        return handleSegmentProxy(url, logger, requestOrigin);
      }

      const channel = url.searchParams.get('channel');
      if (!channel) {
        return jsonResponse(
          { 
            error: 'Missing channel parameter', 
            usage: 'GET /?channel=51',
            note: 'DLHD channels only (numeric IDs 1-850). Use /cdn-live or /ppv for other providers.'
          },
          400,
          requestOrigin
        );
      }

      // Validate DLHD channel format (numeric only)
      if (!/^\d+$/.test(channel)) {
        return jsonResponse(
          { 
            error: 'Invalid DLHD channel format', 
            provided: channel,
            expected: 'Numeric ID (e.g., 51, 325)',
            note: 'DLHD uses numeric channel IDs. For other formats, use /cdn-live or /ppv routes.'
          },
          400,
          requestOrigin
        );
      }

      const channelNum = parseInt(channel);
      if (channelNum < 1 || channelNum > 850) {
        return jsonResponse(
          { 
            error: 'DLHD channel out of range', 
            provided: channelNum,
            validRange: '1-850',
            note: 'DLHD has 850 available channels'
          },
          400,
          requestOrigin
        );
      }

      return handlePlaylistRequest(channel, url.origin, logger, requestOrigin);
    } catch (error) {
      logger.error('TV Proxy error', error as Error);
      return jsonResponse(
        { error: 'Proxy error', details: (error as Error).message },
        500,
        requestOrigin
      );
    }
  },
};

async function handlePlaylistRequest(
  channel: string,
  proxyOrigin: string,
  logger: any,
  origin: string | null
): Promise<Response> {
  const channelKey = `premium${channel}`;
  const initialServerKey = await getServerKey(channelKey, logger);

  const serverKeysToTry = [
    initialServerKey,
    ...ALL_SERVER_KEYS.filter((k) => k !== initialServerKey),
  ];

  const triedCombinations: string[] = [];
  let lastError = '';

  for (const serverKey of serverKeysToTry) {
    for (const domain of CDN_DOMAINS) {
      const combo = `${serverKey}@${domain}`;
      triedCombinations.push(combo);

      try {
        const m3u8Url = constructM3U8Url(serverKey, channelKey, domain);
        logger.info('Trying M3U8', { serverKey, domain });

        // Retry logic with exponential backoff
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            const response = await fetch(`${m3u8Url}?_t=${Date.now()}`, {
              headers: {
                'User-Agent': USER_AGENT,
                Referer: `https://${PLAYER_DOMAIN}/`,
              },
              signal: AbortSignal.timeout(10000), // 10s timeout
            });

            const content = await response.text();

            if (content.includes('#EXTM3U') || content.includes('#EXT-X-')) {
              serverKeyCache.set(channelKey, { serverKey, fetchedAt: Date.now() });
              logger.info('Found working server', { serverKey, domain, retryCount });

              const proxiedM3U8 = rewriteM3U8(content, proxyOrigin, m3u8Url);

              return new Response(proxiedM3U8, {
                status: 200,
                headers: {
                  'Content-Type': 'application/vnd.apple.mpegurl',
                  ...corsHeaders(origin),
                  'Cache-Control': 'no-store, no-cache, must-revalidate',
                  'X-DLHD-Channel': channel,
                  'X-DLHD-Server': serverKey,
                  'X-Retry-Count': retryCount.toString(),
                },
              });
            }

            // If response is not valid M3U8, break retry loop
            lastError = `Invalid M3U8 from ${combo} (${content.substring(0, 100)})`;
            break;
          } catch (fetchErr) {
            retryCount++;
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Max 5s delay
            
            if (retryCount <= maxRetries) {
              logger.warn('M3U8 fetch failed, retrying', { 
                serverKey, 
                domain, 
                retryCount, 
                delay,
                error: (fetchErr as Error).message 
              });
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              lastError = `Error from ${combo} after ${maxRetries} retries: ${(fetchErr as Error).message}`;
            }
          }
        }
      } catch (err) {
        lastError = `Error from ${combo}: ${(err as Error).message}`;
      }
    }
  }

  return jsonResponse({ 
    error: 'Failed to fetch M3U8', 
    details: lastError,
    triedCombinations: triedCombinations.length,
    suggestion: 'Check if RPI proxy is configured for residential IP fallback'
  }, 502, origin);
}

async function handleKeyProxy(
  url: URL,
  logger: any,
  origin: string | null
): Promise<Response> {
  const keyUrlParam = url.searchParams.get('url');
  if (!keyUrlParam) {
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  let keyUrl = keyUrlParam;
  try {
    keyUrl = decodeURIComponent(keyUrl);
  } catch {}

  logger.info('Key proxy request', { keyUrl: keyUrl.substring(0, 80) });

  const channel = extractChannelFromKeyUrl(keyUrl);
  if (!channel) {
    return jsonResponse({ error: 'Could not extract channel' }, 400, origin);
  }

  // Get session from pool
  const session = await getSession(channel, logger);
  if (!session) {
    return jsonResponse({ error: 'Failed to get auth session' }, 502, origin);
  }

  // Call heartbeat (may fail due to rate limit, but key fetch often still works)
  await callHeartbeat(session, logger);

  // Fetch key directly
  const result = await fetchKeyDirect(keyUrl, session, logger);

  if (result.success) {
    logger.info('Key fetched successfully', { size: result.data.byteLength });
    return new Response(result.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': '16',
        ...corsHeaders(origin),
        'Cache-Control': 'private, max-age=30',
        'X-Fetched-By': 'cloudflare-direct',
      },
    });
  }

  // If E2/E3 error, get a fresh token and retry
  if (result.error?.includes('E2') || result.error?.includes('E3')) {
    logger.info('Auth error, fetching fresh session', { error: result.error });

    const freshSession = await getSession(channel, logger, true); // Force new
    if (freshSession) {
      await callHeartbeat(freshSession, logger);
      const retryResult = await fetchKeyDirect(keyUrl, freshSession, logger);

      if (retryResult.success) {
        return new Response(retryResult.data, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': '16',
            ...corsHeaders(origin),
            'Cache-Control': 'private, max-age=30',
            'X-Fetched-By': 'cloudflare-direct-retry',
          },
        });
      }
    }
  }

  return jsonResponse(
    {
      error: 'Key fetch failed',
      details: result.error,
      hint: 'Session may have expired or rate limited',
      channel,
      sessionAge: session ? `${Math.floor((Date.now() - (session as any).fetchedAt) / 1000)}s` : 'unknown',
      debugInfo: {
        keyUrlDomain: new URL(keyUrl).hostname,
        sessionToken: session?.token?.substring(0, 8) + '...',
      }
    },
    502,
    origin
  );
}

async function handleSegmentProxy(
  url: URL,
  _logger: any,
  origin: string | null
): Promise<Response> {
  const segmentUrl = url.searchParams.get('url');
  if (!segmentUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  const decodedUrl = decodeURIComponent(segmentUrl);

  try {
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `https://${PLAYER_DOMAIN}/`,
      },
    });

    const data = await response.arrayBuffer();

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp2t',
        ...corsHeaders(origin),
        'Cache-Control': 'public, max-age=300',
        'Content-Length': data.byteLength.toString(),
      },
    });
  } catch (error) {
    return jsonResponse({ error: 'Segment fetch failed' }, 502, origin);
  }
}

function rewriteM3U8(content: string, proxyOrigin: string, m3u8BaseUrl: string): string {
  let modified = content;

  // Rewrite key URLs to proxy through us, always using chevy.kiko2.ru
  modified = modified.replace(/URI="([^"]+)"/g, (_, originalKeyUrl) => {
    let absoluteKeyUrl = originalKeyUrl;

    if (!absoluteKeyUrl.startsWith('http')) {
      try {
        const base = new URL(m3u8BaseUrl);
        absoluteKeyUrl = new URL(
          absoluteKeyUrl,
          base.origin + base.pathname.replace(/\/[^/]*$/, '/')
        ).toString();
      } catch {
        absoluteKeyUrl = m3u8BaseUrl.replace(/\/[^/]*$/, '/') + absoluteKeyUrl;
      }
    }

    // Rewrite to chevy.kiko2.ru
    const keyPathMatch = absoluteKeyUrl.match(/\/key\/premium\d+\/\d+/);
    if (keyPathMatch) {
      absoluteKeyUrl = `https://chevy.kiko2.ru${keyPathMatch[0]}`;
    }

    return `URI="${proxyOrigin}/tv/key?url=${encodeURIComponent(absoluteKeyUrl)}"`;
  });

  // Remove ENDLIST for live streams
  modified = modified.replace(/\n?#EXT-X-ENDLIST\s*$/m, '');

  // Proxy segment URLs
  const lines = modified.split('\n');
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    if (trimmed.includes('/tv/segment?')) return line;

    const isAbsoluteUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
    const isDlhdSegment = trimmed.includes('.giokko.ru/') || trimmed.includes('.kiko2.ru/');

    if (isAbsoluteUrl && isDlhdSegment && !trimmed.includes('mono.css')) {
      return `${proxyOrigin}/tv/segment?url=${encodeURIComponent(trimmed)}`;
    }

    return line;
  });

  return processedLines.join('\n');
}

function isAllowedOrigin(origin: string | null, referer: string | null): boolean {
  if (ALLOWED_ORIGINS.includes('*')) return true;

  const checkOrigin = (o: string): boolean => {
    return ALLOWED_ORIGINS.some((allowed) => {
      if (allowed.includes('localhost')) return o.includes('localhost');
      try {
        const allowedHost = new URL(allowed).hostname;
        const originHost = new URL(o).hostname;
        return originHost === allowedHost || originHost.endsWith(`.${allowedHost}`);
      } catch {
        return false;
      }
    });
  };

  if (origin && checkOrigin(origin)) return true;
  if (referer) {
    try {
      return checkOrigin(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}

function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
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
