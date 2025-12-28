/**
 * Channel Information API
 * 
 * Provides detailed information about channels and their provider mappings.
 * Properly differentiates what channels are available on each provider.
 * 
 * GET /api/livetv/channel-info?id=<channelId>
 * GET /api/livetv/channel-info?search=<name>
 * GET /api/livetv/channel-info?category=<category>
 * GET /api/livetv/channel-info?provider=<provider>
 * GET /api/livetv/channel-info?stats=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { channelRouter } from '@/app/lib/livetv/channel-router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('id');
    const searchName = searchParams.get('search');
    const category = searchParams.get('category');
    const provider = searchParams.get('provider');
    const country = searchParams.get('country');
    const stats = searchParams.get('stats') === 'true';

    // Get channel statistics
    if (stats) {
      const channelStats = channelRouter.getChannelStats();
      const providers = channelRouter.getAvailableProviders();
      
      return NextResponse.json({
        success: true,
        stats: channelStats,
        providers,
        timestamp: new Date().toISOString(),
      });
    }

    // Get specific channel by ID
    if (channelId) {
      const channel = channelRouter.findChannelById(channelId);
      if (!channel) {
        return NextResponse.json({
          success: false,
          error: 'Channel not found',
          channelId,
        }, { status: 404 });
      }

      const providers = channelRouter.getChannelProviders(channelId);
      const optimalProvider = channelRouter.getOptimalProvider(channelId);

      return NextResponse.json({
        success: true,
        channel,
        providers,
        optimalProvider,
        urls: {
          dlhd: channel.providers.dlhd ? channelRouter.getProviderUrl(channelId, 'dlhd') : null,
          cdnlive: channel.providers.cdnlive ? channelRouter.getProviderUrl(channelId, 'cdnlive') : null,
          ppv: channel.providers.ppv ? channelRouter.getProviderUrl(channelId, 'ppv') : null,
        },
      });
    }

    // Search channels by name
    if (searchName) {
      const channels = channelRouter.findChannelsByName(searchName);
      return NextResponse.json({
        success: true,
        query: searchName,
        results: channels.length,
        channels,
      });
    }

    // Get channels by category
    if (category) {
      const channels = channelRouter.getChannelsByCategory(category);
      return NextResponse.json({
        success: true,
        category,
        results: channels.length,
        channels,
      });
    }

    // Get channels by provider
    if (provider) {
      if (!['dlhd', 'cdnlive', 'ppv'].includes(provider)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid provider. Must be: dlhd, cdnlive, or ppv',
        }, { status: 400 });
      }

      const channels = channelRouter.getChannelsByProvider(provider as any);
      const providerInfo = channelRouter.getProviderInfo(provider as any);
      
      return NextResponse.json({
        success: true,
        provider,
        providerInfo,
        results: channels.length,
        channels,
      });
    }

    // Get channels by country
    if (country) {
      const channels = channelRouter.getChannelsByCountry(country);
      return NextResponse.json({
        success: true,
        country,
        results: channels.length,
        channels,
      });
    }

    // Default: return usage information
    return NextResponse.json({
      success: true,
      message: 'Channel Information API',
      usage: {
        channelInfo: '/api/livetv/channel-info?id=51',
        search: '/api/livetv/channel-info?search=ESPN',
        category: '/api/livetv/channel-info?category=sports',
        provider: '/api/livetv/channel-info?provider=dlhd',
        country: '/api/livetv/channel-info?country=usa',
        stats: '/api/livetv/channel-info?stats=true',
      },
      providers: {
        dlhd: {
          description: 'Premium live TV channels (850+ channels)',
          specialization: 'General live TV, sports, entertainment, news',
          format: 'Numeric channel IDs (e.g., 51, 325)',
        },
        cdnlive: {
          description: 'Live sports events and premium channels',
          specialization: 'Live sports events, breaking news',
          format: 'Event IDs (e.g., ufc-301, nfl-game-123)',
        },
        ppv: {
          description: 'Pay-per-view events and premium content',
          specialization: 'PPV sports, premium movies, special events',
          format: 'URI names (e.g., boxing-event-1, ufc-fight-night)',
        },
      },
    });

  } catch (error) {
    console.error('[Channel Info API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}