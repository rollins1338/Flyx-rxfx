/**
 * Single Flixer Server Extraction API
 * 
 * Extracts from ONE specific Flixer server. The VideoPlayer fires 4 of these
 * in parallel from the client side, rendering each source as it arrives.
 * This gives progressive loading instead of waiting for all servers.
 * 
 * GET /api/stream/flixer-server?tmdbId=550&type=movie&server=alpha
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFlixerExtractUrl } from '@/app/lib/proxy-config';
import { getAnimeKaiProxyUrl } from '@/app/lib/proxy-config';
import { cfFetch } from '@/app/lib/utils/cf-fetch';

const SERVER_NAMES: Record<string, string> = {
  alpha: 'Ares',
  bravo: 'Balder',
  delta: 'Dionysus',
  echo: 'Eros',
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const params = request.nextUrl.searchParams;

  const tmdbId = params.get('tmdbId') || '';
  const type = params.get('type') as 'movie' | 'tv';
  const server = params.get('server') || 'alpha';
  const season = params.get('season') ? parseInt(params.get('season')!) : undefined;
  const episode = params.get('episode') ? parseInt(params.get('episode')!) : undefined;

  if (!tmdbId || !type || !server) {
    return NextResponse.json({ success: false, error: 'Missing required params' }, { status: 400 });
  }

  try {
    const extractUrl = getFlixerExtractUrl(tmdbId, type, server, season, episode);
    const response = await cfFetch(extractUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Server ${server} returned ${response.status}` });
    }

    const data = await response.json();

    if (data.success && data.sources?.length) {
      const source = data.sources[0];
      const displayName = SERVER_NAMES[server] || server;

      // Proxy the URL through /animekai route (residential proxy for Flixer CDN)
      const proxiedUrl = getAnimeKaiProxyUrl(source.url);

      return NextResponse.json({
        success: true,
        source: {
          quality: source.quality || 'auto',
          title: `Flixer ${displayName}`,
          url: proxiedUrl,
          directUrl: source.url,
          type: source.type || 'hls',
          referer: source.referer || '',
          requiresSegmentProxy: true,
          status: 'working',
          server,
        },
        executionTime: Date.now() - startTime,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json({
      success: false,
      error: data.error || `No sources from ${server}`,
      executionTime: Date.now() - startTime,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Extraction failed',
      executionTime: Date.now() - startTime,
    });
  }
}
