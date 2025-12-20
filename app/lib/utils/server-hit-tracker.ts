/**
 * Server Hit Tracker Utility
 * 
 * Tracks server-side page hits for non-browser requests.
 * Can be called from server components or API routes.
 */

import { headers } from 'next/headers';

interface ServerHitData {
  pagePath: string;
  id?: string;
}

/**
 * Track a server-side hit (for use in server components)
 * This is a fire-and-forget function that won't block rendering
 */
export async function trackServerHit(data: ServerHitData): Promise<void> {
  try {
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const referer = headersList.get('referer');
    
    // Skip tracking for known browser requests that will be tracked client-side
    // Only track bots, API clients, and non-JS requests
    const isBrowser = userAgent.toLowerCase().includes('mozilla') && 
                      !userAgent.toLowerCase().includes('bot') &&
                      !userAgent.toLowerCase().includes('crawler');
    
    if (isBrowser) {
      // Browser requests will be tracked by client-side analytics
      return;
    }
    
    // Use internal API to track the hit
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    // Fire and forget - don't await
    fetch(`${baseUrl}/api/analytics/server-hit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        ...(referer ? { 'Referer': referer } : {}),
      },
      body: JSON.stringify({
        pagePath: data.pagePath,
        id: data.id,
      }),
    }).catch(() => {
      // Silently fail - don't break the page
    });
  } catch {
    // Silently fail
  }
}

/**
 * Check if the current request is from a bot
 */
export function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper',
    'googlebot', 'bingbot', 'yandexbot', 'duckduckbot',
    'facebookexternalhit', 'twitterbot', 'linkedinbot',
    'slackbot', 'telegrambot', 'whatsapp', 'discordbot',
    'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'petalbot',
    'gptbot', 'claudebot', 'anthropic', 'bytespider',
    'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
    'curl', 'wget', 'python-requests', 'axios', 'node-fetch',
  ];
  
  return botPatterns.some(pattern => ua.includes(pattern));
}

/**
 * Get referrer information from headers
 */
export async function getReferrerInfo(): Promise<{
  referrer: string | null;
  referrerDomain: string | null;
  referrerMedium: string;
}> {
  try {
    const headersList = await headers();
    const referer = headersList.get('referer');
    
    if (!referer) {
      return {
        referrer: null,
        referrerDomain: null,
        referrerMedium: 'direct',
      };
    }
    
    const url = new URL(referer);
    const domain = url.hostname;
    
    // Determine medium
    let medium = 'referral';
    
    const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex'];
    if (searchEngines.some(se => domain.includes(se))) {
      medium = 'organic';
    }
    
    const socialDomains = ['facebook', 'twitter', 'linkedin', 'reddit', 'instagram', 'tiktok', 'youtube', 'pinterest', 't.co', 'x.com'];
    if (socialDomains.some(sd => domain.includes(sd))) {
      medium = 'social';
    }
    
    return {
      referrer: referer,
      referrerDomain: domain,
      referrerMedium: medium,
    };
  } catch {
    return {
      referrer: null,
      referrerDomain: null,
      referrerMedium: 'direct',
    };
  }
}
