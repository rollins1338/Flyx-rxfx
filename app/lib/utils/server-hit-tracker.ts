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
 * 
 * NOTE: The analytics API routes have been removed as part of the local-first
 * migration. Server-side hit tracking is no longer supported — client-side
 * tracking via Local_Tracker handles all analytics.
 */
export async function trackServerHit(_data: ServerHitData): Promise<void> {
  // No-op: analytics API routes removed in local-first migration
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
