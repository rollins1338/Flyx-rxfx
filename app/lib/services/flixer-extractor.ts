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

// Fast servers for per-server fallback (don't overwhelm RPI with all 12)
const FAST_SERVERS = ['alpha', 'bravo', 'delta', 'echo'];

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
 * 
 * Fires all 12 servers in parallel through the CF Worker.
 * Returns as soon as the first source resolves — doesn't wait for all 12.
 * Remaining sources are collected during a short grace period.
 */
export async function extractFlixerStreams(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<ExtractionResult> {
  console.log(`[Flixer] Extracting for ${type} ${tmdbId}${type === 'tv' ? ` S${season}E${episode}` : ''}`);

  if (!FLIXER_ENABLED) {
    return { success: false, sources: [], error: 'Flixer provider is disabled' };
  }

  if (type === 'tv' && (!season || !episode)) {
    return { success: false, sources: [], error: 'Season and episode required for TV shows' };
  }

  // Subtitles in parallel (don't block)
  const subtitlePromise = fetchSubtitles(tmdbId, type, season, episode);

  // Try batch endpoint first (1 RPI hop, CF Worker races 12 servers internally)
  const extractAllUrl = getFlixerExtractAllUrl(tmdbId, type, season, episode);
  try {
    const response = await cfFetch(extractAllUrl, { signal: AbortSignal.timeout(20000) });
    if (response.ok) {
      const data = await response.json() as any;
      if (data.success && data.sources?.length > 0) {
        console.log(`[Flixer] Batch: ${data.sources.length} sources in ${data.elapsed_ms}ms`);
        const subtitles = await subtitlePromise;
        return {
          success: true,
          sources: data.sources.map((s: any) => ({ ...s, status: 'working' as const })),
          subtitles: subtitles.length > 0 ? subtitles : undefined,
        };
      }
    }
    console.log(`[Flixer] Batch returned no sources, falling back to per-server`);
  } catch (e) {
    console.log(`[Flixer] Batch failed: ${e instanceof Error ? e.message : e}`);
  }

  // Fallback: race a small subset of servers (don't overwhelm RPI with 12 concurrent requests)
  console.log(`[Flixer] Per-server race: ${FAST_SERVERS.join(', ')}...`);
  const sources: StreamSource[] = [];

  const serverPromises = FAST_SERVERS.map(async (server) => {
    try {
      const extractUrl = getFlixerExtractUrl(tmdbId, type, server, season, episode);
      const response = await cfFetch(extractUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return null;
      const data: FlixerApiResponse = await response.json();
      if (data.success && data.sources?.length) {
        const mapped = data.sources.map(src => ({
          ...src,
          title: `Flixer ${SERVER_NAMES[server] || server}`,
          server,
          status: 'working' as const,
        }));
        sources.push(...mapped);
        return mapped[0];
      }
    } catch (_) {}
    return null;
  });

  // Wait for first success, then 1.5s grace for more
  const first = await Promise.any(serverPromises).catch(() => null);
  if (first) {
    await Promise.race([
      Promise.allSettled(serverPromises),
      new Promise(r => setTimeout(r, 1500)),
    ]);
  } else {
    await Promise.allSettled(serverPromises);
  }

  console.log(`[Flixer] Total: ${sources.length} source(s)`);

  if (sources.length === 0) {
    return { success: false, sources: [], error: 'No working sources from Flixer' };
  }

  const subtitles = await subtitlePromise;
  return { success: true, sources, subtitles: subtitles.length > 0 ? subtitles : undefined };
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
