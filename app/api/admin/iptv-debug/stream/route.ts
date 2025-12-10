import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

// RPi proxy configuration - REQUIRED for IPTV streams (datacenter IPs get blocked)
const RPI_PROXY_URL = process.env.RPI_PROXY_URL;
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY;

// STB Device Headers (only used as fallback if no RPi proxy)
const STB_USER_AGENT = 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';

function buildStreamHeaders(macAddress: string, token: string, referer?: string): Record<string, string> {
  const encodedMac = encodeURIComponent(macAddress);
  return {
    'User-Agent': STB_USER_AGENT,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Cookie': `mac=${encodedMac}; stb_lang=en; timezone=GMT`,
    'Authorization': `Bearer ${token}`,
    ...(referer ? { 'Referer': referer } : {}),
  };
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminAuth(request);
  if (!authResult.success) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const streamUrl = searchParams.get('url');
  const mac = searchParams.get('mac');
  const token = searchParams.get('token');

  if (!streamUrl || !mac || !token) {
    return NextResponse.json({ error: 'Missing url, mac, or token parameter' }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(streamUrl);
    
    // Extract referer from stream URL
    const urlObj = new URL(decodedUrl);
    const referer = `${urlObj.protocol}//${urlObj.host}/`;

    let response: Response;

    // Use RPi proxy if available (REQUIRED for production - datacenter IPs get blocked)
    if (RPI_PROXY_URL && RPI_PROXY_KEY) {
      console.log('[IPTV Stream] Using RPi proxy for residential IP');
      const rpiParams = new URLSearchParams({
        url: decodedUrl,
        mac: mac,
        token: token,
        key: RPI_PROXY_KEY,
      });
      
      response = await fetch(`${RPI_PROXY_URL}/iptv/stream?${rpiParams.toString()}`, {
        headers: {
          'X-API-Key': RPI_PROXY_KEY,
        },
      });
    } else {
      // Fallback to direct fetch (will likely fail in production due to IP blocking)
      console.warn('[IPTV Stream] No RPi proxy configured - direct fetch may be blocked');
      response = await fetch(decodedUrl, {
        headers: buildStreamHeaders(mac, token, referer),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[IPTV Stream] Fetch failed: ${response.status}`, errorText.substring(0, 200));
      return new NextResponse(`Stream fetch failed: ${response.status}`, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // For M3U8 playlists, we need to rewrite URLs to go through our proxy
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || decodedUrl.endsWith('.m3u8')) {
      const m3u8Content = await response.text();
      const rewrittenM3u8 = rewriteM3U8(m3u8Content, decodedUrl, mac, token, request.url);
      
      return new NextResponse(rewrittenM3u8, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For TS segments and other binary content, stream directly
    const body = response.body;
    
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[IPTV Stream] Proxy error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function rewriteM3U8(content: string, baseUrl: string, mac: string, token: string, proxyBaseUrl: string): string {
  const baseUrlObj = new URL(baseUrl);
  const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  
  // Get our proxy base URL
  const proxyUrl = new URL(proxyBaseUrl);
  const proxyBase = `${proxyUrl.protocol}//${proxyUrl.host}/api/admin/iptv-debug/stream`;

  // Rewrite each line
  const lines = content.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments (except URI in EXT-X-KEY)
    if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.includes('URI='))) {
      // Handle EXT-X-KEY with URI
      if (trimmedLine.includes('URI=')) {
        return rewriteKeyLine(trimmedLine, basePath, mac, token, proxyBase);
      }
      return line;
    }
    
    // Handle segment URLs
    if (!trimmedLine.startsWith('#')) {
      let segmentUrl = trimmedLine;
      
      // Make absolute URL if relative
      if (!segmentUrl.startsWith('http')) {
        if (segmentUrl.startsWith('/')) {
          segmentUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${segmentUrl}`;
        } else {
          segmentUrl = basePath + segmentUrl;
        }
      }
      
      // Proxy the segment
      return `${proxyBase}?url=${encodeURIComponent(segmentUrl)}&mac=${encodeURIComponent(mac)}&token=${encodeURIComponent(token)}`;
    }
    
    return line;
  });

  return rewrittenLines.join('\n');
}

function rewriteKeyLine(line: string, basePath: string, mac: string, token: string, proxyBase: string): string {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (!uriMatch) return line;
  
  let keyUrl = uriMatch[1];
  
  // Make absolute URL if relative
  if (!keyUrl.startsWith('http')) {
    if (keyUrl.startsWith('/')) {
      const baseUrlObj = new URL(basePath);
      keyUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${keyUrl}`;
    } else {
      keyUrl = basePath + keyUrl;
    }
  }
  
  const proxiedKeyUrl = `${proxyBase}?url=${encodeURIComponent(keyUrl)}&mac=${encodeURIComponent(mac)}&token=${encodeURIComponent(token)}`;
  return line.replace(/URI="[^"]+"/, `URI="${proxiedKeyUrl}"`);
}
