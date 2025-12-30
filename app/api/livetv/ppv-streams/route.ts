/**
 * PPV.to Streams API
 * 
 * Returns all live events/streams from ppv.to organized by category.
 * Data is fetched from the ppv.to API and cached for 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // This route uses searchParams

const PPV_API_BASE = 'https://api.ppvs.su/api';

interface PPVStream {
  id: number;
  name: string;
  tag: string;
  poster: string;
  blurhash?: string;
  colors?: string[];
  uri_name: string;
  starts_at: number;
  ends_at: number;
  always_live: number | boolean;
  locale: string;
  category_name: string;
  iframe: string;
  viewers: string;
  substreams: any[];
}

interface PPVCategory {
  category: string;
  id: number;
  always_live: boolean;
  streams: PPVStream[];
}

interface PPVAPIResponse {
  success: boolean;
  timestamp: number;
  streams: PPVCategory[];
}

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  'American Football': '🏈',
  'Basketball': '🏀',
  'Combat Sports': '🥊',
  'Cricket': '🏏',
  'Darts': '🎯',
  'Football': '⚽',
  'Wrestling': '🤼',
  '24/7 Streams': '📺',
  'Tennis': '🎾',
  'Hockey': '🏒',
  'Baseball': '⚾',
  'Golf': '⛳',
  'Rugby': '🏉',
  'Motorsport': '🏎️',
  'default': '📺',
};

async function fetchPPVStreams(): Promise<PPVCategory[]> {
  const response = await fetch(`${PPV_API_BASE}/streams`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Origin': 'https://ppv.to',
      'Referer': 'https://ppv.to/',
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`PPV API error: ${response.status}`);
  }

  const data: PPVAPIResponse = await response.json();

  if (!data.success) {
    throw new Error('PPV API returned unsuccessful response');
  }

  return data.streams;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const liveOnly = searchParams.get('liveOnly') === 'true';
    const search = searchParams.get('search');

    const categories = await fetchPPVStreams();
    const now = Math.floor(Date.now() / 1000);

    // Transform and filter streams
    let transformedCategories = categories.map((cat) => {
      let streams = cat.streams.map((stream) => {
        const isLive = stream.always_live || 
          (stream.starts_at <= now && stream.ends_at >= now);
        
        return {
          id: stream.id,
          name: stream.name,
          tag: stream.tag,
          poster: stream.poster,
          blurhash: stream.blurhash,
          colors: stream.colors,
          uriName: stream.uri_name,
          startsAt: stream.starts_at,
          endsAt: stream.ends_at,
          isLive,
          isAlwaysLive: !!stream.always_live,
          viewers: stream.viewers,
          hasSubstreams: stream.substreams && stream.substreams.length > 0,
          substreamCount: stream.substreams?.length || 0,
        };
      });

      // Filter by live only
      if (liveOnly) {
        streams = streams.filter((s) => s.isLive);
      }

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        streams = streams.filter((s) => 
          s.name.toLowerCase().includes(searchLower) ||
          s.tag.toLowerCase().includes(searchLower)
        );
      }

      return {
        id: cat.id,
        name: cat.category,
        icon: CATEGORY_ICONS[cat.category] || CATEGORY_ICONS.default,
        isAlwaysLive: cat.always_live,
        streams,
        streamCount: streams.length,
      };
    });

    // Filter by category
    if (category && category !== 'all') {
      transformedCategories = transformedCategories.filter(
        (cat) => cat.name.toLowerCase() === category.toLowerCase()
      );
    }

    // Remove empty categories
    transformedCategories = transformedCategories.filter((cat) => cat.streamCount > 0);

    // Calculate stats
    const totalStreams = transformedCategories.reduce((sum, cat) => sum + cat.streamCount, 0);
    const liveStreams = transformedCategories.reduce(
      (sum, cat) => sum + cat.streams.filter((s) => s.isLive).length,
      0
    );

    return NextResponse.json({
      success: true,
      categories: transformedCategories,
      stats: {
        totalStreams,
        liveStreams,
        categoryCount: transformedCategories.length,
      },
      timestamp: Date.now(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error: any) {
    console.error('[PPV Streams API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch PPV streams' },
      { status: 500 }
    );
  }
}
