/**
 * MAL-Based Anime Stream API
 * GET /api/anime/stream?malId=57658&episode=1&provider=hianime
 * GET /api/anime/stream?malId=4107 (for movies, no episode needed)
 * 
 * Supports providers: hianime (default), animekai (fallback)
 * If requested provider fails, automatically tries the other.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractAnimeKaiStreams } from '@/app/lib/services/animekai-extractor';
import { extractHiAnimeStreams } from '@/app/lib/services/hianime-extractor';
import { malService } from '@/lib/services/mal';
import { getAnimeKaiProxyUrl } from '@/app/lib/proxy-config';

type Provider = 'hianime' | 'animekai';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;

    const malId = searchParams.get('malId') ? parseInt(searchParams.get('malId')!) : undefined;
    const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
    const requestedProvider = (searchParams.get('provider') as Provider) || 'hianime';

    if (!malId) {
      return NextResponse.json(
        { error: 'MAL ID is required' },
        { status: 400 }
      );
    }

    console.log(`[ANIME-STREAM] Request: MAL ID ${malId}, Episode ${episode || 'N/A (movie)'}, Provider ${requestedProvider}`);

    // Get MAL anime info
    const anime = await malService.getById(malId);
    if (!anime) {
      return NextResponse.json(
        { error: 'Anime not found on MAL' },
        { status: 404 }
      );
    }

    const isMovie = anime.type === 'Movie';
    const title = anime.title_english || anime.title;
    console.log(`[ANIME-STREAM] Found anime: ${title} (type: ${anime.type}, episodes: ${anime.episodes})`);

    // TRY BOTH PROVIDERS IN PARALLEL - Get sub/dub from both HiAnime AND AnimeKai!
    console.log(`[ANIME-STREAM] Extracting from BOTH providers in parallel...`);
    
    const [hianimeResult, animekaiResult] = await Promise.allSettled([
      extractFromProvider('hianime', malId, title, anime, isMovie, episode),
      extractFromProvider('animekai', malId, title, anime, isMovie, episode),
    ]);

    // Collect all sources from both providers
    const allSources: Array<{
      quality: string;
      title: string;
      url: string;
      type: string;
      referer: string;
      requiresSegmentProxy: boolean;
      skipOrigin?: boolean;
      language?: string;
      skipIntro?: [number, number];
      skipOutro?: [number, number];
    }> = [];
    const allSubtitles: Array<{ label: string; url: string; language: string }> = [];
    const providersUsed: string[] = [];

    // Process HiAnime results
    if (hianimeResult.status === 'fulfilled' && hianimeResult.value?.success && hianimeResult.value.sources.length > 0) {
      console.log(`[ANIME-STREAM] ✅ HiAnime: ${hianimeResult.value.sources.length} sources`);
      hianimeResult.value.sources.forEach(source => {
        allSources.push({
          ...source,
          title: `${source.title} [HiAnime]`,
        });
      });
      if (hianimeResult.value.subtitles) {
        allSubtitles.push(...hianimeResult.value.subtitles);
      }
      providersUsed.push('hianime');
    } else {
      const error = hianimeResult.status === 'rejected' ? hianimeResult.reason?.message : hianimeResult.value?.error;
      console.log(`[ANIME-STREAM] ❌ HiAnime failed: ${error || 'No sources'}`);
    }

    // Process AnimeKai results
    if (animekaiResult.status === 'fulfilled' && animekaiResult.value?.success && animekaiResult.value.sources.length > 0) {
      console.log(`[ANIME-STREAM] ✅ AnimeKai: ${animekaiResult.value.sources.length} sources`);
      animekaiResult.value.sources.forEach(source => {
        allSources.push({
          ...source,
          url: getAnimeKaiProxyUrl(source.url), // AnimeKai needs residential proxy
          title: `${source.title} [AnimeKai]`,
        });
      });
      if (animekaiResult.value.subtitles) {
        allSubtitles.push(...animekaiResult.value.subtitles);
      }
      providersUsed.push('animekai');
    } else {
      const error = animekaiResult.status === 'rejected' ? animekaiResult.reason?.message : animekaiResult.value?.error;
      console.log(`[ANIME-STREAM] ❌ AnimeKai failed: ${error || 'No sources'}`);
    }

    // Return all sources from both providers
    if (allSources.length > 0) {
      const executionTime = Date.now() - startTime;
      console.log(`[ANIME-STREAM] ✅ SUCCESS: ${allSources.length} total sources from ${providersUsed.join(' + ')}`);
      
      return NextResponse.json({
        success: true,
        sources: allSources,
        subtitles: allSubtitles,
        providers: providersUsed,
        anime: {
          malId: anime.mal_id,
          title: anime.title,
          titleEnglish: anime.title_english,
          episodes: anime.episodes,
          type: anime.type,
        },
        executionTime,
      });
    }

    return NextResponse.json(
      { error: 'No streams found from any provider', success: false },
      { status: 404 }
    );
  } catch (error) {
    console.error('[ANIME-STREAM] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime stream', success: false },
      { status: 500 }
    );
  }
}

interface ExtractResult {
  success: boolean;
  sources: Array<{
    quality: string;
    title: string;
    url: string;
    type: string;
    referer: string;
    requiresSegmentProxy: boolean;
    skipOrigin?: boolean;
    language?: string;
    skipIntro?: [number, number];
    skipOutro?: [number, number];
  }>;
  subtitles?: Array<{ label: string; url: string; language: string }>;
  error?: string;
}

async function extractFromProvider(
  provider: Provider,
  malId: number,
  title: string,
  _anime: { type: string },
  isMovie: boolean,
  episode?: number,
): Promise<ExtractResult | null> {
  if (provider === 'hianime') {
    return extractHiAnimeStreams(
      malId,
      title,
      isMovie ? undefined : (episode || 1),
    );
  }

  if (provider === 'animekai') {
    return extractAnimeKaiStreams(
      '0',
      isMovie ? 'movie' : 'tv',
      isMovie ? undefined : 1,
      isMovie ? undefined : (episode || 1),
      malId,
      title,
    );
  }

  return null;
}
