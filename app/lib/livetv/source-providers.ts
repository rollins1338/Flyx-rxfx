/**
 * Live TV Source Providers
 * 
 * Unified interface for multiple live TV sources with automatic fallback.
 * Sources: DLHD (primary), cdn-live.tv, ppv.to
 * 
 * Each provider implements the same interface for consistent handling.
 */

import { getTvPlaylistUrl } from '@/app/lib/proxy-config';

export type LiveTVSourceType = 'dlhd' | 'cdnlive' | 'ppv';

export interface StreamSource {
  type: LiveTVSourceType;
  name: string;
  priority: number;
  enabled: boolean;
}

export interface StreamResult {
  success: boolean;
  streamUrl?: string;
  source: LiveTVSourceType;
  headers?: Record<string, string>;
  error?: string;
  isLive?: boolean;
}

export interface ChannelMapping {
  dlhdId?: string;
  cdnliveId?: string;
  ppvUri?: string;
}

// Source configuration - order determines fallback priority
export const LIVE_TV_SOURCES: StreamSource[] = [
  { type: 'dlhd', name: 'DLHD', priority: 1, enabled: true },
  { type: 'cdnlive', name: 'CDN Live', priority: 2, enabled: true },
  { type: 'ppv', name: 'PPV.to', priority: 3, enabled: true },
];

/**
 * Get stream URL from DLHD
 * Uses getTvPlaylistUrl helper which respects NEXT_PUBLIC_USE_DLHD_PROXY setting
 */
export async function getDLHDStream(channelId: string, _cfProxyUrl?: string): Promise<StreamResult> {
  try {
    let streamUrl: string;
    
    try {
      // Use getTvPlaylistUrl helper for consistent proxy routing
      // Route is determined by NEXT_PUBLIC_USE_DLHD_PROXY: /tv or /dlhd
      streamUrl = getTvPlaylistUrl(channelId);
    } catch {
      // Fallback to Vercel API if CF proxy not configured
      streamUrl = `/api/dlhd-proxy?channel=${channelId}`;
    }
    
    return {
      success: true,
      streamUrl,
      source: 'dlhd',
    };
  } catch (error: any) {
    return {
      success: false,
      source: 'dlhd',
      error: error.message || 'Failed to get DLHD stream',
    };
  }
}

/**
 * Get stream URL from cdn-live.tv
 * 
 * cdn-live.tv provides embed URLs that need to be processed to extract m3u8
 * Format: https://cdn-live.tv/embed/{eventId} or https://cdn-live.tv/live/{channelName}
 */
export async function getCDNLiveStream(eventId: string): Promise<StreamResult> {
  try {
    // Call our API to extract the stream
    const response = await fetch(`/api/livetv/cdnlive-stream?eventId=${encodeURIComponent(eventId)}`);
    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        source: 'cdnlive',
        error: data.error || 'Failed to extract CDN Live stream',
      };
    }
    
    return {
      success: true,
      streamUrl: data.streamUrl,
      source: 'cdnlive',
      headers: data.headers,
      isLive: data.isLive,
    };
  } catch (error: any) {
    return {
      success: false,
      source: 'cdnlive',
      error: error.message || 'Failed to get CDN Live stream',
    };
  }
}

/**
 * Get stream URL from ppv.to
 */
export async function getPPVStream(uriName: string): Promise<StreamResult> {
  try {
    const response = await fetch(`/api/livetv/ppv-stream?uri=${encodeURIComponent(uriName)}`);
    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        source: 'ppv',
        error: data.error || 'Failed to extract PPV stream',
      };
    }
    
    return {
      success: true,
      streamUrl: data.streamUrl,
      source: 'ppv',
      headers: data.playbackHeaders,
    };
  } catch (error: any) {
    return {
      success: false,
      source: 'ppv',
      error: error.message || 'Failed to get PPV stream',
    };
  }
}

/**
 * Try multiple sources with automatic fallback
 */
export async function getStreamWithFallback(
  channelMapping: ChannelMapping,
  options?: {
    preferredSource?: LiveTVSourceType;
    cfProxyUrl?: string;
    excludeSources?: LiveTVSourceType[];
  }
): Promise<StreamResult> {
  const { preferredSource, cfProxyUrl, excludeSources = [] } = options || {};
  
  // Sort sources by priority, with preferred source first
  const sortedSources = [...LIVE_TV_SOURCES]
    .filter(s => s.enabled && !excludeSources.includes(s.type))
    .sort((a, b) => {
      if (preferredSource) {
        if (a.type === preferredSource) return -1;
        if (b.type === preferredSource) return 1;
      }
      return a.priority - b.priority;
    });
  
  const errors: string[] = [];
  
  for (const source of sortedSources) {
    let result: StreamResult;
    
    switch (source.type) {
      case 'dlhd':
        if (channelMapping.dlhdId) {
          result = await getDLHDStream(channelMapping.dlhdId, cfProxyUrl);
          if (result.success) return result;
          errors.push(`DLHD: ${result.error}`);
        }
        break;
        
      case 'cdnlive':
        if (channelMapping.cdnliveId) {
          result = await getCDNLiveStream(channelMapping.cdnliveId);
          if (result.success) return result;
          errors.push(`CDN Live: ${result.error}`);
        }
        break;
        
      case 'ppv':
        if (channelMapping.ppvUri) {
          result = await getPPVStream(channelMapping.ppvUri);
          if (result.success) return result;
          errors.push(`PPV: ${result.error}`);
        }
        break;
    }
  }
  
  return {
    success: false,
    source: 'dlhd',
    error: errors.length > 0 
      ? `All sources failed: ${errors.join('; ')}` 
      : 'No valid source mapping found',
  };
}
