/**
 * Cloudflare-aware fetch utility
 * 
 * When running on Cloudflare Workers, many sites block datacenter IPs.
 * This utility detects if we're on Cloudflare and routes requests through
 * the RPI residential proxy to bypass these blocks.
 * 
 * Usage:
 *   import { cfFetch } from '@/app/lib/utils/cf-fetch';
 *   const response = await cfFetch(url, options);
 */

// Detect if we're running on Cloudflare Workers/Pages (via OpenNext)
// IMPORTANT: CF Pages with nodejs_compat has process.versions.node defined,
// so we can't rely on that. Instead we check for CF-specific APIs and
// the OpenNext/Cloudflare context.
function isCloudflareWorker(): boolean {
  try {
    // Method 1: caches.default only exists in Cloudflare Workers
    // @ts-ignore - caches.default only exists in Cloudflare Workers
    if (typeof caches !== 'undefined' && typeof caches.default !== 'undefined') {
      return true;
    }
    
    // Method 2: Check for OpenNext Cloudflare context
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      const ctx = getCloudflareContext({ async: false });
      if (ctx?.env) return true;
    } catch {
      // Not on CF Pages/OpenNext
    }
    
    // Method 3: Check for CF-specific env vars that are only set in production
    // NEXT_PUBLIC_ vars are baked at build time, but RPI_PROXY_URL is a secret
    // only available at runtime on CF Workers
    if (typeof process !== 'undefined' && process.env) {
      // If NODE_ENV is production AND we have no typical Node.js server indicators,
      // we're likely on CF Pages. But this is fragile, so we also check if
      // the RPI config is available (which means we SHOULD proxy).
      // The real fix: if RPI is configured, always use it in production.
      if (process.env.NODE_ENV === 'production') {
        // On CF Pages, process.versions.node exists due to nodejs_compat
        // but we're still on a Worker. Check for __cf_env__ or similar.
        const cfEnv = (globalThis as unknown as { __cf_env__?: Record<string, string> })?.__cf_env__;
        if (cfEnv) return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Get RPI proxy configuration from environment
 * Works in both Node.js and Cloudflare Workers
 */
function getRpiConfig(): { url: string | undefined; key: string | undefined } {
  // Try process.env first (works in Node.js and build time)
  let url = process.env.RPI_PROXY_URL || process.env.NEXT_PUBLIC_RPI_PROXY_URL;
  let key = process.env.RPI_PROXY_KEY || process.env.NEXT_PUBLIC_RPI_PROXY_KEY;
  
  // If we already have both, return early
  if (url && key) return { url, key };
  
  // If in Cloudflare Workers, try to get from CF context
  if (isCloudflareWorker()) {
    try {
      // Try OpenNext's getCloudflareContext
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCloudflareContext } = require('@opennextjs/cloudflare');
      const ctx = getCloudflareContext({ async: false });
      if (ctx?.env) {
        url = url || ctx.env.RPI_PROXY_URL;
        key = key || ctx.env.RPI_PROXY_KEY;
        if (url && key) return { url, key };
      }
    } catch (e) {
      // getCloudflareContext not available
      console.debug('[cfFetch] getCloudflareContext failed:', e instanceof Error ? e.message : e);
    }
    
    // Try global CF env
    const globalEnv = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process?.env;
    if (globalEnv) {
      url = url || globalEnv.RPI_PROXY_URL || globalEnv.NEXT_PUBLIC_RPI_PROXY_URL;
      key = key || globalEnv.RPI_PROXY_KEY || globalEnv.NEXT_PUBLIC_RPI_PROXY_KEY;
      if (url && key) return { url, key };
    }
    
    // Try __cf_env__
    const cfEnv = (globalThis as unknown as { __cf_env__?: Record<string, string> })?.__cf_env__;
    if (cfEnv) {
      url = url || cfEnv.RPI_PROXY_URL || cfEnv.NEXT_PUBLIC_RPI_PROXY_URL;
      key = key || cfEnv.RPI_PROXY_KEY || cfEnv.NEXT_PUBLIC_RPI_PROXY_KEY;
    }
  }
  
  return { url, key };
}

/**
 * Fetch that automatically routes through RPI proxy when on Cloudflare.
 * 
 * CRITICAL: On CF Pages (OpenNext), direct fetch() to other CF Workers on the
 * same account silently fails. We MUST route through RPI residential proxy.
 * 
 * Decision logic:
 * 1. forceProxy=true → always proxy
 * 2. Target is a CF Worker URL (*.workers.dev) AND we're in production → proxy
 *    (this is the core fix for Worker-to-Worker fetch limitation)
 * 3. isCloudflareWorker() AND target needs residential IP → proxy
 * 4. Otherwise → direct fetch
 */
export async function cfFetch(
  url: string,
  options: RequestInit = {},
  forceProxy: boolean = false
): Promise<Response> {
  const isCfWorker = isCloudflareWorker();
  
  // Get RPI config dynamically (handles CF Workers env)
  const { url: RPI_PROXY_URL, key: RPI_PROXY_KEY } = getRpiConfig();
  const rpiConfigured = !!(RPI_PROXY_URL && RPI_PROXY_KEY);
  
  const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  
  // Check if target is a CF Worker URL (same-account Worker-to-Worker issue)
  const isCfWorkerUrl = url.includes('.workers.dev');
  
  // Proxy when:
  // 1. Explicitly forced
  // 2. Target is a CF Worker and we're in production (Worker-to-Worker fix)
  // 3. We're on CF and the target needs residential IP (datacenter IP blocking)
  const useProxy = forceProxy || 
    (isCfWorkerUrl && isProduction && rpiConfigured) ||
    (isCfWorker && rpiConfigured);
  
  console.log(`[cfFetch] isCfWorker=${isCfWorker}, isProduction=${isProduction}, isCfWorkerUrl=${isCfWorkerUrl}, useProxy=${useProxy}, RPI=${rpiConfigured ? 'yes' : 'no'}`);
  
  if (useProxy && RPI_PROXY_URL && RPI_PROXY_KEY) {
    // Route through RPI residential proxy
    // Format: GET /proxy?url=<encoded_url> with X-API-Key header
    const proxyUrl = `${RPI_PROXY_URL}/proxy?url=${encodeURIComponent(url)}`;
    
    const headers = new Headers(options.headers);
    headers.set('X-API-Key', RPI_PROXY_KEY);
    
    console.log(`[cfFetch] Routing through RPI: ${url.substring(0, 80)}...`);
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'GET', // RPI /proxy endpoint only supports GET
        headers,
        signal: options.signal,
      });
      
      console.log(`[cfFetch] RPI response: ${response.status} ${response.statusText}`);
      
      // If RPI returns 429 (rate limited), log it
      if (response.status === 429) {
        console.warn(`[cfFetch] RPI proxy rate limited (429) for: ${url.substring(0, 60)}...`);
      }
      
      return response;
    } catch (error) {
      console.error(`[cfFetch] RPI proxy error:`, error instanceof Error ? error.message : error);
      // Fall back to direct fetch if RPI fails
      console.log(`[cfFetch] Falling back to direct fetch...`);
      return fetch(url, options);
    }
  }
  
  // Direct fetch (local dev, or RPI not configured)
  if (useProxy && (!RPI_PROXY_URL || !RPI_PROXY_KEY)) {
    console.warn(`[cfFetch] On CF Worker but RPI not configured! Direct fetch will likely fail.`);
  }
  console.log(`[cfFetch] Direct fetch: ${url.substring(0, 80)}...`);
  return fetch(url, options);
}

/**
 * Check if RPI proxy is available
 */
export function isRpiProxyConfigured(): boolean {
  const { url, key } = getRpiConfig();
  return !!(url && key);
}

/**
 * Check if we're on Cloudflare and need proxying
 */
export function needsProxying(): boolean {
  return isCloudflareWorker();
}
