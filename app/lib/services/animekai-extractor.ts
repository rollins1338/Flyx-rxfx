/**
 * AnimeKai Extractor
 * Primary source for anime content using enc-dec.app API
 * 
 * Flow:
 * 1. Convert TMDB ID → MAL/AniList ID using ARM mapping API
 * 2. Search AnimeKai database for the anime
 * 3. Fetch encrypted stream data from AnimeKai
 * 4. Decrypt using enc-dec.app API
 * 
 * Servers available on AnimeKai:
 * - Yuki (primary)
 * - Kuro (backup)
 * - Shiro (backup)
 */

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  status?: 'working' | 'down' | 'unknown';
  language?: string;
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  subtitles?: Array<{ label: string; url: string; language: string }>;
  error?: string;
}

interface AnimeKaiEpisode {
  id: string;
  number: number;
  title?: string;
}

interface AnimeKaiSearchResult {
  id: string;
  title: string;
  mal_id?: number;
  anilist_id?: number;
  episodes?: AnimeKaiEpisode[];
}

// API Configuration
const ENC_DEC_API = 'https://enc-dec.app';
const ARM_API = 'https://arm.haglund.dev/api/v2/ids';
// const ANILIST_API = 'https://graphql.anilist.co'; // Reserved for future use

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
};

// AnimeKai servers
const SERVERS = [
  { name: 'Yuki', id: 'yuki', priority: 1 },
  { name: 'Kuro', id: 'kuro', priority: 2 },
  { name: 'Shiro', id: 'shiro', priority: 3 },
];

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
 * Search AnimeKai database
 */
async function searchAnimeKai(query: string, malId?: number | null): Promise<AnimeKaiSearchResult | null> {
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
        if (data && data.id) {
          console.log(`[AnimeKai] Found by MAL ID: ${data.title}`);
          return data;
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
    
    if (data.results && data.results.length > 0) {
      console.log(`[AnimeKai] Found ${data.results.length} results, using first: ${data.results[0].title}`);
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.log(`[AnimeKai] Search error:`, error);
    return null;
  }
}

/**
 * Get episode ID from AnimeKai
 */
async function getEpisodeId(animeId: string, episodeNumber: number): Promise<string | null> {
  try {
    console.log(`[AnimeKai] Getting episode ${episodeNumber} for anime ${animeId}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Fetch anime details with episodes
    const response = await fetch(`${ENC_DEC_API}/db/kai/find?kai_id=${animeId}`, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.episodes && data.episodes.length > 0) {
      // Find the episode by number
      const episode = data.episodes.find((ep: AnimeKaiEpisode) => ep.number === episodeNumber);
      if (episode) {
        console.log(`[AnimeKai] Found episode ID: ${episode.id}`);
        return episode.id;
      }
      
      // If exact match not found, try by index (some anime use 0-indexed)
      if (data.episodes[episodeNumber - 1]) {
        console.log(`[AnimeKai] Using episode by index: ${data.episodes[episodeNumber - 1].id}`);
        return data.episodes[episodeNumber - 1].id;
      }
    }

    return null;
  } catch (error) {
    console.log(`[AnimeKai] Get episode error:`, error);
    return null;
  }
}

/**
 * Encrypt text using AnimeKai encryption
 */
async function encryptForAnimeKai(text: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`${ENC_DEC_API}/api/enc-kai?text=${encodeURIComponent(text)}`, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    return data.result || null;
  } catch {
    return null;
  }
}

/**
 * Decrypt AnimeKai response
 */
async function decryptAnimeKaiResponse(encryptedText: string): Promise<any | null> {
  try {
    console.log(`[AnimeKai] Decrypting response (${encryptedText.length} chars)...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${ENC_DEC_API}/api/dec-kai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({ text: encryptedText }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] Decryption failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.result) {
      console.log('[AnimeKai] Decryption returned no result');
      return null;
    }

    // Parse if string
    if (typeof data.result === 'string') {
      try {
        return JSON.parse(data.result);
      } catch {
        return data.result;
      }
    }

    return data.result;
  } catch (error) {
    console.log(`[AnimeKai] Decryption error:`, error);
    return null;
  }
}


/**
 * Fetch stream from a specific AnimeKai server
 */
async function fetchFromServer(
  server: typeof SERVERS[0],
  animeId: string,
  episodeId: string
): Promise<{ source: StreamSource; subtitles?: Array<{ label: string; url: string; language: string }> } | null> {
  try {
    console.log(`[AnimeKai] Trying server ${server.name}...`);

    // Build the source URL (this varies by server implementation)
    // The enc-dec API handles the actual fetching and encryption
    const sourceUrl = `${animeId}/${episodeId}/${server.id}`;
    
    // Encrypt the request
    const encrypted = await encryptForAnimeKai(sourceUrl);
    if (!encrypted) {
      console.log(`[AnimeKai] ${server.name}: Encryption failed`);
      return null;
    }

    // Fetch encrypted stream data from AnimeKai
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // The actual AnimeKai API endpoint
    const response = await fetch(`https://animekai.to/ajax/links/${encrypted}`, {
      headers: {
        ...HEADERS,
        'Referer': 'https://animekai.to/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] ${server.name}: HTTP ${response.status}`);
      return null;
    }

    const encryptedData = await response.text();
    
    if (!encryptedData || encryptedData.includes('error')) {
      console.log(`[AnimeKai] ${server.name}: Empty or error response`);
      return null;
    }

    // Decrypt the response
    const decrypted = await decryptAnimeKaiResponse(encryptedData);
    
    if (!decrypted) {
      console.log(`[AnimeKai] ${server.name}: Decryption failed`);
      return null;
    }

    // Extract stream URL
    let streamUrl = '';
    if (typeof decrypted === 'string') {
      streamUrl = decrypted;
    } else if (decrypted.url) {
      streamUrl = decrypted.url;
    } else if (decrypted.sources && decrypted.sources[0]) {
      streamUrl = decrypted.sources[0].url || decrypted.sources[0].file || '';
    }

    if (!streamUrl) {
      console.log(`[AnimeKai] ${server.name}: No stream URL in response`);
      return null;
    }

    console.log(`[AnimeKai] ${server.name}: ✓ Got stream URL`);

    // Extract subtitles if available
    const subtitles: Array<{ label: string; url: string; language: string }> = [];
    if (decrypted.tracks) {
      for (const track of decrypted.tracks) {
        if (track.kind === 'captions' || track.kind === 'subtitles') {
          subtitles.push({
            label: track.label || 'Unknown',
            url: track.file || track.url || '',
            language: track.label?.toLowerCase().includes('english') ? 'en' : 'unknown',
          });
        }
      }
    }

    return {
      source: {
        quality: 'auto',
        title: `AnimeKai - ${server.name}`,
        url: streamUrl,
        type: 'hls',
        referer: 'https://animekai.to/',
        requiresSegmentProxy: true,
        status: 'working',
        language: 'ja',
      },
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    };
  } catch (error) {
    console.log(`[AnimeKai] ${server.name}: Error -`, error);
    return null;
  }
}

/**
 * Alternative: Direct embed extraction (simpler approach)
 * Uses the embed URL pattern that AnimeKai provides
 */
async function fetchFromEmbed(
  animeId: string,
  episodeNumber: number,
  server: typeof SERVERS[0]
): Promise<{ source: StreamSource; subtitles?: Array<{ label: string; url: string; language: string }> } | null> {
  try {
    console.log(`[AnimeKai] Trying embed method for ${server.name}...`);

    // AnimeKai embed URL pattern
    const embedUrl = `https://animekai.to/embed/${animeId}?ep=${episodeNumber}&server=${server.id}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(embedUrl, {
      headers: {
        ...HEADERS,
        'Referer': 'https://animekai.to/',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[AnimeKai] Embed ${server.name}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Look for encrypted data in the page
    const encryptedMatch = html.match(/data-source="([^"]+)"/);
    if (!encryptedMatch) {
      console.log(`[AnimeKai] Embed ${server.name}: No encrypted data found`);
      return null;
    }

    // Decrypt the source
    const decrypted = await decryptAnimeKaiResponse(encryptedMatch[1]);
    
    if (!decrypted || !decrypted.url) {
      console.log(`[AnimeKai] Embed ${server.name}: Decryption failed`);
      return null;
    }

    console.log(`[AnimeKai] Embed ${server.name}: ✓ Got stream URL`);

    return {
      source: {
        quality: 'auto',
        title: `AnimeKai - ${server.name}`,
        url: decrypted.url,
        type: 'hls',
        referer: 'https://animekai.to/',
        requiresSegmentProxy: true,
        status: 'working',
        language: 'ja',
      },
    };
  } catch (error) {
    console.log(`[AnimeKai] Embed ${server.name}: Error -`, error);
    return null;
  }
}

/**
 * Main extraction function for AnimeKai
 * Tries servers sequentially until finding a working one
 */
export async function extractAnimeKaiStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  _season?: number, // Season not used for anime (episodes are typically absolute)
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[AnimeKai] Extracting streams for ${type} TMDB ID ${tmdbId}...`);

  // Step 1: Get anime IDs (MAL/AniList) from TMDB ID
  const animeIds = await getAnimeIds(tmdbId);
  
  // Step 2: Get title from TMDB for fallback search
  const tmdbInfo = await getTmdbAnimeInfo(tmdbId, type);
  
  if (!animeIds.mal_id && !animeIds.anilist_id && !tmdbInfo) {
    return {
      success: false,
      sources: [],
      error: 'Could not identify anime - no MAL/AniList ID or title found',
    };
  }

  // Step 3: Search AnimeKai database
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

  console.log(`[AnimeKai] Found anime: ${animeResult.title} (ID: ${animeResult.id})`);

  // Step 4: Determine episode number
  // For movies, episode is typically 1 or "full"
  // For TV, use the provided episode number
  const episodeNumber = type === 'movie' ? 1 : (episode || 1);

  // Step 5: Get episode ID if needed
  let episodeId: string | null = null;
  if (type === 'tv') {
    episodeId = await getEpisodeId(animeResult.id, episodeNumber);
    if (!episodeId) {
      console.log(`[AnimeKai] Episode ${episodeNumber} not found`);
      return {
        success: false,
        sources: [],
        error: `Episode ${episodeNumber} not found in AnimeKai`,
      };
    }
  }

  // Step 6: Try each server until one works
  let workingSource: StreamSource | null = null;
  let workingSubtitles: Array<{ label: string; url: string; language: string }> = [];
  let workingServer: typeof SERVERS[0] | null = null;

  for (const server of SERVERS) {
    // Try the embed method first (simpler)
    let result = await fetchFromEmbed(animeResult.id, episodeNumber, server);
    
    // If embed fails and we have an episode ID, try the AJAX method
    if (!result && episodeId) {
      result = await fetchFromServer(server, animeResult.id, episodeId);
    }

    if (result) {
      console.log(`[AnimeKai] ✓ ${server.name} WORKS!`);
      workingSource = result.source;
      workingSubtitles = result.subtitles || [];
      workingServer = server;
      break;
    }
  }

  if (!workingSource || !workingServer) {
    console.error('[AnimeKai] All servers failed');
    return {
      success: false,
      sources: [],
      error: 'All AnimeKai servers unavailable',
    };
  }

  // Build sources list: working source first, then others as unknown
  const allSources: StreamSource[] = [workingSource];
  
  for (const server of SERVERS) {
    if (server.id === workingServer.id) continue;
    
    allSources.push({
      quality: 'auto',
      title: `AnimeKai - ${server.name}`,
      url: '', // Will be fetched when user selects
      type: 'hls',
      referer: 'https://animekai.to/',
      requiresSegmentProxy: true,
      status: 'unknown',
      language: 'ja',
    });
  }

  console.log(`[AnimeKai] Returning 1 working source + ${allSources.length - 1} other servers`);

  return {
    success: true,
    sources: allSources,
    subtitles: workingSubtitles.length > 0 ? workingSubtitles : undefined,
  };
}

/**
 * Fetch a specific AnimeKai server by name
 */
export async function fetchAnimeKaiSourceByName(
  serverName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  _season?: number, // Season not used for anime
  episode?: number
): Promise<StreamSource | null> {
  console.log(`[AnimeKai] Fetching specific server: ${serverName}`);

  // Find the server config
  const serverConfig = SERVERS.find(s => 
    s.name === serverName || 
    serverName.includes(s.name)
  );
  
  if (!serverConfig) {
    console.error(`[AnimeKai] Unknown server: ${serverName}`);
    return null;
  }

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

  const episodeNumber = type === 'movie' ? 1 : (episode || 1);

  // Try to fetch from the specific server
  const result = await fetchFromEmbed(animeResult.id, episodeNumber, serverConfig);
  
  if (result) {
    return result.source;
  }

  return null;
}

// Export server list for UI
export const ANIMEKAI_SERVERS = SERVERS;

// Export enabled flag
export const ANIMEKAI_ENABLED = true;
