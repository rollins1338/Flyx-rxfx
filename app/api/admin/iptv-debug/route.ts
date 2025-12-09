import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

const REQUEST_TIMEOUT = 15000;

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
async function performHandshake(portalUrl: string, macAddress: string): Promise<string> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'stb');
  url.searchParams.set('action', 'handshake');
  url.searchParams.set('token', '');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), { 
      signal: controller.signal,
      headers: buildHeaders(macAddress),
    });
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

// Get account profile
async function getProfile(portalUrl: string, macAddress: string, token: string): Promise<any> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'stb');
  url.searchParams.set('action', 'get_profile');
  url.searchParams.set('hd', '1');
  url.searchParams.set('num_banks', '2');
  url.searchParams.set('stb_type', 'MAG250');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), { 
      signal: controller.signal,
      headers: buildHeaders(macAddress, token),
    });
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

// Get content count
async function getContentCount(portalUrl: string, macAddress: string, token: string, contentType: string): Promise<number> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', contentType);
  url.searchParams.set('action', 'get_ordered_list');
  url.searchParams.set('p', '0');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), { 
      signal: controller.signal,
      headers: buildHeaders(macAddress, token),
    });
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

// Get genres/categories
async function getGenres(portalUrl: string, macAddress: string, token: string, contentType: string): Promise<any[]> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', contentType);
  url.searchParams.set('action', 'get_genres');
  url.searchParams.set('JsHttpRequest', '1-xml');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), { 
      signal: controller.signal,
      headers: buildHeaders(macAddress, token),
    });
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

// Get channels list
async function getChannels(portalUrl: string, macAddress: string, token: string, genre: string = '*', page: number = 0): Promise<any> {
  const url = new URL('/portal.php', portalUrl);
  url.searchParams.set('type', 'itv');
  url.searchParams.set('action', 'get_ordered_list');
  url.searchParams.set('genre', genre);
  url.searchParams.set('p', page.toString());
  url.searchParams.set('JsHttpRequest', '1-xml');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), { 
      signal: controller.signal,
      headers: buildHeaders(macAddress, token),
    });
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
async function getStreamUrl(portalUrl: string, macAddress: string, token: string, cmd: string): Promise<{ streamUrl: string | null; rawResponse: any; requestUrl: string }> {
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
    const response = await fetch(requestUrl, { 
      signal: controller.signal,
      headers: buildHeaders(macAddress, token),
    });
    clearTimeout(timeoutId);
    
    const text = await response.text();
    // Handle Stalker's secure JSON wrapper
    const cleanText = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
    
    let data;
    try {
      data = JSON.parse(cleanText);
    } catch {
      return { streamUrl: null, rawResponse: { parseError: true, rawText: text.substring(0, 500) }, requestUrl };
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
    
    return { streamUrl, rawResponse: data, requestUrl };
  } catch (e) {
    clearTimeout(timeoutId);
    return { streamUrl: null, rawResponse: { error: String(e) }, requestUrl };
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
        const channels = await getChannels(normalizedUrl, macAddress, token, genre || '*', page || 0);
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
        const { streamUrl, rawResponse, requestUrl } = await getStreamUrl(normalizedUrl, macAddress, token, cmd);
        return NextResponse.json({ success: true, streamUrl, rawResponse, cmd, requestUrl });
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
