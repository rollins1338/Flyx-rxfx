/**
 * Intelligent Watchlist Recommendations API
 * GET /api/recommendations/watchlist
 * 
 * Analyzes the user's watchlist to provide smart recommendations based on:
 * - Genre frequency analysis
 * - Similar content discovery
 * - Keyword matching
 * - Cast/crew overlap
 * - Rating and popularity weighting
 */

import { NextRequest, NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

// TMDB fetch options with Bearer token authentication
const tmdbOptions = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_API_KEY}`,
  },
};

interface WatchlistItem {
  id: number | string;
  mediaType: 'movie' | 'tv';
  title?: string;
}

interface GenreScore {
  id: number;
  name: string;
  count: number;
  weight: number;
}

interface RecommendedItem {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  mediaType: 'movie' | 'tv';
  matchScore: number;
  matchReasons: string[];
  primaryReason: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const watchlistItems: WatchlistItem[] = body.items || [];
    
    if (!watchlistItems.length) {
      return NextResponse.json({ success: true, recommendations: [] });
    }

    if (!TMDB_API_KEY) {
      return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    // Step 1: Fetch detailed info for all watchlist items
    const itemDetails = await fetchItemDetails(watchlistItems);
    
    // Step 2: Analyze genres and build preference profile
    const genreProfile = analyzeGenres(itemDetails);
    const topGenres = genreProfile.slice(0, 5);
    
    // Step 3: Collect keywords from watchlist items
    const keywords = await collectKeywords(itemDetails);
    
    // Step 4: Fetch recommendations from multiple sources
    const watchlistIds = new Set(watchlistItems.map(i => `${i.mediaType}-${i.id}`));
    const allRecommendations: RecommendedItem[] = [];
    
    // 4a: Get TMDB recommendations for each item (limited to top 3 by rating)
    const topRatedItems = [...itemDetails]
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 3);
    
    for (const item of topRatedItems) {
      const recs = await fetchTMDBRecommendations(item.id, item.mediaType);
      for (const rec of recs) {
        const key = `${rec.mediaType}-${rec.id}`;
        if (!watchlistIds.has(key)) {
          rec.matchReasons = [`Similar to "${item.title || item.name}"`];
          rec.primaryReason = `Because you added "${item.title || item.name}"`;
          allRecommendations.push(rec);
        }
      }
    }
    
    // 4b: Discover by top genres
    for (const genre of topGenres.slice(0, 3)) {
      const movieRecs = await discoverByGenre(genre.id, 'movie');
      const tvRecs = await discoverByGenre(genre.id, 'tv');
      
      for (const rec of [...movieRecs, ...tvRecs]) {
        const key = `${rec.mediaType}-${rec.id}`;
        if (!watchlistIds.has(key)) {
          rec.matchReasons = [`You like ${genre.name}`];
          rec.primaryReason = `Because you enjoy ${genre.name}`;
          allRecommendations.push(rec);
        }
      }
    }
    
    // 4c: Discover by keywords (if we have any)
    if (keywords.length > 0) {
      const topKeywords = keywords.slice(0, 3);
      for (const keyword of topKeywords) {
        const keywordRecs = await discoverByKeyword(keyword.id);
        for (const rec of keywordRecs) {
          const key = `${rec.mediaType}-${rec.id}`;
          if (!watchlistIds.has(key)) {
            rec.matchReasons = [`Related to "${keyword.name}"`];
            rec.primaryReason = `Because you like "${keyword.name}" content`;
            allRecommendations.push(rec);
          }
        }
      }
    }
    
    // Step 5: Score and deduplicate recommendations
    const scoredRecs = scoreRecommendations(allRecommendations, genreProfile, watchlistIds);
    
    // Step 6: Sort by score and take top results
    const finalRecs = scoredRecs
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 30);
    
    return NextResponse.json({
      success: true,
      recommendations: finalRecs,
      profile: {
        topGenres: topGenres.map(g => ({ name: g.name, count: g.count })),
        itemCount: watchlistItems.length,
      },
    });
    
  } catch (error) {
    console.error('[Recommendations API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

async function fetchItemDetails(items: WatchlistItem[]): Promise<any[]> {
  const details: any[] = [];
  
  // Fetch in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          const res = await fetch(
            `${TMDB_BASE}/${item.mediaType}/${item.id}?language=en-US`,
            tmdbOptions
          );
          if (res.ok) {
            const data = await res.json();
            return { ...data, mediaType: item.mediaType };
          }
        } catch (e) {
          console.error(`[Recommendations] Failed to fetch details for ${item.id}:`, e);
        }
        return null;
      })
    );
    details.push(...results.filter(Boolean));
  }
  
  return details;
}

function analyzeGenres(items: any[]): GenreScore[] {
  const genreCounts: Record<number, { name: string; count: number }> = {};
  
  for (const item of items) {
    const genres = item.genres || [];
    for (const genre of genres) {
      if (!genreCounts[genre.id]) {
        genreCounts[genre.id] = { name: genre.name, count: 0 };
      }
      genreCounts[genre.id].count++;
    }
  }
  
  const totalItems = items.length || 1;
  return Object.entries(genreCounts)
    .map(([id, data]) => ({
      id: parseInt(id),
      name: data.name,
      count: data.count,
      weight: data.count / totalItems,
    }))
    .sort((a, b) => b.count - a.count);
}

async function collectKeywords(items: any[]): Promise<Array<{ id: number; name: string; count: number }>> {
  const keywordCounts: Record<number, { name: string; count: number }> = {};
  
  // Fetch keywords for top 5 items
  const topItems = items.slice(0, 5);
  
  for (const item of topItems) {
    try {
      const res = await fetch(
        `${TMDB_BASE}/${item.mediaType}/${item.id}/keywords`,
        tmdbOptions
      );
      if (res.ok) {
        const data = await res.json();
        const keywords = data.keywords || data.results || [];
        for (const kw of keywords.slice(0, 10)) {
          if (!keywordCounts[kw.id]) {
            keywordCounts[kw.id] = { name: kw.name, count: 0 };
          }
          keywordCounts[kw.id].count++;
        }
      }
    } catch (e) {
      // Ignore keyword fetch errors
    }
  }
  
  return Object.entries(keywordCounts)
    .map(([id, data]) => ({ id: parseInt(id), name: data.name, count: data.count }))
    .filter(k => k.count >= 2) // Only keywords that appear in multiple items
    .sort((a, b) => b.count - a.count);
}

async function fetchTMDBRecommendations(id: number, mediaType: 'movie' | 'tv'): Promise<RecommendedItem[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/${mediaType}/${id}/recommendations?language=en-US&page=1`,
      tmdbOptions
    );
    if (res.ok) {
      const data = await res.json();
      return (data.results || []).slice(0, 10).map((item: any) => ({
        ...item,
        mediaType,
        matchScore: 0,
        matchReasons: [],
        primaryReason: '',
      }));
    }
  } catch (e) {
    console.error(`[Recommendations] Failed to fetch TMDB recs for ${id}:`, e);
  }
  return [];
}

async function discoverByGenre(genreId: number, mediaType: 'movie' | 'tv'): Promise<RecommendedItem[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/discover/${mediaType}?language=en-US&sort_by=popularity.desc&with_genres=${genreId}&vote_count.gte=100&page=1`,
      tmdbOptions
    );
    if (res.ok) {
      const data = await res.json();
      return (data.results || []).slice(0, 8).map((item: any) => ({
        ...item,
        mediaType,
        matchScore: 0,
        matchReasons: [],
        primaryReason: '',
      }));
    }
  } catch (e) {
    console.error(`[Recommendations] Failed to discover by genre ${genreId}:`, e);
  }
  return [];
}

async function discoverByKeyword(keywordId: number): Promise<RecommendedItem[]> {
  try {
    // Keywords work better with movies
    const res = await fetch(
      `${TMDB_BASE}/discover/movie?language=en-US&sort_by=popularity.desc&with_keywords=${keywordId}&vote_count.gte=50&page=1`,
      tmdbOptions
    );
    if (res.ok) {
      const data = await res.json();
      return (data.results || []).slice(0, 5).map((item: any) => ({
        ...item,
        mediaType: 'movie' as const,
        matchScore: 0,
        matchReasons: [],
        primaryReason: '',
      }));
    }
  } catch (e) {
    console.error(`[Recommendations] Failed to discover by keyword ${keywordId}:`, e);
  }
  return [];
}

function scoreRecommendations(
  recs: RecommendedItem[],
  genreProfile: GenreScore[],
  watchlistIds: Set<string>
): RecommendedItem[] {
  // Deduplicate by ID
  const seen = new Map<string, RecommendedItem>();
  
  for (const rec of recs) {
    const key = `${rec.mediaType}-${rec.id}`;
    
    // Skip if in watchlist
    if (watchlistIds.has(key)) continue;
    
    // Calculate match score
    let score = 0;
    const reasons: string[] = [];
    
    // Genre matching (up to 50 points)
    const recGenres = rec.genre_ids || [];
    for (const genreId of recGenres) {
      const profileGenre = genreProfile.find(g => g.id === genreId);
      if (profileGenre) {
        score += profileGenre.weight * 25;
        if (!reasons.includes(`Matches your ${profileGenre.name} preference`)) {
          reasons.push(`Matches your ${profileGenre.name} preference`);
        }
      }
    }
    
    // Rating bonus (up to 20 points)
    const rating = rec.vote_average || 0;
    if (rating >= 7) score += (rating - 5) * 4;
    
    // Popularity bonus (up to 15 points)
    const voteCount = rec.vote_count || 0;
    if (voteCount >= 1000) score += 15;
    else if (voteCount >= 500) score += 10;
    else if (voteCount >= 100) score += 5;
    
    // Recency bonus for newer content (up to 10 points)
    const releaseDate = rec.release_date || rec.first_air_date;
    if (releaseDate) {
      const year = new Date(releaseDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (year >= currentYear - 1) score += 10;
      else if (year >= currentYear - 3) score += 5;
    }
    
    rec.matchScore = score;
    rec.matchReasons = [...rec.matchReasons, ...reasons].slice(0, 3);
    
    // Keep the highest scored version if duplicate
    const existing = seen.get(key);
    if (!existing || rec.matchScore > existing.matchScore) {
      seen.set(key, rec);
    }
  }
  
  return Array.from(seen.values());
}
