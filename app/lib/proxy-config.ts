/**
 * Proxy Configuration
 * 
 * REQUIRES Cloudflare Workers for stream proxying.
 * Set NEXT_PUBLIC_CF_STREAM_PROXY_URL and NEXT_PUBLIC_CF_TV_PROXY_URL env vars.
 * 
 * No fallback to Vercel Edge - Cloudflare Workers are required for proper
 * stream proxying with correct headers and CORS handling.
 */

// Stream proxy for HLS streams (2embed, moviesapi, etc.)
export function getStreamProxyUrl(
  url: string,
  source: string = '2embed',
  referer: string = 'https://www.2embed.cc'
): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL;
  
  if (!cfProxyUrl) {
    console.error('[proxy-config] NEXT_PUBLIC_CF_STREAM_PROXY_URL is not set! Cloudflare Worker is required.');
    throw new Error('Stream proxy not configured. Set NEXT_PUBLIC_CF_STREAM_PROXY_URL environment variable.');
  }
  
  return `${cfProxyUrl}/?url=${encodeURIComponent(url)}&source=${source}&referer=${encodeURIComponent(referer)}`;
}

// TV proxy base URL for DLHD live streams
export function getTvProxyBaseUrl(): string {
  const cfProxyUrl = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL;
  
  if (!cfProxyUrl) {
    console.error('[proxy-config] NEXT_PUBLIC_CF_TV_PROXY_URL is not set! Cloudflare Worker is required.');
    throw new Error('TV proxy not configured. Set NEXT_PUBLIC_CF_TV_PROXY_URL environment variable.');
  }
  
  return cfProxyUrl;
}

// Get TV playlist URL
export function getTvPlaylistUrl(channel: string): string {
  const baseUrl = getTvProxyBaseUrl();
  return `${baseUrl}/?channel=${channel}`;
}

// Get TV key proxy URL
export function getTvKeyProxyUrl(keyUrl: string): string {
  const baseUrl = getTvProxyBaseUrl();
  return `${baseUrl}/key?url=${encodeURIComponent(keyUrl)}`;
}

// Get TV segment proxy URL
export function getTvSegmentProxyUrl(segmentUrl: string): string {
  const baseUrl = getTvProxyBaseUrl();
  return `${baseUrl}/segment?url=${encodeURIComponent(segmentUrl)}`;
}

// Check if Cloudflare Workers are configured (required)
export function isCloudflareProxyConfigured(): {
  stream: boolean;
  tv: boolean;
} {
  return {
    stream: !!process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL,
    tv: !!process.env.NEXT_PUBLIC_CF_TV_PROXY_URL,
  };
}
