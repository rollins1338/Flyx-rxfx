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
 */
async function getAnimeIds(tmdbId: string): Promise<{ mal_id: number | null; anilist_id: number | null }> {
  try {
    console.log(`[AnimeKai] Looking up anime IDs for TMDB ${tmdbId}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ARM_API}?source=themoviedb&id=${tmdbId}`, {
      signal: controller.signal,
    });

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
      const result = data[0];
      if (result.info?.kai_id) {
        console.log(`[AnimeKai] Found ${data.length} results, using first: ${result.info.title_en} (kai_id: ${result.info.kai_id})`);
        return { 
          content_id: result.info.kai_id, 
          title: result.info.title_en || result.info.title_jp,
          episodes: result.episodes 
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
    const mediaUrl = `${baseUrl}/media/${videoId}`;
    console.log(`[AnimeKai] Fetching media endpoint: ${mediaUrl}`);
    
    const mediaController = new AbortController();
    const mediaTimeoutId = setTimeout(() => mediaController.abort(), 10000);
    
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        ...HEADERS,
        'Referer': embedUrl,
      },
      signal: mediaController.signal,
    });
    
    clearTimeout(mediaTimeoutId);
    
    if (!mediaResponse.ok) {
      console.log(`[AnimeKai] MegaUp media request failed: HTTP ${mediaResponse.status}`);
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
    console.log(`[AnimeKai] Trying manual MegaUp extraction...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(embedUrl, {
      headers: {
        ...HEADERS,
        'Referer': 'https://animekai.to/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`[AnimeKai] Failed to fetch MegaUp embed: HTTP ${response.status}`);
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
  _season?: number,
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[AnimeKai] Extracting streams for ${type} TMDB ID ${tmdbId}, episode ${episode || 1}...`);

  try {
    // Step 1: Get anime IDs (MAL/AniList) from TMDB ID
    const animeIds = await getAnimeIds(tmdbId);
    
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
    const animeResult = await searchAnimeKai(
      tmdbInfo?.title || '',
      animeIds.mal_id
    );

    if (!animeResult) {
      console.log('[AnimeKai] Anime not found in database');
      return {
        success: false,
        sources: [],
        error: 'Anime not found in AnimeKai database',
      };
    }

    console.log(`[AnimeKai] Found anime: ${animeResult.title} (content_id: ${animeResult.content_id})`);

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
    const episodeNumber = type === 'movie' ? 1 : (episode || 1);
    const episodeKey = String(episodeNumber);
    
    // Episodes structure from API: { "1": { "1": { token: "..." }, "2": { token: "..." }, ... } }
    // The first key "1" is the season, the second key is the episode number
    let episodeToken: string | null = null;
    
    // Try to find the episode - check season "1" first (most anime are single season)
    const season1 = episodes["1"];
    if (season1 && season1[episodeKey]) {
      const epData = season1[episodeKey];
      if (epData && typeof epData === 'object' && 'token' in epData) {
        episodeToken = epData.token;
      }
    }
    
    // If not found in season 1, try direct access (in case structure is different)
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
      const availableEps = season1 ? Object.keys(season1) : Object.keys(episodes);
      console.log(`[AnimeKai] Episode ${episodeNumber} not found. Available:`, availableEps);
      return {
        success: false,
        sources: [],
        error: `Episode ${episodeNumber} not found`,
      };
    }

    console.log(`[AnimeKai] Found episode ${episodeNumber} token: ${episodeToken.substring(0, 20)}...`);

    // Step 6: Get servers list
    const servers = await getServers(episodeToken);
    if (!servers) {
      return {
        success: false,
        sources: [],
        error: 'Failed to get servers list',
      };
    }

    // Step 7: Try servers (prefer sub over dub)
    const allSources: StreamSource[] = [];
    const serverTypes: Array<'sub' | 'dub'> = ['sub', 'dub'];

    for (const serverType of serverTypes) {
      const serverList = servers[serverType];
      if (!serverList) continue;

      for (const [serverKey, serverData] of Object.entries(serverList)) {
        const server = serverData as any;
        if (!server.lid) continue;

        const serverName = server.name || `Server ${serverKey}`;
        const displayName = `${serverName} (${serverType})`;

        // Try to get stream from this server
        const source = await getStreamFromServer(server.lid, displayName);
        
        if (source) {
          source.title = displayName;
          source.language = serverType === 'dub' ? 'en' : 'ja';
          allSources.push(source);
          
          console.log(`[AnimeKai] ✓ Got source from ${displayName}`);
        }

        // Only try first 3 servers to avoid timeout
        if (allSources.length >= 3) break;
      }

      if (allSources.length >= 3) break;
    }

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
  _season?: number,
  episode?: number
): Promise<StreamSource | null> {
  console.log(`[AnimeKai] Fetching specific server: ${serverName}`);

  try {
    // Get anime info
    const animeIds = await getAnimeIds(tmdbId);
    const tmdbInfo = await getTmdbAnimeInfo(tmdbId, type);
    
    if (!animeIds.mal_id && !tmdbInfo) {
      return null;
    }

    // Search AnimeKai
    const animeResult = await searchAnimeKai(tmdbInfo?.title || '', animeIds.mal_id);
    if (!animeResult) {
      return null;
    }

    // Get episodes - use from search result if available
    let episodes: ParsedEpisodes | null = animeResult.episodes || null;
    if (!episodes) {
      episodes = await getEpisodes(animeResult.content_id);
    }
    if (!episodes) {
      return null;
    }

    // Find episode token
    const episodeNumber = type === 'movie' ? 1 : (episode || 1);
    const episodeKey = String(episodeNumber);
    
    let episodeToken: string | null = null;
    
    // Try season "1" first
    const season1 = episodes["1"];
    if (season1 && season1[episodeKey]) {
      const epData = season1[episodeKey];
      if (epData && typeof epData === 'object' && 'token' in epData) {
        episodeToken = epData.token;
      }
    }
    
    // Fallback to direct access
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
