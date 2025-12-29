/**
 * PPV.to Stream Extractor API
 * 
 * Extracts the actual m3u8 stream URL from ppv.to embed pages.
 * The stream URL is base64-encoded in the embed page's JWPlayer setup.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const EMBED_BASE = 'https://pooembed.top';

interface StreamResult {
  success: boolean;
  streamUrl?: string;
  method?: string;
  error?: string;
  streamInfo?: {
    id: string;
    name: string;
    uriName: string;
  };
}

/**
 * Validate that a URL is actually an m3u8 stream URL, not an image or other garbage
 */
function isValidStreamUrl(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  
  // Must contain .m3u8
  if (!url.includes('.m3u8')) return false;
  
  // Must NOT be an image
  const imagePatterns = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', 'image', 'static.dzine', 'stylar_product'];
  for (const pattern of imagePatterns) {
    if (url.toLowerCase().includes(pattern)) return false;
  }
  
  return true;
}

/**
 * Extract m3u8 URL from embed page
 */
async function extractM3U8(uriName: string): Promise<StreamResult> {
  const embedUrl = `${EMBED_BASE}/embed/${uriName}`;

  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://ppv.to/',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Embed page returned ${response.status}` };
    }

    const html = await response.text();

    // Check for "not live" or "offline" messages first
    if (html.includes('not live') || html.includes('offline') || html.includes('coming soon') || 
        html.includes('Event has ended') || html.includes('not available') || html.includes('Stream Offline')) {
      return { success: false, error: 'Stream is not currently live' };
    }

    // Pattern 1: const src = atob("base64_string");
    const atobPattern = /const\s+src\s*=\s*atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/;
    const atobMatch = html.match(atobPattern);

    if (atobMatch) {
      const base64 = atobMatch[1];
      try {
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        if (isValidStreamUrl(decoded)) {
          return { success: true, streamUrl: decoded, method: 'atob' };
        }
      } catch {}
    }

    // Pattern 2: var src = atob("base64_string");
    const varAtobPattern = /var\s+src\s*=\s*atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/;
    const varAtobMatch = html.match(varAtobPattern);

    if (varAtobMatch) {
      const base64 = varAtobMatch[1];
      try {
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        if (isValidStreamUrl(decoded)) {
          return { success: true, streamUrl: decoded, method: 'atob_var' };
        }
      } catch {}
    }

    // Pattern 3: Direct file URL in JWPlayer setup
    const filePattern = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/;
    const fileMatch = html.match(filePattern);

    if (fileMatch && isValidStreamUrl(fileMatch[1])) {
      return { success: true, streamUrl: fileMatch[1], method: 'direct' };
    }

    // Pattern 4: source src attribute with m3u8
    const sourcePattern = /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i;
    const sourceMatch = html.match(sourcePattern);

    if (sourceMatch && isValidStreamUrl(sourceMatch[1])) {
      return { success: true, streamUrl: sourceMatch[1], method: 'source_tag' };
    }

    // Pattern 5: Look for any m3u8 URL in the page
    const m3u8Pattern = /["'](https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)["']/g;
    let m3u8Match;
    while ((m3u8Match = m3u8Pattern.exec(html)) !== null) {
      const url = m3u8Match[1];
      if (isValidStreamUrl(url)) {
        return { success: true, streamUrl: url, method: 'regex' };
      }
    }

    // Pattern 6: Look for poocloud.in or similar stream URLs
    const pooPattern = /["'](https?:\/\/[^"'\s<>]*poo[^"'\s<>]*\.m3u8[^"'\s<>]*)["']/gi;
    let pooMatch;
    while ((pooMatch = pooPattern.exec(html)) !== null) {
      const url = pooMatch[1];
      if (isValidStreamUrl(url)) {
        return { success: true, streamUrl: url, method: 'poocloud' };
      }
    }

    // Pattern 7: Look for base64 encoded URLs in data attributes
    const dataAttrPattern = /data-[a-z]+="([A-Za-z0-9+/=]{20,})"/gi;
    let dataMatch;
    while ((dataMatch = dataAttrPattern.exec(html)) !== null) {
      try {
        const decoded = Buffer.from(dataMatch[1], 'base64').toString('utf-8');
        if (isValidStreamUrl(decoded)) {
          return { success: true, streamUrl: decoded, method: 'data_attr' };
        }
      } catch {}
    }

    // If we got here, the stream is likely offline - the embed page exists but has no valid stream
    return { success: false, error: 'Stream is offline or not yet started - no valid m3u8 URL found' };

  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch embed page' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const uriName = searchParams.get('uri');
    const streamId = searchParams.get('id');
    const streamName = searchParams.get('name');

    if (!uriName) {
      return NextResponse.json(
        { success: false, error: 'URI parameter is required' },
        { status: 400 }
      );
    }

    const result = await extractM3U8(uriName);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          uriName,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      streamUrl: result.streamUrl,
      method: result.method,
      streamInfo: {
        id: streamId || uriName,
        name: streamName || uriName,
        uriName,
      },
      // Headers needed for playback
      playbackHeaders: {
        'Referer': 'https://pooembed.top/',
        'Origin': 'https://pooembed.top',
      },
    }, {
      headers: {
        // Short cache since streams can change
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });

  } catch (error: any) {
    console.error('[PPV Stream API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to extract stream' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
