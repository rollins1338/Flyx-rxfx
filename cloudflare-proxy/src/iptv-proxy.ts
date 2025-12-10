/**
 * IPTV Stream Proxy for Cloudflare Workers
 * 
 * Proxies IPTV Stalker portal streams to bypass CORS and SSL issues.
 * 
 * Routes:
 *   GET /iptv/stream?url=<encoded_url>&mac=<mac>&token=<token>
 * 
 * If RPI_PROXY_URL is configured, streams are routed through the residential
 * IP proxy to bypass datacenter IP blocking by IPTV providers.
 */

import { createLogger, type LogLevel } from './logger';

export interface Env {
  LOG_LEVEL?: string;
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
}

// STB Device Headers - Required for Stalker Portal authentication
const STB_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

function buildStreamHeaders(macAddress: string, token?: string, referer?: string): Record<string, string> {
  const encodedMac = encodeURIComponent(macAddress);
  const headers: Record<string, string> = {
    'User-Agent': STB_USER_AGENT,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Cookie': `mac=${encodedMac}; stb_lang=en; timezone=GMT`,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (referer) {
    headers['Referer'] = referer;
  }
  
  return headers;
}

function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  };
}

export async function handleIPTVRequest(request: Request, env: Env): Promise<Response> {
  const logLevel = (env.LOG_LEVEL || 'info') as LogLevel;
  const logger = createLogger(request, logLevel);
  
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = request.headers.get('origin');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders(origin) 
    });
  }

  // Route: /iptv/api - Proxy Stalker portal API calls
  if (path === '/iptv/api' || path === '/iptv/api/') {
    return handleApiProxy(url, env, logger, origin);
  }

  // Route: /iptv/stream - Proxy IPTV stream
  if (path === '/iptv/stream' || path === '/iptv/stream/') {
    return handleStreamProxy(url, env, logger, origin);
  }

  return new Response(JSON.stringify({
    error: 'Not found',
    routes: {
      api: '/iptv/api?url=<encoded_url>&mac=<mac>&token=<token>',
      stream: '/iptv/stream?url=<encoded_url>&mac=<mac>&token=<token>',
    },
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function handleApiProxy(url: URL, env: Env, logger: any, origin: string | null): Promise<Response> {
  const apiUrl = url.searchParams.get('url');
  const mac = url.searchParams.get('mac');
  const token = url.searchParams.get('token');

  if (!apiUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(apiUrl);
    logger.info('IPTV API proxy request', { url: decodedUrl.substring(0, 100) });

    // Build STB headers
    const headers = buildStreamHeaders(mac || '', token || undefined);

    let response: Response;

    // If RPi proxy is configured, route through it for residential IP
    if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
      logger.info('Using RPi proxy for IPTV API', { rpiProxy: env.RPI_PROXY_URL });
      
      const rpiParams = new URLSearchParams({ url: decodedUrl, key: env.RPI_PROXY_KEY });
      if (mac) rpiParams.set('mac', mac);
      if (token) rpiParams.set('token', token);
      
      const rpiUrl = `${env.RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`;
      
      response = await fetch(rpiUrl, {
        signal: AbortSignal.timeout(15000),
      });
    } else {
      // Direct fetch from Cloudflare (datacenter IP - may be blocked)
      logger.warn('No RPi proxy configured - direct fetch may be blocked');
      
      response = await fetch(decodedUrl, {
        headers,
        // @ts-ignore - Cloudflare Workers support this
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        },
      });
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    const text = await response.text();

    logger.info('IPTV API response', { status: response.status, length: text.length });

    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        ...corsHeaders(origin),
      },
    });

  } catch (error) {
    logger.error('IPTV API proxy error', error as Error);
    return new Response(JSON.stringify({ 
      error: 'API proxy error', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}

async function handleStreamProxy(url: URL, env: Env, logger: any, origin: string | null): Promise<Response> {
  const streamUrl = url.searchParams.get('url');
  let mac = url.searchParams.get('mac');
  const token = url.searchParams.get('token');

  if (!streamUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(streamUrl);
    logger.info('IPTV stream proxy request', { url: decodedUrl.substring(0, 100) });

    // Extract MAC from stream URL if not provided (e.g., mac=00:1A:79:00:00:0C)
    if (!mac) {
      const macMatch = decodedUrl.match(/mac=([0-9A-Fa-f:]+)/);
      if (macMatch) {
        mac = decodeURIComponent(macMatch[1]);
        logger.info('Extracted MAC from URL', { mac });
      }
    }

    // Extract referer from stream URL
    let referer: string | undefined;
    try {
      const urlObj = new URL(decodedUrl);
      referer = `${urlObj.protocol}//${urlObj.host}/`;
    } catch {}

    // Build headers - always use STB headers for IPTV streams
    const headers = mac ? buildStreamHeaders(mac, token || undefined, referer) : {
      'User-Agent': STB_USER_AGENT,
      'X-User-Agent': 'Model: MAG250; Link: WiFi',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      ...(referer ? { 'Referer': referer } : {}),
    };

    let response: Response;

    // If RPi proxy is configured, route through it for residential IP
    if (env.RPI_PROXY_URL) {
      logger.info('Using RPi proxy for IPTV stream', { rpiProxy: env.RPI_PROXY_URL });
      
      const rpiParams = new URLSearchParams({ url: decodedUrl });
      if (mac) rpiParams.set('mac', mac);
      if (token) rpiParams.set('token', token);
      
      const rpiUrl = `${env.RPI_PROXY_URL}/iptv/stream?${rpiParams.toString()}`;
      
      response = await fetch(rpiUrl, {
        headers: {
          'X-API-Key': env.RPI_PROXY_KEY || '',
        },
      });
    } else {
      // Direct fetch (will likely get blocked by IPTV providers)
      logger.warn('No RPi proxy configured - direct fetch may be blocked');
      
      response = await fetch(decodedUrl, {
        headers,
        // @ts-ignore - Cloudflare Workers support this
        cf: {
          cacheTtl: 0,
          cacheEverything: false,
        },
      });
    }

    if (!response.ok) {
      logger.error('Stream fetch failed', { status: response.status });
      return new Response(JSON.stringify({ 
        error: 'Stream fetch failed', 
        status: response.status 
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const contentType = response.headers.get('content-type') || 'video/mp2t';
    const contentLength = response.headers.get('content-length');

    // Stream the response
    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      ...corsHeaders(origin),
      'Cache-Control': 'no-store',
    };

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    logger.info('Streaming IPTV content', { contentType, contentLength });

    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    logger.error('IPTV proxy error', error as Error);
    return new Response(JSON.stringify({ 
      error: 'Proxy error', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}
