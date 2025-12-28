/**
 * CDN Live Events API
 * 
 * Fetches live sports events from cdn-live.tv
 * Returns events organized by category with stream availability.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 300; // Cache for 5 minutes

const CDN_LIVE_DOMAINS = [
  'cdn-live.tv',
  'cdn-live.me',
];

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
  'default': '📺',
};

interface CDNLiveEvent {
  id: string;
  title: string;
  time: string;
  isoTime?: string;
  sport: string;
  league?: string;
  teams?: { home: string; away: string };
  isLive: boolean;
  embedId: string;
  channels: { name: string; embedId: string }[];
}

interface CDNLiveCategory {
  name: string;
  icon: string;
  events: CDNLiveEvent[];
}

/**
 * Parse events from cdn-live.tv HTML
 */
function parseEventsFromHTML(html: string): CDNLiveCategory[] {
  const categories: Map<string, CDNLiveEvent[]> = new Map();
  
  // Pattern to match event blocks - adjust based on actual HTML structure
  // This is a generic pattern that should work with most sports streaming sites
  const eventPattern = /<div[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const titlePattern = /<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</i;
  const timePattern = /(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i;
  const livePattern = /\blive\b|🔴|●/i;
  const embedPattern = /embed\/([a-zA-Z0-9_-]+)/i;
  const sportPattern = /soccer|football|basketball|tennis|hockey|baseball|rugby|cricket|golf|boxing|mma|ufc|motorsport|f1|nfl/i;
  
  let match;
  while ((match = eventPattern.exec(html)) !== null) {
    const eventHtml = match[1];
    
    const titleMatch = eventHtml.match(titlePattern);
    const timeMatch = eventHtml.match(timePattern);
    const embedMatch = eventHtml.match(embedPattern);
    const sportMatch = eventHtml.match(sportPattern);
    const isLive = livePattern.test(eventHtml);
    
    if (titleMatch && embedMatch) {
      const title = titleMatch[1].trim();
      const time = timeMatch ? timeMatch[1] : '';
      const embedId = embedMatch[1];
      const sport = sportMatch ? sportMatch[0].toLowerCase() : 'sports';
      
      // Parse teams from title (e.g., "Team A vs Team B")
      let teams: { home: string; away: string } | undefined;
      const vsMatch = title.match(/(.+?)\s+(?:vs?\.?|@)\s+(.+)/i);
      if (vsMatch) {
        teams = { home: vsMatch[1].trim(), away: vsMatch[2].trim() };
      }
      
      const event: CDNLiveEvent = {
        id: embedId,
        title,
        time,
        sport,
        teams,
        isLive,
        embedId,
        channels: [{ name: 'CDN Live', embedId }],
      };
      
      const categoryName = sport.charAt(0).toUpperCase() + sport.slice(1);
      if (!categories.has(categoryName)) {
        categories.set(categoryName, []);
      }
      categories.get(categoryName)!.push(event);
    }
  }
  
  // Convert to array format
  return Array.from(categories.entries()).map(([name, events]) => ({
    name,
    icon: SPORT_ICONS[name.toLowerCase()] || SPORT_ICONS.default,
    events,
  }));
}

/**
 * Fetch events from cdn-live.tv
 */
async function fetchCDNLiveEvents(): Promise<CDNLiveCategory[]> {
  for (const domain of CDN_LIVE_DOMAINS) {
    try {
      const response = await fetch(`https://${domain}/`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (!response.ok) continue;
      
      const html = await response.text();
      const categories = parseEventsFromHTML(html);
      
      if (categories.length > 0) {
        return categories;
      }
    } catch (error) {
      console.error(`[CDN Live Events] Error fetching from ${domain}:`, error);
    }
  }
  
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const liveOnly = searchParams.get('liveOnly') === 'true';
    const search = searchParams.get('search');
    
    let categories = await fetchCDNLiveEvents();
    
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
