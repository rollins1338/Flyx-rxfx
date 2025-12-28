/**
 * CDN Live Stream Extractor API
 * 
 * Extracts m3u8 stream URLs from cdn-live.tv by reverse engineering
 * their obfuscated JavaScript player.
 * 
 * Usage:
 *   GET /api/livetv/cdnlive-stream?channel={channelName}&code={countryCode}
 *   GET /api/livetv/cdnlive-stream?eventId={eventId} (legacy)
 */

import { NextRequest, NextResponse } from 'next/server';
import { decodeStreamFromPlayer, getCDNLiveStreamUrl, getTokenTTL } from '@/app/lib/livetv/cdnlive-decoder';

export const runtime = 'nodejs';
export const maxDuration = 30;

const API_BASE = 'https://api.cdn-live.tv';
const CDN_LIVE_BASE = 'https://cdn-live.tv';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface CDNLiveChannel {
  name: string;
  code: string;
  url: string;
  image: string;
  status: string;
  viewers: number;
}

/**
 * Fetch channel list from CDN Live API
 */
async function fetchChannelList(): Promise<CDNLiveChannel[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': `${CDN_LIVE_BASE}/`,
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.channels || [];
  } catch {
    return [];
  }
}

/**
 * Find a channel by name (fuzzy match)
 */
function findChannel(channels: CDNLiveChannel[], searchName: string, countryCode?: string): CDNLiveChannel | null {
  const searchLower = searchName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // First try exact match with country code
  if (countryCode) {
    const exactMatch = channels.find(ch => 
      ch.name.toLowerCase().replace(/[^a-z0-9]/g, '') === searchLower &&
      ch.code.toLowerCase() === countryCode.toLowerCase()
    );
    if (exactMatch) return exactMatch;
  }
  
  // Try exact match without country code
  const exactMatch = channels.find(ch => 
    ch.name.toLowerCase().replace(/[^a-z0-9]/g, '') === searchLower
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match
  const partialMatch = channels.find(ch => 
    ch.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(searchLower) ||
    searchLower.includes(ch.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );
  if (partialMatch) return partialMatch;
  
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');
    const channel = searchParams.get('channel');
    const code = searchParams.get('code') || 'us';
    
    if (!eventId && !channel) {
      return NextResponse.json(
        { success: false, error: 'eventId or channel parameter is required' },
        { status: 400 }
      );
    }
    
    // If channel is provided, use the decoder
    if (channel) {
      // Fetch channel list to verify channel exists and get info
      const channels = await fetchChannelList();
      const foundChannel = channels.length > 0 ? findChannel(channels, channel, code) : null;
      
      // Check if channel is online (if we found it)
      if (foundChannel && foundChannel.status !== 'online') {
        return NextResponse.json({
          success: false,
          error: `Channel "${foundChannel.name}" is currently offline`,
          isLive: false,
          channelInfo: {
            name: foundChannel.name,
            code: foundChannel.code,
            status: foundChannel.status,
            viewers: foundChannel.viewers,
          },
        }, { status: 404 });
      }
      
      // Use the decoder to extract the stream URL
      const playerUrl = foundChannel?.url || 
        `${CDN_LIVE_BASE}/api/v1/channels/player/?name=${encodeURIComponent(channel.toLowerCase())}&code=${code}&user=cdnlivetv&plan=free`;
      
      const decoded = await decodeStreamFromPlayer(playerUrl);
      
      if (decoded.success && decoded.streamUrl) {
        // Calculate cache TTL based on token expiration
        const ttl = decoded.expiresAt ? Math.min(getTokenTTL(decoded.expiresAt), 3600) : 60;
        
        return NextResponse.json({
          success: true,
          streamUrl: decoded.streamUrl,
          channelId: decoded.channelId,
          method: 'deobfuscated',
          isLive: true,
          expiresAt: decoded.expiresAt,
          ttl,
          headers: {
            'Referer': 'https://cdn-live.tv/',
            'Origin': 'https://cdn-live.tv',
          },
          channelInfo: foundChannel ? {
            name: foundChannel.name,
            code: foundChannel.code,
            status: foundChannel.status,
            viewers: foundChannel.viewers,
          } : undefined,
        }, {
          headers: {
            'Cache-Control': `public, s-maxage=${Math.min(ttl, 300)}, stale-while-revalidate=${Math.min(ttl * 2, 600)}`,
          },
        });
      }
      
      // Decoding failed
      return NextResponse.json({
        success: false,
        error: decoded.error || 'Failed to decode stream URL',
        playerUrl,
        channelInfo: foundChannel ? {
          name: foundChannel.name,
          code: foundChannel.code,
          status: foundChannel.status,
          viewers: foundChannel.viewers,
        } : undefined,
      }, { status: 404 });
    }
    
    // Legacy eventId support
    if (eventId) {
      const decoded = await getCDNLiveStreamUrl(eventId, 'us');
      
      if (decoded.success && decoded.streamUrl) {
        const ttl = decoded.expiresAt ? Math.min(getTokenTTL(decoded.expiresAt), 3600) : 60;
        
        return NextResponse.json({
          success: true,
          streamUrl: decoded.streamUrl,
          channelId: decoded.channelId,
          method: 'deobfuscated',
          isLive: true,
          expiresAt: decoded.expiresAt,
          ttl,
          headers: {
            'Referer': 'https://cdn-live.tv/',
            'Origin': 'https://cdn-live.tv',
          },
        }, {
          headers: {
            'Cache-Control': `public, s-maxage=${Math.min(ttl, 300)}, stale-while-revalidate=${Math.min(ttl * 2, 600)}`,
          },
        });
      }
      
      return NextResponse.json({
        success: false,
        error: decoded.error || 'Could not extract stream for eventId',
        suggestion: 'Use ?channel=channelName&code=countryCode',
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid request',
    }, { status: 400 });
    
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
