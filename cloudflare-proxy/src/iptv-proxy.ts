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
  // RPi proxy (residential IP)
  RPI_PROXY_URL?: string;
  RPI_PROXY_KEY?: string;
  // Hetzner VPS proxy (datacenter but different IP range)
  HETZNER_PROXY_URL?: string;
  HETZNER_PROXY_KEY?: string;
  // Oxylabs residential proxy (paid, reliable)
  OXYLABS_USERNAME?: string;
  OXYLABS_PASSWORD?: string;
  OXYLABS_COUNTRY?: string;
}

// STB Device Headers - Required for Stalker Portal authentication
const STB_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

function buildStreamHeaders(macAddress: string, token?: string, referer?: string): Record<string, string> {
  const encodedMac = encodeURIComponent(macAddress);
  const headers: Record<string, string> = {
    'User-Agent': STB_USER_AGENT,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate',
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

/**
 * Fetch via Oxylabs residential proxy
 * This gives us residential IPs directly from CF worker - bypasses datacenter IP blocking!
 */
async function fetchViaOxylabs(
  url: string, 
  headers: Record<string, string>,
  env: Env, 
  logger: any
): Promise<Response> {
  if (!env.OXYLABS_USERNAME || !env.OXYLABS_PASSWORD) {
    throw new Error('Oxylabs not configured');
  }

  // Oxylabs Web Unblocker endpoint
  const oxylabsEndpoint = 'https://realtime.oxylabs.io/v1/queries';
  
  logger.info('Fetching via Oxylabs residential proxy', { url: url.substring(0, 80) });

  const payload = {
    source: 'universal',
    url: url,
    geo_location: env.OXYLABS_COUNTRY || 'United States',
    render: 'html', // Some portals need JS rendering
    // Pass through our STB headers
    context: [
      { key: 'http_method', value: 'GET' },
      { key: 'headers', value: headers },
    ],
  };

  const response = await fetch(oxylabsEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${env.OXYLABS_USERNAME}:${env.OXYLABS_PASSWORD}`),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Oxylabs request failed', { status: response.status, error: errorText.substring(0, 200) });
    throw new Error(`Oxylabs error: ${response.status}`);
  }

  const result = await response.json() as { results?: Array<{ content?: string; status_code?: number }> };
  
  if (!result.results?.[0]?.content) {
    throw new Error('Oxylabs returned empty content');
  }

  const content = result.results[0].content;
  const statusCode = result.results[0].status_code || 200;
  
  logger.info('Oxylabs succeeded', { statusCode, contentLength: content.length });

  // Return as a Response object
  return new Response(content, {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
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
    return handleApiProxy(url, env, logger, origin, request);
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

async function handleApiProxy(url: URL, env: Env, logger: any, origin: string | null, request?: Request): Promise<Response> {
  const apiUrl = url.searchParams.get('url');
  const mac = url.searchParams.get('mac');
  const token = url.searchParams.get('token');
  // Allow forcing direct fetch even if proxies are configured
  const forceDirect = url.searchParams.get('direct') === 'true';
  // Allow client IP forwarding mode - token bound to user's IP!
  const forwardClientIp = url.searchParams.get('forward_ip') === 'true';

  if (!apiUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  try {
    const decodedUrl = decodeURIComponent(apiUrl);
    logger.info('IPTV API proxy request', { url: decodedUrl.substring(0, 100), forceDirect, forwardClientIp });

    // Build STB headers
    const headers = buildStreamHeaders(mac || '', token || undefined);
    
    // Extract referer from URL
    try {
      const urlObj = new URL(decodedUrl);
      headers['Referer'] = `${urlObj.protocol}//${urlObj.host}/`;
      headers['Origin'] = `${urlObj.protocol}//${urlObj.host}`;
    } catch {}
    
    // Forward client IP if requested - this makes the portal bind the token to the USER's IP!
    // The user can then stream directly without needing a proxy!
    if (forwardClientIp && request) {
      const clientIp = request.headers.get('CF-Connecting-IP') || 
                       request.headers.get('X-Real-IP') ||
                       request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
      if (clientIp) {
        headers['X-Forwarded-For'] = clientIp;
        headers['X-Real-IP'] = clientIp;
        headers['CF-Connecting-IP'] = clientIp;
        logger.info('Forwarding client IP to portal', { clientIp });
      }
    }

    let response: Response;
    let usedMethod = 'direct';

    // Priority order for IPTV API calls:
    // 1. Hetzner VPS proxy (PRIMARY - working, cheap bandwidth ~€1/TB)
    // 2. RPi proxy (residential IP - backup, currently broken tunnel)
    // 3. Oxylabs (residential IP - paid but reliable)
    // 4. Direct from CF worker (often rate-limited by portals)

    const hasHetzner = env.HETZNER_PROXY_URL && env.HETZNER_PROXY_KEY;
    const hasRpi = env.RPI_PROXY_URL && env.RPI_PROXY_KEY;
    const hasOxylabs = env.OXYLABS_USERNAME && env.OXYLABS_PASSWORD;

    // Helper to try Hetzner proxy
    const tryHetzner = async (): Promise<Response> => {
      const hetznerParams = new URLSearchParams({ url: decodedUrl, key: env.HETZNER_PROXY_KEY! });
      if (mac) hetznerParams.set('mac', mac);
      if (token) hetznerParams.set('token', token);
      const hetznerUrl = `${env.HETZNER_PROXY_URL}/iptv/api?${hetznerParams.toString()}`;
      logger.info('Trying Hetzner proxy', { url: hetznerUrl.substring(0, 80) });
      return fetch(hetznerUrl, { signal: AbortSignal.timeout(15000) });
    };

    // Helper to try RPi proxy
    const tryRpi = async (): Promise<Response> => {
      const rpiParams = new URLSearchParams({ url: decodedUrl, key: env.RPI_PROXY_KEY! });
      if (mac) rpiParams.set('mac', mac);
      if (token) rpiParams.set('token', token);
      const rpiUrl = `${env.RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`;
      logger.info('Trying RPi proxy', { url: rpiUrl.substring(0, 80) });
      return fetch(rpiUrl, { signal: AbortSignal.timeout(15000) });
    };

    if (!forceDirect && hasHetzner) {
      // Try Hetzner proxy FIRST (primary)
      logger.info('Trying Hetzner proxy for IPTV API (primary)');
      
      try {
        response = await tryHetzner();
        usedMethod = 'hetzner';
        
        if (response.ok) {
          logger.info('Hetzner proxy succeeded');
        } else {
          logger.warn('Hetzner proxy returned error', { status: response.status });
          throw new Error(`Hetzner returned ${response.status}`);
        }
      } catch (hetznerError) {
        logger.warn('Hetzner proxy failed', { error: String(hetznerError) });
        
        // Try RPi as first fallback
        if (hasRpi) {
          try {
            response = await tryRpi();
            usedMethod = 'rpi';
            if (!response.ok) throw new Error(`RPi returned ${response.status}`);
            logger.info('RPi proxy succeeded');
          } catch (rpiError) {
            logger.warn('RPi also failed', { error: String(rpiError) });
            // Try Oxylabs
            if (hasOxylabs) {
              try {
                response = await fetchViaOxylabs(decodedUrl, headers, env, logger);
                usedMethod = 'oxylabs';
              } catch (oxError) {
                logger.warn('Oxylabs also failed', { error: String(oxError) });
                response = await fetch(decodedUrl, { headers });
                usedMethod = 'direct-fallback';
              }
            } else {
              response = await fetch(decodedUrl, { headers });
              usedMethod = 'direct-fallback';
            }
          }
        } else if (hasOxylabs) {
          try {
            logger.info('Falling back to Oxylabs residential proxy');
            response = await fetchViaOxylabs(decodedUrl, headers, env, logger);
            usedMethod = 'oxylabs';
          } catch (oxError) {
            logger.warn('Oxylabs also failed', { error: String(oxError) });
            response = await fetch(decodedUrl, { headers });
            usedMethod = 'direct-fallback';
          }
        } else {
          // No fallbacks, go direct
          response = await fetch(decodedUrl, { headers });
          usedMethod = 'direct-fallback';
        }
      }
    } else if (!forceDirect && hasRpi) {
      // No Hetzner but have RPi - try it
      logger.info('Using RPi proxy (no Hetzner configured)');
      try {
        response = await tryRpi();
        usedMethod = 'rpi';
        if (!response.ok) throw new Error(`RPi returned ${response.status}`);
      } catch (rpiError) {
        logger.warn('RPi failed', { error: String(rpiError) });
        if (hasOxylabs) {
          try {
            response = await fetchViaOxylabs(decodedUrl, headers, env, logger);
            usedMethod = 'oxylabs';
          } catch (oxError) {
            response = await fetch(decodedUrl, { headers });
            usedMethod = 'direct-fallback';
          }
        } else {
          response = await fetch(decodedUrl, { headers });
          usedMethod = 'direct-fallback';
        }
      }
    } else if (!forceDirect && hasOxylabs) {
      // No Hetzner/RPi but have Oxylabs - use it directly
      logger.info('Using Oxylabs residential proxy (no Hetzner/RPi configured)');
      try {
        response = await fetchViaOxylabs(decodedUrl, headers, env, logger);
        usedMethod = 'oxylabs';
      } catch (oxError) {
        logger.warn('Oxylabs failed', { error: String(oxError) });
        response = await fetch(decodedUrl, { headers });
        usedMethod = 'direct-fallback';
      }
    } else {
      // Direct fetch from Cloudflare (may get rate-limited)
      logger.info('Direct fetch from Cloudflare Worker');
      response = await fetch(decodedUrl, { headers });
      usedMethod = 'direct';
      
      // If rate-limited, try fallbacks
      if (response.status === 429) {
        if (hasHetzner) {
          logger.warn('Got 429, trying Hetzner');
          try {
            response = await tryHetzner();
            usedMethod = 'hetzner-retry';
          } catch { /* ignore */ }
        }
        if (response.status === 429 && hasRpi) {
          logger.warn('Still 429, trying RPi');
          try {
            response = await tryRpi();
            usedMethod = 'rpi-retry';
          } catch { /* ignore */ }
        }
        if (response.status === 429 && hasOxylabs) {
          logger.warn('Still 429, trying Oxylabs');
          try {
            response = await fetchViaOxylabs(decodedUrl, headers, env, logger);
            usedMethod = 'oxylabs-retry';
          } catch { /* ignore */ }
        }
      }
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    const text = await response.text();

    logger.info('IPTV API response', { status: response.status, length: text.length, usedMethod });

    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'X-Used-Rpi': usedMethod === 'rpi' ? 'true' : 'false',
        'X-Used-Method': usedMethod,
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
    let usedProxy = 'direct';

    // Helper to build proxy params
    const buildProxyParams = () => {
      const params = new URLSearchParams({ url: decodedUrl });
      if (mac) params.set('mac', mac);
      if (token) params.set('token', token);
      return params;
    };

    // Priority: Hetzner (PRIMARY) > RPi (backup) > Direct
    // Hetzner has cheap bandwidth (~€1/TB), RPi tunnel is currently broken
    if (env.HETZNER_PROXY_URL && env.HETZNER_PROXY_KEY) {
      logger.info('Using Hetzner proxy for IPTV stream (primary)');
      const params = buildProxyParams();
      params.set('key', env.HETZNER_PROXY_KEY);
      const hetznerUrl = `${env.HETZNER_PROXY_URL}/iptv/stream?${params.toString()}`;
      
      try {
        response = await fetch(hetznerUrl);
        usedProxy = 'hetzner';
        if (!response.ok && env.RPI_PROXY_URL) {
          throw new Error(`Hetzner returned ${response.status}`);
        }
      } catch (hetznerErr) {
        logger.warn('Hetzner stream failed, trying RPi', { error: String(hetznerErr) });
        if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
          const rpiParams = buildProxyParams();
          rpiParams.set('key', env.RPI_PROXY_KEY);
          const rpiUrl = `${env.RPI_PROXY_URL}/iptv/stream?${rpiParams.toString()}`;
          response = await fetch(rpiUrl);
          usedProxy = 'rpi';
        } else {
          response = await fetch(decodedUrl, { headers });
          usedProxy = 'direct-fallback';
        }
      }
    } else if (env.RPI_PROXY_URL && env.RPI_PROXY_KEY) {
      logger.info('Using RPi proxy for IPTV stream (no Hetzner configured)');
      const params = buildProxyParams();
      params.set('key', env.RPI_PROXY_KEY);
      const rpiUrl = `${env.RPI_PROXY_URL}/iptv/stream?${params.toString()}`;
      response = await fetch(rpiUrl);
      usedProxy = 'rpi';
    } else {
      // Direct fetch (will likely get blocked by IPTV providers)
      logger.warn('No proxy configured - direct fetch may be blocked');
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
