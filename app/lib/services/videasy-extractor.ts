/**
 * Videasy Extractor
 * Uses the videasy.net API with external decryption service
 * 
 * Servers available:
 * - Neon (myflixerzupcloud) - Original language
 * - Sage (1movies) - Original language
 * - Cypher (moviebox) - Original language
 * - Yoru (cdn) - Original language, MOVIE ONLY
 * - Reyna (primewire) - Original language
 * - Omen (onionplay) - Original language
 * - Breach (m4uhd) - Original language
 * - Vyse (hdmovie) - Original language
 * - Killjoy (meine?language=german) - German
 * - Harbor (meine?language=italian) - Italian
 * - Chamber (meine?language=french) - French, MOVIE ONLY
 * - Fade (hdmovie) - Hindi
 * - Gekko (cuevana-latino) - Latin
 * - Kayo (cuevana-spanish) - Spanish
 * - Raze (superflix) - Portuguese
 * - Phoenix (overflix) - Portuguese
 * - Astra (visioncine) - Portuguese
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

interface VideasySource {
  file?: string;
  url?: string;
  type?: string;
  label?: string;
  quality?: string;
}

interface VideasyResponse {
  sources?: VideasySource[];
  subtitles?: Array<{ file?: string; url?: string; label?: string; lang?: string }>;
  tracks?: Array<{ file?: string; url?: string; label?: string; kind?: string }>;
}

// API Configuration
const VIDEASY_API_BASE = 'https://api.videasy.net';
const VIDEASY_API_BASE_ALT = 'https://api2.videasy.net';
const DECRYPTION_API = 'https://enc-dec.app/api';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
};

// Language display names for UI (exported for use in other components)
export const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'de': 'German',
  'it': 'Italian',
  'fr': 'French',
  'es': 'Spanish',
  'es-419': 'Latin Spanish',
  'pt': 'Portuguese',
  'hi': 'Hindi',
};

// Source configurations - ALL sources for multi-language support
const SOURCES = [
  // English sources (highest priority)
  { name: 'Neon', endpoint: 'myflixerzupcloud', language: 'en', languageName: 'English', priority: 1, movieOnly: false },
  { name: 'Sage', endpoint: '1movies', language: 'en', languageName: 'English', priority: 2, movieOnly: false },
  { name: 'Cypher', endpoint: 'moviebox', language: 'en', languageName: 'English', priority: 3, movieOnly: false },
  { name: 'Yoru', endpoint: 'cdn', language: 'en', languageName: 'English', priority: 4, movieOnly: true },
  { name: 'Reyna', endpoint: 'primewire', language: 'en', languageName: 'English', priority: 5, movieOnly: false },
  { name: 'Omen', endpoint: 'onionplay', language: 'en', languageName: 'English', priority: 6, movieOnly: false },
  { name: 'Breach', endpoint: 'm4uhd', language: 'en', languageName: 'English', priority: 7, movieOnly: false },
  { name: 'Vyse', endpoint: 'hdmovie', language: 'en', languageName: 'English', priority: 8, movieOnly: false },
  // German
  { name: 'Killjoy', endpoint: 'meine', language: 'de', languageName: 'German', priority: 10, movieOnly: false, queryParams: 'language=german' },
  // Italian
  { name: 'Harbor', endpoint: 'meine', language: 'it', languageName: 'Italian', priority: 11, movieOnly: false, queryParams: 'language=italian' },
  // French
  { name: 'Chamber', endpoint: 'meine', language: 'fr', languageName: 'French', priority: 12, movieOnly: true, queryParams: 'language=french' },
  // Spanish
  { name: 'Gekko', endpoint: 'cuevana-latino', language: 'es-419', languageName: 'Latin Spanish', priority: 13, movieOnly: false },
  { name: 'Kayo', endpoint: 'cuevana-spanish', language: 'es', languageName: 'Spanish', priority: 14, movieOnly: false },
  // Portuguese
  { name: 'Raze', endpoint: 'superflix', language: 'pt', languageName: 'Portuguese', priority: 15, movieOnly: false },
  { name: 'Phoenix', endpoint: 'overflix', language: 'pt', languageName: 'Portuguese', priority: 16, movieOnly: false },
  { name: 'Astra', endpoint: 'visioncine', language: 'pt', languageName: 'Portuguese', priority: 17, movieOnly: false },
];

/**
 * Fetch encrypted data from Videasy API
 */
async function fetchFromVideasy(
  endpoint: string,
  tmdbId: string,
  title: string,
  year: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  queryParams?: string,
  useAltApi: boolean = false
): Promise<string | null> {
  try {
    const baseUrl = useAltApi ? VIDEASY_API_BASE_ALT : VIDEASY_API_BASE;
    
    // Build URL
    let url = `${baseUrl}/${endpoint}/sources-with-title?title=${encodeURIComponent(title)}&mediaType=${type}&year=${year}&tmdbId=${tmdbId}`;
    
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      url += `&seasonId=${season}&episodeId=${episode}`;
    }
    
    if (queryParams) {
      url += `&${queryParams}`;
    }

    console.log(`[Videasy] Fetching: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Videasy] ${endpoint}: HTTP ${response.status}`);
      return null;
    }

    const text = await response.text();
    
    if (!text || text.trim() === '' || text.includes('error') || text.includes('Error')) {
      console.log(`[Videasy] ${endpoint}: Empty or error response`);
      return null;
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[Videasy] ${endpoint}: Timeout`);
    } else {
      console.log(`[Videasy] ${endpoint}: Error -`, error);
    }
    return null;
  }
}

/**
 * Decrypt Videasy response using external API
 */
async function decryptVideasyResponse(encryptedText: string, tmdbId: string): Promise<VideasyResponse | null> {
  try {
    console.log(`[Videasy] Decrypting response (${encryptedText.length} chars)...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${DECRYPTION_API}/dec-videasy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({
        text: encryptedText,
        id: tmdbId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Videasy] Decryption failed: HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    
    if (!json.result) {
      console.log('[Videasy] Decryption returned no result');
      return null;
    }

    // Parse the decrypted result
    let decrypted: VideasyResponse;
    if (typeof json.result === 'string') {
      try {
        decrypted = JSON.parse(json.result);
      } catch {
        console.log('[Videasy] Failed to parse decrypted JSON');
        return null;
      }
    } else {
      decrypted = json.result;
    }

    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Videasy] Decryption timeout');
    } else {
      console.log('[Videasy] Decryption error:', error);
    }
    return null;
  }
}

/**
 * Get title and year from TMDB
 */
async function getTmdbInfo(tmdbId: string, type: 'movie' | 'tv'): Promise<{ title: string; year: string } | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      console.error('[Videasy] TMDB API key not configured');
      return null;
    }

    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Videasy] TMDB lookup failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    const title = type === 'movie' ? data.title : data.name;
    const dateStr = type === 'movie' ? data.release_date : data.first_air_date;
    const year = dateStr ? dateStr.split('-')[0] : '';

    if (!title || !year) {
      console.log('[Videasy] Missing title or year from TMDB');
      return null;
    }

    return { title, year };
  } catch (error) {
    console.log('[Videasy] TMDB lookup error:', error);
    return null;
  }
}

/**
 * Try to extract from a single source
 */
async function trySource(
  src: typeof SOURCES[0],
  tmdbId: string,
  title: string,
  year: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<{ source: StreamSource; subtitles?: Array<{ label: string; url: string; language: string }> } | null> {
  try {
    console.log(`[Videasy] Trying ${src.name} (${src.endpoint})...`);

    // Skip movie-only sources for TV shows
    if (src.movieOnly && type === 'tv') {
      console.log(`[Videasy] ${src.name}: Skipping (movie only)`);
      return null;
    }

    // Fetch encrypted data
    const encryptedData = await fetchFromVideasy(
      src.endpoint,
      tmdbId,
      title,
      year,
      type,
      season,
      episode,
      src.queryParams
    );

    if (!encryptedData) {
      console.log(`[Videasy] ${src.name}: No data returned`);
      return null;
    }

    // Decrypt the response
    const decrypted = await decryptVideasyResponse(encryptedData, tmdbId);

    if (!decrypted) {
      console.log(`[Videasy] ${src.name}: Decryption failed`);
      return null;
    }

    // Extract stream URL (API returns 'url' not 'file')
    let streamUrl = '';
    if (decrypted.sources && decrypted.sources.length > 0) {
      streamUrl = decrypted.sources[0].url || decrypted.sources[0].file || '';
    }

    if (!streamUrl) {
      console.log(`[Videasy] ${src.name}: No stream URL in response`);
      return null;
    }

    console.log(`[Videasy] ${src.name}: ✓ Got stream URL`);

    // Extract subtitles (check both 'subtitles' and 'tracks' arrays)
    const subtitles: Array<{ label: string; url: string; language: string }> = [];
    
    // Check subtitles array first
    if (decrypted.subtitles && decrypted.subtitles.length > 0) {
      for (const sub of decrypted.subtitles) {
        const subUrl = sub.url || sub.file;
        if (subUrl) {
          subtitles.push({
            label: sub.label || sub.lang || 'Unknown',
            url: subUrl,
            language: sub.lang || 
                     (sub.label?.toLowerCase().includes('english') ? 'en' : 
                      sub.label?.toLowerCase().includes('spanish') ? 'es' : 
                      sub.label?.toLowerCase().includes('french') ? 'fr' : 'unknown'),
          });
        }
      }
    }
    
    // Also check tracks array
    if (decrypted.tracks) {
      for (const track of decrypted.tracks) {
        if (track.kind === 'captions' || track.kind === 'subtitles' || !track.kind) {
          const trackUrl = track.url || track.file;
          if (trackUrl && !subtitles.find(s => s.url === trackUrl)) {
            subtitles.push({
              label: track.label || 'Unknown',
              url: trackUrl,
              language: track.label?.toLowerCase().includes('english') ? 'en' : 
                       track.label?.toLowerCase().includes('spanish') ? 'es' : 
                       track.label?.toLowerCase().includes('french') ? 'fr' : 'unknown',
            });
          }
        }
      }
    }

    return {
      source: {
        quality: 'auto',
        title: src.name,
        url: streamUrl,
        type: 'hls',
        referer: 'https://videasy.net/',
        requiresSegmentProxy: true,
        status: 'working',
        language: src.language,
      },
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    };
  } catch (error) {
    console.log(`[Videasy] ${src.name}: Error -`, error);
    return null;
  }
}

/**
 * Main extraction function - tries sources ONE AT A TIME until finding a working one
 * Returns immediately with the first working source for fast playback
 * Other sources are listed as "unknown" status for the user to try manually
 */
export async function extractVideasyStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  _includeAllLanguages: boolean = true
): Promise<ExtractionResult> {
  console.log(`[Videasy] Extracting sources for ${type} ID ${tmdbId} (sequential mode)...`);

  // Get title and year from TMDB
  const tmdbInfo = await getTmdbInfo(tmdbId, type);
  
  if (!tmdbInfo) {
    return {
      success: false,
      sources: [],
      error: 'Failed to get title/year from TMDB',
    };
  }

  console.log(`[Videasy] Title: "${tmdbInfo.title}", Year: ${tmdbInfo.year}`);

  // Filter sources based on type
  let sourcesToTry = SOURCES.filter(src => {
    // Skip movie-only sources for TV
    if (src.movieOnly && type === 'tv') return false;
    return true;
  });

  // Sort by priority (English first, then other languages)
  sourcesToTry.sort((a, b) => a.priority - b.priority);

  console.log(`[Videasy] Will try ${sourcesToTry.length} sources sequentially until one works...`);

  // Try sources ONE AT A TIME until we find a working one
  let workingSource: StreamSource | null = null;
  let workingSubtitles: Array<{ label: string; url: string; language: string }> = [];
  let workingSourceConfig: typeof SOURCES[0] | null = null;

  for (const src of sourcesToTry) {
    console.log(`[Videasy] Trying ${src.name} (${src.languageName})...`);
    
    const result = await trySource(src, tmdbId, tmdbInfo.title, tmdbInfo.year, type, season, episode);
    
    if (result) {
      console.log(`[Videasy] ✓ ${src.name} (${src.languageName}) WORKS! Using this source.`);
      workingSource = {
        ...result.source,
        title: `${src.name} (${src.languageName})`,
        language: src.language,
        status: 'working',
      };
      workingSubtitles = result.subtitles || [];
      workingSourceConfig = src;
      break; // Stop trying more sources - we found one that works!
    } else {
      console.log(`[Videasy] ✗ ${src.name} (${src.languageName}) failed, trying next...`);
    }
  }

  if (!workingSource || !workingSourceConfig) {
    console.error('[Videasy] All sources failed');
    return {
      success: false,
      sources: [],
      error: 'All Videasy sources unavailable',
    };
  }

  // Build the sources list: working source first, then all others as "unknown" status
  // This lets the user try other sources/languages manually from the menu
  const allSources: StreamSource[] = [workingSource];
  
  for (const src of sourcesToTry) {
    // Skip the one we already added as working
    if (src.name === workingSourceConfig.name) continue;
    
    // Add other sources as "unknown" - user can try them manually
    allSources.push({
      quality: 'auto',
      title: `${src.name} (${src.languageName})`,
      url: '', // Empty URL - will be fetched when user selects
      type: 'hls',
      referer: 'https://videasy.net/',
      requiresSegmentProxy: true,
      status: 'unknown',
      language: src.language,
    });
  }

  console.log(`[Videasy] Returning 1 working source + ${allSources.length - 1} other options`);
  
  return {
    success: true,
    sources: allSources,
    subtitles: workingSubtitles.length > 0 ? workingSubtitles : undefined,
  };
}

/**
 * Fetch a specific source by name - used when user manually selects a source from the menu
 */
export async function fetchVideasySourceByName(
  sourceName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<StreamSource | null> {
  console.log(`[Videasy] Fetching specific source: ${sourceName}`);

  // Find the source config
  const srcConfig = SOURCES.find(s => s.name === sourceName || s.name === sourceName.split(' (')[0]);
  if (!srcConfig) {
    console.error(`[Videasy] Unknown source: ${sourceName}`);
    return null;
  }

  // Get title and year from TMDB
  const tmdbInfo = await getTmdbInfo(tmdbId, type);
  if (!tmdbInfo) {
    console.error('[Videasy] Failed to get TMDB info');
    return null;
  }

  // Try the source
  const result = await trySource(srcConfig, tmdbId, tmdbInfo.title, tmdbInfo.year, type, season, episode);
  
  if (result) {
    console.log(`[Videasy] ✓ ${srcConfig.name} fetched successfully`);
    return {
      ...result.source,
      title: `${srcConfig.name} (${srcConfig.languageName})`,
      language: srcConfig.language,
      status: 'working',
    };
  }

  console.log(`[Videasy] ✗ ${srcConfig.name} failed`);
  return null;
}

// Export for testing
export { SOURCES as VIDEASY_SOURCES };
