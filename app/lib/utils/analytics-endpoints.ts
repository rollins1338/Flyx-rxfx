/**
 * Analytics Endpoints Configuration
 * 
 * Routes analytics through Cloudflare Worker when configured.
 * Supports two modes:
 *   1. Dedicated Analytics Worker (NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL) - Preferred
 *   2. Main CF Proxy with analytics route (NEXT_PUBLIC_CF_ANALYTICS_URL) - Legacy
 * 
 * This reduces Vercel Edge function costs by leveraging CF's free tier (100k req/day).
 * 
 * Usage:
 *   import { getAnalyticsEndpoint } from '@/lib/utils/analytics-endpoints';
 *   const url = getAnalyticsEndpoint('presence'); // Returns CF or Vercel URL
 */

function getCfAnalyticsDedicatedWorkerUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Check for dedicated analytics worker URL (preferred)
  // No caching - env vars are inlined at build time anyway
  return process.env.NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL || null;
}

function getCfAnalyticsUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Check for CF analytics URL (legacy - routes through main proxy)
  return process.env.NEXT_PUBLIC_CF_ANALYTICS_URL || null;
}

/**
 * Get the appropriate analytics endpoint URL
 * Routes through Cloudflare Worker if configured, otherwise falls back to Vercel
 * 
 * Priority:
 *   1. Dedicated Analytics Worker (NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL)
 *   2. Main CF Proxy (NEXT_PUBLIC_CF_ANALYTICS_URL)
 *   3. Vercel Edge (fallback)
 * 
 * @param endpoint - The endpoint name (presence, pageview, event, watch-session, live-activity, page-view, stats)
 * @returns The full URL to use for the analytics request
 */
export function getAnalyticsEndpoint(endpoint: 'presence' | 'pageview' | 'page-view' | 'event' | 'watch-session' | 'live-activity' | 'stats'): string {
  const dedicatedWorkerUrl = getCfAnalyticsDedicatedWorkerUrl();
  const cfUrl = getCfAnalyticsUrl();
  
  // Priority 1: Dedicated Analytics Worker
  if (dedicatedWorkerUrl) {
    // Map endpoint names to dedicated worker routes
    const workerEndpoints: Record<string, string> = {
      'presence': '/presence',
      'pageview': '/page-view',
      'page-view': '/page-view',
      'event': '/page-view', // Events tracked as page views
      'watch-session': '/watch-session',
      'live-activity': '/live-activity',
      'stats': '/stats',
    };
    return `${dedicatedWorkerUrl}${workerEndpoints[endpoint] || `/${endpoint}`}`;
  }
  
  // Priority 2: Main CF Proxy with analytics route
  if (cfUrl) {
    // Route through Cloudflare Worker
    // Map endpoint names to CF routes
    const cfEndpoints: Record<string, string> = {
      'presence': '/presence',
      'pageview': '/pageview',
      'page-view': '/pageview',
      'event': '/event',
      'watch-session': '/watch-session',
      'live-activity': '/live-activity',
      'stats': '/stats',
    };
    return `${cfUrl}${cfEndpoints[endpoint] || `/${endpoint}`}`;
  }
  
  // Fallback to Vercel Edge
  const vercelEndpoints: Record<string, string> = {
    'presence': '/api/analytics/presence',
    'pageview': '/api/analytics/page-view',
    'page-view': '/api/analytics/page-view',
    'event': '/api/analytics/track',
    'watch-session': '/api/analytics/watch-session',
    'live-activity': '/api/analytics/live-activity',
    'stats': '/api/admin/analytics',
  };
  return vercelEndpoints[endpoint] || `/api/analytics/${endpoint}`;
}

/**
 * Check if analytics is routed through Cloudflare
 */
export function isUsingCloudflareAnalytics(): boolean {
  return getCfAnalyticsDedicatedWorkerUrl() !== null || getCfAnalyticsUrl() !== null;
}

/**
 * Get analytics configuration info (for debugging)
 */
export function getAnalyticsConfig(): {
  provider: 'cloudflare-dedicated' | 'cloudflare-proxy' | 'vercel';
  baseUrl: string | null;
} {
  const dedicatedUrl = getCfAnalyticsDedicatedWorkerUrl();
  const cfUrl = getCfAnalyticsUrl();
  
  if (dedicatedUrl) {
    return {
      provider: 'cloudflare-dedicated',
      baseUrl: dedicatedUrl,
    };
  }
  
  if (cfUrl) {
    return {
      provider: 'cloudflare-proxy',
      baseUrl: cfUrl,
    };
  }
  
  return {
    provider: 'vercel',
    baseUrl: null,
  };
}
