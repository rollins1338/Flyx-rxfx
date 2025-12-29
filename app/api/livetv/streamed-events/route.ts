/**
 * Streamed.pk Events API
 * 
 * Fetches sports events from streamed.pk API.
 * Returns events with stream sources for playback.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 120; // Cache for 2 minutes

const API_BASE = 'https://streamed.pk/api';

interface StreamedMatch {
  id: string;
  title: string;
  category: string;
  date: number;
  poster?: string;
  popular?: boolean;
  sources: Array<{
    source: string;
    id: string;
  }>;
}

interface StreamedSport {
  id: string;
  name: string;
}

const SPORT_ICONS: Record<string, string> = {
  football: '⚽',
  basketball: '🏀',
  'american-football': '🏈',
  hockey: '🏒',
  baseball: '⚾',
  'motor-sports': '🏎️',
  fight: '🥊',
  tennis: '🎾',
  rugby: '🏉',
  golf: '⛳',
  billiards: '🎱',
  afl: '🏉',
  darts: '🎯',
  cricket: '🏏',
  other: '📺',
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function isMatchLive(dateMs: number): boolean {
  const now = Date.now();
  const matchTime = dateMs;
  // Match is live if it started within the last 3 hours
  const threeHoursMs = 3 * 60 * 60 * 1000;
  return matchTime <= now && (now - matchTime) < threeHoursMs;
}

function formatMatchTime(dateMs: number): string {
  const date = new Date(dateMs);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport');
    const liveOnly = searchParams.get('live') === 'true';
    const search = searchParams.get('search');

    // Fetch all matches or specific sport
    let matches: StreamedMatch[];
    
    if (sport && sport !== 'all') {
      matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/${sport}`);
    } else {
      matches = await fetchJson<StreamedMatch[]>(`${API_BASE}/matches/all`);
    }

    // Filter live only
    if (liveOnly) {
      matches = matches.filter(m => isMatchLive(m.date));
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      matches = matches.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.category.toLowerCase().includes(searchLower)
      );
    }

    // Transform to our event format
    const events = matches.map(match => ({
      id: `streamed-${match.id}`,
      title: match.title,
      sport: match.category,
      time: formatMatchTime(match.date),
      isoTime: new Date(match.date).toISOString(),
      isLive: isMatchLive(match.date),
      source: 'streamed' as const,
      poster: match.poster,
      popular: match.popular,
      streamedId: match.id,
      streamedSources: match.sources,
      channels: match.sources.map((s, i) => ({
        name: `Stream ${i + 1} (${s.source})`,
        channelId: `${s.source}:${s.id}`,
        href: `/livetv/streamed/${match.id}`,
      })),
    }));

    // Sort by live status, then by date
    events.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.isoTime).getTime() - new Date(b.isoTime).getTime();
    });

    // Get category stats
    const categoryStats: Record<string, number> = {};
    for (const event of events) {
      categoryStats[event.sport] = (categoryStats[event.sport] || 0) + 1;
    }

    const categories = Object.entries(categoryStats)
      .map(([id, count]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
        icon: SPORT_ICONS[id] || '📺',
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      events,
      categories,
      stats: {
        total: events.length,
        live: events.filter(e => e.isLive).length,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });

  } catch (error: any) {
    console.error('[Streamed Events API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch events',
    }, { status: 500 });
  }
}
