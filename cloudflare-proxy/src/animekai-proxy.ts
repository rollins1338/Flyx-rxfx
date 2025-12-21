/**
 * AnimeKai Stream Proxy
 * 
 * Routes AnimeKai HLS streams through the RPI residential proxy.
 * MegaUp CDN (used by AnimeKai) blocks datacenter IPs, so we need
 * to proxy through a residential IP.
 * 
 * Flow:
 *   Client -> Cloudflare Worker -> RPI Proxy -> MegaUp CDN
 * 
 * Routes:
 *   GET /animekai?url=<encoded_url> - Proxy HLS stream/segment
 *   GET /animekai/health - Health check
 * 
 * The RPI proxy fetches without Origin/Referer headers which MegaUp blocks.
 */

import { createLogger, type LogLevel } from './logger';

export interface Env {
  LOG_LEVEL?: string;
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
}

// CORS headers
function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  };
}

function jsonResponse(data: object, status: number, origin?: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// Allowed origins for anti-leech protection
const ALLOWED_ORIGINS = [
  'https://tv.vynx.cc',
  'https://flyx.tv',
  'https://www.flyx.tv',
  'http://localhost:3000',
  'http://localhost:3001',
  '.vercel.app',
];

function isAllowedOrigin(origin: string | null, referer: string | null): boolean {
  // Allow server-side requests (no origin/referer) - these come from Vercel API routes
  // The RPI proxy key provides authentication for these requests
  if (!origin && !referer) {
    return true;
  }

  const checkOrigin = (o: string): boolean => {
    return ALLOWED_ORIGINS.some(allowed => {
      if (allowed.includes('localhost')) return o.includes('localhost');
      if (allowed.startsWith('.')) {
        try {
          const originHost = new URL(o).hostname;
          return originHost.endsWith(allowed);
        } catch { return false; }
      }
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

/**
 * Rewrite playlist URLs to route through this proxy
 */
function rewritePlaylistUrls(
  playlist: string,
  baseUrl: string,
  proxyOrigin: string
): string {
  const lines = playlist.split('\n');
  const rewritten: string[] = [];
  
  const base = new URL(baseUrl);
  const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
  
  // Check if this is Flixer CDN - needs referer parameter
  const isFlixerCdn = baseUrl.match(/p\.\d+\.workers\.dev/);
  
  const proxyUrl = (url: string): string => {
    let absoluteUrl: string;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      absoluteUrl = url;
    } else if (url.startsWith('/')) {
      absoluteUrl = `${base.origin}${url}`;
    } else {
      absoluteUrl = `${base.origin}${basePath}${url}`;
    }
    
    // Add referer parameter for Flixer CDN URLs
    const refererParam = isFlixerCdn ? `&referer=${encodeURIComponent('https://flixer.sh/')}` : '';
    return `${proxyOrigin}/animekai?url=${encodeURIComponent(absoluteUrl)}${refererParam}`;
  };
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Handle HLS tags with URIs
    if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const originalUri = uriMatch[1];
        const proxiedUri = proxyUrl(originalUri);
        rewritten.push(line.replace(`URI="${originalUri}"`, `URI="${proxiedUri}"`));
      } else {
        rewritten.push(line);
      }
      continue;
    }
    
    // Keep comments and empty lines
    if (line.startsWith('#') || trimmedLine === '') {
      rewritten.push(line);
      continue;
    }
    
    try {
      rewritten.push(proxyUrl(trimmedLine));
    } catch {
      rewritten.push(line);
    }
  }

  return rewritten.join('\n');
}

export async function handleAnimeKaiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const logLevel = (env.LOG_LEVEL || 'info') as LogLevel;
  const logger = createLogger(request, logLevel);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Health check
  if (path === '/animekai/health' || path.endsWith('/health')) {
    const hasRpi = !!(env.RPI_PROXY_URL && env.RPI_PROXY_KEY);
    return jsonResponse({
      status: 'ok',
      rpiProxy: {
        configured: hasRpi,
        url: env.RPI_PROXY_URL ? env.RPI_PROXY_URL.substring(0, 30) + '...' : 'not set',
      },
      timestamp: new Date().toISOString(),
    }, 200, origin);
  }

  // Anti-leech check
  if (!isAllowedOrigin(origin, referer)) {
    logger.warn('Blocked unauthorized request', { origin, referer });
    return jsonResponse({
      error: 'Access denied',
      message: 'This proxy only serves authorized domains',
    }, 403, origin);
  }

  // Get target URL, optional User-Agent, and optional Referer
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400, origin);
  }

  const decodedUrl = decodeURIComponent(targetUrl);
  const customUserAgent = url.searchParams.get('ua');
  const customReferer = url.searchParams.get('referer');
  logger.info('AnimeKai proxy request', { url: decodedUrl.substring(0, 100), ua: customUserAgent ? 'custom' : 'default', referer: customReferer ? 'custom' : 'auto' });

  // Check if RPI proxy is configured
  if (!env.RPI_PROXY_URL || !env.RPI_PROXY_KEY) {
    logger.error('RPI proxy not configured');
    return jsonResponse({
      error: 'RPI proxy not configured',
      message: 'Set RPI_PROXY_URL and RPI_PROXY_KEY environment variables',
    }, 503, origin);
  }

  try {
    // Route through RPI proxy
    let rpiBaseUrl = env.RPI_PROXY_URL;
    if (!rpiBaseUrl.startsWith('http://') && !rpiBaseUrl.startsWith('https://')) {
      rpiBaseUrl = `https://${rpiBaseUrl}`;
    }

    const rpiParams = new URLSearchParams({
      url: decodedUrl,
      key: env.RPI_PROXY_KEY,
    });
    
    // Pass custom User-Agent if provided (important for enc-dec.app decryption)
    if (customUserAgent) {
      rpiParams.set('ua', customUserAgent);
    }
    
    // Pass custom Referer if provided, or auto-detect for Flixer CDN
    // Flixer CDN (p.XXXXX.workers.dev) REQUIRES Referer header
    const isFlixerCdn = decodedUrl.match(/p\.\d+\.workers\.dev/);
    if (customReferer) {
      rpiParams.set('referer', customReferer);
    } else if (isFlixerCdn) {
      // Auto-add Flixer referer for Flixer CDN URLs
      rpiParams.set('referer', 'https://flixer.sh/');
    }
    
    const rpiUrl = `${rpiBaseUrl}/animekai?${rpiParams.toString()}`;
    logger.debug('Forwarding to RPI proxy', { rpiUrl: rpiUrl.substring(0, 80) });

    const rpiResponse = await fetch(rpiUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (!rpiResponse.ok) {
      logger.error('RPI proxy error', { status: rpiResponse.status });
      
      // Try to get error details
      let errorDetails = '';
      try {
        const errorBody = await rpiResponse.text();
        errorDetails = errorBody.substring(0, 200);
      } catch {}
      
      return jsonResponse({
        error: `RPI proxy returned ${rpiResponse.status}`,
        details: errorDetails,
      }, rpiResponse.status, origin);
    }

    const contentType = rpiResponse.headers.get('content-type') || '';
    
    // If it's a playlist, rewrite URLs to route through this proxy
    if (contentType.includes('mpegurl') || decodedUrl.includes('.m3u8')) {
      const playlistText = await rpiResponse.text();
      const rewrittenPlaylist = rewritePlaylistUrls(playlistText, decodedUrl, url.origin);
      
      return new Response(rewrittenPlaylist, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=5',
          'X-Proxied-Via': 'rpi',
          ...corsHeaders(origin),
        },
      });
    }

    // For segments, stream directly
    const body = await rpiResponse.arrayBuffer();
    
    // Detect content type from first bytes
    const firstBytes = new Uint8Array(body.slice(0, 4));
    const isMpegTs = firstBytes[0] === 0x47;
    const isFmp4 = firstBytes[0] === 0x00 && firstBytes[1] === 0x00 && firstBytes[2] === 0x00;
    
    let actualContentType = contentType;
    if (isMpegTs) actualContentType = 'video/mp2t';
    else if (isFmp4) actualContentType = 'video/mp4';
    else if (!actualContentType) actualContentType = 'application/octet-stream';

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': actualContentType,
        'Content-Length': body.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Proxied-Via': 'rpi',
        ...corsHeaders(origin),
      },
    });

  } catch (error) {
    logger.error('AnimeKai proxy error', error as Error);
    return jsonResponse({
      error: 'Proxy error',
      details: error instanceof Error ? error.message : String(error),
    }, 502, origin);
  }
}

export default {
  fetch: handleAnimeKaiRequest,
};
