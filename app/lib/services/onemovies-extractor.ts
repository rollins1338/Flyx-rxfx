/**
 * 1movies/yflix Extractor - Primary Video Source
 * 
 * Uses the videasy.net API with the 1movies endpoint for reliable extraction.
 * The videasy API handles all the complexity internally and returns m3u8 directly.
 * 
 * Flow:
 * 1. Get TMDB info (title, year)
 * 2. Call videasy API: api.videasy.net/1movies/sources-with-title
 * 3. Decrypt response via enc-dec.app/api/dec-videasy
 * 4. Return m3u8 URL
 * 
 * Response format from dec-videasy:
 * {
 *   "sources": [{ "url": "https://rrr.swift38path.site/.../list.m3u8" }],
 *   "tracks": [{ "file": "https://z78.rapidshare.cc/.../thumbnails.vtt", "kind": "thumbnails" }]
 * }
 */

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  status: 'working' | 'down' | 'unknown';
  language: string;
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
const DECRYPTION_API = 'https://enc-dec.app/api';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'keep-alive',
};

/**
 * Fetch encrypted data from Videasy API (1movies endpoint)
 */
async function fetchFrom1Movies(
  tmdbId: string,
  title: string,
  year: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<string | null> {
  try {
    // Build URL for 1movies endpoint
    let url = `${VIDEASY_API_BASE}/1movies/sources-with-title?title=${encodeURIComponent(title)}&mediaType=${type}&year=${year}&tmdbId=${tmdbId}`;
    
    if (type === 'tv' && season !== undefined && episode !== undefined) {
      url += `&seasonId=${season}&episodeId=${episode}`;
    }

    console.log(`[1movies] Fetching: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[1movies] HTTP ${response.status}`);
      return null;
    }

    const text = await response.text();
    
    if (!text || text.trim() === '' || text.includes('error') || text.includes('Error')) {
      console.log(`[1movies] Empty or error response`);
      return null;
    }

    console.log(`[1movies] Got encrypted response (${text.length} chars)`);
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[1movies] Timeout`);
    } else {
      console.log(`[1movies] Error:`, error);
    }
    return null;
  }
}

/**
 * Decrypt Videasy response using enc-dec.app/api/dec-videasy
 */
async function decryptVideasyResponse(encryptedText: string, tmdbId: string): Promise<VideasyResponse | null> {
  try {
    console.log(`[1movies] Decrypting response via dec-videasy...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
      console.log(`[1movies] Decryption failed: HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    
    if (!json.result) {
      console.log('[1movies] Decryption returned no result');
      return null;
    }

    // Parse the decrypted result
    let decrypted: VideasyResponse;
    if (typeof json.result === 'string') {
      try {
        decrypted = JSON.parse(json.result);
      } catch {
        console.log('[1movies] Failed to parse decrypted JSON');
        return null;
      }
    } else {
      decrypted = json.result;
    }

    console.log('[1movies] Decryption successful');
    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[1movies] Decryption timeout');
    } else {
      console.log('[1movies] Decryption error:', error);
    }
    return null;
  }
}

/**
 * Get TMDB info (title and year)
 */
async function getTmdbInfo(tmdbId: string, type: 'movie' | 'tv'): Promise<{ title: string; year: string } | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      console.error('[1movies] TMDB API key not configured');
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
      console.log(`[1movies] TMDB lookup failed: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    const title = type === 'movie' ? data.title : data.name;
    const dateStr = type === 'movie' ? data.release_date : data.first_air_date;
    const year = dateStr ? dateStr.split('-')[0] : '';

    if (!title) {
      console.log('[1movies] Missing title from TMDB');
      return null;
    }

    return { title, year };
  } catch (error) {
    console.log('[1movies] TMDB lookup error:', error);
    return null;
  }
}

/**
 * Main extraction function for 1movies/yflix
 */
export async function extractOneMoviesStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[1movies] Extracting ${type} ID ${tmdbId}${type === 'tv' ? ` S${season}E${episode}` : ''}...`);

  // Get title from TMDB
  const tmdbInfo = await getTmdbInfo(tmdbId, type);
  if (!tmdbInfo) {
    return {
      success: false,
      sources: [],
      error: 'Failed to get title from TMDB',
    };
  }

  console.log(`[1movies] Title: "${tmdbInfo.title}", Year: ${tmdbInfo.year}`);

  // Fetch encrypted data from videasy 1movies endpoint
  const encryptedData = await fetchFrom1Movies(
    tmdbId,
    tmdbInfo.title,
    tmdbInfo.year,
    type,
    season,
    episode
  );

  if (!encryptedData) {
    return {
      success: false,
      sources: [],
      error: 'Failed to fetch from 1movies endpoint',
    };
  }

  // Decrypt the response
  const decrypted = await decryptVideasyResponse(encryptedData, tmdbId);

  if (!decrypted) {
    return {
      success: false,
      sources: [],
      error: 'Failed to decrypt 1movies response',
    };
  }

  // Extract stream URL
  let streamUrl = '';
  if (decrypted.sources && decrypted.sources.length > 0) {
    streamUrl = decrypted.sources[0].url || decrypted.sources[0].file || '';
  }

  if (!streamUrl) {
    return {
      success: false,
      sources: [],
      error: 'No stream URL in 1movies response',
    };
  }

  console.log(`[1movies] ✓ Got stream URL: ${streamUrl.substring(0, 80)}...`);

  // Build sources array
  const sources: StreamSource[] = [{
    quality: 'auto',
    title: '1movies',
    url: streamUrl,
    type: 'hls',
    referer: 'https://videasy.net/',
    requiresSegmentProxy: true,
    status: 'working',
    language: 'en',
  }];

  // Extract subtitles
  const subtitles: Array<{ label: string; url: string; language: string }> = [];
  
  if (decrypted.subtitles && decrypted.subtitles.length > 0) {
    for (const sub of decrypted.subtitles) {
      const subUrl = sub.url || sub.file;
      if (subUrl) {
        subtitles.push({
          label: sub.label || sub.lang || 'Unknown',
          url: subUrl,
          language: sub.lang || 'en',
        });
      }
    }
  }
  
  if (decrypted.tracks) {
    for (const track of decrypted.tracks) {
      if (track.kind === 'captions' || track.kind === 'subtitles' || !track.kind) {
        const trackUrl = track.url || track.file;
        if (trackUrl && !subtitles.find(s => s.url === trackUrl)) {
          subtitles.push({
            label: track.label || 'Unknown',
            url: trackUrl,
            language: 'en',
          });
        }
      }
    }
  }

  console.log(`[1movies] Returning 1 working source${subtitles.length > 0 ? ` + ${subtitles.length} subtitles` : ''}`);

  return {
    success: true,
    sources,
    subtitles: subtitles.length > 0 ? subtitles : undefined,
  };
}

/**
 * Fetch a specific 1movies source (for manual selection)
 */
export async function fetchOneMoviesSourceByName(
  _serverName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<StreamSource | null> {
  console.log(`[1movies] Fetching source for ${type} ID ${tmdbId}`);

  const result = await extractOneMoviesStreams(tmdbId, type, season, episode);
  
  if (result.success && result.sources.length > 0) {
    return result.sources[0];
  }

  return null;
}

// Export enabled flag
export const ONEMOVIES_ENABLED = true;
