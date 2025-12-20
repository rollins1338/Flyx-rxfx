/**
 * Traffic Sources Analytics API
 * GET /api/admin/analytics/traffic-sources - Get traffic source analytics
 * 
 * Provides insights into:
 * - Page view statistics from analytics_events and page_views
 * - User traffic from user_activity
 * - Bot traffic from server_hits (bots only)
 * - Geographic distribution
 * - Hourly patterns
 * 
 * NOTE: server_hits only contains bot/non-browser traffic.
 * Human traffic is tracked in analytics_events, page_views, and user_activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '20');

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get human traffic from page_views table (actual user page views)
    let humanPageViews = 0;
    let uniqueHumanVisitors = 0;
    try {
      const humanStats = isNeon
        ? await adapter.query(`
            SELECT 
              COUNT(*) as total_views,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM page_views
            WHERE entry_time > $1
          `, [startTime])
        : await adapter.query(`
            SELECT 
              COUNT(*) as total_views,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM page_views
            WHERE entry_time > ?
          `, [startTime]);
      humanPageViews = parseInt(humanStats[0]?.total_views) || 0;
      uniqueHumanVisitors = parseInt(humanStats[0]?.unique_visitors) || 0;
    } catch (e) {
      console.error('Error fetching page_views:', e);
    }

    // Fallback to analytics_events if page_views is empty
    if (humanPageViews === 0) {
      try {
        const eventStats = isNeon
          ? await adapter.query(`
              SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT COALESCE(metadata->>'userId', session_id)) as unique_visitors
              FROM analytics_events
              WHERE timestamp > $1 AND event_type = 'page_view'
            `, [startTime])
          : await adapter.query(`
              SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT COALESCE(JSON_EXTRACT(metadata, '$.userId'), session_id)) as unique_visitors
              FROM analytics_events
              WHERE timestamp > ? AND event_type = 'page_view'
            `, [startTime]);
        humanPageViews = parseInt(eventStats[0]?.total_views) || 0;
        uniqueHumanVisitors = parseInt(eventStats[0]?.unique_visitors) || 0;
      } catch (e) {
        console.error('Error fetching analytics_events:', e);
      }
    }

    // Get bot traffic from server_hits (this table only has bot/non-browser traffic)
    let botHits = 0;
    let botStats: any[] = [];
    try {
      const botTotals = isNeon
        ? await adapter.query(`
            SELECT COUNT(*) as total FROM server_hits WHERE timestamp > $1
          `, [startTime])
        : await adapter.query(`
            SELECT COUNT(*) as total FROM server_hits WHERE timestamp > ?
          `, [startTime]);
      botHits = parseInt(botTotals[0]?.total) || 0;

      // Get bot breakdown
      botStats = isNeon
        ? await adapter.query(`
            SELECT 
              COALESCE(source_name, 'Unknown') as source_name,
              COUNT(*) as hit_count
            FROM server_hits
            WHERE timestamp > $1
            GROUP BY source_name
            ORDER BY hit_count DESC
            LIMIT $2
          `, [startTime, limit])
        : await adapter.query(`
            SELECT 
              COALESCE(source_name, 'Unknown') as source_name,
              COUNT(*) as hit_count
            FROM server_hits
            WHERE timestamp > ?
            GROUP BY source_name
            ORDER BY hit_count DESC
            LIMIT ?
          `, [startTime, limit]);
    } catch (e) {
      console.error('Error fetching server_hits:', e);
    }

    // Get traffic by source type (from page_views referrer data)
    let sourceTypeStats: any[] = [];
    try {
      sourceTypeStats = isNeon
        ? await adapter.query(`
            SELECT 
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN 'direct'
                WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' OR referrer LIKE '%yahoo%' OR referrer LIKE '%duckduckgo%' THEN 'organic'
                WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%reddit%' OR referrer LIKE '%instagram%' OR referrer LIKE '%tiktok%' OR referrer LIKE '%t.co%' OR referrer LIKE '%x.com%' THEN 'social'
                ELSE 'referral'
              END as source_type,
              'Browser' as source_name,
              COUNT(*) as hit_count,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM page_views
            WHERE entry_time > $1
            GROUP BY source_type
            ORDER BY hit_count DESC
          `, [startTime])
        : await adapter.query(`
            SELECT 
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN 'direct'
                WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' OR referrer LIKE '%yahoo%' OR referrer LIKE '%duckduckgo%' THEN 'organic'
                WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%reddit%' OR referrer LIKE '%instagram%' OR referrer LIKE '%tiktok%' OR referrer LIKE '%t.co%' OR referrer LIKE '%x.com%' THEN 'social'
                ELSE 'referral'
              END as source_type,
              'Browser' as source_name,
              COUNT(*) as hit_count,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM page_views
            WHERE entry_time > ?
            GROUP BY source_type
            ORDER BY hit_count DESC
          `, [startTime]);
    } catch (e) {
      console.error('Error fetching source type stats:', e);
    }

    // Get traffic by medium
    let mediumStats: any[] = [];
    try {
      mediumStats = isNeon
        ? await adapter.query(`
            SELECT 
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN 'direct'
                WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' OR referrer LIKE '%yahoo%' OR referrer LIKE '%duckduckgo%' THEN 'organic'
                WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%reddit%' OR referrer LIKE '%instagram%' OR referrer LIKE '%tiktok%' OR referrer LIKE '%t.co%' OR referrer LIKE '%x.com%' THEN 'social'
                ELSE 'referral'
              END as referrer_medium,
              COUNT(*) as hit_count,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM page_views
            WHERE entry_time > $1
            GROUP BY referrer_medium
            ORDER BY hit_count DESC
          `, [startTime])
        : await adapter.query(`
            SELECT 
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN 'direct'
                WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' OR referrer LIKE '%yahoo%' OR referrer LIKE '%duckduckgo%' THEN 'organic'
                WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%reddit%' OR referrer LIKE '%instagram%' OR referrer LIKE '%tiktok%' OR referrer LIKE '%t.co%' OR referrer LIKE '%x.com%' THEN 'social'
                ELSE 'referral'
              END as referrer_medium,
              COUNT(*) as hit_count,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM page_views
            WHERE entry_time > ?
            GROUP BY referrer_medium
            ORDER BY hit_count DESC
          `, [startTime]);
    } catch (e) {
      console.error('Error fetching medium stats:', e);
    }

    // Get top referring domains from page_views
    let topReferrers: any[] = [];
    try {
      topReferrers = isNeon
        ? await adapter.query(`
            SELECT 
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
                WHEN referrer LIKE 'https://%' THEN SPLIT_PART(SPLIT_PART(referrer, '://', 2), '/', 1)
                WHEN referrer LIKE 'http://%' THEN SPLIT_PART(SPLIT_PART(referrer, '://', 2), '/', 1)
                ELSE referrer
              END as referrer_domain,
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN 'direct'
                WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' THEN 'organic'
                WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%reddit%' THEN 'social'
                ELSE 'referral'
              END as referrer_medium,
              COUNT(*) as hit_count,
              MAX(entry_time) as last_hit
            FROM page_views
            WHERE entry_time > $1 AND referrer IS NOT NULL AND referrer != ''
            GROUP BY referrer_domain, referrer_medium
            ORDER BY hit_count DESC
            LIMIT $2
          `, [startTime, limit])
        : await adapter.query(`
            SELECT 
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
                ELSE SUBSTR(referrer, INSTR(referrer, '://') + 3, 
                  CASE 
                    WHEN INSTR(SUBSTR(referrer, INSTR(referrer, '://') + 3), '/') > 0 
                    THEN INSTR(SUBSTR(referrer, INSTR(referrer, '://') + 3), '/') - 1
                    ELSE LENGTH(referrer)
                  END)
              END as referrer_domain,
              CASE 
                WHEN referrer IS NULL OR referrer = '' THEN 'direct'
                WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' THEN 'organic'
                WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%reddit%' THEN 'social'
                ELSE 'referral'
              END as referrer_medium,
              COUNT(*) as hit_count,
              MAX(entry_time) as last_hit
            FROM page_views
            WHERE entry_time > ? AND referrer IS NOT NULL AND referrer != ''
            GROUP BY referrer_domain, referrer_medium
            ORDER BY hit_count DESC
            LIMIT ?
          `, [startTime, limit]);
    } catch (e) {
      console.error('Error fetching top referrers:', e);
    }

    // Get hourly traffic pattern from page_views
    let hourlyPattern: any[] = [];
    try {
      hourlyPattern = isNeon
        ? await adapter.query(`
            SELECT 
              EXTRACT(HOUR FROM to_timestamp(entry_time / 1000)) as hour,
              COUNT(*) as hit_count,
              0 as bot_hits
            FROM page_views
            WHERE entry_time > $1
            GROUP BY EXTRACT(HOUR FROM to_timestamp(entry_time / 1000))
            ORDER BY hour
          `, [startTime])
        : await adapter.query(`
            SELECT 
              CAST(strftime('%H', datetime(entry_time / 1000, 'unixepoch')) AS INTEGER) as hour,
              COUNT(*) as hit_count,
              0 as bot_hits
            FROM page_views
            WHERE entry_time > ?
            GROUP BY strftime('%H', datetime(entry_time / 1000, 'unixepoch'))
            ORDER BY hour
          `, [startTime]);
    } catch (e) {
      console.error('Error fetching hourly pattern:', e);
    }

    // Get geographic distribution from user_activity (more accurate than page_views)
    let geoStats: any[] = [];
    try {
      geoStats = isNeon
        ? await adapter.query(`
            SELECT 
              UPPER(country) as country,
              COUNT(DISTINCT user_id) as hit_count,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM user_activity
            WHERE last_seen > $1 AND country IS NOT NULL AND country != '' AND LENGTH(country) = 2
            GROUP BY UPPER(country)
            ORDER BY hit_count DESC
            LIMIT $2
          `, [startTime, limit])
        : await adapter.query(`
            SELECT 
              UPPER(country) as country,
              COUNT(DISTINCT user_id) as hit_count,
              COUNT(DISTINCT user_id) as unique_visitors
            FROM user_activity
            WHERE last_seen > ? AND country IS NOT NULL AND country != '' AND LENGTH(country) = 2
            GROUP BY UPPER(country)
            ORDER BY hit_count DESC
            LIMIT ?
          `, [startTime, limit]);
    } catch (e) {
      console.error('Error fetching geo stats:', e);
    }

    // Calculate totals
    const totalHits = humanPageViews + botHits;

    return NextResponse.json({
      success: true,
      period: { days, startTime },
      totals: {
        total_hits: totalHits,
        unique_visitors: uniqueHumanVisitors,
        bot_hits: botHits,
        human_hits: humanPageViews,
      },
      sourceTypeStats,
      mediumStats,
      topReferrers,
      botStats,
      hourlyPattern,
      geoStats,
    });
  } catch (error) {
    console.error('Failed to get traffic source analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get traffic source analytics' },
      { status: 500 }
    );
  }
}
