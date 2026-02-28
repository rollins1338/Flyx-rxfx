import { NextRequest, NextResponse } from 'next/server';
import { type MALEpisode } from '@/lib/services/mal';

export const runtime = 'edge';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const malId = searchParams.get('malId');
  const page = searchParams.get('page') || '1';

  if (!malId) {
    return NextResponse.json({ success: false, error: 'Missing malId parameter' }, { status: 400 });
  }

  const malIdNum = parseInt(malId);
  const pageNum = parseInt(page);

  if (isNaN(malIdNum)) {
    return NextResponse.json({ success: false, error: 'Invalid malId parameter' }, { status: 400 });
  }

  if (isNaN(pageNum) || pageNum < 1) {
    return NextResponse.json({ success: false, error: 'Invalid page parameter' }, { status: 400 });
  }

  const jikanUrl = `${JIKAN_BASE_URL}/anime/${malIdNum}/episodes?page=${pageNum}`;

  // Try direct fetch first, then fall back to RPI proxy
  let data: any = null;

  // Attempt 1: Direct fetch to Jikan
  try {
    const response = await fetch(jikanUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      data = await response.json();
    } else {
      console.warn(`[MAL Episodes API] Direct Jikan fetch returned ${response.status}`);
    }
  } catch (err) {
    console.warn(`[MAL Episodes API] Direct Jikan fetch failed:`, err instanceof Error ? err.message : err);
  }

  // Attempt 2: Route through RPI proxy if direct failed
  if (!data) {
    try {
      const { cfFetch } = await import('@/lib/utils/cf-fetch');
      const response = await cfFetch(jikanUrl);
      if (response.ok) {
        data = await response.json();
      } else {
        console.error(`[MAL Episodes API] RPI proxy Jikan fetch returned ${response.status}`);
      }
    } catch (err) {
      console.error(`[MAL Episodes API] RPI proxy Jikan fetch failed:`, err instanceof Error ? err.message : err);
    }
  }

  // Both attempts failed — return error WITHOUT caching
  if (!data || !data.data) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Jikan API unavailable' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const episodes: MALEpisode[] = data.data || [];
  const hasNextPage = data.pagination?.has_next_page || false;
  const lastPage = data.pagination?.last_visible_page || 1;

  // Only cache successful responses
  return new NextResponse(
    JSON.stringify({
      success: true,
      data: {
        malId: malIdNum,
        page: pageNum,
        totalPages: lastPage,
        hasNextPage,
        episodes: episodes.map((ep: MALEpisode) => ({
          number: ep.mal_id,
          title: ep.title,
          titleJapanese: ep.title_japanese,
          aired: ep.aired,
          score: ep.score,
          filler: ep.filler,
          recap: ep.recap,
        })),
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    }
  );
}
