/**
 * Proxy Configuration
 * 
 * REQUIRES Cloudflare Workers for stream proxying.
 * Set NEXT_PUBLIC_CF_STREAM_PROXY_URL and NEXT_PUBLIC_CF_TV_PROXY_URL env vars.
 * 
 * Live TV Proxy Options:
 *   - /tv/   - Direct fetch with RPI proxy fallback (faster, but may be blocked)
 *   - /dlhd/ - Oxylabs residential proxy (more reliable, uses residential IPs)
 * 
 * Set NEXT_PUBLIC_USE_DLHD_PROXY=true to use Oxylabs residential proxies for Live TV.
 * 
 * No fallback to Vercel Edge - Cloudflare Workers are required for proper
 * stream proxying with correct headers and CORS handling.
 */

// Stream proxy for HLS streams (2embed, moviesapi, etc.)
export function getStreamProxyUrl(
  url: string,
  source: string = '2embed',
  referer: string = 'https://www.2embed.cc',
  skipOrigin: boolean = false
): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
  
  if (!cfProxyUrl) {
    console.error('[proxy-config] NEXT_PUBLIC_CF_STREAM_PROXY_URL is not set! Cloudflare Worker is required.');
    throw new Error('Stream proxy not configured. Set NEXT_PUBLIC_CF_STREAM_PROXY_URL environment variable.');
  }
  
  // Strip trailing slash if present to avoid double slashes
  const baseUrl = cfProxyUrl.replace(/\/+$/, '');
  
  // Add noreferer param for sources that block requests with Origin header (like MegaUp CDN)
  const noRefParam = skipOrigin ? '&noreferer=true' : '';
  return `${baseUrl}?url=${encodeURIComponent(url)}&source=${source}&referer=${encodeURIComponent(referer)}${noRefParam}`;
}

// Check if DLHD proxy (Oxylabs residential) should be used for Live TV
export function useDlhdProxy(): boolean {
  return process.env.NEXT_PUBLIC_USE_DLHD_PROXY === 'true';
}

// TV proxy base URL for DLHD live streams
export function getTvProxyBaseUrl(): string {
  let cfProxyUrl = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL;
  
  if (!cfProxyUrl) {
    console.error('[proxy-config] NEXT_PUBLIC_CF_TV_PROXY_URL is not set! Cloudflare Worker is required.');
    throw new Error('TV proxy not configured. Set NEXT_PUBLIC_CF_TV_PROXY_URL environment variable.');
  }
  
  // Strip trailing /tv or /dlhd if present (for backwards compatibility)
  // The route is now determined by NEXT_PUBLIC_USE_DLHD_PROXY
  cfProxyUrl = cfProxyUrl.replace(/\/(tv|dlhd)\/?$/, '');
  
  return cfProxyUrl;
}

// Get the TV proxy route path based on configuration
// Returns '/dlhd' for Oxylabs residential proxy, '/tv' for direct/RPI fallback
function getTvProxyRoute(): string {
  return useDlhdProxy() ? '/dlhd' : '/tv';
}

// Get TV playlist URL
// Uses /dlhd route (Oxylabs residential) if NEXT_PUBLIC_USE_DLHD_PROXY=true
// Otherwise uses /tv route (direct fetch with RPI fallback)
export function getTvPlaylistUrl(channel: string): string {
  const baseUrl = getTvProxyBaseUrl();
  const route = getTvProxyRoute();
  return `${baseUrl}${route}?channel=${channel}`;
}

// Get TV key proxy URL
export function getTvKeyProxyUrl(keyUrl: string): string {
  const baseUrl = getTvProxyBaseUrl();
  const route = getTvProxyRoute();
  return `${baseUrl}${route}/key?url=${encodeURIComponent(keyUrl)}`;
}

// Get TV segment proxy URL
export function getTvSegmentProxyUrl(segmentUrl: string): string {
  const baseUrl = getTvProxyBaseUrl();
  const route = getTvProxyRoute();
  return `${baseUrl}${route}/segment?url=${encodeURIComponent(segmentUrl)}`;
}

// PPV stream proxy URL - uses dedicated /ppv/stream route
// This route has proper Referer handling for pooembed.top streams
export function getPpvStreamProxyUrl(url: string): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
  
  if (!cfProxyUrl) {
    throw new Error('PPV proxy not configured. Set NEXT_PUBLIC_CF_STREAM_PROXY_URL environment variable.');
  }
  
  // Strip trailing /stream suffix if present to get base URL
  const baseUrl = cfProxyUrl.replace(/\/stream\/?$/, '').replace(/\/+$/, '');
  // Use dedicated /ppv/stream route which has proper referer handling and URL rewriting
  return `${baseUrl}/ppv/stream?url=${encodeURIComponent(url)}`;
}

// CDN-Live stream proxy URL - uses dedicated /cdn-live/stream route
// This route has proper Referer handling and URL rewriting for CDN-Live streams
export function getCdnLiveStreamProxyUrl(url: string): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
  
  if (!cfProxyUrl) {
    throw new Error('CDN-Live proxy not configured. Set NEXT_PUBLIC_CF_STREAM_PROXY_URL environment variable.');
  }
  
  // Strip trailing /stream suffix if present to get base URL
  const baseUrl = cfProxyUrl.replace(/\/stream\/?$/, '').replace(/\/+$/, '');
  // Use dedicated /cdn-live/stream route which has proper referer handling and URL rewriting
  return `${baseUrl}/cdn-live/stream?url=${encodeURIComponent(url)}`;
}

// Check if Cloudflare Workers are configured (required)
export function isCloudflareProxyConfigured(): {
  stream: boolean;
  tv: boolean;
  dlhd: boolean;
} {
  return {
    stream: !!process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL,
    tv: !!process.env.NEXT_PUBLIC_CF_TV_PROXY_URL,
    dlhd: useDlhdProxy(),
  };
}

// IPTV Stalker Portal proxy configuration
// Uses RPi residential proxy to bypass datacenter IP blocking
export function getIPTVProxyUrl(): string | null {
  // Client-side: use public env var
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_RPI_PROXY_URL || null;
  }
  // Server-side: use server env var
  return process.env.RPI_PROXY_URL || null;
}

export function getIPTVProxyKey(): string | null {
  // Client-side: use public env var
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_RPI_PROXY_KEY || null;
  }
  // Server-side: use server env var
  return process.env.RPI_PROXY_KEY || null;
}

// Get IPTV stream URL through RPi proxy
export function getIPTVStreamProxyUrl(
  streamUrl: string,
  mac?: string,
  token?: string
): string | null {
  const proxyUrl = getIPTVProxyUrl();
  if (!proxyUrl) return null;
  
  const params = new URLSearchParams({ url: streamUrl });
  if (mac) params.set('mac', mac);
  if (token) params.set('token', token);
  
  return `${proxyUrl}/iptv/stream?${params.toString()}`;
}

// ============================================================================
// AnimeKai Proxy Configuration
// ============================================================================
// AnimeKai uses MegaUp CDN which blocks:
//   1. Datacenter IPs (Cloudflare, AWS, etc.)
//   2. Requests with Origin header
// 
// The /animekai route on Cloudflare Worker forwards to RPI residential proxy
// which fetches without Origin/Referer headers from a residential IP.
// ============================================================================

/**
 * Check if AnimeKai proxy is configured
 * Requires NEXT_PUBLIC_CF_STREAM_PROXY_URL to be set
 */
export function isAnimeKaiProxyConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
}

/**
 * Get AnimeKai stream proxy URL
 * Routes through Cloudflare Worker -> RPI Proxy -> MegaUp CDN
 * 
 * @param url - The MegaUp CDN stream URL (m3u8 or segment)
 * @returns Proxied URL through Cloudflare /animekai route
 */
export function getAnimeKaiProxyUrl(url: string): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
  
  if (!cfProxyUrl) {
    console.error('[proxy-config] NEXT_PUBLIC_CF_STREAM_PROXY_URL is not set! AnimeKai proxy requires Cloudflare Worker.');
    throw new Error('AnimeKai proxy not configured. Set NEXT_PUBLIC_CF_STREAM_PROXY_URL environment variable.');
  }
  
  // Use /animekai route which forwards to RPI residential proxy
  // Strip /stream suffix if present (the base URL might include it)
  const baseUrl = cfProxyUrl.replace(/\/stream\/?$/, '');
  
  return `${baseUrl}/animekai?url=${encodeURIComponent(url)}`;
}

/**
 * Check if a URL is from AnimeKai CDN (requires RPI residential proxy)
 * 
 * AnimeKai uses multiple CDN domains that ALL block:
 *   1. Datacenter IPs (Cloudflare, AWS, Vercel, etc.)
 *   2. Requests with Origin header
 * 
 * ALL these domains need to go through the /animekai route -> RPI proxy
 */
export function isMegaUpCdnUrl(url: string): boolean {
  // MegaUp CDN domains
  if (url.includes('megaup') || 
      url.includes('hub26link') || 
      url.includes('app28base')) {
    return true;
  }
  
  // Other AnimeKai CDN domains that also block datacenter IPs
  // These are used by different servers (Mega, Rapid, etc.)
  if (url.includes('code29wave') ||    // rrr.code29wave.site
      url.includes('pro25zone') ||     // rrr.pro25zone.site
      url.includes('rapidshare') ||
      url.includes('rapid-cloud') ||
      url.includes('rabbitstream') ||
      url.includes('vidcloud') ||
      url.includes('dokicloud')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a URL is from 1movies CDN (requires RPI residential proxy)
 * 
 * 1movies uses Cloudflare Workers CDN domains that block:
 *   1. Datacenter IPs (Cloudflare, AWS, Vercel, etc.)
 *   2. Requests from other Cloudflare Workers
 * 
 * These domains need to go through the /animekai route -> RPI proxy
 */
export function is1moviesCdnUrl(url: string): boolean {
  // 1movies CDN domains - Cloudflare Workers that block datacenter IPs
  // Pattern: p.XXXXX.workers.dev (e.g., p.10014.workers.dev)
  if (url.includes('.workers.dev')) {
    // Check for 1movies-specific patterns
    if (url.includes('p.') && url.match(/p\.\d+\.workers\.dev/)) {
      return true;
    }
    // Also check for other 1movies CDN patterns
    if (url.includes('dewshine') || url.includes('afc7d47f')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a source is from AnimeKai provider (all AnimeKai sources need RPI proxy)
 */
export function isAnimeKaiSource(source: { title?: string; referer?: string }): boolean {
  if (source.title?.toLowerCase().includes('animekai')) return true;
  if (source.referer?.includes('animekai.to')) return true;
  return false;
}


// ============================================================================
// Flixer Proxy Configuration
// ============================================================================
// Flixer uses WASM-based encryption that runs in the Cloudflare Worker.
// The /flixer route handles key generation, API requests, and decryption.
// ============================================================================

/**
 * Check if Flixer proxy is configured
 * Requires NEXT_PUBLIC_CF_STREAM_PROXY_URL to be set
 */
export function isFlixerProxyConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
}

/**
 * Get Flixer extraction URL via Cloudflare Worker
 * 
 * @param tmdbId - TMDB ID of the content
 * @param type - 'movie' or 'tv'
 * @param server - Server name (alpha, bravo, charlie, delta, echo, foxtrot)
 * @param season - Season number (for TV)
 * @param episode - Episode number (for TV)
 * @returns URL to the Cloudflare /flixer/extract endpoint
 */
export function getFlixerExtractUrl(
  tmdbId: string,
  type: 'movie' | 'tv',
  server: string = 'alpha',
  season?: number,
  episode?: number
): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
  
  if (!cfProxyUrl) {
    throw new Error('NEXT_PUBLIC_CF_STREAM_PROXY_URL is not set');
  }
  
  // Strip /stream suffix if present
  const baseUrl = cfProxyUrl.replace(/\/stream\/?$/, '');
  
  const params = new URLSearchParams({
    tmdbId,
    type,
    server,
  });
  
  if (type === 'tv' && season && episode) {
    params.set('season', season.toString());
    params.set('episode', episode.toString());
  }
  
  return `${baseUrl}/flixer/extract?${params.toString()}`;
}

/**
 * Check if a URL is from Flixer CDN
 */
export function isFlixerCdnUrl(url: string): boolean {
  // Flixer uses Cloudflare Workers CDN
  return url.includes('flixer') || url.includes('plsdontscrapemelove');
}
