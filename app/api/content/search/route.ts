/**
 * Search Content API Route
 * GET /api/content/search
 * Returns search results with debouncing and caching
 */

import { NextRequest, NextResponse } from 'next/server';
import { tmdbService } from '@/lib/services/tmdb';
import { searchRateLimiter, getClientIP } from '@/lib/utils/api-rate-limiter';


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
    const contentType = searchParams.get('type') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const sessionId = searchParams.get('sessionId') || '';

    if (!query && !category) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Query or category is required',
        },
        { status: 400 }
      );
    }

    let searchResults: any[] = [];

    // Perform search based on type
    if (category) {
      // Category-based search
      searchResults = await tmdbService.searchByCategory(category, contentType as any, page);
    } else {
      // Regular text search
      searchResults = await tmdbService.search(query, page);
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
        // Don't fail the search if tracking fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: searchResults,
        count: searchResults.length,
        query: query || category,
        page,
        searchType: category ? 'category' : 'text'
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

    // Handle specific error types
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

    // Generic error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to perform search',
      },
      { status: 500 }
    );
  }
}
