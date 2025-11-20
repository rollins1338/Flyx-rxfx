/**
 * Search Content API Route
 * GET /api/content/search
 * Returns search results with debouncing and caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { tmdbService } from '@/lib/services/tmdb';
import { searchRateLimiter, getClientIP } from '@/lib/utils/api-rate-limiter';
import { GENRES } from '@/lib/constants/genres';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting (stricter for search to prevent abuse)
    const clientIP = getClientIP(request);
    const rateLimit = searchRateLimiter.checkLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Search rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const genre = searchParams.get('genre') || '';
    const contentType = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const sessionId = searchParams.get('sessionId') || '';

    let searchResults: any[] = [];

    if (!query && !category && !genre) {
      // If no search parameters, return trending content
      searchResults = await tmdbService.getTrending('all', 'week', page);
    }

    // Helper to get genre IDs from slug or ID string
    const getGenreIds = (genreParam: string): number[] => {
      // Check if it's a number (ID)
      if (/^\d+$/.test(genreParam)) {
        return [parseInt(genreParam)];
      }
      // Check if it's a slug
      const matchedGenres = GENRES.filter(g => g.slug === genreParam.toLowerCase() || g.name.toLowerCase() === genreParam.toLowerCase());
      return matchedGenres.map(g => g.id);
    };

    if (query) {
      // Regular text search
      searchResults = await tmdbService.search(query, page);

      // Filter by genre if specified
      if (genre) {
        const targetGenreIds = getGenreIds(genre);
        if (targetGenreIds.length > 0) {
          searchResults = searchResults.filter((item: any) => {
            const itemGenreIds = item.genre_ids || [];
            return itemGenreIds.some((id: number) => targetGenreIds.includes(id));
          });
        }
      }
    } else if (category) {
      // Category-based search (legacy/special categories)
      searchResults = await tmdbService.searchByCategory(category, contentType as any, page);
    } else if (genre) {
      // Genre-based discovery
      const targetGenreIds = getGenreIds(genre);

      if (targetGenreIds.length > 0) {
        const promises = [];

        // If specific type requested or 'all', fetch accordingly
        if (contentType === 'movie' || contentType === 'all') {
          // Find movie genre ID
          const movieGenreId = targetGenreIds.find(id => GENRES.find(g => g.id === id && g.type === 'movie'));
          // Fallback: use any ID if we can't distinguish (some IDs might be shared or we just have one)
          const idToUse = movieGenreId || targetGenreIds[0];
          if (idToUse) {
            promises.push(tmdbService.searchMoviesByGenre(idToUse, page));
          }
        }

        if (contentType === 'tv' || contentType === 'all') {
          // Find TV genre ID
          const tvGenreId = targetGenreIds.find(id => GENRES.find(g => g.id === id && g.type === 'tv'));
          const idToUse = tvGenreId || targetGenreIds[0];
          if (idToUse) {
            promises.push(tmdbService.searchTVByGenre(idToUse, page));
          }
        }

        const results = await Promise.all(promises);
        searchResults = results.flat().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      }
    } else if (contentType === 'person') {
      // Person-only search (if no query but type=person is set, which shouldn't happen often without query)
      // But if we have a query, it's handled in the first block.
      // This block is just a fallback if needed, but usually query + type=person is handled above.
    }

    // Track the search query for popular searches
    if (query && sessionId) {
      try {
        await fetch(`${request.nextUrl.origin}/api/search/popular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            sessionId,
            resultsCount: searchResults.length,
            clickedResult: false
          })
        });
      } catch (trackingError) {
        console.error('Failed to track search:', trackingError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: searchResults,
        count: searchResults.length,
        query: query || category || genre,
        page,
        searchType: category ? 'category' : genre ? 'genre' : 'text'
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    );
  } catch (error: any) {
    console.error('Search API error:', error);

    if (error.code === 'MISSING_API_KEY') {
      return NextResponse.json(
        {
          error: 'Configuration error',
          message: 'Service is not properly configured',
        },
        { status: 500 }
      );
    }

    if (error.statusCode === 404) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          count: 0,
          message: 'No results found',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to perform search',
      },
      { status: 500 }
    );
  }
}
