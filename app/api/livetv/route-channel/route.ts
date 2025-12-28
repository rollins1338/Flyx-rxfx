/**
 * Channel Routing API
 * 
 * Intelligently routes channel requests to the correct provider.
 * Properly differentiates between DLHD, CDN-Live.tv, and PPV.to.
 * 
 * POST /api/livetv/route-channel
 * Body: { channelId: string, preferredProvider?: string }
 * 
 * Returns the optimal provider and stream URL for the requested channel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { channelRouter, getOptimalProvider, createChannelMapping } from '@/app/lib/livetv/channel-router';
import { getStreamWithFallback, LiveTVSourceType } from '@/app/lib/livetv/source-providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteChannelRequest {
  channelId: string;
  preferredProvider?: LiveTVSourceType;
  excludeProviders?: LiveTVSourceType[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteChannelRequest = await request.json();
    const { channelId, preferredProvider, excludeProviders } = body;

    if (!channelId) {
      return NextResponse.json({
        success: false,
        error: 'Missing channelId parameter',
        usage: {
          body: {
            channelId: 'string (required)',
            preferredProvider: 'dlhd | cdnlive | ppv (optional)',
            excludeProviders: 'array of providers to exclude (optional)',
          },
        },
      }, { status: 400 });
    }

    // Get channel information
    const channelInfo = channelRouter.findChannelById(channelId);
    if (!channelInfo) {
      // Check if it's a numeric DLHD channel
      if (/^\d+$/.test(channelId)) {
        const channelNum = parseInt(channelId);
        if (channelNum >= 1 && channelNum <= 850) {
          return NextResponse.json({
            success: true,
            channelId,
            provider: 'dlhd',
            providerId: channelId,
            streamUrl: `/tv/?channel=${channelId}`,
            channelInfo: {
              id: channelId,
              name: `DLHD Channel ${channelId}`,
              category: 'entertainment',
              country: 'usa',
              provider: 'dlhd',
            },
            routing: {
              reason: 'Numeric channel ID routed to DLHD',
              fallbackAvailable: false,
            },
          });
        }
      }

      return NextResponse.json({
        success: false,
        error: 'Channel not found',
        channelId,
        suggestion: 'Check channel ID format or use /api/livetv/channel-info for available channels',
      }, { status: 404 });
    }

    // Get optimal provider
    const optimalProvider = getOptimalProvider(channelId);
    if (!optimalProvider) {
      return NextResponse.json({
        success: false,
        error: 'No providers available for this channel',
        channelId,
        channelInfo,
      }, { status: 404 });
    }

    // Get all available providers for fallback
    const availableProviders = channelRouter.getChannelProviders(channelId);

    // Create channel mapping for stream fetching
    const channelMapping = createChannelMapping(channelId);

    // Get stream URL with fallback
    const streamResult = await getStreamWithFallback(channelMapping, {
      preferredSource: preferredProvider,
      excludeSources: excludeProviders,
    });

    if (!streamResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get stream from any provider',
        channelId,
        channelInfo,
        availableProviders,
        streamError: streamResult.error,
      }, { status: 502 });
    }

    // Determine which provider was used
    const usedProvider = streamResult.source;
    const usedProviderId = usedProvider in channelInfo.providers 
      ? channelInfo.providers[usedProvider as keyof typeof channelInfo.providers]
      : null;

    return NextResponse.json({
      success: true,
      channelId,
      provider: usedProvider,
      providerId: usedProviderId,
      streamUrl: streamResult.streamUrl,
      channelInfo: {
        ...channelInfo,
        provider: usedProvider,
      },
      routing: {
        optimalProvider: optimalProvider.provider,
        usedProvider,
        priority: optimalProvider.priority,
        fallbackAvailable: availableProviders.length > 1,
        availableProviders,
      },
      streamInfo: {
        headers: streamResult.headers,
        isLive: streamResult.isLive,
      },
    });

  } catch (error) {
    console.error('[Route Channel API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return NextResponse.json({
      success: true,
      message: 'Channel Routing API',
      usage: {
        post: {
          url: '/api/livetv/route-channel',
          body: {
            channelId: 'string (required)',
            preferredProvider: 'dlhd | cdnlive | ppv (optional)',
            excludeProviders: 'array of providers to exclude (optional)',
          },
        },
        get: '/api/livetv/route-channel?channelId=51',
      },
      providers: {
        dlhd: {
          route: '/tv/?channel=<id>',
          format: 'Numeric (1-850)',
          examples: ['51', '325', '100'],
          specialization: 'General live TV channels',
        },
        cdnlive: {
          route: '/cdn-live/stream?eventId=<id>',
          format: 'Event ID string',
          examples: ['ufc-301', 'nfl-game-123'],
          specialization: 'Live sports events',
        },
        ppv: {
          route: '/ppv/stream?uri=<id>',
          format: 'URI name string',
          examples: ['boxing-event-1', 'ufc-fight-night'],
          specialization: 'Pay-per-view events',
        },
      },
    });
  }

  // Handle GET request as simplified POST
  try {
    const body = { channelId };
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    return await POST(postRequest);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to process GET request',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}