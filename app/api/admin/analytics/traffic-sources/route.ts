/**
 * Traffic Sources Analytics API
 * GET /api/admin/analytics/traffic-sources - Get traffic source analytics
 * 
 * Provides insights into:
 * - Referrer breakdown
 * - Bot vs human traffic
 * - Traffic by source type (organic, social, direct, referral)
 * - Top referring domains
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

    // Get traffic by source type
    const sourceTypeStats = isNeon
      ? await adapter.query(`
          SELECT 
            source_type,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > $1
          GROUP BY source_type
          ORDER BY hit_count DESC
        `, [startTime])
      : await adapter.query(`
          SELECT 
            source_type,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > ?
          GROUP BY source_type
          ORDER BY hit_count DESC
        `, [startTime]);

    // Get traffic by medium (organic, social, referral, direct)
    const mediumStats = isNeon
      ? await adapter.query(`
          SELECT 
            referrer_medium,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > $1
          GROUP BY referrer_medium
          ORDER BY hit_count DESC
        `, [startTime])
      : await adapter.query(`
          SELECT 
            referrer_medium,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > ?
          GROUP BY referrer_medium
          ORDER BY hit_count DESC
        `, [startTime]);

    // Get top referring domains
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

    // Get bot breakdown
    const botStats = isNeon
      ? await adapter.query(`
          SELECT 
            source_name,
            COUNT(*) as hit_count
          FROM server_hits
          WHERE timestamp > $1 AND is_bot = TRUE
          GROUP BY source_name
          ORDER BY hit_count DESC
          LIMIT $2
        `, [startTime, limit])
      : await adapter.query(`
          SELECT 
            source_name,
            COUNT(*) as hit_count
          FROM server_hits
          WHERE timestamp > ? AND is_bot = 1
          GROUP BY source_name
          ORDER BY hit_count DESC
          LIMIT ?
        `, [startTime, limit]);

    // Get hourly traffic pattern
    const hourlyPattern = isNeon
      ? await adapter.query(`
          SELECT 
            EXTRACT(HOUR FROM to_timestamp(timestamp / 1000)) as hour,
            COUNT(*) as hit_count,
            SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) as bot_hits
          FROM server_hits
          WHERE timestamp > $1
          GROUP BY EXTRACT(HOUR FROM to_timestamp(timestamp / 1000))
          ORDER BY hour
        `, [startTime])
      : await adapter.query(`
          SELECT 
            strftime('%H', datetime(timestamp / 1000, 'unixepoch')) as hour,
            COUNT(*) as hit_count,
            SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) as bot_hits
          FROM server_hits
          WHERE timestamp > ?
          GROUP BY strftime('%H', datetime(timestamp / 1000, 'unixepoch'))
          ORDER BY hour
        `, [startTime]);

    // Get geographic distribution
    const geoStats = isNeon
      ? await adapter.query(`
          SELECT 
            country,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > $1 AND country IS NOT NULL
          GROUP BY country
          ORDER BY hit_count DESC
          LIMIT $2
        `, [startTime, limit])
      : await adapter.query(`
          SELECT 
            country,
            COUNT(*) as hit_count,
            COUNT(DISTINCT ip_hash) as unique_visitors
          FROM server_hits
          WHERE timestamp > ? AND country IS NOT NULL
          GROUP BY country
          ORDER BY hit_count DESC
          LIMIT ?
        `, [startTime, limit]);

    // Calculate totals
    const totals = isNeon
      ? await adapter.query(`
          SELECT 
            COUNT(*) as total_hits,
            COUNT(DISTINCT ip_hash) as unique_visitors,
            SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) as bot_hits,
            SUM(CASE WHEN NOT is_bot THEN 1 ELSE 0 END) as human_hits
          FROM server_hits
          WHERE timestamp > $1
        `, [startTime])
      : await adapter.query(`
          SELECT 
            COUNT(*) as total_hits,
            COUNT(DISTINCT ip_hash) as unique_visitors,
            SUM(CASE WHEN is_bot THEN 1 ELSE 0 END) as bot_hits,
            SUM(CASE WHEN NOT is_bot THEN 1 ELSE 0 END) as human_hits
          FROM server_hits
          WHERE timestamp > ?
        `, [startTime]);

    return NextResponse.json({
      success: true,
      period: { days, startTime },
      totals: totals[0] || { total_hits: 0, unique_visitors: 0, bot_hits: 0, human_hits: 0 },
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
