/**
 * Check if content is anime
 * Uses TMDB to check if content has Animation genre (16) and is Japanese origin
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tmdbId = searchParams.get('tmdbId');
  const type = searchParams.get('type') as 'movie' | 'tv';

  if (!tmdbId || !type) {
    return NextResponse.json({ isAnime: false, error: 'Missing tmdbId or type' }, { status: 400 });
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ isAnime: false, error: 'TMDB API key not configured' });
    }

    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      return NextResponse.json({ isAnime: false });
    }

    const data = await response.json();

    // Check if it's anime:
    // 1. Has Animation genre (16)
    // 2. Origin country is Japan (JP) OR original language is Japanese (ja)
    const hasAnimationGenre = data.genres?.some((g: { id: number }) => g.id === 16) || false;
    const isJapaneseOrigin = data.origin_country?.includes('JP') || data.original_language === 'ja';

    const isAnime = hasAnimationGenre && isJapaneseOrigin;

    return NextResponse.json({
      isAnime,
      details: {
        hasAnimationGenre,
        isJapaneseOrigin,
        genres: data.genres?.map((g: { name: string }) => g.name) || [],
        originCountry: data.origin_country || [],
        originalLanguage: data.original_language,
      },
    });
  } catch (error) {
    console.error('[check-anime] Error:', error);
    return NextResponse.json({ isAnime: false, error: 'Failed to check anime status' });
  }
}
