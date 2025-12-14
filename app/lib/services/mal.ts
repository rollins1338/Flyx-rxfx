/**
 * MyAnimeList (MAL) API Service
 * Fetches anime data from Jikan API (unofficial MAL API)
 * Used to get accurate season/episode information for anime
 */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// Rate limiting: Jikan has a 3 requests/second limit
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 350; // ms between requests

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

export interface MALAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  type: string; // TV, Movie, OVA, etc.
  episodes: number | null;
  status: string;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  synopsis: string | null;
  season: string | null;
  year: number | null;
  images: {
    jpg: { image_url: string; large_image_url: string };
    webp: { image_url: string; large_image_url: string };
  };
  aired: {
    from: string | null;
    to: string | null;
    string: string;
  };
  genres: Array<{ mal_id: number; name: string }>;
  studios: Array<{ mal_id: number; name: string }>;
}

export interface MALRelation {
  relation: string;
  entry: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
}

export interface MALSearchResult {
  mal_id: number;
  title: string;
  title_english: string | null;
  type: string;
  episodes: number | null;
  score: number | null;
  images: {
    jpg: { image_url: string; large_image_url: string };
  };
}

export interface MALSeason {
  malId: number;
  title: string;
  titleEnglish: string | null;
  episodes: number | null;
  score: number | null;
  members: number | null;
  type: string;
  status: string;
  aired: string;
  synopsis: string | null;
  imageUrl: string;
  seasonOrder: number; // Order in the series (1, 2, 3...)
}

export interface MALAnimeDetails {
  mainEntry: MALAnime;
  allSeasons: MALSeason[];
  totalEpisodes: number;
}

/**
 * Search for anime on MAL by title
 */
export async function searchMALAnime(query: string, limit: number = 10): Promise<MALSearchResult[]> {
  try {
    const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=${limit}&order_by=members&sort=desc`;
    const response = await rateLimitedFetch(url);
    
    if (!response.ok) {
      console.error('[MAL] Search failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[MAL] Search error:', error);
    return [];
  }
}

/**
 * Get anime details by MAL ID
 */
export async function getMALAnimeById(malId: number): Promise<MALAnime | null> {
  try {
    const url = `${JIKAN_BASE_URL}/anime/${malId}/full`;
    const response = await rateLimitedFetch(url);
    
    if (!response.ok) {
      console.error('[MAL] Get anime failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('[MAL] Get anime error:', error);
    return null;
  }
}

/**
 * Get anime relations (sequels, prequels, etc.)
 */
export async function getMALAnimeRelations(malId: number): Promise<MALRelation[]> {
  try {
    const url = `${JIKAN_BASE_URL}/anime/${malId}/relations`;
    const response = await rateLimitedFetch(url);
    
    if (!response.ok) {
      console.error('[MAL] Get relations failed:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('[MAL] Get relations error:', error);
    return [];
  }
}

/**
 * Find the best MAL match for a TMDB anime
 */
export async function findMALMatch(
  tmdbTitle: string,
  _tmdbYear?: number, // Reserved for future year-based filtering
  tmdbType?: 'movie' | 'tv'
): Promise<MALAnime | null> {
  // Clean up title for search
  const cleanTitle = tmdbTitle
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical info
    .replace(/\s*-\s*Season\s*\d+/gi, '') // Remove "- Season X"
    .replace(/\s*Season\s*\d+/gi, '') // Remove "Season X"
    .trim();
  
  const results = await searchMALAnime(cleanTitle, 15);
  
  if (results.length === 0) {
    // Try with original title
    const originalResults = await searchMALAnime(tmdbTitle, 10);
    if (originalResults.length === 0) return null;
    
    // Return best match by members
    const anime = await getMALAnimeById(originalResults[0].mal_id);
    return anime;
  }
  
  // Score each result
  const scoredResults = results.map(result => {
    let score = 0;
    
    // Title match
    const titleLower = cleanTitle.toLowerCase();
    const resultTitleLower = result.title.toLowerCase();
    const resultEnglishLower = result.title_english?.toLowerCase() || '';
    
    if (resultTitleLower === titleLower || resultEnglishLower === titleLower) {
      score += 100;
    } else if (resultTitleLower.includes(titleLower) || resultEnglishLower.includes(titleLower)) {
      score += 50;
    } else if (titleLower.includes(resultTitleLower) || titleLower.includes(resultEnglishLower)) {
      score += 30;
    }
    
    // Type match
    if (tmdbType === 'movie' && result.type === 'Movie') {
      score += 20;
    } else if (tmdbType === 'tv' && result.type === 'TV') {
      score += 20;
    }
    
    // Popularity bonus (more members = more likely correct)
    score += Math.min(result.score || 0, 10);
    
    return { result, score };
  });
  
  // Sort by score and get best match
  scoredResults.sort((a, b) => b.score - a.score);
  
  if (scoredResults.length > 0 && scoredResults[0].score > 20) {
    const anime = await getMALAnimeById(scoredResults[0].result.mal_id);
    return anime;
  }
  
  return null;
}

/**
 * Get all seasons/entries for an anime series
 * This handles cases like Bleach TYBW where MAL has multiple entries
 */
export async function getMALSeriesSeasons(malId: number): Promise<MALAnimeDetails | null> {
  try {
    // Get the main anime entry
    const mainAnime = await getMALAnimeById(malId);
    if (!mainAnime) return null;
    
    // Get relations to find all related entries
    const relations = await getMALAnimeRelations(malId);
    
    // Collect all related anime IDs (sequels, prequels, side stories that are TV)
    const relatedIds = new Set<number>();
    relatedIds.add(malId);
    
    const relevantRelations = ['Sequel', 'Prequel', 'Parent story', 'Side story'];
    
    for (const relation of relations) {
      if (relevantRelations.includes(relation.relation)) {
        for (const entry of relation.entry) {
          if (entry.type === 'anime') {
            relatedIds.add(entry.mal_id);
          }
        }
      }
    }
    
    // Fetch details for all related anime
    const allAnimePromises = Array.from(relatedIds).map(id => getMALAnimeById(id));
    const allAnimeResults = await Promise.all(allAnimePromises);
    const allAnime = allAnimeResults.filter((a): a is MALAnime => a !== null);
    
    // Filter to only TV series and sort by air date
    const tvSeries = allAnime
      .filter(a => a.type === 'TV' || a.type === 'ONA')
      .sort((a, b) => {
        const dateA = a.aired.from ? new Date(a.aired.from).getTime() : 0;
        const dateB = b.aired.from ? new Date(b.aired.from).getTime() : 0;
        return dateA - dateB;
      });
    
    // Convert to MALSeason format
    const seasons: MALSeason[] = tvSeries.map((anime, index) => ({
      malId: anime.mal_id,
      title: anime.title,
      titleEnglish: anime.title_english,
      episodes: anime.episodes,
      score: anime.score,
      members: anime.members,
      type: anime.type,
      status: anime.status,
      aired: anime.aired.string,
      synopsis: anime.synopsis,
      imageUrl: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
      seasonOrder: index + 1,
    }));
    
    // Calculate total episodes
    const totalEpisodes = seasons.reduce((sum, s) => sum + (s.episodes || 0), 0);
    
    return {
      mainEntry: mainAnime,
      allSeasons: seasons,
      totalEpisodes,
    };
  } catch (error) {
    console.error('[MAL] Get series seasons error:', error);
    return null;
  }
}

/**
 * Search and get full series info for a TMDB anime
 */
export async function getMALDataForTMDBAnime(
  tmdbTitle: string,
  tmdbYear?: number,
  tmdbType?: 'movie' | 'tv'
): Promise<MALAnimeDetails | null> {
  // Find the MAL match
  const match = await findMALMatch(tmdbTitle, tmdbYear, tmdbType);
  if (!match) return null;
  
  // Get all seasons for the series
  return getMALSeriesSeasons(match.mal_id);
}

export const malService = {
  search: searchMALAnime,
  getById: getMALAnimeById,
  getRelations: getMALAnimeRelations,
  findMatch: findMALMatch,
  getSeriesSeasons: getMALSeriesSeasons,
  getDataForTMDB: getMALDataForTMDBAnime,
};
