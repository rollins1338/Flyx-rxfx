/**
 * MAL Info API Route
 * GET /api/content/mal-info
 * Fetches MyAnimeList data for anime content
 * 
 * Query params:
 * - tmdbId: TMDB ID of the content
 * - type: 'movie' | 'tv'
 * - title: Title to search for (optional, will fetch from TMDB if not provided)
 */

import { NextRequest, NextResponse } from 'next/server';
import { malService, type MALAnimeDetails } from '@/lib/services/mal';

// Simple in-memory cache for MAL data (survives across requests in same process)
const malCache = new Map<string, { data: MALAnimeDetails | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tmdbId = searchParams.get('tmdbId');
  const type = searchParams.get('type') as 'movie' | 'tv';
  let title = searchParams.get('title');

  if (!tmdbId || !type) {
    return NextResponse.json(
      { error: 'Missing required parameters: tmdbId and type' },
      { status: 400 }
    );
  }

  // Check cache first
  const cacheKey = `${tmdbId}-${type}`;
  const cached = malCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      success: true,
      data: cached.data,
      cached: true,
    });
  }

  try {
    // If no title provided, fetch from TMDB
    if (!title) {
      const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
      if (apiKey) {
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
        const tmdbResponse = await fetch(tmdbUrl);
        if (tmdbResponse.ok) {
          const tmdbData = await tmdbResponse.json();
          title = tmdbData.name || tmdbData.title;
        }
      }
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Could not determine title for MAL search' },
        { status: 400 }
      );
    }

    // Get MAL data
    const malData = await malService.getDataForTMDB(title, undefined, type);

    // Cache the result
    malCache.set(cacheKey, { data: malData, timestamp: Date.now() });

    if (!malData) {
      return NextResponse.json({
        success: false,
        error: 'No MAL match found',
        searchedTitle: title,
      });
    }

    return NextResponse.json({
      success: true,
      data: malData,
      cached: false,
    });
  } catch (error) {
    console.error('[mal-info] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MAL data' },
      { status: 500 }
    );
  }
}
