/**
 * 111movies (1movies) Stream Extractor
 * 
 * FULLY REVERSE-ENGINEERED - No Puppeteer required!
 * 
 * ALGORITHM:
 * 1. Fetch page to get __NEXT_DATA__.props.pageProps.data
 * 2. Encode pageData: AES-256-CBC encrypt → hex → XOR → UTF-8 → Base64 → char substitution
 * 3. Call sources API: /{API_HASH}/{encoded}/sr
 * 4. Call stream API: /{API_HASH}/{source.data} to get m3u8 URL
 */

import * as crypto from 'crypto';

const BASE_URL = 'https://111movies.com';

// Static API hash (from bundle)
const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';

// Encryption keys (from 860-58807119fccb267b.js)
const AES_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

// Alphabet substitution
const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

// Build character map
const CHAR_MAP = new Map<string, string>();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

// Enable by default now that we have working extraction
export const ONEMOVIES_ENABLED = process.env.DISABLE_ONEMOVIES_PROVIDER !== 'true';

export interface OneMoviesSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  status: 'working' | 'unknown' | 'down';
  language?: string;
}

export interface OneMoviesExtractionResult {
  success: boolean;
  sources: OneMoviesSource[];
  error?: string;
}

interface SourceResponse {
  name: string;
  description: string;
  image: string;
  data: string;
}

interface StreamResponse {
  url: string;
  noReferrer?: boolean;
  tracks?: Array<{ file: string; label?: string; kind?: string }>;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://111movies.com/',
  'X-Requested-With': 'XMLHttpRequest',
  'Content-Type': 'application/octet-stream',
  'sec-ch-ua': '"Chromium";v="120", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

/**
 * Encode page data for API request
 * Flow: AES-256-CBC encrypt → hex → XOR → UTF-8 → Base64 → char substitution
 */
function encodePageData(pageData: string): string {
  // AES-256-CBC encrypt
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  
  // XOR each character
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  // UTF-8 encode and Base64
  const utf8Bytes = Buffer.from(xored, 'utf8');
  const base64 = utf8Bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Character substitution
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

/**
 * Get embed URL for 111movies
 */
export function getOneMoviesEmbedUrl(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number
): string {
  if (type === 'movie') {
    return `${BASE_URL}/movie/${tmdbId}`;
  } else {
    return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  }
}

/**
 * Check if 111movies has content for a given ID
 */
export async function checkOneMoviesAvailability(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number
): Promise<boolean> {
  try {
    const url = type === 'movie' 
      ? `${BASE_URL}/movie/${tmdbId}`
      : `${BASE_URL}/tv/${tmdbId}/${season || 1}/${episode || 1}`;
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': HEADERS['User-Agent'] },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch page data from 111movies page
 */
async function fetchPageData(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<string | null> {
  const url = type === 'movie'
    ? `${BASE_URL}/movie/${tmdbId}`
    : `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  
  console.log(`[1movies] Fetching page: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'User-Agent': HEADERS['User-Agent'] },
  });
  
  if (!response.ok) {
    console.log(`[1movies] Page fetch failed: ${response.status}`);
    return null;
  }
  
  const html = await response.text();
  
  // Extract __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!nextDataMatch) {
    console.log('[1movies] Could not find __NEXT_DATA__');
    return null;
  }
  
  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const pageData = nextData.props?.pageProps?.data;
    
    if (!pageData) {
      console.log('[1movies] No pageProps.data found');
      return null;
    }
    
    console.log(`[1movies] Got page data: ${pageData.substring(0, 50)}...`);
    return pageData;
  } catch (e) {
    console.log('[1movies] Failed to parse __NEXT_DATA__');
    return null;
  }
}

/**
 * Fetch available sources from 111movies
 */
async function fetchSources(encodedData: string): Promise<SourceResponse[]> {
  const url = `${BASE_URL}/${API_HASH}/${encodedData}/sr`;
  
  console.log(`[1movies] Fetching sources...`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: HEADERS,
  });
  
  if (!response.ok) {
    console.log(`[1movies] Sources fetch failed: ${response.status}`);
    return [];
  }
  
  const sources = await response.json() as SourceResponse[];
  console.log(`[1movies] Got ${sources.length} sources`);
  
  return sources;
}

/**
 * Fetch stream URL for a specific source
 */
async function fetchStreamUrl(sourceData: string): Promise<StreamResponse | null> {
  const url = `${BASE_URL}/${API_HASH}/${sourceData}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: HEADERS,
  });
  
  if (!response.ok) {
    console.log(`[1movies] Stream fetch failed: ${response.status}`);
    return null;
  }
  
  try {
    const data = await response.json() as StreamResponse;
    return data;
  } catch {
    return null;
  }
}


/**
 * Extract streams from 111movies
 */
export async function extractOneMoviesStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<OneMoviesExtractionResult> {
  if (!ONEMOVIES_ENABLED) {
    return {
      success: false,
      sources: [],
      error: '1movies provider is disabled'
    };
  }

  console.log(`[1movies] Extracting streams for ${type} ${tmdbId}${season ? ` S${season}E${episode}` : ''}`);

  try {
    // Step 1: Fetch page data
    const pageData = await fetchPageData(tmdbId, type, season, episode);
    
    if (!pageData) {
      return {
        success: false,
        sources: [],
        error: 'Content not available on 1movies'
      };
    }
    
    // Step 2: Encode page data
    const encoded = encodePageData(pageData);
    console.log(`[1movies] Encoded data length: ${encoded.length}`);
    
    // Step 3: Fetch sources
    const sources = await fetchSources(encoded);
    
    if (sources.length === 0) {
      return {
        success: false,
        sources: [],
        error: 'No sources available'
      };
    }
    
    // Step 4: Fetch stream URLs for each source (in parallel, max 3)
    const results: OneMoviesSource[] = [];
    
    // Process sources in batches of 3
    for (let i = 0; i < Math.min(sources.length, 6); i += 3) {
      const batch = sources.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(async (source) => {
          try {
            const streamData = await fetchStreamUrl(source.data);
            
            if (streamData?.url) {
              console.log(`[1movies] ✓ ${source.name}: ${streamData.url.substring(0, 60)}...`);
              return {
                quality: 'auto',
                title: `1movies ${source.name}`,
                url: streamData.url,
                type: 'hls' as const,
                referer: BASE_URL,
                requiresSegmentProxy: true,
                status: 'working' as const,
                language: 'en',
              };
            }
            
            console.log(`[1movies] ✗ ${source.name}: No URL`);
            return null;
          } catch (e) {
            console.log(`[1movies] ✗ ${source.name}: ${e instanceof Error ? e.message : 'Error'}`);
            return null;
          }
        })
      );
      
      for (const r of batchResults) {
        if (r !== null) results.push(r);
      }
      
      // If we have at least 2 working sources, stop
      if (results.length >= 2) break;
    }
    
    if (results.length === 0) {
      return {
        success: false,
        sources: [],
        error: 'Failed to extract stream URLs'
      };
    }
    
    console.log(`[1movies] Successfully extracted ${results.length} sources`);
    
    return {
      success: true,
      sources: results,
    };

  } catch (error) {
    console.error('[1movies] Extraction error:', error);
    return {
      success: false,
      sources: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch a specific source by name from 111movies
 */
export async function fetchOneMoviesSourceByName(
  sourceName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<OneMoviesSource | null> {
  if (!ONEMOVIES_ENABLED) {
    return null;
  }

  console.log(`[1movies] Fetching source by name: ${sourceName}`);

  try {
    // Extract the server name from the source title (e.g., "1movies Alpha" -> "Alpha")
    const serverName = sourceName.replace('1movies ', '');
    
    // Fetch page data
    const pageData = await fetchPageData(tmdbId, type, season, episode);
    if (!pageData) return null;
    
    // Encode and fetch sources
    const encoded = encodePageData(pageData);
    const sources = await fetchSources(encoded);
    
    // Find the matching source
    const source = sources.find(s => s.name === serverName);
    if (!source) {
      console.log(`[1movies] Source "${serverName}" not found`);
      return null;
    }
    
    // Fetch stream URL
    const streamData = await fetchStreamUrl(source.data);
    if (!streamData?.url) {
      console.log(`[1movies] No stream URL for "${serverName}"`);
      return null;
    }
    
    return {
      quality: 'auto',
      title: `1movies ${source.name}`,
      url: streamData.url,
      type: 'hls',
      referer: BASE_URL,
      requiresSegmentProxy: true,
      status: 'working',
      language: 'en',
    };
  } catch (error) {
    console.error('[1movies] fetchOneMoviesSourceByName error:', error);
    return null;
  }
}

/**
 * Get subtitles from wyzie.ru (used by 111movies)
 */
export async function getOneMoviesSubtitles(
  tmdbId: string
): Promise<Array<{ url: string; label: string; language: string }>> {
  try {
    const response = await fetch(`https://sub.wyzie.ru/search?id=${tmdbId}&format=srt`, {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
    });
    
    if (!response.ok) {
      console.log(`[1movies] Subtitles fetch failed: ${response.status}`);
      return [];
    }

    const subtitles = await response.json();
    
    return subtitles.slice(0, 20).map((sub: { url: string; display?: string; language: string }) => ({
      url: sub.url,
      label: sub.display || sub.language,
      language: sub.language,
    }));
  } catch (error) {
    console.error('[1movies] Subtitles error:', error);
    return [];
  }
}

export default {
  ONEMOVIES_ENABLED,
  getOneMoviesEmbedUrl,
  extractOneMoviesStreams,
  fetchOneMoviesSourceByName,
  getOneMoviesSubtitles,
  checkOneMoviesAvailability,
};
