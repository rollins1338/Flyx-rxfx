/**
 * AnimeKai Extractor
 * Primary source for anime content using enc-dec.app API
 * 
 * Flow:
 * 1. Convert TMDB ID → MAL/AniList ID using ARM mapping API
 * 2. Search AnimeKai database for the anime (get content_id)
 * 3. Encrypt content_id → fetch episodes list
 * 4. Parse HTML → get episode token
 * 5. Encrypt token → fetch servers list
 * 6. Parse HTML → get server lid
 * 7. Encrypt lid → fetch embed (encrypted)
 * 8. Decrypt → get stream URL
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
const ENC_DEC_API = 'https://enc-dec.app';
const KAI_AJAX = 'https://animekai.to/ajax';
const ARM_API = 'https://arm.haglund.dev/api/v2/ids';

/**
 * Fetch a URL through Cloudflare Worker → RPI residential proxy
 * Used for MegaUp CDN which blocks datacenter IPs
 * 
 * Flow: Vercel → Cloudflare Worker (/animekai) → RPI Proxy → MegaUp CDN
 * 
 * IMPORTANT: The User-Agent MUST be consistent across the entire chain:
 * - RPI proxy uses it to fetch from MegaUp
 * - enc-dec.app uses it to decrypt the response
 * If they don't match, decryption will fail!
 */
async function fetchViaCfAnimeKaiProxy(
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
 * Encrypt text using AnimeKai encryption via enc-dec.app
 */
async function encrypt(text: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${ENC_DEC_API}/api/enc-kai?text=${encodeURIComponent(text)}`, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] Encryption failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.log(`[AnimeKai] Encryption error:`, error);
    return null;
  }
}

/**
 * Decrypt text using AnimeKai decryption via enc-dec.app
 */
async function decrypt(text: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${ENC_DEC_API}/api/dec-kai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] Decryption failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.log(`[AnimeKai] Decryption error:`, error);
    return null;
  }
}

/**
 * Parse HTML using enc-dec.app parser
 */
async function parseHtml(html: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${ENC_DEC_API}/api/parse-html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({ text: html }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] HTML parse failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.log(`[AnimeKai] HTML parse error:`, error);
    return null;
  }
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
 * Search AnimeKai database via enc-dec.app to get content_id
 * API returns: [{ info: { kai_id, title_en, ... }, episodes: { ... } }]
 */
async function searchAnimeKai(query: string, malId?: number | null): Promise<{ content_id: string; title: string; episodes?: ParsedEpisodes } | null> {
  try {
    // First try by MAL ID if available
    if (malId) {
      console.log(`[AnimeKai] Searching by MAL ID: ${malId}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${ENC_DEC_API}/db/kai/find?mal_id=${malId}`, {
        headers: HEADERS,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        // Handle both direct object and array response
        const result = Array.isArray(data) ? data[0] : data;
        if (result?.info?.kai_id) {
          console.log(`[AnimeKai] Found by MAL ID: ${result.info.title_en} (kai_id: ${result.info.kai_id})`);
          return { 
            content_id: result.info.kai_id, 
            title: result.info.title_en || result.info.title_jp,
            episodes: result.episodes 
          };
        }
        // Also check for flat structure
        if (result?.kai_id) {
          console.log(`[AnimeKai] Found by MAL ID: ${result.title_en || result.title} (kai_id: ${result.kai_id})`);
          return { content_id: result.kai_id, title: result.title_en || result.title };
        }
      }
    }

    // Fallback to title search
    console.log(`[AnimeKai] Searching by title: "${query}"`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${ENC_DEC_API}/db/kai/search?query=${encodeURIComponent(query)}`, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] Search failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // API returns array: [{ info: {...}, episodes: {...} }]
    if (Array.isArray(data) && data.length > 0) {
      console.log(`[AnimeKai] Found ${data.length} results, scoring matches...`);
      
      // Score all results and pick the best match
      let bestResult = data[0];
      let bestScore = -1;
      
      for (const result of data) {
        if (!result.info?.kai_id) continue;
        
        const title = result.info.title_en || result.info.title_jp || '';
        const score = scoreMatch(title, query);
        console.log(`[AnimeKai]   - "${title}" score: ${score}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      }
      
      if (bestResult.info?.kai_id) {
        const title = bestResult.info.title_en || bestResult.info.title_jp;
        console.log(`[AnimeKai] Best match: "${title}" (score: ${bestScore}, kai_id: ${bestResult.info.kai_id})`);
        return { 
          content_id: bestResult.info.kai_id, 
          title,
          episodes: bestResult.episodes 
        };
      }
    }
    
    // Also check for results wrapper
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const info = result.info || result;
      console.log(`[AnimeKai] Found ${data.results.length} results, using first: ${info.title_en || info.title}`);
      return { 
        content_id: info.kai_id, 
        title: info.title_en || info.title,
        episodes: result.episodes 
      };
    }

    console.log(`[AnimeKai] No results found for "${query}"`);
    return null;
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
    const encId = await encrypt(contentId);
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

    // Parse the HTML response
    const parsed = await parseHtml(response.result);
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
    const encToken = await encrypt(token);
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

    // Parse the HTML response
    const parsed = await parseHtml(response.result);
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
 * 3. Decrypt with enc-dec.app/api/dec-mega
 */
async function decryptMegaUpEmbed(embedUrl: string): Promise<string | null> {
  try {
    console.log(`[AnimeKai] Decrypting MegaUp embed: ${embedUrl}`);
    
    // Extract video ID and base URL from embed URL
    // Format: https://megaup22.online/e/{videoId}
    const urlMatch = embedUrl.match(/^(https?:\/\/[^/]+)\/e\/([^/?#]+)/);
    if (!urlMatch) {
      console.log(`[AnimeKai] Invalid MegaUp embed URL format`);
      return null;
    }
    
    const [, baseUrl, videoId] = urlMatch;
    console.log(`[AnimeKai] MegaUp base: ${baseUrl}, videoId: ${videoId}`);
    
    // Step 1: Fetch /media/{videoId} to get encrypted stream data
    // IMPORTANT: MegaUp blocks datacenter IPs, so we MUST use RPI proxy
    const mediaUrl = `${baseUrl}/media/${videoId}`;
    console.log(`[AnimeKai] Fetching media endpoint via CF→RPI proxy: ${mediaUrl}`);

    const mediaResponse = await fetchViaCfAnimeKaiProxy(mediaUrl, { timeout: 15000 });
    
    if (!mediaResponse.ok) {
      // Log the error details from the response body
      let errorDetails = '';
      try {
        const errorBody = await mediaResponse.text();
        errorDetails = errorBody.substring(0, 500);
        console.log(`[AnimeKai] MegaUp media request failed: HTTP ${mediaResponse.status}`);
        console.log(`[AnimeKai] Error details: ${errorDetails}`);
      } catch {
        console.log(`[AnimeKai] MegaUp media request failed: HTTP ${mediaResponse.status}`);
      }
      // Fallback to manual extraction
      return await extractMegaUpSourcesManually(embedUrl);
    }
    
    const mediaData = await mediaResponse.json();
    
    if (!mediaData.result) {
      console.log(`[AnimeKai] No result in MegaUp media response`);
      return await extractMegaUpSourcesManually(embedUrl);
    }
    
    const encryptedData = mediaData.result;
    console.log(`[AnimeKai] Got encrypted data (${encryptedData.length} chars)`);
    
    // Step 2: Decrypt with enc-dec.app/api/dec-mega
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${ENC_DEC_API}/api/dec-mega`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({ 
        text: encryptedData,
        agent: HEADERS['User-Agent']
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] MegaUp decrypt API failed: HTTP ${response.status}`);
      return await extractMegaUpSourcesManually(embedUrl);
    }

    const data = await response.json();
    console.log(`[AnimeKai] MegaUp decrypt response:`, JSON.stringify(data).substring(0, 300));
    
    // The response should contain the actual HLS stream URL
    if (data.result) {
      // Result could be a URL string or an object with sources
      if (typeof data.result === 'string' && (data.result.includes('.m3u8') || data.result.includes('.mp4'))) {
        return data.result;
      }
      // Try to parse as JSON if it's a string
      try {
        const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        if (parsed.sources && parsed.sources[0]) {
          return parsed.sources[0].file || parsed.sources[0].url || null;
        }
        if (parsed.file) return parsed.file;
        if (parsed.url) return parsed.url;
      } catch {
        // Not JSON, check if it's a direct URL
        if (typeof data.result === 'string' && data.result.startsWith('http')) {
          return data.result;
        }
      }
    }
    
    // Also check for direct properties
    if (data.file) return data.file;
    if (data.url) return data.url;
    if (data.sources && data.sources[0]) {
      return data.sources[0].file || data.sources[0].url || null;
    }
    
    console.log(`[AnimeKai] Could not extract stream URL from MegaUp API response`);
    return null;
  } catch (error) {
    console.log(`[AnimeKai] MegaUp decrypt error:`, error);
    return null;
  }
}

/**
 * Unpack p,a,c,k,e,d JavaScript
 * Many embed pages use this obfuscation
 */
function unpackPACKED(packed: string): string {
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
 * Fallback when dec-mega API fails
 */
async function extractMegaUpSourcesManually(embedUrl: string): Promise<string | null> {
  try {
    console.log(`[AnimeKai] Trying manual MegaUp extraction via RPI proxy...`);
    
    // IMPORTANT: MegaUp blocks datacenter IPs, so we MUST use CF→RPI proxy
    const response = await fetchViaCfAnimeKaiProxy(embedUrl, { timeout: 15000 });
    
    if (!response.ok) {
      // Log the error details from the response body
      let errorDetails = '';
      try {
        const errorBody = await response.text();
        errorDetails = errorBody.substring(0, 500);
        console.log(`[AnimeKai] Failed to fetch MegaUp embed: HTTP ${response.status}`);
        console.log(`[AnimeKai] Error details: ${errorDetails}`);
      } catch {
        console.log(`[AnimeKai] Failed to fetch MegaUp embed: HTTP ${response.status}`);
      }
      return null;
    }
    
    let html = await response.text();
    console.log(`[AnimeKai] Got MegaUp page (${html.length} bytes), searching for sources...`);
    
    // Check if the page contains packed JavaScript and try to unpack it
    if (html.includes('eval(function(p,a,c,k,e,')) {
      console.log(`[AnimeKai] Found packed JavaScript, attempting to unpack...`);
      try {
        const unpacked = unpackPACKED(html);
        if (unpacked !== html) {
          console.log(`[AnimeKai] Successfully unpacked JavaScript`);
          html = html + '\n' + unpacked; // Search both original and unpacked
        }
      } catch (e) {
        console.log(`[AnimeKai] Failed to unpack JavaScript:`, e);
      }
    }
    
    // Try to find sources in the HTML
    // Look for patterns like: sources: [{file: "..."}] or file: "..."
    const patterns = [
      /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /src\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /"file"\s*:\s*"([^"]+\.m3u8[^"]*)"/i,
      /"source"\s*:\s*"([^"]+\.m3u8[^"]*)"/i,
      // Also look for mp4 as fallback
      /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
      /file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const url = match[1].replace(/\\/g, '');
        console.log(`[AnimeKai] ✓ Found stream URL in MegaUp page:`, url.substring(0, 80));
        return url;
      }
    }
    
    // Also look for any .m3u8 URL
    const m3u8Match = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
    if (m3u8Match) {
      const url = m3u8Match[0].replace(/\\/g, '');
      console.log(`[AnimeKai] ✓ Found m3u8 URL in MegaUp page:`, url.substring(0, 80));
      return url;
    }
    
    // Look for mp4 as fallback
    const mp4Match = html.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/i);
    if (mp4Match) {
      const url = mp4Match[0].replace(/\\/g, '');
      console.log(`[AnimeKai] ✓ Found mp4 URL in MegaUp page:`, url.substring(0, 80));
      return url;
    }
    
    console.log(`[AnimeKai] No stream URL found in MegaUp page`);
    // Log a snippet of the HTML for debugging
    console.log(`[AnimeKai] HTML snippet:`, html.substring(0, 800));
    return null;
  } catch (error) {
    console.log(`[AnimeKai] Manual MegaUp extraction error:`, error);
    return null;
  }
}

/**
 * Decrypt RapidShare embed URL to get actual HLS stream
 */
async function decryptRapidShareEmbed(embedUrl: string): Promise<string | null> {
  try {
    console.log(`[AnimeKai] Decrypting RapidShare embed: ${embedUrl}`);
    
    // First try manual extraction (same approach as MegaUp)
    const manualResult = await extractMegaUpSourcesManually(embedUrl);
    if (manualResult) {
      return manualResult;
    }
    
    // Try the dec-rapid API
    console.log(`[AnimeKai] Manual extraction failed, trying dec-rapid API...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${ENC_DEC_API}/api/dec-rapid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({ 
        text: embedUrl,
        agent: HEADERS['User-Agent']
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] RapidShare decrypt API failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[AnimeKai] RapidShare decrypt response:`, JSON.stringify(data).substring(0, 300));
    
    // Extract stream URL from response
    if (data.result) {
      if (typeof data.result === 'string' && (data.result.includes('.m3u8') || data.result.includes('.mp4'))) {
        return data.result;
      }
      try {
        const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        if (parsed.sources && parsed.sources[0]) {
          return parsed.sources[0].file || parsed.sources[0].url || null;
        }
        if (parsed.file) return parsed.file;
        if (parsed.url) return parsed.url;
      } catch {
        if (typeof data.result === 'string' && data.result.startsWith('http')) {
          return data.result;
        }
      }
    }
    
    if (data.file) return data.file;
    if (data.url) return data.url;
    if (data.sources && data.sources[0]) {
      return data.sources[0].file || data.sources[0].url || null;
    }
    
    return null;
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
    const encLid = await encrypt(lid);
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
    const decrypted = await decrypt(response.result);
    if (!decrypted) {
      console.log(`[AnimeKai] Failed to decrypt embed`);
      return null;
    }

    // Parse the decrypted data
    let streamData: any;
    try {
      streamData = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
    } catch {
      // If it's not JSON, it might be a direct URL
      if (typeof decrypted === 'string' && decrypted.startsWith('http')) {
        streamData = { url: decrypted };
      } else {
        console.log(`[AnimeKai] Failed to parse decrypted data`);
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
        console.log(`[AnimeKai] Failed to decrypt MegaUp embed`);
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
        console.log(`[AnimeKai] Failed to decrypt RapidShare embed`);
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
 */
export async function extractAnimeKaiStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[AnimeKai] Extracting streams for ${type} TMDB ID ${tmdbId}, S${season || 1}E${episode || 1}...`);

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
    let searchTitle = tmdbInfo?.title || '';
    
    // For seasons > 1, try searching with season number appended
    // Common patterns: "Title II", "Title Season 2", "Title 2nd Season", "Title Part 2"
    const seasonSearchVariants = getSeasonSearchVariants(searchTitle, seasonNum);
    
    console.log(`[AnimeKai] Searching with: title="${searchTitle}", MAL ID=${animeIds.mal_id}, season=${seasonNum}`);
    if (seasonSearchVariants.length > 0) {
      console.log(`[AnimeKai] Season search variants:`, seasonSearchVariants);
    }
    
    let animeResult: { content_id: string; title: string; episodes?: ParsedEpisodes } | null = null;
    
    // For seasons > 1, ALWAYS try season-specific search FIRST
    // This is because anime sites list each season as a separate entry
    if (seasonNum > 1 && seasonSearchVariants.length > 0) {
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
      if (!animeResult) {
        console.log(`[AnimeKai] No season-specific entry found, trying base title...`);
        animeResult = await searchAnimeKai(searchTitle, animeIds.mal_id);
      }
    } else {
      // Season 1 or no season specified - search normally
      animeResult = await searchAnimeKai(searchTitle, animeIds.mal_id);
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
    if (seasonNum > 1 && animeResult.title !== tmdbInfo?.title) {
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
      const lowerTitle = animeResult.title.toLowerCase();
      foundSeasonSpecificEntry = seasonIndicators.some(indicator => lowerTitle.includes(indicator));
      
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
    // Calculate absolute episode by summing previous seasons' episodes
    if (!episodeToken && seasonNumber > 1) {
      console.log(`[AnimeKai] Episode not found in season ${seasonNumber}, trying absolute numbering...`);
      
      // Check if all episodes are in season "1" (absolute numbering)
      const season1 = episodes["1"];
      if (season1) {
        // Count episodes in previous seasons to calculate absolute number
        let absoluteEpisode = episodeNumber;
        
        // Try to calculate based on available seasons
        for (let s = 1; s < seasonNumber; s++) {
          const prevSeason = episodes[String(s)];
          if (prevSeason) {
            absoluteEpisode += Object.keys(prevSeason).length;
          }
        }
        
        const absoluteKey = String(absoluteEpisode);
        console.log(`[AnimeKai] Trying absolute episode ${absoluteEpisode}...`);
        
        if (season1[absoluteKey]) {
          const epData = season1[absoluteKey];
          if (epData && typeof epData === 'object' && 'token' in epData) {
            episodeToken = epData.token;
            console.log(`[AnimeKai] Found episode using absolute numbering: ${absoluteEpisode}`);
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
      for (const s of allSeasons) {
        const seasonData = episodes[s];
        if (seasonData && typeof seasonData === 'object') {
          episodeInfo[`Season ${s}`] = Object.keys(seasonData);
        }
      }
      console.log(`[AnimeKai] S${seasonNumber}E${episodeNumber} not found. Available:`, episodeInfo);
      return {
        success: false,
        sources: [],
        error: `Episode S${seasonNumber}E${episodeNumber} not found`,
      };
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
    // We want at least 2 sub sources + 1 dub source (if available)
    const allSources: StreamSource[] = [];
    const subSources: StreamSource[] = [];
    const dubSources: StreamSource[] = [];

    // First, collect sub sources (up to 2)
    const subServerList = servers.sub;
    if (subServerList) {
      for (const [serverKey, serverData] of Object.entries(subServerList)) {
        const server = serverData as any;
        if (!server.lid) continue;

        const serverName = server.name || `Server ${serverKey}`;
        const displayName = `${serverName} (sub)`;

        const source = await getStreamFromServer(server.lid, displayName);
        
        if (source) {
          source.title = displayName;
          source.language = 'ja';
          subSources.push(source);
          console.log(`[AnimeKai] ✓ Got SUB source from ${displayName}`);
        }

        // Get up to 2 sub sources
        if (subSources.length >= 2) break;
      }
    }

    // Then, collect dub sources (up to 1)
    const dubServerList = servers.dub;
    if (dubServerList) {
      for (const [serverKey, serverData] of Object.entries(dubServerList)) {
        const server = serverData as any;
        if (!server.lid) continue;

        const serverName = server.name || `Server ${serverKey}`;
        const displayName = `${serverName} (dub)`;

        const source = await getStreamFromServer(server.lid, displayName);
        
        if (source) {
          source.title = displayName;
          source.language = 'en';
          dubSources.push(source);
          console.log(`[AnimeKai] ✓ Got DUB source from ${displayName}`);
        }

        // Get up to 1 dub source
        if (dubSources.length >= 1) break;
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
  episode?: number
): Promise<StreamSource | null> {
  console.log(`[AnimeKai] Fetching specific server: ${serverName}`);

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
    let searchTitle = tmdbInfo?.title || '';
    
    let animeResult: { content_id: string; title: string; episodes?: ParsedEpisodes } | null = null;
    
    // For seasons > 1, ALWAYS try season-specific search FIRST
    // This is critical because anime sites list each season as a separate entry
    // e.g., "Record of Ragnarok III" is a different entry from "Record of Ragnarok"
    if (seasonNum > 1 && searchTitle) {
      const seasonVariants = getSeasonSearchVariants(searchTitle, seasonNum);
      
      console.log(`[AnimeKai] Season ${seasonNum} requested - trying season-specific search first...`);
      
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
      // (in case the anime uses absolute episode numbering)
      if (!animeResult) {
        console.log(`[AnimeKai] No season-specific entry found, trying base title...`);
        animeResult = await searchAnimeKai(searchTitle, animeIds.mal_id);
      }
    } else {
      // Season 1 or no season specified - search normally
      animeResult = await searchAnimeKai(searchTitle, animeIds.mal_id);
    }
    
    if (!animeResult) {
      return null;
    }
    
    // Check if we found a season-specific entry
    // If so, we should use season 1 and the episode number directly
    let foundSeasonSpecificEntry = false;
    if (seasonNum > 1 && animeResult.title !== tmdbInfo?.title) {
      const seasonIndicators = [
        `season ${seasonNum}`,
        `${seasonNum}nd season`, `${seasonNum}rd season`, `${seasonNum}th season`,
        `part ${seasonNum}`,
        toRomanNumeral(seasonNum).toLowerCase(),
        'thousand-year blood war', 'tybw', 'shippuden', 'brotherhood',
      ];
      const lowerTitle = animeResult.title.toLowerCase();
      foundSeasonSpecificEntry = seasonIndicators.some(indicator => lowerTitle.includes(indicator));
      
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
