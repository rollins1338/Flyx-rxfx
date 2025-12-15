/**
 * SmashyStream Extractor
 * 
 * STATUS: DISABLED - API is currently down (522 errors)
 * 
 * ============================================================================
 * TOKEN GENERATION ALGORITHM - SUCCESSFULLY REVERSE ENGINEERED (December 2024)
 * ============================================================================
 * 
 * TOKEN FORMAT:
 *   {part1}.{part2}.{unix_timestamp}
 *   - Part 1: 36 characters (starts with "7f6_" when properly initialized)
 *   - Part 2: 22 characters
 *   - Part 3: Unix timestamp in seconds
 *   Example: 7f6_Uvi5w9kiubAtfgbkk3aa5xZzHL5YgY7a.IBxPrs2bvwbVcXbMU0eL9Q.1765755375
 * 
 * TOKEN GENERATION:
 *   - WASM module: tkk4.wasm (937KB) from https://player.smashystream.com/js/tkk4.wasm
 *   - Function: Module.cwrap('gewe_town', 'string', ['string'])
 *   - Input: "https://player.smashystream.com" + "TAxcjBGffNfvY" (constant suffix)
 *   - Full input: "https://player.smashystream.comTAxcjBGffNfvY"
 * 
 * USER ID FORMAT:
 *   {8-char-prefix}_{32-char-hex}
 *   Example: 8E4A4253_00c7fb9880a5db8c353db5c26423bcb3
 *   Generated from: WASM fingerprint + FingerprintJS visitor ID
 * 
 * API ENDPOINTS:
 *   - Data: https://api.smashystream.top/api/v1/data?tmdb={id}&token={token}&user_id={user_id}
 *   - Stream: https://api.smashystream.top/api/v1/videosmashyi/{imdb}/{tmdb}?token={token}&user_id={user_id}
 *   - Other: videozoan, videogoan, videophan, videoflxt, videostc, videoophim
 * 
 * IMPORTANT NOTES:
 *   1. WASM has internal state - first call produces "7f6_" prefix, subsequent calls vary
 *   2. Must be initialized in browser context with SmashyStream player page loaded
 *   3. Tokens are timestamp-based and expire
 *   4. API currently returning 522 errors (server down as of Dec 2024)
 * 
 * IMPLEMENTATION:
 *   Use Puppeteer to maintain browser context and generate tokens:
 *   ```
 *   await page.goto('https://player.smashystream.com/movie/155');
 *   const token = await page.evaluate(() => {
 *     const tokenFunc = Module.cwrap('gewe_town', 'string', ['string']);
 *     return tokenFunc('https://player.smashystream.comTAxcjBGffNfvY');
 *   });
 *   ```
 * 
 * See: source-testing/SMASHYSTREAM_TOKEN_ALGORITHM.md for full details
 * See: source-testing/tests/smashystream-token-service.js for working implementation
 */

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls' | 'mp4';
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

// API Configuration
const SMASHY_EMBED_BASE = 'https://embed.smashystream.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Rate limiting
const MIN_DELAY_MS = 500;
let lastRequestTime = 0;

async function rateLimitDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const requiredDelay = Math.max(0, MIN_DELAY_MS - timeSinceLastRequest);
  
  if (requiredDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, requiredDelay));
  }
  lastRequestTime = Date.now();
}

/**
 * Fetch streams from dude.php endpoint
 * NOTE: These URLs are IP-locked and will return 404 when accessed directly
 */
async function fetchDudePhpStreams(
  imdbId: string,
  season?: number,
  episode?: number
): Promise<{ streams: Array<{ title: string; url: string }>; error?: string }> {
  try {
    await rateLimitDelay();
    
    let url = `${SMASHY_EMBED_BASE}/dude.php?imdb=${imdbId}`;
    if (season !== undefined && episode !== undefined) {
      url += `&season=${season}&episode=${episode}`;
    }

    console.log(`[SmashyStream] Fetching dude.php: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      headers: {
        ...HEADERS,
        'Referer': 'https://smashystream.com/',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[SmashyStream] HTTP ${response.status}`);
      return { streams: [], error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    
    // Extract stream URLs from Playerjs config
    const filePattern = /"file"\s*:\s*"(https?:[^"]+)"/g;
    const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
    
    const urls: string[] = [];
    const titles: string[] = [];
    
    let match;
    while ((match = filePattern.exec(html)) !== null) {
      const streamUrl = match[1].replace(/\\\//g, '/');
      if (streamUrl.includes('m3u8') || streamUrl.includes('mp4')) {
        urls.push(streamUrl);
      }
    }
    
    while ((match = titlePattern.exec(html)) !== null) {
      titles.push(match[1]);
    }
    
    if (urls.length === 0) {
      return { streams: [], error: 'No stream URLs found in response' };
    }
    
    const streams = urls.map((url, i) => ({
      title: titles[i] || `Stream ${i + 1}`,
      url,
    }));
    
    console.log(`[SmashyStream] Found ${streams.length} stream(s) from dude.php`);
    console.log(`[SmashyStream] WARNING: These URLs are IP-locked and will return 404`);
    
    return { streams };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { streams: [], error: 'Timeout' };
    }
    return { streams: [], error: String(error) };
  }
}

/**
 * Main extraction function
 * 
 * NOTE: This extractor is disabled because:
 * 1. dude.php returns IP-locked URLs that only work from SmashyStream's server
 * 2. The main API requires authentication tokens we cannot generate
 */
export async function extractSmashyStreamStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  imdbId?: string
): Promise<ExtractionResult> {
  console.log(`[SmashyStream] Extracting ${type} ID ${tmdbId}${type === 'tv' ? ` S${season}E${episode}` : ''}...`);

  // We need IMDB ID for dude.php
  if (!imdbId) {
    return {
      success: false,
      sources: [],
      error: 'SmashyStream requires IMDB ID (dude.php endpoint)',
    };
  }

  // Try dude.php endpoint
  const result = await fetchDudePhpStreams(
    imdbId,
    type === 'tv' ? season : undefined,
    type === 'tv' ? episode : undefined
  );

  if (result.error || result.streams.length === 0) {
    return {
      success: false,
      sources: [],
      error: result.error || 'No streams found',
    };
  }

  // Convert to StreamSource format
  // NOTE: These URLs will NOT work due to IP locking
  const sources: StreamSource[] = result.streams.map(stream => ({
    quality: 'auto',
    title: `SmashyStream (${stream.title})`,
    url: stream.url,
    type: stream.url.includes('.m3u8') ? 'hls' as const : 'mp4' as const,
    referer: 'https://embed.smashystream.com/',
    requiresSegmentProxy: true,
    status: 'unknown' as const, // Unknown because IP-locked
    language: stream.title.toLowerCase().includes('hindi') ? 'hi' : 'en',
  }));

  return {
    success: true,
    sources,
    // Note: Subtitles would need to be extracted separately
  };
}

/**
 * Fetch a specific source by name
 */
export async function fetchSmashyStreamSourceByName(
  _sourceName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number,
  imdbId?: string
): Promise<StreamSource | null> {
  const result = await extractSmashyStreamStreams(tmdbId, type, season, episode, imdbId);
  
  if (result.success && result.sources.length > 0) {
    return result.sources[0];
  }

  return null;
}

/**
 * DISABLED: SmashyStream streams are IP-locked to their server
 * 
 * The dude.php endpoint returns valid M3U8 URLs, but they contain IP validation
 * that only allows access from SmashyStream's server IP (185.237.106.42).
 * 
 * When accessed from any other IP, the streams return 404 Not Found.
 * 
 * This is a server-side proxy pattern where SmashyStream's player.js
 * handles the stream proxying internally.
 */
export const SMASHYSTREAM_ENABLED = false;
