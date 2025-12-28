/**
 * CDN Live Stream Extractor API
 * 
 * Extracts m3u8 stream URLs from cdn-live.tv embed pages.
 * Supports both event-based and channel-based streams.
 * 
 * Usage:
 *   GET /api/livetv/cdnlive-stream?eventId={eventId}
 *   GET /api/livetv/cdnlive-stream?channel={channelName}
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// CDN Live domains (they rotate domains frequently)
const CDN_LIVE_DOMAINS = [
  'cdn-live.tv',
  'cdn-live.me',
  'cdnlive.tv',
  'cdnlive.me',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface StreamResult {
  success: boolean;
  streamUrl?: string;
  method?: string;
  error?: string;
  isLive?: boolean;
  headers?: Record<string, string>;
}

/**
 * Try to extract m3u8 from embed page HTML
 */
function extractM3U8FromHTML(html: string): { url: string; method: string } | null {
  // Pattern 1: JWPlayer file config
  const jwPlayerPattern = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i;
  const jwMatch = html.match(jwPlayerPattern);
  if (jwMatch) {
    return { url: jwMatch[1], method: 'jwplayer' };
  }
  
  // Pattern 2: HLS.js source
  const hlsPattern = /hls\.loadSource\s*\(\s*["']([^"']+\.m3u8[^"']*)["']\s*\)/i;
  const hlsMatch = html.match(hlsPattern);
  if (hlsMatch) {
    return { url: hlsMatch[1], method: 'hlsjs' };
  }
  
  // Pattern 3: Video source tag
  const sourcePattern = /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i;
  const sourceMatch = html.match(sourcePattern);
  if (sourceMatch) {
    return { url: sourceMatch[1], method: 'source-tag' };
  }
  
  // Pattern 4: Base64 encoded URL (atob)
  const atobPattern = /atob\s*\(\s*["']([A-Za-z0-9+/=]+)["']\s*\)/g;
  let atobMatch;
  while ((atobMatch = atobPattern.exec(html)) !== null) {
    try {
      const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
      if (decoded.includes('.m3u8') || decoded.includes('m3u8')) {
        return { url: decoded, method: 'atob' };
      }
    } catch {
      // Continue to next match
    }
  }
  
  // Pattern 5: Generic m3u8 URL in page
  const genericPattern = /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/i;
  const genericMatch = html.match(genericPattern);
  if (genericMatch) {
    return { url: genericMatch[1], method: 'generic' };
  }
  
  // Pattern 6: Clappr player source
  const clapprPattern = /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i;
  const clapprMatch = html.match(clapprPattern);
  if (clapprMatch) {
    return { url: clapprMatch[1], method: 'clappr' };
  }
  
  return null;
}

/**
 * Fetch embed page and extract stream URL
 */
async function extractStream(embedUrl: string, referer: string): Promise<StreamResult> {
  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer,
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `Embed page returned ${response.status}` };
    }
    
    const html = await response.text();
    
    // Check for offline/not live indicators
    const offlinePatterns = [
      /stream.*offline/i,
      /not.*live/i,
      /coming.*soon/i,
      /event.*ended/i,
      /no.*stream/i,
    ];
    
    for (const pattern of offlinePatterns) {
      if (pattern.test(html)) {
        return { success: false, error: 'Stream is not currently live', isLive: false };
      }
    }
    
    // Try to extract m3u8 URL
    const extracted = extractM3U8FromHTML(html);
    
    if (extracted) {
      // Determine the correct referer for playback
      const urlObj = new URL(embedUrl);
      const playbackHeaders = {
        'Referer': `${urlObj.protocol}//${urlObj.host}/`,
        'Origin': `${urlObj.protocol}//${urlObj.host}`,
      };
      
      return {
        success: true,
        streamUrl: extracted.url,
        method: extracted.method,
        isLive: true,
        headers: playbackHeaders,
      };
    }
    
    // Check if there's an iframe to follow
    const iframePattern = /<iframe[^>]+src=["']([^"']+)["']/i;
    const iframeMatch = html.match(iframePattern);
    
    if (iframeMatch) {
      const iframeSrc = iframeMatch[1].startsWith('http') 
        ? iframeMatch[1] 
        : new URL(iframeMatch[1], embedUrl).href;
      
      // Recursively try the iframe URL
      return extractStream(iframeSrc, embedUrl);
    }
    
    return { success: false, error: 'Could not extract stream URL from embed page' };
    
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch embed page' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');
    const channel = searchParams.get('channel');
    
    if (!eventId && !channel) {
      return NextResponse.json(
        { success: false, error: 'eventId or channel parameter is required' },
        { status: 400 }
      );
    }
    
    // Try each domain until one works
    for (const domain of CDN_LIVE_DOMAINS) {
      const embedUrl = eventId 
        ? `https://${domain}/embed/${eventId}`
        : `https://${domain}/live/${channel}`;
      
      const referer = `https://${domain}/`;
      
      const result = await extractStream(embedUrl, referer);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          streamUrl: result.streamUrl,
          method: result.method,
          domain,
          isLive: result.isLive,
          headers: result.headers,
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        });
      }
      
      // If explicitly not live, don't try other domains
      if (result.isLive === false) {
        return NextResponse.json({
          success: false,
          error: result.error,
          isLive: false,
        }, { status: 404 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Could not extract stream from any CDN Live domain',
    }, { status: 404 });
    
  } catch (error: any) {
    console.error('[CDN Live Stream API] Error:', error);
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
