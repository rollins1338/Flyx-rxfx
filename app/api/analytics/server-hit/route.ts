/**
 * Server Hit Tracking API
 * POST /api/analytics/server-hit - Track server-side page hits (non-JS tracking)
 * GET /api/analytics/server-hit - Get server hit analytics
 * 
 * This tracks hits that don't come from browsers or don't execute JavaScript:
 * - Bots and crawlers
 * - API requests
 * - Direct link access
 * - Embedded iframes
 * - RSS readers
 * - Social media previews
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { getLocationFromHeaders } from '@/app/lib/utils/geolocation';
import { getClientIP } from '@/lib/utils/api-rate-limiter';

function generateId() {
  return `sh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Hash IP for privacy
function hashIP(ip: string): string {
  try {
    const crypto = require('crypto');
    const salt = process.env.IP_SALT || 'server_hit_salt';
    return crypto.createHash('sha256').update(ip + salt).digest('hex').substring(0, 16);
  } catch {
    return 'hash_error';
  }
}

// Classify the request source
function classifySource(userAgent: string, referer: string | null): {
  sourceType: 'browser' | 'bot' | 'api' | 'social' | 'rss' | 'unknown';
  sourceName: string;
  isBot: boolean;
} {
  const ua = userAgent.toLowerCase();
  
  // Known bots
  const botPatterns: Record<string, string> = {
    'googlebot': 'Google Bot',
    'bingbot': 'Bing Bot',
    'yandexbot': 'Yandex Bot',
    'duckduckbot': 'DuckDuckGo Bot',
    'baiduspider': 'Baidu Spider',
    'facebookexternalhit': 'Facebook Crawler',
    'twitterbot': 'Twitter Bot',
    'linkedinbot': 'LinkedIn Bot',
    'slackbot': 'Slack Bot',
    'telegrambot': 'Telegram Bot',
    'whatsapp': 'WhatsApp',
    'discordbot': 'Discord Bot',
    'pinterest': 'Pinterest',
    'semrush': 'SEMrush',
    'ahrefs': 'Ahrefs',
    'mj12bot': 'Majestic Bot',
    'dotbot': 'DotBot',
    'petalbot': 'PetalBot',
    'applebot': 'Apple Bot',
    'gptbot': 'GPT Bot',
    'claudebot': 'Claude Bot',
    'anthropic': 'Anthropic Bot',
    'bytespider': 'ByteDance Spider',
    'headless': 'Headless Browser',
    'phantomjs': 'PhantomJS',
    'puppeteer': 'Puppeteer',
    'playwright': 'Playwright',
    'selenium': 'Selenium',
    'curl': 'cURL',
    'wget': 'wget',
    'python-requests': 'Python Requests',
    'axios': 'Axios',
    'node-fetch': 'Node Fetch',
    'go-http-client': 'Go HTTP Client',
    'java': 'Java Client',
    'okhttp': 'OkHttp',
  };
  
  for (const [pattern, name] of Object.entries(botPatterns)) {
    if (ua.includes(pattern)) {
      return { sourceType: 'bot', sourceName: name, isBot: true };
    }
  }
  
  // Social media referrers
  const socialPatterns: Record<string, string> = {
    'facebook.com': 'Facebook',
    'fb.com': 'Facebook',
    't.co': 'Twitter/X',
    'twitter.com': 'Twitter/X',
    'x.com': 'Twitter/X',
    'linkedin.com': 'LinkedIn',
    'reddit.com': 'Reddit',
    'discord.com': 'Discord',
    'discord.gg': 'Discord',
    'telegram.org': 'Telegram',
    't.me': 'Telegram',
    'instagram.com': 'Instagram',
    'tiktok.com': 'TikTok',
    'youtube.com': 'YouTube',
    'pinterest.com': 'Pinterest',
  };
  
  if (referer) {
    const refLower = referer.toLowerCase();
    for (const [pattern, name] of Object.entries(socialPatterns)) {
      if (refLower.includes(pattern)) {
        return { sourceType: 'social', sourceName: name, isBot: false };
      }
    }
  }
  
  // RSS readers
  const rssPatterns = ['feedly', 'inoreader', 'newsblur', 'theoldreader', 'feedbin', 'rss'];
  for (const pattern of rssPatterns) {
    if (ua.includes(pattern)) {
      return { sourceType: 'rss', sourceName: 'RSS Reader', isBot: false };
    }
  }
  
  // API clients (no typical browser UA)
  if (!ua.includes('mozilla') && !ua.includes('chrome') && !ua.includes('safari') && !ua.includes('firefox') && !ua.includes('edge')) {
    return { sourceType: 'api', sourceName: 'API Client', isBot: false };
  }
  
  // Regular browser
  if (ua.includes('chrome')) return { sourceType: 'browser', sourceName: 'Chrome', isBot: false };
  if (ua.includes('firefox')) return { sourceType: 'browser', sourceName: 'Firefox', isBot: false };
  if (ua.includes('safari')) return { sourceType: 'browser', sourceName: 'Safari', isBot: false };
  if (ua.includes('edge')) return { sourceType: 'browser', sourceName: 'Edge', isBot: false };
  
  return { sourceType: 'unknown', sourceName: 'Unknown', isBot: false };
}

// Parse referrer into components
function parseReferrer(referer: string | null): {
  referrerDomain: string | null;
  referrerPath: string | null;
  referrerSource: string;
  referrerMedium: string;
} {
  if (!referer) {
    return {
      referrerDomain: null,
      referrerPath: null,
      referrerSource: 'direct',
      referrerMedium: 'none',
    };
  }
  
  try {
    const url = new URL(referer);
    const domain = url.hostname;
    
    // Determine source and medium
    let source = domain;
    let medium = 'referral';
    
    // Search engines
    const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex'];
    if (searchEngines.some(se => domain.includes(se))) {
      medium = 'organic';
    }
    
    // Social media
    const socialDomains = ['facebook', 'twitter', 'linkedin', 'reddit', 'instagram', 'tiktok', 'youtube', 'pinterest', 't.co', 'x.com'];
    if (socialDomains.some(sd => domain.includes(sd))) {
      medium = 'social';
    }
    
    // Email
    if (domain.includes('mail') || domain.includes('outlook') || domain.includes('gmail')) {
      medium = 'email';
    }
    
    return {
      referrerDomain: domain,
      referrerPath: url.pathname,
      referrerSource: source,
      referrerMedium: medium,
    };
  } catch {
    return {
      referrerDomain: referer,
      referrerPath: null,
      referrerSource: referer,
      referrerMedium: 'referral',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.pagePath) {
      return NextResponse.json(
        { error: 'Missing required field: pagePath' },
        { status: 400 }
      );
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();
    
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer');
    const clientIP = getClientIP(request);
    const location = getLocationFromHeaders(request);
    const now = Date.now();
    
    const hitId = data.id || generateId();
    const ipHash = hashIP(clientIP);
    
    // Classify the source
    const { sourceType, sourceName, isBot } = classifySource(userAgent, referer);
    
    // Parse referrer
    const { referrerDomain, referrerPath, referrerSource, referrerMedium } = parseReferrer(referer);
    
    // Create server hit record
    if (isNeon) {
      await adapter.execute(`
        INSERT INTO server_hits (
          id, page_path, ip_hash, user_agent, 
          source_type, source_name, is_bot,
          referrer_full, referrer_domain, referrer_path, referrer_source, referrer_medium,
          country, city, region,
          timestamp, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        hitId,
        data.pagePath,
        ipHash,
        userAgent.substring(0, 500),
        sourceType,
        sourceName,
        isBot,
        referer?.substring(0, 1000) || null,
        referrerDomain,
        referrerPath,
        referrerSource,
        referrerMedium,
        location.countryCode,
        location.city,
        location.region,
        now,
        now
      ]);
    } else {
      await adapter.execute(`
        INSERT INTO server_hits (
          id, page_path, ip_hash, user_agent,
          source_type, source_name, is_bot,
          referrer_full, referrer_domain, referrer_path, referrer_source, referrer_medium,
          country, city, region,
          timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        hitId,
        data.pagePath,
        ipHash,
        userAgent.substring(0, 500),
        sourceType,
        sourceName,
        isBot ? 1 : 0,
        referer?.substring(0, 1000) || null,
        referrerDomain,
        referrerPath,
        referrerSource,
        referrerMedium,
        location.countryCode,
        location.city,
        location.region,
        now,
        now
      ]);
    }
    
    // Update aggregated referrer stats
    if (referrerDomain) {
      if (isNeon) {
        await adapter.execute(`
          INSERT INTO referrer_stats (
            referrer_domain, hit_count, last_hit, referrer_medium, created_at, updated_at
          ) VALUES ($1, 1, $2, $3, $2, $2)
          ON CONFLICT (referrer_domain) DO UPDATE SET
            hit_count = referrer_stats.hit_count + 1,
            last_hit = $2,
            updated_at = $2
        `, [referrerDomain, now, referrerMedium]);
      } else {
        await adapter.execute(`
          INSERT INTO referrer_stats (
            referrer_domain, hit_count, last_hit, referrer_medium, created_at, updated_at
          ) VALUES (?, 1, ?, ?, ?, ?)
          ON CONFLICT (referrer_domain) DO UPDATE SET
            hit_count = hit_count + 1,
            last_hit = ?,
            updated_at = ?
        `, [referrerDomain, now, referrerMedium, now, now, now, now]);
      }
    }

    return NextResponse.json({ 
      success: true, 
      id: hitId,
      sourceType,
      sourceName,
      isBot,
      referrerMedium,
    });
  } catch (error) {
    console.error('Failed to track server hit:', error);
    return NextResponse.json(
      { error: 'Failed to track server hit' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '50');

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get hits by source type
    const sourceStats = isNeon
      ? await adapter.query(`
          SELECT 
            source_type,
            source_name,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > $1
          GROUP BY source_type, source_name
          ORDER BY hit_count DESC
          LIMIT $2
        `, [startTime, limit])
      : await adapter.query(`
          SELECT 
            source_type,
            source_name,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > ?
          GROUP BY source_type, source_name
          ORDER BY hit_count DESC
          LIMIT ?
        `, [startTime, limit]);

    // Get top referrers
    const topReferrers = isNeon
      ? await adapter.query(`
          SELECT 
            referrer_domain,
            referrer_medium,
            hit_count,
            last_hit
          FROM referrer_stats
          WHERE last_hit > $1
          ORDER BY hit_count DESC
          LIMIT $2
        `, [startTime, limit])
      : await adapter.query(`
          SELECT 
            referrer_domain,
            referrer_medium,
            hit_count,
            last_hit
          FROM referrer_stats
          WHERE last_hit > ?
          ORDER BY hit_count DESC
          LIMIT ?
        `, [startTime, limit]);

    // Get bot vs human breakdown
    const botStats = isNeon
      ? await adapter.query(`
          SELECT 
            is_bot,
            COUNT(*) as hit_count
          FROM server_hits
          WHERE timestamp > $1
          GROUP BY is_bot
        `, [startTime])
      : await adapter.query(`
          SELECT 
            is_bot,
            COUNT(*) as hit_count
          FROM server_hits
          WHERE timestamp > ?
          GROUP BY is_bot
        `, [startTime]);

    // Get hits by page
    const pageStats = isNeon
      ? await adapter.query(`
          SELECT 
            page_path,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors,
            SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) as bot_hits
          FROM server_hits
          WHERE timestamp > $1
          GROUP BY page_path
          ORDER BY hit_count DESC
          LIMIT $2
        `, [startTime, limit])
      : await adapter.query(`
          SELECT 
            page_path,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors,
            SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) as bot_hits
          FROM server_hits
          WHERE timestamp > ?
          GROUP BY page_path
          ORDER BY hit_count DESC
          LIMIT ?
        `, [startTime, limit]);

    return NextResponse.json({
      success: true,
      sourceStats,
      topReferrers,
      botStats,
      pageStats,
      period: { days, startTime }
    });
  } catch (error) {
    console.error('Failed to get server hit analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get server hit analytics' },
      { status: 500 }
    );
  }
}
