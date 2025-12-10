import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

const REQUEST_TIMEOUT = 15000;

// Proxy configurations
const RPI_PROXY_URL = process.env.RPI_PROXY_URL;
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY;
const HETZNER_PROXY_URL = process.env.HETZNER_PROXY_URL;
const HETZNER_PROXY_KEY = process.env.HETZNER_PROXY_KEY;

// STB Device Headers - Required for Stalker Portal authentication
const STB_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

function buildHeaders(macAddress: string, token?: string): Record<string, string> {
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
  
  return headers;
}

// Perform handshake to get authentication token
// MUST use RPi proxy so token is bound to residential IP (same IP that will stream)
async function performHandshake(portalUrl: string, macAddress: string): Promise<string> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'stb');
  url.searchParams.set('action', 'handshake');
  url.searchParams.set('token', '');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const requestUrl = url.toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    let response: Response;
    
    // Use RPi proxy if available - CRITICAL for token to be bound to residential IP
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      console.log('[Handshake] Using RPi proxy for residential IP');
      const rpiParams = new URLSearchParams({
        url: requestUrl,
        mac: macAddress,
        key: RPI_PROXY_KEY,
      });
      
      response = await fetch(`${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`, {
        signal: controller.signal,
      });
    } else {
      // Direct fetch (token will be bound to server IP - streaming may fail)
      console.warn('[Handshake] No RPi proxy - token will be bound to datacenter IP');
      response = await fetch(requestUrl, { 
        signal: controller.signal,
        headers: buildHeaders(macAddress),
      });
    }
    clearTimeout(timeoutId);
    
    const text = await response.text();
    // Handle secure JSON wrapper
    const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    const data = JSON.parse(clean);
    
    if (data?.js?.token) {
      return data.js.token;
    }
    throw new Error('Invalid handshake response - no token received');
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Handshake timeout');
    }
    throw error;
  }
}

// Get account profile - uses RPi proxy if available
async function getProfile(portalUrl: string, macAddress: string, token: string): Promise<any> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'stb');
  url.searchParams.set('action', 'get_profile');
  url.searchParams.set('hd', '1');
  url.searchParams.set('num_banks', '2');
  url.searchParams.set('stb_type', 'MAG250');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const requestUrl = url.toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    let response: Response;
    
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      const rpiParams = new URLSearchParams({
        url: requestUrl,
        mac: macAddress,
        token: token,
        key: RPI_PROXY_KEY,
      });
      response = await fetch(`${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`, {
        signal: controller.signal,
      });
    } else {
      response = await fetch(requestUrl, { 
        signal: controller.signal,
        headers: buildHeaders(macAddress, token),
      });
    }
    clearTimeout(timeoutId);
    
    const text = await response.text();
    const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    const data = JSON.parse(clean);
    
    if (data?.js) {
      return data.js;
    }
    throw new Error('Invalid profile response');
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Profile request timeout');
    }
    throw error;
  }
}

// Get content count - uses RPi proxy if available
async function getContentCount(portalUrl: string, macAddress: string, token: string, contentType: string): Promise<number> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', contentType);
  url.searchParams.set('action', 'get_ordered_list');
  url.searchParams.set('p', '0');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const requestUrl = url.toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    let response: Response;
    
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      const rpiParams = new URLSearchParams({
        url: requestUrl,
        mac: macAddress,
        token: token,
        key: RPI_PROXY_KEY,
      });
      response = await fetch(`${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`, {
        signal: controller.signal,
      });
    } else {
      response = await fetch(requestUrl, { 
        signal: controller.signal,
        headers: buildHeaders(macAddress, token),
      });
    }
    clearTimeout(timeoutId);
    
    const text = await response.text();
    const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    const data = JSON.parse(clean);
    return data?.js?.total_items ?? 0;
  } catch {
    clearTimeout(timeoutId);
    return 0;
  }
}

// Get genres/categories - uses RPi proxy if available
async function getGenres(portalUrl: string, macAddress: string, token: string, contentType: string): Promise<any[]> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', contentType);
  url.searchParams.set('action', 'get_genres');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const requestUrl = url.toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    let response: Response;
    
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      const rpiParams = new URLSearchParams({
        url: requestUrl,
        mac: macAddress,
        token: token,
        key: RPI_PROXY_KEY,
      });
      response = await fetch(`${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`, {
        signal: controller.signal,
      });
    } else {
      response = await fetch(requestUrl, { 
        signal: controller.signal,
        headers: buildHeaders(macAddress, token),
      });
    }
    clearTimeout(timeoutId);
    
    const text = await response.text();
    const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    const data = JSON.parse(clean);
    return data?.js || [];
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

// Parse Stalker's secure JSON wrapper
function parseSecureJson(text: string): any {
  const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// Get channels list - uses RPi proxy if available
async function getChannels(portalUrl: string, macAddress: string, token: string, genre: string = '*', page: number = 0, pageSize: number = 14): Promise<any> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'itv');
  url.searchParams.set('action', 'get_ordered_list');
  url.searchParams.set('genre', genre);
  url.searchParams.set('p', page.toString());
  // Some Stalker portals support 'cnt' parameter for page size
  if (pageSize !== 14) {
    url.searchParams.set('cnt', pageSize.toString());
  }
  url.searchParams.set('JsHttpRequest', '1-xml');

  const requestUrl = url.toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    let response: Response;
    
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      const rpiParams = new URLSearchParams({
        url: requestUrl,
        mac: macAddress,
        token: token,
        key: RPI_PROXY_KEY,
      });
      response = await fetch(`${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`, {
        signal: controller.signal,
      });
    } else {
      response = await fetch(requestUrl, { 
        signal: controller.signal,
        headers: buildHeaders(macAddress, token),
      });
    }
    clearTimeout(timeoutId);
    
    const text = await response.text();
    const data = parseSecureJson(text);
    return data?.js || { data: [], total_items: 0 };
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('getChannels error:', e);
    return { data: [], total_items: 0 };
  }
}

// Extract URL from ffmpeg/ffrt command format
function extractUrlFromCmd(cmd: string): string {
  let url = cmd;
  // Remove various ffmpeg prefixes
  const prefixes = ['ffmpeg ', 'ffrt ', 'ffrt2 ', 'ffrt3 ', 'ffrt4 '];
  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) {
      url = url.substring(prefix.length);
      break;
    }
  }
  return url.trim();
}

// Get stream URL for a channel
// Uses RPi proxy if available to ensure token is bound to residential IP
async function getStreamUrl(portalUrl: string, macAddress: string, token: string, cmd: string): Promise<{ streamUrl: string | null; rawResponse: any; requestUrl: string; usedRpiProxy: boolean }> {
  // The cmd from channel list is the full command - we need to pass it as-is
  // Some portals expect "ffmpeg http://..." format, others just the URL
  // We'll try the original cmd first
  
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'itv');
  url.searchParams.set('action', 'create_link');
  url.searchParams.set('cmd', cmd);
  url.searchParams.set('series', '');
  url.searchParams.set('forced_storage', 'undefined');
  url.searchParams.set('disable_ad', '0');
  url.searchParams.set('download', '0');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const requestUrl = url.toString();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    let response: Response;
    let usedRpiProxy = false;
    
    // Use RPi proxy if available - this ensures the stream token is bound to the residential IP
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      console.log('Using RPi proxy for create_link to bind token to residential IP');
      const rpiParams = new URLSearchParams({
        url: requestUrl,
        mac: macAddress,
        token: token,
        key: RPI_PROXY_KEY,
      });
      
      response = await fetch(`${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`, {
        signal: controller.signal,
      });
      usedRpiProxy = true;
    } else {
      // Direct fetch (token will be bound to server IP - may not work for streaming)
      console.log('No RPi proxy configured - token will be bound to server IP');
      response = await fetch(requestUrl, { 
        signal: controller.signal,
        headers: buildHeaders(macAddress, token),
      });
    }
    clearTimeout(timeoutId);
    
    const text = await response.text();
    console.log('Raw response from proxy:', text.substring(0, 500));
    console.log('Response status:', response.status);
    
    // Handle Stalker's secure JSON wrapper
    const cleanText = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    console.log('Cleaned text:', cleanText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(cleanText);
      console.log('Parsed data:', JSON.stringify(data).substring(0, 500));
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return { streamUrl: null, rawResponse: { parseError: true, rawText: text.substring(0, 500) }, requestUrl, usedRpiProxy };
    }
    
    let streamUrl = data?.js?.cmd || null;
    
    // Extract actual URL from ffmpeg command format
    if (streamUrl) {
      streamUrl = extractUrlFromCmd(streamUrl);
    }
    
    // Check if the returned URL has empty stream parameter - if so, use original cmd URL
    if (streamUrl && streamUrl.includes('stream=&')) {
      console.log('Portal returned empty stream param, using original cmd URL');
      streamUrl = extractUrlFromCmd(cmd);
    }
    
    console.log('Stream URL extracted:', streamUrl);
    console.log('Original cmd:', cmd);
    console.log('Response cmd:', data?.js?.cmd);
    console.log('Used RPi proxy:', usedRpiProxy);
    
    return { streamUrl, rawResponse: data, requestUrl, usedRpiProxy };
  } catch (e) {
    clearTimeout(timeoutId);
    return { streamUrl: null, rawResponse: { error: String(e) }, requestUrl, usedRpiProxy: false };
  }
}

// Normalize portal URL to proper format
function normalizePortalUrl(portalUrl: string): string {
  let url = portalUrl.trim();
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  
  // Remove trailing slash
  url = url.replace(/\/+$/, '');
  
  // Handle different portal URL formats
  // If it ends with /c, use the base for portal.php
  if (url.endsWith('/c')) {
    url = url.slice(0, -2);
  } else if (url.endsWith('/portal.php')) {
    url = url.slice(0, -11);
  } else if (url.endsWith('/server/load.php')) {
    url = url.slice(0, -16);
  }
  
  return url;
}

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, portalUrl, macAddress, token, genre, page, cmd } = body;

    if (!portalUrl || !macAddress) {
      return NextResponse.json({ error: 'Portal URL and MAC address are required' }, { status: 400 });
    }

    const normalizedUrl = normalizePortalUrl(portalUrl);

    switch (action) {
      case 'test': {
        // Full test: handshake + profile + content counts
        const authToken = await performHandshake(normalizedUrl, macAddress);
        const profile = await getProfile(normalizedUrl, macAddress, authToken);
        
        const [itvCount, radioCount, vodCount] = await Promise.all([
          getContentCount(normalizedUrl, macAddress, authToken, 'itv'),
          getContentCount(normalizedUrl, macAddress, authToken, 'radio'),
          getContentCount(normalizedUrl, macAddress, authToken, 'vod')
        ]);

        return NextResponse.json({
          success: true,
          token: authToken,
          profile,
          content: { itv: itvCount, radio: radioCount, vod: vodCount }
        });
      }

      case 'genres': {
        if (!token) {
          return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }
        const genres = await getGenres(normalizedUrl, macAddress, token, 'itv');
        return NextResponse.json({ success: true, genres });
      }

      case 'channels': {
        if (!token) {
          return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }
        const pageSize = body.pageSize || 14;
        const channels = await getChannels(normalizedUrl, macAddress, token, genre || '*', page || 0, pageSize);
        // Log first channel for debugging
        if (channels.data && channels.data.length > 0) {
          console.log('Sample channel data:', JSON.stringify(channels.data[0], null, 2));
        }
        return NextResponse.json({ success: true, channels });
      }

      case 'stream': {
        if (!token || !cmd) {
          return NextResponse.json({ error: 'Token and cmd required' }, { status: 400 });
        }
        const { streamUrl, rawResponse, requestUrl, usedRpiProxy } = await getStreamUrl(normalizedUrl, macAddress, token, cmd);
        
        // Return success only if we got a valid stream URL
        if (!streamUrl) {
          return NextResponse.json({ 
            success: false, 
            error: 'No stream URL returned from portal',
            rawResponse, 
            cmd, 
            requestUrl, 
            usedRpiProxy 
          });
        }
        
        return NextResponse.json({ success: true, streamUrl, rawResponse, cmd, requestUrl, usedRpiProxy });
      }

      case 'debug_sources': {
        // Test handshake from different sources to see which IPs are blocked
        const results: Record<string, any> = {};
        
        let testUrl: string;
        try {
          const handshakeUrl = new URL('/portal.php', normalizedUrl);
          handshakeUrl.searchParams.set('type', 'stb');
          handshakeUrl.searchParams.set('action', 'handshake');
          handshakeUrl.searchParams.set('token', '');
          handshakeUrl.searchParams.set('JsHttpRequest', '1-xml');
          testUrl = handshakeUrl.toString();
        } catch (urlError: any) {
          return NextResponse.json({ 
            success: false, 
            error: `Invalid portal URL: ${urlError.message}`,
            normalizedUrl 
          });
        }
        
        // 1. Test direct from Vercel (datacenter IP)
        try {
          const startVercel = Date.now();
          const vercelRes = await fetch(testUrl, {
            headers: buildHeaders(macAddress),
            signal: AbortSignal.timeout(10000),
          });
          const vercelText = await vercelRes.text();
          const vercelClean = vercelText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
          let vercelData;
          try { vercelData = JSON.parse(vercelClean); } catch { vercelData = null; }
          
          results.vercel = {
            source: 'Vercel (Datacenter)',
            status: vercelRes.status,
            success: vercelRes.ok && vercelData?.js?.token,
            token: vercelData?.js?.token ? vercelData.js.token.substring(0, 20) + '...' : null,
            latency: Date.now() - startVercel,
            error: !vercelRes.ok ? `HTTP ${vercelRes.status}` : (!vercelData?.js?.token ? 'No token in response' : null),
            rawResponse: vercelText.substring(0, 200),
          };
        } catch (e: any) {
          results.vercel = {
            source: 'Vercel (Datacenter)',
            success: false,
            error: e.message || String(e),
          };
        }
        
        // 2. Test through Cloudflare Worker (normal mode - will use RPi if configured)
        const cfProxyUrl = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL;
        if (cfProxyUrl) {
          try {
            const startCf = Date.now();
            // Test CF worker's normal flow (will route through RPi if configured in CF worker)
            const cfParams = new URLSearchParams({ url: testUrl, mac: macAddress });
            const cfFullUrl = `${cfProxyUrl}/iptv/api?${cfParams.toString()}`;
            console.log('[Debug Sources] Testing CF worker (normal):', cfFullUrl.substring(0, 100));
            
            const cfRes = await fetch(cfFullUrl, {
              signal: AbortSignal.timeout(15000),
            });
            const cfText = await cfRes.text();
            console.log('[Debug Sources] CF response:', cfRes.status, cfText.substring(0, 200));
            
            const cfClean = cfText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
            let cfData;
            try { cfData = JSON.parse(cfClean); } catch { cfData = null; }
            
            // Check X-Used-Rpi header to see if it went through RPi
            const usedRpi = cfRes.headers.get('X-Used-Rpi');
            
            // Determine error source
            let errorSource = null;
            if (!cfRes.ok) {
              if (cfRes.status === 429) {
                errorSource = usedRpi === 'true' 
                  ? 'Portal rate-limiting (even through RPi)' 
                  : 'Portal rate-limiting CF worker IP - set RPI_PROXY_URL secret in CF worker';
              } else if (cfRes.status === 403) {
                errorSource = usedRpi === 'true'
                  ? 'Portal blocking RPi IP'
                  : 'Portal blocking CF worker IP - set RPI_PROXY_URL secret in CF worker';
              } else if (cfRes.status === 400) {
                errorSource = 'Bad request - check CF worker /iptv/api endpoint';
              } else if (cfRes.status === 502 || cfRes.status === 504) {
                errorSource = 'CF worker failed to reach portal or RPi proxy';
              } else {
                errorSource = `HTTP ${cfRes.status}`;
              }
            }
            
            results.cloudflare = {
              source: 'Cloudflare Worker',
              status: cfRes.status,
              success: cfRes.ok && cfData?.js?.token,
              token: cfData?.js?.token ? cfData.js.token.substring(0, 20) + '...' : null,
              latency: Date.now() - startCf,
              error: errorSource || (!cfData?.js?.token ? 'No token in response' : null),
              rawResponse: cfText.substring(0, 300),
              usedRpi: usedRpi === 'true',
              rpiConfigured: usedRpi !== null,
              testedUrl: cfFullUrl.substring(0, 80) + '...',
              hint: usedRpi === 'true' ? 'CF routed through RPi proxy' : 'CF made direct request (RPI_PROXY_URL not set in CF worker)',
            };
          } catch (e: any) {
            console.error('[Debug Sources] CF worker error:', e);
            results.cloudflare = {
              source: 'Cloudflare Worker',
              success: false,
              error: e.name === 'TimeoutError' ? 'Request timed out (15s)' : (e.message || String(e)),
            };
          }
        } else {
          results.cloudflare = {
            source: 'Cloudflare Worker',
            success: false,
            error: 'Not configured (NEXT_PUBLIC_CF_TV_PROXY_URL not set)',
          };
        }
        
        // 3. Test through RPi proxy (residential IP)
        if (RPI_PROXY_URL && RPI_PROXY_KEY) {
          // First, test if RPi proxy is reachable via health endpoint
          let rpiHealthy = false;
          try {
            const healthRes = await fetch(`${RPI_PROXY_URL}/health`, {
              signal: AbortSignal.timeout(5000),
            });
            rpiHealthy = healthRes.ok;
            console.log('[Debug Sources] RPi health check:', healthRes.status);
          } catch (healthErr: any) {
            console.error('[Debug Sources] RPi health check failed:', healthErr.message);
          }
          
          try {
            const startRpi = Date.now();
            const rpiParams = new URLSearchParams({
              url: testUrl,
              mac: macAddress,
              key: RPI_PROXY_KEY,
            });
            const rpiFullUrl = `${RPI_PROXY_URL}/iptv/api?${rpiParams.toString()}`;
            console.log('[Debug Sources] Testing RPi proxy:', rpiFullUrl.substring(0, 100));
            
            const rpiRes = await fetch(rpiFullUrl, {
              signal: AbortSignal.timeout(10000),
            });
            const rpiText = await rpiRes.text();
            console.log('[Debug Sources] RPi response:', rpiRes.status, rpiText.substring(0, 200));
            
            const rpiClean = rpiText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
            let rpiData;
            try { rpiData = JSON.parse(rpiClean); } catch { rpiData = null; }
            
            // Determine error source
            let errorSource = null;
            if (!rpiRes.ok) {
              if (rpiRes.status === 401) {
                errorSource = 'RPi proxy auth failed (check API key)';
              } else if (rpiRes.status === 403) {
                errorSource = 'Portal returned 403 to residential IP';
              } else if (rpiRes.status === 429) {
                errorSource = 'Portal rate-limiting residential IP';
              } else if (rpiRes.status === 502 || rpiRes.status === 504) {
                errorSource = 'RPi proxy failed to reach portal';
              } else {
                errorSource = `HTTP ${rpiRes.status}`;
              }
            }
            
            results.rpiProxy = {
              source: 'RPi Proxy (Residential IP)',
              status: rpiRes.status,
              success: rpiRes.ok && rpiData?.js?.token,
              token: rpiData?.js?.token ? rpiData.js.token.substring(0, 20) + '...' : null,
              latency: Date.now() - startRpi,
              error: errorSource || (!rpiData?.js?.token ? 'No token in response' : null),
              rawResponse: rpiText.substring(0, 500),
              rpiHealthy,
              rpiUrl: `${RPI_PROXY_URL}/iptv/api?url=...&mac=${macAddress}&key=***`,
            };
          } catch (e: any) {
            results.rpiProxy = {
              source: 'RPi Proxy (Residential IP)',
              success: false,
              error: e.name === 'TimeoutError' ? 'Request timed out (10s)' : (e.message || String(e)),
              rpiHealthy,
            };
          }
        } else {
          results.rpiProxy = {
            source: 'RPi Proxy (Residential IP)',
            success: false,
            error: 'Not configured (RPI_PROXY_URL or RPI_PROXY_KEY not set)',
          };
        }
        
        // 4. Test through Hetzner VPS proxy (if configured)
        if (HETZNER_PROXY_URL && HETZNER_PROXY_KEY) {
          let hetznerHealthy = false;
          try {
            const healthRes = await fetch(`${HETZNER_PROXY_URL}/health`, {
              signal: AbortSignal.timeout(5000),
            });
            hetznerHealthy = healthRes.ok;
            console.log('[Debug Sources] Hetzner health check:', healthRes.status);
          } catch (healthErr: any) {
            console.error('[Debug Sources] Hetzner health check failed:', healthErr.message);
          }
          
          try {
            const startHetzner = Date.now();
            const hetznerParams = new URLSearchParams({
              url: testUrl,
              mac: macAddress,
              key: HETZNER_PROXY_KEY,
            });
            const hetznerFullUrl = `${HETZNER_PROXY_URL}/iptv/api?${hetznerParams.toString()}`;
            console.log('[Debug Sources] Testing Hetzner proxy:', hetznerFullUrl.substring(0, 100));
            
            const hetznerRes = await fetch(hetznerFullUrl, {
              signal: AbortSignal.timeout(10000),
            });
            const hetznerText = await hetznerRes.text();
            console.log('[Debug Sources] Hetzner response:', hetznerRes.status, hetznerText.substring(0, 200));
            
            const hetznerClean = hetznerText.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
            let hetznerData;
            try { hetznerData = JSON.parse(hetznerClean); } catch { hetznerData = null; }
            
            let errorSource = null;
            if (!hetznerRes.ok) {
              if (hetznerRes.status === 401) {
                errorSource = 'Hetzner proxy auth failed (check API key)';
              } else if (hetznerRes.status === 403) {
                errorSource = 'Portal returned 403 to Hetzner IP';
              } else if (hetznerRes.status === 429) {
                errorSource = 'Portal rate-limiting Hetzner IP';
              } else {
                errorSource = `HTTP ${hetznerRes.status}`;
              }
            }
            
            results.hetznerProxy = {
              source: 'Hetzner VPS (Germany)',
              status: hetznerRes.status,
              success: hetznerRes.ok && hetznerData?.js?.token,
              token: hetznerData?.js?.token ? hetznerData.js.token.substring(0, 20) + '...' : null,
              latency: Date.now() - startHetzner,
              error: errorSource || (!hetznerData?.js?.token ? 'No token in response' : null),
              rawResponse: hetznerText.substring(0, 500),
              hetznerHealthy,
            };
          } catch (e: any) {
            results.hetznerProxy = {
              source: 'Hetzner VPS (Germany)',
              success: false,
              error: e.name === 'TimeoutError' ? 'Request timed out (10s)' : (e.message || String(e)),
              hetznerHealthy,
            };
          }
        } else {
          results.hetznerProxy = {
            source: 'Hetzner VPS (Germany)',
            success: false,
            error: 'Not configured (HETZNER_PROXY_URL or HETZNER_PROXY_KEY not set)',
          };
        }
        
        // Summary and recommendation
        // Key insight: Stream tokens are IP-bound, so ALL API calls must come from the same IP that will stream
        const cfUsedRpi = results.cloudflare?.usedRpi === true;
        const cfRpiConfigured = results.cloudflare?.rpiConfigured === true;
        
        let recommendation = '';
        if (results.rpiProxy?.success) {
          recommendation = 'RPi proxy works! Use it for all IPTV requests (stream tokens are IP-bound)';
        } else if (results.hetznerProxy?.success) {
          recommendation = 'Hetzner VPS works! Use it for IPTV requests. Set HETZNER_PROXY_URL/KEY in CF worker.';
        } else if (results.cloudflare?.success && cfUsedRpi) {
          recommendation = 'CF Worker → RPi works! Streaming should work through this path.';
        } else if (results.cloudflare?.success && !cfRpiConfigured) {
          recommendation = 'CF Worker works directly but no proxy configured. Set proxy secrets in CF worker for streaming.';
        } else if (results.vercel?.success) {
          if (results.hetznerProxy?.hetznerHealthy === false) {
            recommendation = 'Vercel works. Hetzner proxy unreachable - check if server is running.';
          } else if (!results.rpiProxy?.rpiHealthy) {
            recommendation = 'Vercel works but RPi unreachable. Try Hetzner VPS or check RPi tunnel.';
          } else {
            recommendation = 'Vercel works. For streaming, configure Hetzner or RPi proxy in CF worker.';
          }
        } else {
          recommendation = 'All sources failed - check portal URL and MAC address';
        }
        
        const summary = {
          vercelBlocked: !results.vercel?.success,
          cloudflareBlocked: !results.cloudflare?.success,
          rpiWorks: results.rpiProxy?.success === true,
          hetznerWorks: results.hetznerProxy?.success === true,
          cfUsedRpi,
          cfRpiConfigured,
          recommendation,
          note: 'Stream tokens are bound to the requesting IP. For streaming to work, ALL API calls (handshake, create_link) must come from the same IP that will stream.',
        };
        
        return NextResponse.json({ success: true, results, summary, testUrl });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}
