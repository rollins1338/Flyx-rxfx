/**
 * AnimeKai Extractor
 * Primary source for anime content
 * 
 * *** FULLY NATIVE - NO enc-dec.app DEPENDENCY! ***
 * - AnimeKai crypto: Native implementation (183 substitution tables)
 * - MegaUp decryption: Native implementation (pre-computed keystream)
 * 
 * Flow:
 * 1. Convert TMDB ID → MAL/AniList ID using ARM mapping API
 * 2. Search AnimeKai directly for the anime (get content_id/kai_id)
 * 3. Encrypt content_id (native) → fetch episodes list
 * 4. Parse HTML (native) → get episode token
 * 5. Encrypt token (native) → fetch servers list
 * 6. Parse HTML (native) → get server lid
 * 7. Encrypt lid (native) → fetch embed (encrypted)
 * 8. Decrypt (native) → get stream URL
 * 
 * All encryption/decryption is done natively using reverse-engineered algorithms.
 * HTML parsing is done with regex - no external API calls needed.
 */

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  skipOrigin?: boolean; // For MegaUp CDN - proxy should NOT send Origin/Referer headers
  status?: 'working' | 'down' | 'unknown';
  language?: string;
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  subtitles?: Array<{ label: string; url: string; language: string }>;
  error?: string;
}

interface ParsedEpisodeEntry {
  token: string;
  [key: string]: any;
}

// Episodes structure: { "1": { "1": { token: "..." } }, "2": { "1": { token: "..." } } }
type ParsedEpisodes = Record<string, Record<string, ParsedEpisodeEntry>>;

interface ParsedServerEntry {
  lid: string;
  name?: string;
  [key: string]: any;
}

// Servers structure: { sub: { "1": { lid: "...", name: "..." } }, dub: { ... } }
interface ParsedServers {
  sub?: Record<string, ParsedServerEntry>;
  dub?: Record<string, ParsedServerEntry>;
}

// API Configuration
// All crypto is native - no external API dependencies!
const KAI_AJAX = 'https://animekai.to/ajax';
const ARM_API = 'https://arm.haglund.dev/api/v2/ids';

/**
 * Fetch a URL through Cloudflare Worker → RPI residential proxy
 * Used for MegaUp CDN which blocks datacenter IPs
 * 
 * Flow: Vercel → Cloudflare Worker (/animekai) → RPI Proxy → MegaUp CDN
 */
// @ts-ignore - Reserved for future use
async function _fetchViaCfAnimeKaiProxy(
  targetUrl: string,
  options?: { timeout?: number }
): Promise<Response> {
  // Use the Cloudflare stream proxy URL with /animekai route
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;

  if (!cfProxyUrl) {
    console.log(`[AnimeKai] CF proxy not configured, falling back to direct fetch`);
    // Fall back to direct fetch (will likely fail with 403)
    return fetch(targetUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(options?.timeout || 10000),
    });
  }

  // Strip /stream suffix if present and use /animekai route
  // Pass the User-Agent so RPI proxy uses the same one we'll use for decryption
  const baseUrl = cfProxyUrl.replace(/\/stream\/?$/, '');
  const proxyUrl = `${baseUrl}/animekai?url=${encodeURIComponent(targetUrl)}&ua=${encodeURIComponent(HEADERS['User-Agent'])}`;

  console.log(`[AnimeKai] Fetching via CF→RPI proxy: ${targetUrl.substring(0, 60)}...`);

  // Server-side requests (no Origin/Referer) are now allowed by the CF Worker
  return fetch(proxyUrl, {
    signal: AbortSignal.timeout(options?.timeout || 15000),
  });
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Connection': 'keep-alive',
};


/**
 * Check if content is anime based on TMDB data
 */
export async function isAnimeContent(tmdbId: string, type: 'movie' | 'tv'): Promise<boolean> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) return false;

    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    
    // Check if it has Animation genre (16) AND is Japanese
    const hasAnimationGenre = data.genres?.some((g: { id: number }) => g.id === 16);
    const isJapanese = data.original_language === 'ja';
    
    return hasAnimationGenre && isJapanese;
  } catch {
    return false;
  }
}

/**
 * Encrypt text using native AnimeKai cipher
 * No external API dependency - fully reverse engineered
 */
import { encryptAnimeKai, decryptAnimeKai } from '../animekai-crypto';

function encrypt(text: string): string | null {
  try {
    return encryptAnimeKai(text);
  } catch (error) {
    console.log(`[AnimeKai] Native encryption error:`, error);
    return null;
  }
}

/**
 * Decrypt text using native AnimeKai cipher
 * No external API dependency - fully reverse engineered
 */
function decrypt(text: string): string | null {
  try {
    return decryptAnimeKai(text);
  } catch (error) {
    console.log(`[AnimeKai] Native decryption error:`, error);
    return null;
  }
}

/**
 * Parse episodes HTML natively
 * Extracts episode tokens from AnimeKai HTML response
 * 
 * HTML structure: <a num="1" token="xxx" langs="3">...</a>
 * Returns: { "1": { "1": { token: "xxx" } } }
 */
function parseEpisodesHtml(html: string): ParsedEpisodes | null {
  try {
    const episodes: ParsedEpisodes = {};
    
    // Match all episode links with num and token attributes
    const episodeRegex = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
    let match;
    
    while ((match = episodeRegex.exec(html)) !== null) {
      const [, num, token] = match;
      // AnimeKai uses season "1" for all episodes in the list
      if (!episodes['1']) episodes['1'] = {};
      episodes['1'][num] = { token };
    }
    
    // Also try alternate attribute order (token before num)
    const altRegex = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"[^>]*>/gi;
    while ((match = altRegex.exec(html)) !== null) {
      const [, token, num] = match;
      if (!episodes['1']) episodes['1'] = {};
      if (!episodes['1'][num]) {
        episodes['1'][num] = { token };
      }
    }
    
    return Object.keys(episodes).length > 0 ? episodes : null;
  } catch (error) {
    console.log(`[AnimeKai] Native episodes parse error:`, error);
    return null;
  }
}

/**
 * Parse servers HTML natively
 * Extracts server lids from AnimeKai HTML response
 * 
 * HTML structure: 
 * <div data-id="sub">
 *   <span class="server" data-sid="3" data-lid="xxx">Server 1</span>
 * </div>
 * 
 * Returns: { sub: { "1": { lid: "xxx", name: "Server 1" } }, dub: { ... } }
 */
function parseServersHtml(html: string): ParsedServers | null {
  try {
    const servers: ParsedServers = {};
    
    // Parse sub servers
    const subMatch = html.match(/<div[^>]*data-id="sub"[^>]*>([\s\S]*?)<\/div>/i);
    if (subMatch) {
      servers.sub = parseServerGroup(subMatch[1]);
    }
    
    // Parse dub servers
    const dubMatch = html.match(/<div[^>]*data-id="dub"[^>]*>([\s\S]*?)<\/div>/i);
    if (dubMatch) {
      servers.dub = parseServerGroup(dubMatch[1]);
    }
    
    return (servers.sub || servers.dub) ? servers : null;
  } catch (error) {
    console.log(`[AnimeKai] Native servers parse error:`, error);
    return null;
  }
}

/**
 * Parse a server group (sub or dub section)
 */
function parseServerGroup(html: string): Record<string, ParsedServerEntry> {
  const result: Record<string, ParsedServerEntry> = {};
  
  // Match server spans with data-lid attribute
  const serverRegex = /<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>([^<]*)<\/span>/gi;
  let match;
  let index = 1;
  
  while ((match = serverRegex.exec(html)) !== null) {
    const [, lid, name] = match;
    result[String(index)] = { 
      lid, 
      name: name.trim() || `Server ${index}` 
    };
    index++;
  }
  
  return result;
}

/**
 * Fetch JSON from AnimeKai AJAX endpoint
 */
async function getJson(url: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] Fetch failed: HTTP ${response.status} for ${url}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.log(`[AnimeKai] Fetch error for ${url}:`, error);
    return null;
  }
}


/**
 * Get anime IDs from TMDB ID using ARM mapping API
 * 
 * ARM API requires specifying the media type:
 * - For movies: source=themoviedb (default)
 * - For TV shows: source=tmdb (different endpoint!)
 */
async function getAnimeIds(tmdbId: string, type: 'movie' | 'tv' = 'tv'): Promise<{ mal_id: number | null; anilist_id: number | null }> {
  try {
    console.log(`[AnimeKai] Looking up anime IDs for TMDB ${tmdbId} (type: ${type})...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // ARM API uses different source names:
    // - "themoviedb" for movies
    // - "tmdb" for TV shows (yes, they're different!)
    // Actually, let's try both and see which one works
    const source = type === 'movie' ? 'themoviedb' : 'tmdb';
    
    let response = await fetch(`${ARM_API}?source=${source}&id=${tmdbId}`, {
      signal: controller.signal,
    });

    // If TV lookup fails, try the movie endpoint as fallback
    if (!response.ok && type === 'tv') {
      console.log(`[AnimeKai] ARM tmdb lookup failed, trying themoviedb...`);
      response = await fetch(`${ARM_API}?source=themoviedb&id=${tmdbId}`, {
        signal: AbortSignal.timeout(5000),
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] ARM lookup failed: HTTP ${response.status}`);
      return { mal_id: null, anilist_id: null };
    }

    const data = await response.json();
    console.log(`[AnimeKai] ARM result: MAL=${data.mal}, AniList=${data.anilist}`);
    
    return {
      mal_id: data.mal || null,
      anilist_id: data.anilist || null,
    };
  } catch (error) {
    console.log(`[AnimeKai] ARM lookup error:`, error);
    return { mal_id: null, anilist_id: null };
  }
}

/**
 * Get anime title from TMDB for fallback search
 */
async function getTmdbAnimeInfo(tmdbId: string, type: 'movie' | 'tv'): Promise<{ title: string; year: string } | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    const title = type === 'movie' ? data.title : data.name;
    const dateStr = type === 'movie' ? data.release_date : data.first_air_date;
    const year = dateStr ? dateStr.split('-')[0] : '';

    return { title, year };
  } catch {
    return null;
  }
}

/**
 * Get season name from TMDB
 * This is crucial for anime like Bleach where Season 2 is "Thousand-Year Blood War"
 */
async function getTmdbSeasonName(tmdbId: string, seasonNumber: number): Promise<string | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    // TMDB returns season name in the "name" field
    // e.g., "Thousand-Year Blood War" for Bleach Season 2
    const seasonName = data.name;
    
    // Skip generic names like "Season 2", "Specials", etc.
    if (seasonName && 
        !seasonName.toLowerCase().startsWith('season ') && 
        !seasonName.toLowerCase().startsWith('specials') &&
        seasonName.toLowerCase() !== `season ${seasonNumber}`) {
      console.log(`[AnimeKai] TMDB Season ${seasonNumber} name: "${seasonName}"`);
      return seasonName;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get episode counts for all seasons from TMDB
 * Used to calculate absolute episode numbers for anime with multiple TMDB seasons
 * but single AnimeKai entry (e.g., Dragon Ball Z has 9 TMDB seasons but 1 AnimeKai entry)
 */
async function getTmdbSeasonEpisodeCounts(tmdbId: string): Promise<Record<number, number> | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    if (!data.seasons || !Array.isArray(data.seasons)) return null;
    
    const counts: Record<number, number> = {};
    for (const season of data.seasons) {
      if (season.season_number > 0) { // Skip specials (season 0)
        counts[season.season_number] = season.episode_count || 0;
      }
    }
    
    console.log(`[AnimeKai] TMDB season episode counts:`, counts);
    return counts;
  } catch {
    return null;
  }
}

/**
 * Helper to normalize title for comparison
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim();
}

/**
 * Convert number to Roman numeral (for anime season naming)
 */
function toRomanNumeral(num: number): string {
  const romanNumerals: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

/**
 * Generate season search variants for a title
 * Anime sites use various naming conventions: "Title Season 2", "Title II", "Title 2nd Season", etc.
 */
function getSeasonSearchVariants(baseTitle: string, seasonNum: number): string[] {
  if (seasonNum <= 1) return [];
  
  const variants: string[] = [];
  
  // Roman numeral variants (most common for anime)
  const roman = toRomanNumeral(seasonNum);
  variants.push(`${baseTitle} ${roman}`);
  
  // Standard naming
  variants.push(`${baseTitle} Season ${seasonNum}`);
  variants.push(`${baseTitle} ${seasonNum}`);
  
  // Ordinal suffixes
  const ordinal = seasonNum === 2 ? '2nd' : seasonNum === 3 ? '3rd' : `${seasonNum}th`;
  variants.push(`${baseTitle} ${ordinal} Season`);
  
  // Part naming
  variants.push(`${baseTitle} Part ${seasonNum}`);
  
  return variants;
}

/**
 * Score how well a result matches the query
 * Higher score = better match
 */
function scoreMatch(resultTitle: string, query: string): number {
  const normalizedResult = normalizeTitle(resultTitle);
  const normalizedQuery = normalizeTitle(query);
  
  // Exact match (ignoring case/special chars)
  if (normalizedResult === normalizedQuery) return 100;
  
  // Result starts with query (e.g., "Jujutsu Kaisen" matches "Jujutsu Kaisen Season 2")
  if (normalizedResult.startsWith(normalizedQuery)) return 90;
  
  // Query starts with result (e.g., "Jujutsu Kaisen Season 2" matches "Jujutsu Kaisen")
  if (normalizedQuery.startsWith(normalizedResult)) return 85;
  
  // Result contains query as a whole word sequence
  if (normalizedResult.includes(normalizedQuery)) return 70;
  
  // Penalize results with extra words like "Movie", "Execution", "OVA", etc.
  const penaltyWords = ['movie', 'execution', 'ova', 'special', 'recap', 'summary'];
  let score = 50;
  for (const word of penaltyWords) {
    if (normalizedResult.includes(word) && !normalizedQuery.includes(word)) {
      score -= 20;
    }
  }
  
  return Math.max(score, 0);
}

/**
 * Search AnimeKai directly (no enc-dec.app dependency)
 * 
 * Flow:
 * 1. Search via AJAX endpoint → get watch URLs
 * 2. Fetch watch page → extract kai_id from data-id attribute
 */
async function searchAnimeKai(query: string, malId?: number | null): Promise<{ content_id: string; title: string; episodes?: ParsedEpisodes } | null> {
  try {
    // Search AnimeKai directly
    console.log(`[AnimeKai] Searching directly for: "${query}"`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const searchResponse = await fetch(`${KAI_AJAX}/anime/search?keyword=${encodeURIComponent(query)}`, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!searchResponse.ok) {
      console.log(`[AnimeKai] Search failed: HTTP ${searchResponse.status}`);
      return null;
    }

    const searchData = await searchResponse.json();
    const searchHtml = searchData.result?.html;
    
    if (!searchHtml) {
      console.log(`[AnimeKai] No search results HTML`);
      return null;
    }

    // Parse search results - extract slug and title
    const animeRegex = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*(?:data-jp="([^"]*)")?[^>]*>([^<]*)<\/h6>/gi;
    const results: Array<{ slug: string; jpTitle: string; enTitle: string }> = [];
    
    let match;
    while ((match = animeRegex.exec(searchHtml)) !== null) {
      const [, slug, jpTitle, enTitle] = match;
      results.push({ slug, jpTitle: jpTitle || '', enTitle: enTitle.trim() });
    }

    if (results.length === 0) {
      console.log(`[AnimeKai] No results found for "${query}"`);
      return null;
    }

    console.log(`[AnimeKai] Found ${results.length} results, scoring matches...`);

    // Score results and pick best match
    let bestResult = results[0];
    let bestScore = -1;
    
    for (const result of results) {
      const score = scoreMatch(result.enTitle, query);
      console.log(`[AnimeKai]   - "${result.enTitle}" score: ${score}`);
      
      if (score > bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }

    console.log(`[AnimeKai] Best match: "${bestResult.enTitle}" (score: ${bestScore})`);

    // Fetch the watch page to get kai_id
    const watchUrl = `https://animekai.to/watch/${bestResult.slug}`;
    console.log(`[AnimeKai] Fetching watch page: ${watchUrl}`);

    const watchController = new AbortController();
    const watchTimeoutId = setTimeout(() => watchController.abort(), 10000);

    const watchResponse = await fetch(watchUrl, {
      headers: HEADERS,
      signal: watchController.signal,
    });

    clearTimeout(watchTimeoutId);

    if (!watchResponse.ok) {
      console.log(`[AnimeKai] Watch page fetch failed: HTTP ${watchResponse.status}`);
      return null;
    }

    const watchHtml = await watchResponse.text();

    // First try to extract anime_id from syncData script (most reliable)
    let kaiId: string | null = null;
    const syncDataMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (syncDataMatch) {
      try {
        const syncData = JSON.parse(syncDataMatch[1]);
        if (syncData.anime_id) {
          kaiId = syncData.anime_id;
          console.log(`[AnimeKai] Found anime_id from syncData: ${kaiId}`);
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Fallback: Extract kai_id from data-id attribute (filter out common IDs)
    if (!kaiId) {
      const dataIdMatches = watchHtml.match(/data-id="([a-zA-Z0-9_-]{4,10})"/g) || [];
      const reservedIds = ['signin', 'report', 'request', 'anime', 'episode', 'sub', 'dub'];
      
      for (const match of dataIdMatches) {
        const id = match.match(/data-id="([^"]+)"/)?.[1];
        if (id && !reservedIds.includes(id.toLowerCase()) && id.length >= 4) {
          kaiId = id;
          break;
        }
      }
    }

    if (!kaiId) {
      console.log(`[AnimeKai] Could not extract kai_id from watch page`);
      return null;
    }

    // Optionally verify MAL ID matches if provided
    if (malId) {
      const malIdMatch = watchHtml.match(/data-mal-id="(\d+)"/);
      const pageMalId = malIdMatch ? parseInt(malIdMatch[1], 10) : 0;
      if (pageMalId && pageMalId !== malId) {
        console.log(`[AnimeKai] MAL ID mismatch: expected ${malId}, got ${pageMalId}`);
        // Continue anyway - the title match might still be correct
      }
    }

    console.log(`[AnimeKai] Found: "${bestResult.enTitle}" (kai_id: ${kaiId})`);
    return {
      content_id: kaiId,
      title: bestResult.enTitle || bestResult.jpTitle,
    };
  } catch (error) {
    console.log(`[AnimeKai] Search error:`, error);
    return null;
  }

}


/**
 * Get episodes list for an anime
 */
async function getEpisodes(contentId: string): Promise<ParsedEpisodes | null> {
  try {
    console.log(`[AnimeKai] Getting episodes for content_id: ${contentId}`);
    
    // Encrypt the content_id
    const encId = encrypt(contentId);
    if (!encId) {
      console.log(`[AnimeKai] Failed to encrypt content_id`);
      return null;
    }

    // Fetch episodes list
    const url = `${KAI_AJAX}/episodes/list?ani_id=${contentId}&_=${encId}`;
    const response = await getJson(url);
    
    if (!response || !response.result) {
      console.log(`[AnimeKai] No episodes response`);
      return null;
    }

    // Parse the HTML response using episodes-specific parser
    const parsed = parseEpisodesHtml(response.result);
    if (!parsed) {
      console.log(`[AnimeKai] Failed to parse episodes HTML`);
      return null;
    }

    console.log(`[AnimeKai] Got episodes:`, Object.keys(parsed));
    return parsed;
  } catch (error) {
    console.log(`[AnimeKai] Get episodes error:`, error);
    return null;
  }
}

/**
 * Get servers list for an episode
 */
async function getServers(token: string): Promise<ParsedServers | null> {
  try {
    console.log(`[AnimeKai] Getting servers for token: ${token.substring(0, 20)}...`);
    
    // Encrypt the token
    const encToken = encrypt(token);
    if (!encToken) {
      console.log(`[AnimeKai] Failed to encrypt token`);
      return null;
    }

    // Fetch servers list
    const url = `${KAI_AJAX}/links/list?token=${token}&_=${encToken}`;
    const response = await getJson(url);
    
    if (!response || !response.result) {
      console.log(`[AnimeKai] No servers response`);
      return null;
    }

    // Parse the HTML response using servers-specific parser
    const parsed = parseServersHtml(response.result);
    if (!parsed) {
      console.log(`[AnimeKai] Failed to parse servers HTML`);
      return null;
    }

    console.log(`[AnimeKai] Got servers - sub:`, parsed.sub ? Object.keys(parsed.sub) : 'none', 'dub:', parsed.dub ? Object.keys(parsed.dub) : 'none');
    return parsed;
  } catch (error) {
    console.log(`[AnimeKai] Get servers error:`, error);
    return null;
  }
}

/**
 * Decrypt MegaUp embed URL to get actual HLS stream
 * MegaUp embeds (/e/...) need to be decrypted to get the .m3u8 URL
 * 
 * Correct flow:
 * 1. Extract video ID from embed URL
 * 2. Call /media/{videoId} to get encrypted stream data
 * 3. Extract stream URL from page (no enc-dec.app dependency)
 */
async function decryptMegaUpEmbed(embedUrl: string): Promise<string | null> {
  // Use manual extraction directly - no enc-dec.app dependency
  return await extractMegaUpSourcesManually(embedUrl);
}

/**
 * Unpack p,a,c,k,e,d JavaScript
 * Many embed pages use this obfuscation
 */
// @ts-ignore - Reserved for future use
function _unpackPACKED(packed: string): string {
  // Match the packed function pattern - use [\s\S] instead of . with /s flag for compatibility
  const packedMatch = packed.match(/eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]*?\}?\('([^']+)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/);
  
  if (!packedMatch) {
    return packed;
  }
  
  const [, p, aStr, cStr, keywords] = packedMatch;
  const base = parseInt(aStr);
  const count = parseInt(cStr);
  const keywordList = keywords.split('|');
  
  // Build replacement function
  const unbaser = (n: number): string => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (n < base) {
      return n < 36 ? chars[n] : String.fromCharCode(n + 29);
    }
    return unbaser(Math.floor(n / base)) + unbaser(n % base);
  };
  
  // Replace all encoded tokens
  let result = p;
  for (let i = count - 1; i >= 0; i--) {
    if (keywordList[i]) {
      const token = unbaser(i);
      result = result.replace(new RegExp(`\\b${token}\\b`, 'g'), keywordList[i]);
    }
  }
  
  return result;
}

/**
 * Manually extract sources from MegaUp embed page
 * Uses /media/ endpoint + native decryption (no enc-dec.app dependency)
 * 
 * IMPORTANT: MegaUp blocks datacenter IPs (Vercel, Cloudflare, AWS, etc.)
 * We route the /media/ API call through the Cloudflare Worker -> RPI residential proxy
 */
async function extractMegaUpSourcesManually(embedUrl: string): Promise<string | null> {
  try {
    // Import native MegaUp decryption
    const { decryptMegaUp, MEGAUP_USER_AGENT } = await import('../megaup-crypto');
    
    // Extract video ID and base URL from embed URL
    // e.g., https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCQ
    const urlMatch = embedUrl.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
    if (!urlMatch) {
      console.log(`[AnimeKai] Invalid MegaUp embed URL format`);
      return null;
    }
    
    const [, host, videoId] = urlMatch;
    const baseUrl = `https://${host}`;
    const mediaUrl = `${baseUrl}/media/${videoId}`;
    
    console.log(`[AnimeKai] Fetching MegaUp /media/ endpoint: ${mediaUrl}`);
    
    // MegaUp blocks datacenter IPs - we need to route through residential proxy
    // Use the Cloudflare Worker's /animekai route which forwards to RPI proxy
    const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
    
    let mediaResponse: Response;
    
    if (cfProxyUrl) {
      // Route through Cloudflare Worker -> RPI residential proxy
      const proxyBaseUrl = cfProxyUrl.replace(/\/stream\/?$/, '');
      const proxiedMediaUrl = `${proxyBaseUrl}/animekai?url=${encodeURIComponent(mediaUrl)}&ua=${encodeURIComponent(MEGAUP_USER_AGENT)}&referer=${encodeURIComponent(embedUrl)}`;
      
      console.log(`[AnimeKai] Routing MegaUp /media/ through residential proxy...`);
      
      mediaResponse = await fetch(proxiedMediaUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
    } else {
      // Fallback: Direct fetch (will likely fail due to datacenter IP blocking)
      console.log(`[AnimeKai] WARNING: No CF proxy configured, trying direct fetch (may fail)...`);
      
      mediaResponse = await fetch(mediaUrl, {
        headers: {
          'User-Agent': MEGAUP_USER_AGENT,
          'Referer': embedUrl,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
    }
    
    if (!mediaResponse.ok) {
      console.log(`[AnimeKai] MegaUp /media/ failed: HTTP ${mediaResponse.status}`);
      // Log response body for debugging
      try {
        const errorText = await mediaResponse.text();
        console.log(`[AnimeKai] MegaUp error response:`, errorText.substring(0, 200));
      } catch {}
      return null;
    }
    
    const mediaData = await mediaResponse.json();
    
    if (mediaData.status !== 200 || !mediaData.result) {
      console.log(`[AnimeKai] MegaUp /media/ returned no result:`, mediaData);
      return null;
    }
    
    console.log(`[AnimeKai] Got encrypted media data (${mediaData.result.length} chars), decrypting natively...`);
    
    // Decrypt using native implementation (no enc-dec.app!)
    const decrypted = decryptMegaUp(mediaData.result);
    
    // Parse the decrypted result
    let streamData: any;
    try {
      streamData = JSON.parse(decrypted);
    } catch (e) {
      console.log(`[AnimeKai] MegaUp decryption produced invalid JSON:`, decrypted.substring(0, 100));
      return null;
    }
    
    // Extract stream URL
    let streamUrl = '';
    if (streamData.sources && streamData.sources[0]) {
      streamUrl = streamData.sources[0].file || streamData.sources[0].url || '';
    } else if (streamData.file) {
      streamUrl = streamData.file;
    } else if (streamData.url) {
      streamUrl = streamData.url;
    }
    
    if (streamUrl) {
      console.log(`[AnimeKai] ✓ Got MegaUp stream URL (native decrypt):`, streamUrl.substring(0, 80));
      return streamUrl;
    }
    
    console.log(`[AnimeKai] No stream URL in decrypted data:`, streamData);
    return null;
  } catch (error) {
    console.log(`[AnimeKai] MegaUp extraction error:`, error);
    return null;
  }
}

/**
 * Decrypt RapidShare embed URL to get actual HLS stream
 * Uses manual extraction - no enc-dec.app dependency
 */
async function decryptRapidShareEmbed(embedUrl: string): Promise<string | null> {
  try {
    console.log(`[AnimeKai] Decrypting RapidShare embed: ${embedUrl}`);
    
    // Use manual extraction (same approach as MegaUp)
    return await extractMegaUpSourcesManually(embedUrl);
  } catch (error) {
    console.log(`[AnimeKai] RapidShare decrypt error:`, error);
    return null;
  }
}

/**
 * Get stream URL from a server
 */
async function getStreamFromServer(lid: string, serverName: string): Promise<StreamSource | null> {
  try {
    console.log(`[AnimeKai] Getting stream from server ${serverName} (lid: ${lid.substring(0, 20)}...)`);
    
    // Encrypt the lid
    const encLid = encrypt(lid);
    if (!encLid) {
      console.log(`[AnimeKai] Failed to encrypt lid`);
      return null;
    }

    // Fetch embed data
    const url = `${KAI_AJAX}/links/view?id=${lid}&_=${encLid}`;
    const response = await getJson(url);
    
    if (!response || !response.result) {
      console.log(`[AnimeKai] No embed response`);
      return null;
    }

    // Decrypt the response
    let decrypted = decrypt(response.result);
    if (!decrypted) {
      console.log(`[AnimeKai] Failed to decrypt embed`);
      return null;
    }

    // Decode }XX format (AnimeKai's custom URL encoding)
    // }7B = {, }22 = ", }3A = :, etc.
    decrypted = decrypted.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => 
      String.fromCharCode(parseInt(hex, 16))
    );

    // Parse the decrypted data
    let streamData: any;
    try {
      streamData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
    } catch {
      // If it's not JSON, it might be a direct URL
      if (typeof decrypted === 'string' && decrypted.startsWith('http')) {
        streamData = { url: decrypted };
      } else {
        console.log(`[AnimeKai] Failed to parse decrypted data:`, decrypted.substring(0, 100));
        return null;
      }
    }

    // Extract stream URL
    let streamUrl = '';
    if (streamData.url) {
      streamUrl = streamData.url;
    } else if (streamData.sources && streamData.sources[0]) {
      streamUrl = streamData.sources[0].url || streamData.sources[0].file || '';
    } else if (streamData.file) {
      streamUrl = streamData.file;
    }

    if (!streamUrl) {
      console.log(`[AnimeKai] No stream URL in decrypted data:`, streamData);
      return null;
    }

    console.log(`[AnimeKai] ✓ Got URL from ${serverName}:`, streamUrl);

    // Check if this is an embed URL that needs further decryption
    // MegaUp embeds have /e/ in the path and are NOT direct HLS streams
    if (streamUrl.includes('megaup') && streamUrl.includes('/e/')) {
      console.log(`[AnimeKai] Detected MegaUp embed URL, decrypting to get HLS stream...`);
      const hlsUrl = await decryptMegaUpEmbed(streamUrl);
      if (hlsUrl) {
        streamUrl = hlsUrl;
        console.log(`[AnimeKai] ✓ Got HLS stream from MegaUp:`, streamUrl.substring(0, 100));
      } else {
        // MegaUp extraction failed - do NOT return embed URL as it's not playable
        console.log(`[AnimeKai] MegaUp extraction failed - cannot play embed URL directly`);
        return null;
      }
    }
    // RapidShare embeds also need decryption
    else if (streamUrl.includes('rapid') && streamUrl.includes('/e/')) {
      console.log(`[AnimeKai] Detected RapidShare embed URL, decrypting...`);
      const hlsUrl = await decryptRapidShareEmbed(streamUrl);
      if (hlsUrl) {
        streamUrl = hlsUrl;
        console.log(`[AnimeKai] ✓ Got HLS stream from RapidShare:`, streamUrl.substring(0, 100));
      } else {
        // RapidShare extraction failed - do NOT return embed URL
        console.log(`[AnimeKai] RapidShare extraction failed - cannot play embed URL directly`);
        return null;
      }
    }
    // Check if URL is already a direct stream (m3u8 or mp4)
    else if (!streamUrl.includes('.m3u8') && !streamUrl.includes('.mp4') && streamUrl.includes('/e/')) {
      console.log(`[AnimeKai] Unknown embed type, trying generic extraction...`);
      const hlsUrl = await extractMegaUpSourcesManually(streamUrl);
      if (hlsUrl) {
        streamUrl = hlsUrl;
        console.log(`[AnimeKai] ✓ Got stream from generic extraction:`, streamUrl.substring(0, 100));
      } else {
        console.log(`[AnimeKai] Failed to extract from unknown embed type`);
        return null;
      }
    }

    // Extract the proper referer from the stream URL's origin
    // MegaUp and similar servers require their own domain as referer, not animekai.to
    let referer = 'https://animekai.to/';
    try {
      const streamOrigin = new URL(streamUrl).origin;
      // Use the stream's origin as referer - this is what the server expects
      referer = streamOrigin + '/';
      console.log(`[AnimeKai] Using referer from stream origin: ${referer}`);
    } catch {
      console.log(`[AnimeKai] Could not parse stream URL, using default referer`);
    }

    // MegaUp CDN URLs (app28base.site, hub26link.site, megaup.cc) MUST be proxied
    // because browser XHR adds Origin header which MegaUp blocks with 403.
    // The Cloudflare Worker will fetch WITHOUT Origin header (noreferer mode).
    const isMegaUpCdn = streamUrl.includes('megaup') || 
                        streamUrl.includes('hub26link') || 
                        streamUrl.includes('app28base');
    
    if (isMegaUpCdn) {
      console.log(`[AnimeKai] MegaUp CDN detected - will proxy with noreferer mode`);
    }

    return {
      quality: 'auto',
      title: `AnimeKai - ${serverName}`,
      url: streamUrl,
      type: 'hls',
      referer,
      // MegaUp CDN MUST be proxied - browser adds Origin header which causes 403
      // Cloudflare Worker fetches without Origin header
      requiresSegmentProxy: true,
      // Flag to tell proxy to skip Origin/Referer headers (MegaUp blocks them)
      skipOrigin: isMegaUpCdn,
      status: 'working',
      language: 'ja',
    };
  } catch (error) {
    console.log(`[AnimeKai] Get stream error:`, error);
    return null;
  }
}


/**
 * Main extraction function for AnimeKai
 * 
 * @param tmdbId - TMDB ID of the content
 * @param type - 'movie' or 'tv'
 * @param season - Season number (TMDB)
 * @param episode - Episode number (TMDB - may need conversion for MAL split seasons)
 * @param malId - Optional MAL ID for direct lookup (used when TMDB season is split into multiple MAL entries)
 * @param malTitle - Optional MAL title for the specific entry
 */
export async function extractAnimeKaiStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  malId?: number,
  malTitle?: string
): Promise<ExtractionResult> {
  console.log(`[AnimeKai] Extracting streams for ${type} TMDB ID ${tmdbId}, S${season || 1}E${episode || 1}...`);
  if (malId) {
    console.log(`[AnimeKai] MAL override: ID=${malId}, Title="${malTitle}"`);
  }

  try {
    // Step 1: Get anime IDs (MAL/AniList) from TMDB ID
    const animeIds = await getAnimeIds(tmdbId, type);
    
    // Step 2: Get title from TMDB for fallback search
    const tmdbInfo = await getTmdbAnimeInfo(tmdbId, type);
    
    if (!animeIds.mal_id && !animeIds.anilist_id && !tmdbInfo) {
      console.log('[AnimeKai] Could not identify anime');
      return {
        success: false,
        sources: [],
        error: 'Could not identify anime - no MAL/AniList ID or title found',
      };
    }

    // Step 3: Search AnimeKai database to get content_id (and episodes if available)
    // IMPORTANT: Anime sites typically list each season as a SEPARATE anime entry
    // So we need to search for "Title Season X" for seasons > 1
    const seasonNum = season || 1;
    const baseTitle = tmdbInfo?.title || '';
    
    // For seasons > 1, get the TMDB season name first (e.g., "Thousand-Year Blood War" for Bleach S2)
    let tmdbSeasonName: string | null = null;
    if (seasonNum > 1 && type === 'tv') {
      tmdbSeasonName = await getTmdbSeasonName(tmdbId, seasonNum);
    }
    
    // Build search variants - prioritize TMDB season name if available
    const seasonSearchVariants: string[] = [];
    
    if (tmdbSeasonName) {
      // Try the full title with season name: "Bleach: Thousand-Year Blood War"
      seasonSearchVariants.push(`${baseTitle}: ${tmdbSeasonName}`);
      seasonSearchVariants.push(`${baseTitle} ${tmdbSeasonName}`);
      // Also try just the season name alone (some anime are listed this way)
      seasonSearchVariants.push(tmdbSeasonName);
      // Try without hyphens (some databases don't use them)
      const noHyphens = tmdbSeasonName.replace(/-/g, ' ');
      if (noHyphens !== tmdbSeasonName) {
        seasonSearchVariants.push(`${baseTitle} ${noHyphens}`);
        seasonSearchVariants.push(noHyphens);
      }
    }
    
    // Add standard season variants
    seasonSearchVariants.push(...getSeasonSearchVariants(baseTitle, seasonNum));
    
    console.log(`[AnimeKai] Searching with: title="${baseTitle}", MAL ID=${animeIds.mal_id}, season=${seasonNum}`);
    if (tmdbSeasonName) {
      console.log(`[AnimeKai] TMDB Season name: "${tmdbSeasonName}"`);
    }
    if (seasonSearchVariants.length > 0) {
      console.log(`[AnimeKai] Season search variants:`, seasonSearchVariants);
    }
    
    let animeResult: { content_id: string; title: string; episodes?: ParsedEpisodes } | null = null;
    
    // If we have a specific MAL title (from MAL split), search for it FIRST
    // This handles cases like Bleach TYBW where TMDB S2 is split into 3 MAL entries
    if (malTitle) {
      console.log(`[AnimeKai] MAL title provided - searching for: "${malTitle}"`);
      
      // Try the MAL title directly
      animeResult = await searchAnimeKai(malTitle, malId || null);
      
      if (!animeResult) {
        // Try variations of the MAL title
        const malTitleVariants = [
          malTitle.replace(/:/g, ''), // Remove colons
          malTitle.replace(/-/g, ' '), // Replace hyphens with spaces
          malTitle.split(':').pop()?.trim() || malTitle, // Just the subtitle
        ];
        
        for (const variant of malTitleVariants) {
          if (variant !== malTitle) {
            console.log(`[AnimeKai] Trying MAL title variant: "${variant}"`);
            animeResult = await searchAnimeKai(variant, null);
            if (animeResult) {
              console.log(`[AnimeKai] ✓ Found with MAL title variant: "${animeResult.title}"`);
              break;
            }
          }
        }
      } else {
        console.log(`[AnimeKai] ✓ Found with MAL title: "${animeResult.title}"`);
      }
    }
    
    // For seasons > 1, ALWAYS try season-specific search FIRST (if MAL title didn't work)
    // This is because anime sites list each season as a separate entry
    if (!animeResult && seasonNum > 1 && seasonSearchVariants.length > 0) {
      console.log(`[AnimeKai] Season ${seasonNum} requested - trying season-specific search first...`);
      
      for (const variant of seasonSearchVariants) {
        console.log(`[AnimeKai] Trying: "${variant}"`);
        const variantResult = await searchAnimeKai(variant, null);
        if (variantResult) {
          console.log(`[AnimeKai] ✓ Found season-specific entry: "${variantResult.title}"`);
          animeResult = variantResult;
          break;
        }
      }
      
      // If no season-specific entry found, fall back to base title search
      // (in case the anime uses absolute episode numbering)
      // NOTE: Don't use MAL ID first because it maps to the original anime, not the season
      if (!animeResult) {
        console.log(`[AnimeKai] No season-specific entry found, trying base title (without MAL ID)...`);
        animeResult = await searchAnimeKai(baseTitle, null);
        
        // If still not found and we have a MAL ID, try with it as last resort
        if (!animeResult && animeIds.mal_id) {
          console.log(`[AnimeKai] Still not found, trying with MAL ID as last resort...`);
          animeResult = await searchAnimeKai(baseTitle, animeIds.mal_id);
        }
      }
    } else {
      // Season 1 or no season specified - search normally
      animeResult = await searchAnimeKai(baseTitle, animeIds.mal_id);
    }

    if (!animeResult) {
      console.log('[AnimeKai] Anime not found in database');
      return {
        success: false,
        sources: [],
        error: 'Anime not found in AnimeKai database',
      };
    }

    // IMPORTANT: Log what we found to verify it's the right anime!
    console.log(`[AnimeKai] *** FOUND ANIME: "${animeResult.title}" (content_id: ${animeResult.content_id}) ***`);
    console.log(`[AnimeKai] *** EXPECTED: "${tmdbInfo?.title}" ***`);
    
    // Warn if titles don't match (might be wrong anime!)
    if (tmdbInfo?.title && !animeResult.title.toLowerCase().includes(tmdbInfo.title.toLowerCase().split(' ')[0])) {
      console.warn(`[AnimeKai] ⚠️ WARNING: Found title "${animeResult.title}" doesn't match expected "${tmdbInfo.title}"!`);
    }
    
    // IMPORTANT: Check if we found a season-specific entry
    // If so, we should use season 1 and the episode number directly
    // because the season-specific anime is a separate entry with its own episode numbering
    let foundSeasonSpecificEntry = false;
    
    // If MAL title was provided and we found the anime, ALWAYS treat as season-specific
    // because the episode number is already relative to that MAL entry
    if (malTitle && animeResult) {
      foundSeasonSpecificEntry = true;
      console.log(`[AnimeKai] MAL title provided - treating as season-specific entry (episode ${episode || 1} is MAL-relative)`);
    } else if (seasonNum > 1 && animeResult.title !== baseTitle) {
      // Check if the found title contains season indicators
      const seasonIndicators = [
        `season ${seasonNum}`,
        `${seasonNum}nd season`, `${seasonNum}rd season`, `${seasonNum}th season`,
        `part ${seasonNum}`,
        toRomanNumeral(seasonNum).toLowerCase(),
        // Also check for specific sequel titles
        'thousand-year blood war', 'tybw', // Bleach
        'shippuden', // Naruto
        'brotherhood', // FMA
      ];
      
      // Also add the TMDB season name if available
      if (tmdbSeasonName) {
        seasonIndicators.push(tmdbSeasonName.toLowerCase());
      }
      
      const lowerTitle = animeResult.title.toLowerCase();
      foundSeasonSpecificEntry = seasonIndicators.some(indicator => lowerTitle.includes(indicator));
      
      // Also check if the found title is different from the base title
      // This catches cases where the anime is listed under a completely different name
      if (!foundSeasonSpecificEntry && animeResult.title.toLowerCase() !== baseTitle.toLowerCase()) {
        // If we searched with season variants and found something different, it's likely season-specific
        foundSeasonSpecificEntry = true;
        console.log(`[AnimeKai] Found different title "${animeResult.title}" vs base "${baseTitle}" - treating as season-specific`);
      }
      
      if (foundSeasonSpecificEntry) {
        console.log(`[AnimeKai] ✓ Found season-specific entry "${animeResult.title}" - will use episode ${episode || 1} directly`);
      }
    }

    // Step 4: Get episodes - use from search result if available, otherwise fetch
    let episodes: ParsedEpisodes | null = animeResult.episodes || null;
    if (!episodes) {
      console.log(`[AnimeKai] Episodes not in search result, fetching separately...`);
      episodes = await getEpisodes(animeResult.content_id);
    }
    
    if (!episodes) {
      return {
        success: false,
        sources: [],
        error: 'Failed to get episodes list',
      };
    }

    // Step 5: Find the episode token
    // IMPORTANT: If we found a season-specific entry, use season 1 with the episode number
    // because the anime site treats each season as a separate anime with its own episode list
    const seasonNumber = type === 'movie' ? 1 : (foundSeasonSpecificEntry ? 1 : (season || 1));
    const episodeNumber = type === 'movie' ? 1 : (episode || 1);
    const seasonKey = String(seasonNumber);
    const episodeKey = String(episodeNumber);
    
    if (foundSeasonSpecificEntry) {
      console.log(`[AnimeKai] Using season 1 (season-specific entry) with episode ${episodeNumber}`);
    }
    
    // Episodes structure from API: { "1": { "1": { token: "..." }, "2": { token: "..." }, ... } }
    // The first key is the season, the second key is the episode number
    // NOTE: Some anime use absolute episode numbers (all episodes in season "1")
    // while others use per-season numbering
    let episodeToken: string | null = null;
    
    console.log(`[AnimeKai] Looking for S${seasonNumber}E${episodeNumber}...`);
    console.log(`[AnimeKai] Available seasons:`, Object.keys(episodes));
    
    // Log episode count in season 1 (for absolute numbering detection)
    const season1EpCount = episodes["1"] ? Object.keys(episodes["1"]).length : 0;
    console.log(`[AnimeKai] Season 1 has ${season1EpCount} episodes in AnimeKai`);
    
    // Strategy 1: Try the exact season/episode combination
    const targetSeason = episodes[seasonKey];
    if (targetSeason && targetSeason[episodeKey]) {
      const epData = targetSeason[episodeKey];
      if (epData && typeof epData === 'object' && 'token' in epData) {
        episodeToken = epData.token;
        console.log(`[AnimeKai] Found episode in season ${seasonNumber}`);
      }
    }
    
    // Strategy 2: If season > 1 and not found, try absolute episode number
    // Calculate absolute episode by summing previous seasons' episodes from TMDB
    if (!episodeToken && seasonNumber > 1) {
      console.log(`[AnimeKai] Episode not found in season ${seasonNumber}, trying absolute numbering...`);
      
      // Check if all episodes are in season "1" (absolute numbering)
      const season1 = episodes["1"];
      if (season1) {
        // Get TMDB season episode counts to calculate absolute number
        const tmdbSeasonCounts = await getTmdbSeasonEpisodeCounts(tmdbId);
        
        let absoluteEpisode = episodeNumber;
        
        if (tmdbSeasonCounts) {
          // Use TMDB episode counts for accurate calculation
          for (let s = 1; s < seasonNumber; s++) {
            const seasonEpCount = tmdbSeasonCounts[s] || 0;
            absoluteEpisode += seasonEpCount;
            console.log(`[AnimeKai] Season ${s} has ${seasonEpCount} episodes (TMDB)`);
          }
        } else {
          // Fallback: Try to calculate based on available seasons in episodes object
          for (let s = 1; s < seasonNumber; s++) {
            const prevSeason = episodes[String(s)];
            if (prevSeason) {
              absoluteEpisode += Object.keys(prevSeason).length;
            }
          }
        }
        
        const absoluteKey = String(absoluteEpisode);
        console.log(`[AnimeKai] Trying absolute episode ${absoluteEpisode} (S${seasonNumber}E${episodeNumber})...`);
        
        if (season1[absoluteKey]) {
          const epData = season1[absoluteKey];
          if (epData && typeof epData === 'object' && 'token' in epData) {
            episodeToken = epData.token;
            console.log(`[AnimeKai] ✓ Found episode using absolute numbering: ${absoluteEpisode}`);
          }
        }
      }
    }
    
    // Strategy 3: Try season "1" with the episode number directly (fallback)
    if (!episodeToken) {
      const season1 = episodes["1"];
      if (season1 && season1[episodeKey]) {
        const epData = season1[episodeKey];
        if (epData && typeof epData === 'object' && 'token' in epData) {
          episodeToken = epData.token;
          console.log(`[AnimeKai] Found episode in season 1 (fallback)`);
        }
      }
    }
    
    // Strategy 4: Try direct access (in case structure is different)
    if (!episodeToken && episodes[episodeKey]) {
      const episodeData = episodes[episodeKey];
      if (typeof episodeData === 'object' && 'token' in episodeData) {
        episodeToken = (episodeData as any).token;
      } else {
        // Get the first sub-entry
        const subKeys = Object.keys(episodeData);
        if (subKeys.length > 0) {
          const firstEntry = episodeData[subKeys[0]];
          if (firstEntry && typeof firstEntry === 'object' && 'token' in firstEntry) {
            episodeToken = firstEntry.token;
          }
        }
      }
    }

    if (!episodeToken) {
      // Log available episodes for debugging
      const allSeasons = Object.keys(episodes);
      const episodeInfo: Record<string, string[]> = {};
      let maxEpisodeInSeason1 = 0;
      for (const s of allSeasons) {
        const seasonData = episodes[s];
        if (seasonData && typeof seasonData === 'object') {
          const epKeys = Object.keys(seasonData);
          episodeInfo[`Season ${s}`] = epKeys;
          if (s === '1') {
            maxEpisodeInSeason1 = Math.max(...epKeys.map(k => parseInt(k) || 0));
          }
        }
      }
      console.log(`[AnimeKai] S${seasonNumber}E${episodeNumber} not found. Available:`, episodeInfo);
      
      // Strategy 5: If episode number exceeds available episodes, this might be a multi-part anime
      // Try to find the next part and calculate the relative episode number
      if (episodeNumber > maxEpisodeInSeason1 && maxEpisodeInSeason1 > 0 && !malTitle) {
        console.log(`[AnimeKai] Episode ${episodeNumber} exceeds max episode ${maxEpisodeInSeason1} - trying to find next part...`);
        
        // Calculate which part and episode we need
        // For now, assume each part has roughly the same number of episodes
        const partNumber = Math.ceil(episodeNumber / maxEpisodeInSeason1);
        const relativeEpisode = episodeNumber - (maxEpisodeInSeason1 * (partNumber - 1));
        
        console.log(`[AnimeKai] Calculated: Part ${partNumber}, Episode ${relativeEpisode}`);
        
        // Try to find the next part by searching with part number
        const partSearchVariants = [
          `${baseTitle} Part ${partNumber}`,
          `${animeResult.title} Part ${partNumber}`,
          // For specific anime like Bleach TYBW
          ...(animeResult.title.toLowerCase().includes('thousand-year blood war') ? [
            partNumber === 2 ? 'Bleach: Thousand-Year Blood War - The Separation' : null,
            partNumber === 3 ? 'Bleach: Thousand-Year Blood War - The Conflict' : null,
          ].filter(Boolean) as string[] : []),
        ];
        
        for (const variant of partSearchVariants) {
          console.log(`[AnimeKai] Trying next part search: "${variant}"`);
          const nextPartResult = await searchAnimeKai(variant, null);
          if (nextPartResult && nextPartResult.content_id !== animeResult.content_id) {
            console.log(`[AnimeKai] ✓ Found next part: "${nextPartResult.title}"`);
            
            // Get episodes for the next part
            const nextPartEpisodes = nextPartResult.episodes || await getEpisodes(nextPartResult.content_id);
            if (nextPartEpisodes) {
              const nextPartSeason1 = nextPartEpisodes["1"];
              if (nextPartSeason1 && nextPartSeason1[String(relativeEpisode)]) {
                const epData = nextPartSeason1[String(relativeEpisode)];
                if (epData && typeof epData === 'object' && 'token' in epData) {
                  episodeToken = epData.token;
                  console.log(`[AnimeKai] ✓ Found episode ${relativeEpisode} in next part!`);
                  // Update animeResult for logging
                  animeResult = nextPartResult;
                  break;
                }
              }
            }
          }
        }
      }
      
      // If still not found, return error
      if (!episodeToken) {
        return {
          success: false,
          sources: [],
          error: `Episode S${seasonNumber}E${episodeNumber} not found`,
        };
      }
    }

    console.log(`[AnimeKai] Found episode token: ${episodeToken.substring(0, 20)}...`);

    // Step 6: Get servers list
    const servers = await getServers(episodeToken);
    if (!servers) {
      return {
        success: false,
        sources: [],
        error: 'Failed to get servers list',
      };
    }

    // Step 7: Try servers - get sources from both sub AND dub
    // Process servers in PARALLEL to avoid sequential rate limiting
    const allSources: StreamSource[] = [];
    const subSources: StreamSource[] = [];
    const dubSources: StreamSource[] = [];

    // Collect all server tasks
    const serverTasks: Array<{
      lid: string;
      displayName: string;
      type: 'sub' | 'dub';
    }> = [];

    // Add sub servers
    const subServerList = servers.sub;
    if (subServerList) {
      for (const [serverKey, serverData] of Object.entries(subServerList)) {
        const server = serverData as any;
        if (!server.lid) continue;
        const serverName = server.name || `Server ${serverKey}`;
        serverTasks.push({
          lid: server.lid,
          displayName: `${serverName} (sub)`,
          type: 'sub',
        });
      }
    }

    // Add dub servers
    const dubServerList = servers.dub;
    if (dubServerList) {
      for (const [serverKey, serverData] of Object.entries(dubServerList)) {
        const server = serverData as any;
        if (!server.lid) continue;
        const serverName = server.name || `Server ${serverKey}`;
        serverTasks.push({
          lid: server.lid,
          displayName: `${serverName} (dub)`,
          type: 'dub',
        });
      }
    }

    // Process all servers in parallel
    console.log(`[AnimeKai] Processing ${serverTasks.length} servers in parallel...`);
    const results = await Promise.allSettled(
      serverTasks.map(async (task) => {
        const source = await getStreamFromServer(task.lid, task.displayName);
        if (source) {
          source.title = task.displayName;
          source.language = task.type === 'dub' ? 'en' : 'ja';
          return { source, type: task.type };
        }
        return null;
      })
    );

    // Collect successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { source, type } = result.value;
        if (type === 'sub' && subSources.length < 2) {
          subSources.push(source);
          console.log(`[AnimeKai] ✓ Got SUB source from ${source.title}`);
        } else if (type === 'dub' && dubSources.length < 1) {
          dubSources.push(source);
          console.log(`[AnimeKai] ✓ Got DUB source from ${source.title}`);
        }
      }
    }

    // Combine: sub sources first, then dub
    allSources.push(...subSources, ...dubSources);
    
    console.log(`[AnimeKai] Total sources: ${allSources.length} (${subSources.length} sub, ${dubSources.length} dub)`)

    if (allSources.length === 0) {
      console.log('[AnimeKai] All servers failed');
      return {
        success: false,
        sources: [],
        error: 'All AnimeKai servers failed',
      };
    }

    console.log(`[AnimeKai] Returning ${allSources.length} sources`);
    
    // Log final source URLs for debugging
    allSources.forEach((src, i) => {
      console.log(`[AnimeKai] Source ${i + 1}: ${src.title}`);
      console.log(`[AnimeKai]   URL: ${src.url}`);
      console.log(`[AnimeKai]   Referer: ${src.referer}`);
    });

    return {
      success: true,
      sources: allSources,
    };
  } catch (error) {
    console.error('[AnimeKai] Extraction error:', error);
    return {
      success: false,
      sources: [],
      error: `AnimeKai extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}


/**
 * Fetch a specific AnimeKai server by name
 */
export async function fetchAnimeKaiSourceByName(
  serverName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  malId?: number,
  malTitle?: string
): Promise<StreamSource | null> {
  console.log(`[AnimeKai] Fetching specific server: ${serverName}`);
  if (malId) {
    console.log(`[AnimeKai] MAL override: ID=${malId}, Title="${malTitle}"`);
  }

  try {
    // Get anime info
    const animeIds = await getAnimeIds(tmdbId, type);
    const tmdbInfo = await getTmdbAnimeInfo(tmdbId, type);
    
    if (!animeIds.mal_id && !tmdbInfo) {
      return null;
    }

    // Search AnimeKai - use season-aware search for seasons > 1
    // IMPORTANT: Anime sites list each season as a SEPARATE anime entry
    // So for seasons > 1, we MUST try season-specific search FIRST
    const seasonNum = season || 1;
    const baseTitle = tmdbInfo?.title || '';
    
    // For seasons > 1, get the TMDB season name first
    let tmdbSeasonName: string | null = null;
    if (seasonNum > 1 && type === 'tv') {
      tmdbSeasonName = await getTmdbSeasonName(tmdbId, seasonNum);
    }
    
    // Build search variants - prioritize TMDB season name if available
    const seasonVariants: string[] = [];
    if (tmdbSeasonName) {
      seasonVariants.push(`${baseTitle}: ${tmdbSeasonName}`);
      seasonVariants.push(`${baseTitle} ${tmdbSeasonName}`);
      seasonVariants.push(tmdbSeasonName);
      // Try without hyphens (some databases don't use them)
      const noHyphens = tmdbSeasonName.replace(/-/g, ' ');
      if (noHyphens !== tmdbSeasonName) {
        seasonVariants.push(`${baseTitle} ${noHyphens}`);
        seasonVariants.push(noHyphens);
      }
    }
    seasonVariants.push(...getSeasonSearchVariants(baseTitle, seasonNum));
    
    let animeResult: { content_id: string; title: string; episodes?: ParsedEpisodes } | null = null;
    
    // If we have a specific MAL title (from MAL split), search for it FIRST
    if (malTitle) {
      console.log(`[AnimeKai] MAL title provided - searching for: "${malTitle}"`);
      animeResult = await searchAnimeKai(malTitle, malId || null);
      
      if (!animeResult) {
        // Try variations
        const malTitleVariants = [
          malTitle.replace(/:/g, ''),
          malTitle.replace(/-/g, ' '),
          malTitle.split(':').pop()?.trim() || malTitle,
        ];
        for (const variant of malTitleVariants) {
          if (variant !== malTitle) {
            animeResult = await searchAnimeKai(variant, null);
            if (animeResult) break;
          }
        }
      }
    }
    
    // For seasons > 1, ALWAYS try season-specific search FIRST (if MAL title didn't work)
    // This is critical because anime sites list each season as a separate entry
    // e.g., "Record of Ragnarok III" is a different entry from "Record of Ragnarok"
    if (!animeResult && seasonNum > 1 && baseTitle && seasonVariants.length > 0) {
      console.log(`[AnimeKai] Season ${seasonNum} requested - trying season-specific search first...`);
      if (tmdbSeasonName) {
        console.log(`[AnimeKai] TMDB Season name: "${tmdbSeasonName}"`);
      }
      
      for (const variant of seasonVariants) {
        console.log(`[AnimeKai] Trying: "${variant}"`);
        const variantResult = await searchAnimeKai(variant, null);
        if (variantResult) {
          console.log(`[AnimeKai] ✓ Found season-specific entry: "${variantResult.title}"`);
          animeResult = variantResult;
          break;
        }
      }
      
      // If no season-specific entry found, fall back to base title search
      // NOTE: Don't use MAL ID first because it maps to the original anime, not the season
      if (!animeResult) {
        console.log(`[AnimeKai] No season-specific entry found, trying base title (without MAL ID)...`);
        animeResult = await searchAnimeKai(baseTitle, null);
        
        // If still not found and we have a MAL ID, try with it as last resort
        if (!animeResult && animeIds.mal_id) {
          console.log(`[AnimeKai] Still not found, trying with MAL ID as last resort...`);
          animeResult = await searchAnimeKai(baseTitle, animeIds.mal_id);
        }
      }
    } else {
      // Season 1 or no season specified - search normally
      animeResult = await searchAnimeKai(baseTitle, animeIds.mal_id);
    }
    
    if (!animeResult) {
      return null;
    }
    
    // Check if we found a season-specific entry
    // If so, we should use season 1 and the episode number directly
    let foundSeasonSpecificEntry = false;
    if (seasonNum > 1 && animeResult.title !== baseTitle) {
      const seasonIndicators = [
        `season ${seasonNum}`,
        `${seasonNum}nd season`, `${seasonNum}rd season`, `${seasonNum}th season`,
        `part ${seasonNum}`,
        toRomanNumeral(seasonNum).toLowerCase(),
        'thousand-year blood war', 'tybw', 'shippuden', 'brotherhood',
      ];
      
      // Also add the TMDB season name if available
      if (tmdbSeasonName) {
        seasonIndicators.push(tmdbSeasonName.toLowerCase());
      }
      
      const lowerTitle = animeResult.title.toLowerCase();
      foundSeasonSpecificEntry = seasonIndicators.some(indicator => lowerTitle.includes(indicator));
      
      // Also check if the found title is different from the base title
      if (!foundSeasonSpecificEntry && animeResult.title.toLowerCase() !== baseTitle.toLowerCase()) {
        foundSeasonSpecificEntry = true;
        console.log(`[AnimeKai] Found different title "${animeResult.title}" vs base "${baseTitle}" - treating as season-specific`);
      }
      
      if (foundSeasonSpecificEntry) {
        console.log(`[AnimeKai] ✓ Found season-specific entry "${animeResult.title}" - will use episode ${episode || 1} directly`);
      }
    }

    // Get episodes - use from search result if available
    let episodes: ParsedEpisodes | null = animeResult.episodes || null;
    if (!episodes) {
      episodes = await getEpisodes(animeResult.content_id);
    }
    if (!episodes) {
      return null;
    }

    // Find episode token - for season-specific entries, episode is in season "1"
    // because the anime site treats each season as a separate anime
    const seasonNumber = type === 'movie' ? 1 : (foundSeasonSpecificEntry ? 1 : (season || 1));
    const episodeNumber = type === 'movie' ? 1 : (episode || 1);
    const seasonKey = String(seasonNumber);
    const episodeKey = String(episodeNumber);
    
    if (foundSeasonSpecificEntry) {
      console.log(`[AnimeKai] Using season 1 (season-specific entry) with episode ${episodeNumber}`);
    }
    
    let episodeToken: string | null = null;
    
    // Strategy 1: Try exact season/episode
    const targetSeason = episodes[seasonKey];
    if (targetSeason && targetSeason[episodeKey]) {
      const epData = targetSeason[episodeKey];
      if (epData && typeof epData === 'object' && 'token' in epData) {
        episodeToken = epData.token;
      }
    }
    
    // Strategy 2: If season > 1 and not found, try absolute episode number
    if (!episodeToken && seasonNumber > 1) {
      const season1 = episodes["1"];
      if (season1) {
        let absoluteEpisode = episodeNumber;
        for (let s = 1; s < seasonNumber; s++) {
          const prevSeason = episodes[String(s)];
          if (prevSeason) {
            absoluteEpisode += Object.keys(prevSeason).length;
          }
        }
        const absoluteKey = String(absoluteEpisode);
        if (season1[absoluteKey]) {
          const epData = season1[absoluteKey];
          if (epData && typeof epData === 'object' && 'token' in epData) {
            episodeToken = epData.token;
          }
        }
      }
    }
    
    // Strategy 3: Try season "1" with episode number directly
    if (!episodeToken) {
      const season1 = episodes["1"];
      if (season1 && season1[episodeKey]) {
        const epData = season1[episodeKey];
        if (epData && typeof epData === 'object' && 'token' in epData) {
          episodeToken = epData.token;
        }
      }
    }
    
    // Strategy 4: Fallback to direct access
    if (!episodeToken && episodes[episodeKey]) {
      const episodeData = episodes[episodeKey];
      if (typeof episodeData === 'object' && 'token' in episodeData) {
        episodeToken = (episodeData as any).token;
      } else {
        const subKeys = Object.keys(episodeData);
        if (subKeys.length > 0) {
          const firstEntry = episodeData[subKeys[0]];
          if (firstEntry && typeof firstEntry === 'object' && 'token' in firstEntry) {
            episodeToken = firstEntry.token;
          }
        }
      }
    }

    if (!episodeToken) {
      console.log(`[AnimeKai] Episode S${seasonNumber}E${episodeNumber} not found for server ${serverName}`);
      return null;
    }

    // Get servers
    const servers = await getServers(episodeToken);
    if (!servers) {
      return null;
    }

    // Find the specific server by name
    const serverTypes: Array<'sub' | 'dub'> = ['sub', 'dub'];
    
    for (const serverType of serverTypes) {
      const serverList = servers[serverType];
      if (!serverList) continue;

      for (const [, serverData] of Object.entries(serverList)) {
        const server = serverData as any;
        const displayName = `${server.name || 'Server'} (${serverType})`;
        
        if (serverName.includes(server.name) || serverName === displayName) {
          const source = await getStreamFromServer(server.lid, displayName);
          if (source) {
            source.language = serverType === 'dub' ? 'en' : 'ja';
            return source;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[AnimeKai] Fetch source by name error:`, error);
    return null;
  }
}

// Export enabled flag
export const ANIMEKAI_ENABLED = true;
