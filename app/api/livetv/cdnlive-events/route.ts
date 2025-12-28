/**
 * CDN Live Events API
 * 
 * Note: CDN Live has changed their API structure. They no longer have
 * a public events/sports page that can be scraped. The main functionality
 * is now through their channels API.
 * 
 * This endpoint now returns channel data organized by category/sport
 * based on channel names and metadata.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 300; // Cache for 5 minutes

const API_BASE = 'https://api.cdn-live.tv';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Sport category icons
const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽',
  'football': '⚽',
  'basketball': '🏀',
  'tennis': '🎾',
  'hockey': '🏒',
  'baseball': '⚾',
  'american football': '🏈',
  'nfl': '🏈',
  'rugby': '🏉',
  'cricket': '🏏',
  'golf': '⛳',
  'boxing': '🥊',
  'mma': '🥊',
  'ufc': '🥊',
  'motorsport': '🏎️',
  'f1': '🏎️',
  'sports': '📺',
  'entertainment': '🎬',
  'news': '📰',
  'default': '📺',
};

// Keywords to categorize channels
const SPORT_KEYWORDS: Record<string, string[]> = {
  'soccer': ['soccer', 'football', 'premier', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'champions league', 'uefa', 'fifa'],
  'basketball': ['basketball', 'nba', 'ncaa basketball', 'wnba'],
  'american football': ['nfl', 'ncaa football', 'college football', 'espn'],
  'hockey': ['hockey', 'nhl', 'ice hockey'],
  'baseball': ['baseball', 'mlb'],
  'tennis': ['tennis', 'atp', 'wta', 'wimbledon', 'us open'],
  'cricket': ['cricket', 'ipl', 'test match'],
  'golf': ['golf', 'pga'],
  'boxing': ['boxing', 'fight'],
  'mma': ['mma', 'ufc', 'bellator'],
  'motorsport': ['f1', 'formula', 'nascar', 'motogp', 'racing'],
  'sports': ['sports', 'espn', 'fox sports', 'sky sports', 'bein', 'dazn'],
};

interface CDNLiveChannel {
  name: string;
  code: string;
  url: string;
  image: string;
  status: string;
  viewers: number;
}

interface CDNLiveEvent {
  id: string;
  title: string;
  sport: string;
  isLive: boolean;
  playerUrl: string;
  channel: CDNLiveChannel;
}

interface CDNLiveCategory {
  name: string;
  icon: string;
  events: CDNLiveEvent[];
}

/**
 * Categorize a channel based on its name
 */
function categorizeChannel(channel: CDNLiveChannel): string {
  const nameLower = channel.name.toLowerCase();
  
  for (const [category, keywords] of Object.entries(SPORT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'entertainment';
}

/**
 * Fetch channels from CDN Live API and organize as events
 */
async function fetchCDNLiveChannelsAsEvents(): Promise<CDNLiveCategory[]> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/channels/?user=cdnlivetv&plan=free`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://cdn-live.tv/',
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const channels: CDNLiveChannel[] = data.channels || [];
    
    // Group channels by category
    const categoryMap: Map<string, CDNLiveEvent[]> = new Map();
    
    for (const channel of channels) {
      const category = categorizeChannel(channel);
      
      const event: CDNLiveEvent = {
        id: `${channel.name.toLowerCase().replace(/\s+/g, '-')}-${channel.code}`,
        title: channel.name,
        sport: category,
        isLive: channel.status === 'online',
        playerUrl: channel.url,
        channel,
      };
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(event);
    }
    
    // Convert to array format and sort by viewer count
    return Array.from(categoryMap.entries())
      .map(([name, events]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        icon: SPORT_ICONS[name.toLowerCase()] || SPORT_ICONS.default,
        events: events.sort((a, b) => b.channel.viewers - a.channel.viewers),
      }))
      .sort((a, b) => {
        // Put sports categories first
        const aIsSport = Object.keys(SPORT_KEYWORDS).includes(a.name.toLowerCase());
        const bIsSport = Object.keys(SPORT_KEYWORDS).includes(b.name.toLowerCase());
        if (aIsSport && !bIsSport) return -1;
        if (!aIsSport && bIsSport) return 1;
        return b.events.length - a.events.length;
      });
  } catch (error) {
    console.error('[CDN Live Events] Error fetching channels:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const liveOnly = searchParams.get('liveOnly') === 'true';
    const search = searchParams.get('search');
    
    let categories = await fetchCDNLiveChannelsAsEvents();
    
    // Filter by category
    if (category && category !== 'all') {
      categories = categories.filter(
        cat => cat.name.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Filter events within categories
    categories = categories.map(cat => ({
      ...cat,
      events: cat.events.filter(event => {
        if (liveOnly && !event.isLive) return false;
        if (search) {
          const searchLower = search.toLowerCase();
          return event.title.toLowerCase().includes(searchLower) ||
                 event.sport.toLowerCase().includes(searchLower);
        }
        return true;
      }),
    })).filter(cat => cat.events.length > 0);
    
    // Calculate stats
    const totalEvents = categories.reduce((sum, cat) => sum + cat.events.length, 0);
    const liveEvents = categories.reduce(
      (sum, cat) => sum + cat.events.filter(e => e.isLive).length,
      0
    );
    
    return NextResponse.json({
      success: true,
      source: 'cdnlive',
      note: 'CDN Live now uses channel-based streaming. Events are derived from channel categories.',
      categories,
      stats: {
        totalEvents,
        liveEvents,
        categoryCount: categories.length,
      },
      timestamp: Date.now(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
    
  } catch (error: any) {
    console.error('[CDN Live Events API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch CDN Live events' },
      { status: 500 }
    );
  }
}
