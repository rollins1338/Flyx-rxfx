/**
 * Flixer.sh Extractor - Cloudflare Worker Implementation
 * 
 * This extractor routes all requests through the Cloudflare Worker at /flixer/extract.
 * The WASM-based encryption/decryption runs in the CF Worker (bundled at build time).
 * 
 * Key discoveries from cracking:
 * - The `bW90aGFmYWth` header BLOCKS requests when present - must NOT send it
 * - The `Origin` header should NOT be sent
 * - A "warm-up" request is needed before the actual request
 * - WASM must be bundled with CF Worker, not fetched at runtime
 */

import { getFlixerExtractUrl, getFlixerExtractAllUrl } from '../proxy-config';
import { cfFetch } from '../utils/cf-fetch';

interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls' | 'mp4';
  referer: string;
  requiresSegmentProxy: boolean;
  status?: 'working' | 'down' | 'unknown';
  language?: string;
  server?: string;
}

interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  subtitles?: Array<{ label: string; url: string; language: string }>;
  error?: string;
}

interface FlixerApiResponse {
  success: boolean;
  sources?: StreamSource[];
  error?: string;
  server?: string;
}

const FLIXER_BASE_URL = 'https://flixer.sh';
const SUBTITLE_API = 'https://sub.wyzie.ru';

// Flixer is back online (February 2026) — PRIMARY provider for movies and TV
export const FLIXER_ENABLED = true;

const SERVER_NAMES: Record<string, string> = {
  alpha: 'Ares',
  bravo: 'Balder',
  charlie: 'Circe',
  delta: 'Dionysus',
  echo: 'Eros',
  foxtrot: 'Freya',
  golf: 'Gaia',
  hotel: 'Hera',
  india: 'Iris',
  juliet: 'Juno',
  kilo: 'Kali',
  lima: 'Loki',
};

// All 12 NATO servers — charlie/golf sometimes return E58 but the rest are solid
const NATO_ORDER = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'];

async function fetchSubtitles(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<Array<{ label: string; url: string; language: string }>> {
  try {
    let url = `${SUBTITLE_API}/search?id=${tmdbId}`;
    if (type === 'tv' && season && episode) {
      url += `&season=${season}&episode=${episode}`;
    }
    // Direct fetch — subtitle API doesn't block datacenter IPs
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': FLIXER_BASE_URL },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((sub: any) => ({
        label: sub.label || sub.lang || 'Unknown',
        url: sub.url || sub.file || '',
        language: sub.lang || 'en',
      }))
      .filter((s: any) => s.url);
  } catch {
    return [];
  }
}

/**
 * Extract streams from Flixer via Cloudflare Worker
 * The CF Worker handles WASM-based encryption/decryption
 * 
 * Uses /flixer/extract-all to fetch ALL servers in a single request.
 * The CF Worker fans out to all 12 servers in parallel internally.
 * 
 * On CF Pages, we must use cfFetch (routes through RPI) to reach our own
 * CF Worker due to same-account fetch limitations. But we only make ONE
 * request instead of 12, so the RPI hop only happens once.
 */
export async function extractFlixerStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[Flixer] Extracting streams for ${type} ID ${tmdbId}${type === 'tv' ? ` S${season}E${episode}` : ''}`);

  if (!FLIXER_ENABLED) {
    return { success: false, sources: [], error: 'Flixer provider is disabled' };
  }

  if (type === 'tv' && (!season || !episode)) {
    return { success: false, sources: [], error: 'Season and episode required for TV shows' };
  }

  // Start subtitle fetch in parallel with extraction (don't block on it)
  // Subtitle API is public, no RPI needed
  const subtitlePromise = fetchSubtitles(tmdbId, type, season, episode);

  // ONE batch request to CF Worker — it fans out to all 12 servers internally.
  // cfFetch routes through RPI on CF Pages (same-account worker limitation),
  // but that's 1 RPI hop instead of the old 12.
  let allSources: StreamSource[] = [];
  const extractAllUrl = getFlixerExtractAllUrl(tmdbId, type, season, episode);

  try {
    console.log(`[Flixer] Batch extract-all (single request)...`);
    const response = await cfFetch(extractAllUrl, {
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const data: FlixerApiResponse & { successCount?: number; failures?: string[] } = await response.json();
      if (data.success && data.sources && data.sources.length > 0) {
        allSources = data.sources.map(src => ({
          ...src,
          status: 'working' as const,
        }));
        console.log(`[Flixer] Batch extract returned ${allSources.length} sources`);
      } else {
        console.log(`[Flixer] Batch extract returned no sources: ${data.error || 'empty'}`);
      }
    } else {
      const body = await response.text().catch(() => '');
      console.log(`[Flixer] Batch extract HTTP ${response.status}: ${body.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`[Flixer] Batch extract error: ${e instanceof Error ? e.message : e}`);
  }

  // Fallback: per-server parallel requests (if batch endpoint not deployed yet)
  if (allSources.length === 0) {
    console.log(`[Flixer] Falling back to per-server extraction...`);
    const serverResults = await Promise.allSettled(
      NATO_ORDER.map(async (server) => {
        const extractUrl = getFlixerExtractUrl(tmdbId, type, server, season, episode);
        const response = await cfFetch(extractUrl, { signal: AbortSignal.timeout(15000) });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${body.substring(0, 100)}`);
        }

        const data: FlixerApiResponse = await response.json();

        if (data.success && data.sources && data.sources.length > 0) {
          const serverDisplayName = SERVER_NAMES[server] || server;
          return data.sources.map(src => ({
            ...src,
            title: `Flixer ${serverDisplayName}`,
            server: server,
            status: 'working' as const,
          }));
        }
        throw new Error(data.error || 'No sources');
      })
    );

    for (let i = 0; i < serverResults.length; i++) {
      const result = serverResults[i];
      if (result.status === 'fulfilled') {
        allSources.push(...result.value);
      } else {
        console.log(`[Flixer] Server ${NATO_ORDER[i]} failed: ${result.reason?.message || result.reason}`);
      }
    }
  }

  console.log(`[Flixer] Total: ${allSources.length} source(s)`);

  if (allSources.length === 0) {
    return { success: false, sources: [], error: 'No working sources available from Flixer' };
  }

  const subtitles = await subtitlePromise;
  return { success: true, sources: allSources, subtitles: subtitles.length > 0 ? subtitles : undefined };
}

/**
 * Fetch a specific Flixer source by display name
 */
export async function fetchFlixerSourceByName(
  sourceName: string,
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<StreamSource | null> {
  // Find server by display name (e.g., "Flixer Ares" -> "alpha")
  const serverEntry = Object.entries(SERVER_NAMES).find(([_, displayName]) =>
    sourceName.toLowerCase().includes(displayName.toLowerCase())
  );
  const server = serverEntry ? serverEntry[0] : 'alpha';

  try {
    const extractUrl = getFlixerExtractUrl(tmdbId, type, server, season, episode);
    
    const response = await cfFetch(extractUrl, {
      signal: AbortSignal.timeout(20000),
    });
    
    if (!response.ok) {
      console.error(`[Flixer] fetchFlixerSourceByName: HTTP ${response.status}`);
      return null;
    }
    
    const data: FlixerApiResponse = await response.json();
    
    if (data.success && data.sources && data.sources.length > 0) {
      return data.sources[0];
    }
  } catch (e) {
    console.error('[Flixer] fetchFlixerSourceByName error:', e);
  }

  return null;
}
