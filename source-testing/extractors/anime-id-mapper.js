/**
 * Anime ID Mapper
 * 
 * Maps TMDB IDs to MAL/AniList IDs for anime content
 * 
 * Strategies:
 * 1. Use enc-dec.app kai database (search by title)
 * 2. Use AniList GraphQL API (search by title, returns both AniList + MAL IDs)
 * 3. Use arm.haglund.dev mapping API (direct TMDB→MAL mapping)
 */

const { db } = require('./index');

// ============ ANILIST GRAPHQL API ============

const ANILIST_API = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query ($search: String, $type: MediaType) {
  Media(search: $search, type: $type) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    format
    episodes
    seasonYear
    averageScore
  }
}
`;

const SEARCH_MULTI_QUERY = `
query ($search: String, $type: MediaType) {
  Page(page: 1, perPage: 10) {
    media(search: $search, type: $type) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      format
      episodes
      seasonYear
      averageScore
    }
  }
}
`;

async function searchAniList(title, type = 'ANIME') {
  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: SEARCH_MULTI_QUERY,
        variables: { search: title, type },
      }),
    });
    const data = await res.json();
    return data?.data?.Page?.media || [];
  } catch (e) {
    console.error('AniList search error:', e.message);
    return [];
  }
}

async function getAniListById(anilistId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english native }
        format
        episodes
        seasonYear
      }
    }
  `;
  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: anilistId } }),
    });
    const data = await res.json();
    return data?.data?.Media || null;
  } catch (e) {
    console.error('AniList fetch error:', e.message);
    return null;
  }
}

// ============ ARM MAPPING API ============
// https://arm.haglund.dev - maps between anime IDs

const ARM_API = 'https://arm.haglund.dev/api/v2/ids';

async function armLookup(source, id) {
  // source: anilist, mal, anidb, kitsu, thetvdb, themoviedb, imdb, livechart, notify
  try {
    const res = await fetch(`${ARM_API}?source=${source}&id=${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error('ARM lookup error:', e.message);
    return null;
  }
}

async function tmdbToMal(tmdbId) {
  const result = await armLookup('themoviedb', tmdbId);
  return result?.mal || null;
}

async function tmdbToAniList(tmdbId) {
  const result = await armLookup('themoviedb', tmdbId);
  return result?.anilist || null;
}

async function malToAniList(malId) {
  const result = await armLookup('mal', malId);
  return result?.anilist || null;
}

// ============ COMBINED MAPPER ============

/**
 * Get anime IDs from TMDB ID
 * Tries multiple sources to find MAL/AniList IDs
 * 
 * @param {string|number} tmdbId - TMDB ID
 * @param {string} title - Anime title (fallback for search)
 * @param {number} year - Release year (optional, helps matching)
 * @returns {Promise<{mal_id: number|null, anilist_id: number|null, title: string|null}>}
 */
async function getAnimeIds(tmdbId, title = null, year = null) {
  const result = { mal_id: null, anilist_id: null, title: null, source: null };
  
  // Strategy 1: Try ARM direct mapping (fastest if available)
  console.log(`[AnimeMapper] Trying ARM mapping for TMDB ${tmdbId}...`);
  const armResult = await armLookup('themoviedb', tmdbId);
  if (armResult) {
    result.mal_id = armResult.mal || null;
    result.anilist_id = armResult.anilist || null;
    if (result.mal_id || result.anilist_id) {
      result.source = 'arm';
      console.log(`[AnimeMapper] ARM found: MAL=${result.mal_id}, AniList=${result.anilist_id}`);
      
      // Get title from AniList if we have the ID
      if (result.anilist_id) {
        const anilistData = await getAniListById(result.anilist_id);
        result.title = anilistData?.title?.english || anilistData?.title?.romaji || null;
      }
      return result;
    }
  }
  
  // Strategy 2: Search by title on AniList
  if (title) {
    console.log(`[AnimeMapper] Searching AniList for "${title}"...`);
    const anilistResults = await searchAniList(title);
    
    if (anilistResults.length > 0) {
      // Try to find best match by year if provided
      let match = anilistResults[0];
      if (year) {
        const yearMatch = anilistResults.find(r => r.seasonYear === year);
        if (yearMatch) match = yearMatch;
      }
      
      result.anilist_id = match.id;
      result.mal_id = match.idMal;
      result.title = match.title?.english || match.title?.romaji;
      result.source = 'anilist_search';
      console.log(`[AnimeMapper] AniList found: MAL=${result.mal_id}, AniList=${result.anilist_id}`);
      return result;
    }
  }
  
  // Strategy 3: Search enc-dec kai database
  if (title) {
    console.log(`[AnimeMapper] Searching kai database for "${title}"...`);
    try {
      const kaiResults = await db.kai.search(title, null, year);
      if (kaiResults?.results?.length > 0) {
        const match = kaiResults.results[0];
        result.mal_id = match.mal_id || null;
        result.anilist_id = match.anilist_id || null;
        result.title = match.title || null;
        result.source = 'kai_db';
        console.log(`[AnimeMapper] Kai found: MAL=${result.mal_id}, AniList=${result.anilist_id}`);
        return result;
      }
    } catch (e) {
      console.log('[AnimeMapper] Kai search failed:', e.message);
    }
  }
  
  console.log(`[AnimeMapper] No IDs found for TMDB ${tmdbId}`);
  return result;
}

/**
 * Batch lookup - get anime IDs for multiple TMDB entries
 */
async function batchGetAnimeIds(entries) {
  // entries: [{ tmdbId, title, year }, ...]
  const results = [];
  for (const entry of entries) {
    const ids = await getAnimeIds(entry.tmdbId, entry.title, entry.year);
    results.push({ ...entry, ...ids });
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

module.exports = {
  // Main mapper
  getAnimeIds,
  batchGetAnimeIds,
  
  // Individual APIs
  anilist: {
    search: searchAniList,
    getById: getAniListById,
  },
  arm: {
    lookup: armLookup,
    tmdbToMal,
    tmdbToAniList,
    malToAniList,
  },
};
