/**
 * Admin Insights API
 * GET /api/admin/insights - Get detailed insights data for visualizations
 * 
 * Returns:
 * - Hourly activity patterns
 * - Daily user trends
 * - Traffic sources/referrers
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '7d';

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const now = Date.now();
    let startTime: number;
    
    switch (range) {
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '7d':
      default:
        startTime = now - 7 * 24 * 60 * 60 * 1000;
    }

    // ============================================
    // 1. HOURLY ACTIVITY PATTERN (last 7 days)
    // ============================================
    let hourlyActivity: Array<{ hour: number; users: number; sessions: number; pageViews: number }> = [];
    try {
      const hourlyQuery = isNeon
        ? `SELECT 
             EXTRACT(HOUR FROM TO_TIMESTAMP(last_seen / 1000)) as hour,
             COUNT(DISTINCT user_id) as users
           FROM user_activity
           WHERE last_seen >= $1 AND last_seen <= $2
           GROUP BY hour
           ORDER BY hour`
        : `SELECT 
             CAST(strftime('%H', datetime(last_seen / 1000, 'unixepoch')) AS INTEGER) as hour,
             COUNT(DISTINCT user_id) as users
           FROM user_activity
           WHERE last_seen >= ? AND last_seen <= ?
           GROUP BY hour
           ORDER BY hour`;
      
      const hourlyResult = await adapter.query(hourlyQuery, [startTime, now]);
      
      // Fill in all 24 hours
      hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyResult.find((r: any) => parseInt(r.hour) === hour);
        return {
          hour,
          users: parseInt(data?.users) || 0,
          sessions: 0,
          pageViews: 0,
        };
      });

      // Add session data
      const sessionHourlyQuery = isNeon
        ? `SELECT 
             EXTRACT(HOUR FROM TO_TIMESTAMP(started_at / 1000)) as hour,
             COUNT(*) as sessions
           FROM watch_sessions
           WHERE started_at >= $1 AND started_at <= $2
           GROUP BY hour`
        : `SELECT 
             CAST(strftime('%H', datetime(started_at / 1000, 'unixepoch')) AS INTEGER) as hour,
             COUNT(*) as sessions
           FROM watch_sessions
           WHERE started_at >= ? AND started_at <= ?
           GROUP BY hour`;
      
      const sessionResult = await adapter.query(sessionHourlyQuery, [startTime, now]);
      sessionResult.forEach((r: any) => {
        const hour = parseInt(r.hour);
        if (hourlyActivity[hour]) {
          hourlyActivity[hour].sessions = parseInt(r.sessions) || 0;
        }
      });

      // Add page view data
      const pageViewHourlyQuery = isNeon
        ? `SELECT 
             EXTRACT(HOUR FROM TO_TIMESTAMP(timestamp / 1000)) as hour,
             COUNT(*) as page_views
           FROM analytics_events
           WHERE event_type = 'page_view' AND timestamp >= $1 AND timestamp <= $2
           GROUP BY hour`
        : `SELECT 
             CAST(strftime('%H', datetime(timestamp / 1000, 'unixepoch')) AS INTEGER) as hour,
             COUNT(*) as page_views
           FROM analytics_events
           WHERE event_type = 'page_view' AND timestamp >= ? AND timestamp <= ?
           GROUP BY hour`;
      
      const pageViewResult = await adapter.query(pageViewHourlyQuery, [startTime, now]);
      pageViewResult.forEach((r: any) => {
        const hour = parseInt(r.hour);
        if (hourlyActivity[hour]) {
          hourlyActivity[hour].pageViews = parseInt(r.page_views) || 0;
        }
      });
    } catch (e) {
      console.error('Error fetching hourly activity:', e);
    }

    // ============================================
    // 2. DAILY USER TREND
    // ============================================
    let dailyTrend: Array<{ date: string; users: number; newUsers: number; sessions: number }> = [];
    try {
      const dailyQuery = isNeon
        ? `SELECT 
             TO_CHAR(TO_TIMESTAMP(last_seen / 1000), 'YYYY-MM-DD') as date,
             COUNT(DISTINCT user_id) as users
           FROM user_activity
           WHERE last_seen >= $1 AND last_seen <= $2
           GROUP BY date
           ORDER BY date`
        : `SELECT 
             DATE(last_seen / 1000, 'unixepoch') as date,
             COUNT(DISTINCT user_id) as users
           FROM user_activity
           WHERE last_seen >= ? AND last_seen <= ?
           GROUP BY date
           ORDER BY date`;
      
      const dailyResult = await adapter.query(dailyQuery, [startTime, now]);

      // Get new users per day
      const newUsersQuery = isNeon
        ? `SELECT 
             TO_CHAR(TO_TIMESTAMP(first_seen / 1000), 'YYYY-MM-DD') as date,
             COUNT(DISTINCT user_id) as new_users
           FROM user_activity
           WHERE first_seen >= $1 AND first_seen <= $2
           GROUP BY date`
        : `SELECT 
             DATE(first_seen / 1000, 'unixepoch') as date,
             COUNT(DISTINCT user_id) as new_users
           FROM user_activity
           WHERE first_seen >= ? AND first_seen <= ?
           GROUP BY date`;
      
      const newUsersResult = await adapter.query(newUsersQuery, [startTime, now]);
      const newUsersMap = new Map(newUsersResult.map((r: any) => [r.date, parseInt(r.new_users) || 0]));

      // Get sessions per day
      const sessionsQuery = isNeon
        ? `SELECT 
             TO_CHAR(TO_TIMESTAMP(started_at / 1000), 'YYYY-MM-DD') as date,
             COUNT(*) as sessions
           FROM watch_sessions
           WHERE started_at >= $1 AND started_at <= $2
           GROUP BY date`
        : `SELECT 
             DATE(started_at / 1000, 'unixepoch') as date,
             COUNT(*) as sessions
           FROM watch_sessions
           WHERE started_at >= ? AND started_at <= ?
           GROUP BY date`;
      
      const sessionsResult = await adapter.query(sessionsQuery, [startTime, now]);
      const sessionsMap = new Map(sessionsResult.map((r: any) => [r.date, parseInt(r.sessions) || 0]));

      dailyTrend = dailyResult.map((r: any) => ({
        date: r.date,
        users: parseInt(r.users) || 0,
        newUsers: newUsersMap.get(r.date) || 0,
        sessions: sessionsMap.get(r.date) || 0,
      }));
    } catch (e) {
      console.error('Error fetching daily trend:', e);
    }

    // ============================================
    // 3. TRAFFIC SOURCES / REFERRERS
    // ============================================
    let referrers: Array<{ referrer: string; count: number }> = [];
    try {
      const referrerQuery = isNeon
        ? `SELECT 
             COALESCE(
               CASE 
                 WHEN metadata->>'referrer' IS NULL OR metadata->>'referrer' = '' THEN 'Direct'
                 WHEN metadata->>'referrer' LIKE '%google%' THEN 'Google'
                 WHEN metadata->>'referrer' LIKE '%reddit%' THEN 'Reddit'
                 WHEN metadata->>'referrer' LIKE '%twitter%' OR metadata->>'referrer' LIKE '%x.com%' THEN 'Twitter'
                 WHEN metadata->>'referrer' LIKE '%facebook%' THEN 'Facebook'
                 WHEN metadata->>'referrer' LIKE '%discord%' THEN 'Discord'
                 WHEN metadata->>'referrer' LIKE '%youtube%' THEN 'YouTube'
                 ELSE 'Other'
               END,
               'Direct'
             ) as referrer,
             COUNT(DISTINCT COALESCE(user_id, session_id)) as count
           FROM analytics_events
           WHERE event_type = 'page_view' AND timestamp >= $1 AND timestamp <= $2
           GROUP BY referrer
           ORDER BY count DESC`
        : `SELECT 
             COALESCE(
               CASE 
                 WHEN JSON_EXTRACT(metadata, '$.referrer') IS NULL OR JSON_EXTRACT(metadata, '$.referrer') = '' THEN 'Direct'
                 WHEN JSON_EXTRACT(metadata, '$.referrer') LIKE '%google%' THEN 'Google'
                 WHEN JSON_EXTRACT(metadata, '$.referrer') LIKE '%reddit%' THEN 'Reddit'
                 WHEN JSON_EXTRACT(metadata, '$.referrer') LIKE '%twitter%' OR JSON_EXTRACT(metadata, '$.referrer') LIKE '%x.com%' THEN 'Twitter'
                 WHEN JSON_EXTRACT(metadata, '$.referrer') LIKE '%facebook%' THEN 'Facebook'
                 WHEN JSON_EXTRACT(metadata, '$.referrer') LIKE '%discord%' THEN 'Discord'
                 WHEN JSON_EXTRACT(metadata, '$.referrer') LIKE '%youtube%' THEN 'YouTube'
                 ELSE 'Other'
               END,
               'Direct'
             ) as referrer,
             COUNT(DISTINCT COALESCE(user_id, session_id)) as count
           FROM analytics_events
           WHERE event_type = 'page_view' AND timestamp >= ? AND timestamp <= ?
           GROUP BY referrer
           ORDER BY count DESC`;
      
      const referrerResult = await adapter.query(referrerQuery, [startTime, now]);
      referrers = referrerResult.map((r: any) => ({
        referrer: r.referrer || 'Direct',
        count: parseInt(r.count) || 0,
      }));
    } catch (e) {
      console.error('Error fetching referrers:', e);
      // Fallback - just show direct traffic
      referrers = [{ referrer: 'Direct', count: 0 }];
    }

    return NextResponse.json({
      success: true,
      hourlyActivity,
      dailyTrend,
      referrers,
      range,
      timestamp: now,
    });

  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
