import { NextRequest, NextResponse } from 'next/server';
import { getMALAnimeEpisodes, type MALEpisode } from '@/lib/services/mal';

export const runtime = 'edge';

// Cache episodes for 1 hour
export const revalidate = 3600;

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
  
  try {
    // Fetch single page from Jikan API (100 episodes per page)
    const result = await getMALAnimeEpisodes(malIdNum, pageNum);
    
    return NextResponse.json({
      success: true,
      data: {
        malId: malIdNum,
        page: pageNum,
        totalPages: result.lastPage,
        hasNextPage: result.hasNextPage,
        episodes: result.episodes.map((ep: MALEpisode) => ({
          number: ep.mal_id,
          title: ep.title,
          titleJapanese: ep.title_japanese,
          aired: ep.aired,
          score: ep.score,
          filler: ep.filler,
          recap: ep.recap,
        })),
      },
    });
  } catch (error) {
    console.error('[MAL Episodes API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch episodes' }, { status: 500 });
  }
}
