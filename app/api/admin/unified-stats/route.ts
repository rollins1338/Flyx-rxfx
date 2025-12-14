/**
 * Unified Stats API - SINGLE SOURCE OF TRUTH
 * GET /api/admin/unified-stats
 * 
 * ALL admin pages MUST use this endpoint for key metrics.
 * This ensures consistent data across the entire admin panel.
 * 
 * Data Sources:
 * - live_activity: Real-time user presence (last 5 min heartbeat)
 * - user_activity: User sessions and activity history (UNIQUE users only)
 * - watch_sessions: Content viewing data
 * - analytics_events: Page views and events
 * 
 * IMPORTANT: All user counts use COUNT(DISTINCT user_id) to avoid duplicates
 * 
 * OPTIMIZATION: Uses in-memory caching to reduce database load
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { getCountryName } from '@/app/lib/utils/geolocation';

// Minimum valid timestamp (Jan 1, 2020)
const MIN_VALID_TIMESTAMP = 1577836800000;

// In-memory cache for stats
interface CachedStats {
  data: any;
  timestamp: number;
}

let statsCache: CachedStats | null = null;
const CACHE_TTL = 10000; // 10 seconds cache TTL - balances freshness with performance

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    
    // Check cache first - return cached data if still valid
    if (statsCache && (now - statsCache.timestamp) < CACHE_TTL) {
      return NextResponse.json({
        ...statsCache.data,
        cached: true,
        cacheAge: now - statsCache.timestamp,
      });
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // ============================================
    // 1. REAL-TIME DATA (SESSION-BASED)
    // Count UNIQUE users with active watch sessions
    // 
    // "Active" = session updated in last 5 minutes (player sends updates)
    // "Watching" = active watch sessions (VOD content)
    // "LiveTV" = active sessions with content_type = 'livetv'
    // "Browsing" = users in user_activity but NOT in active watch sessions
    // ============================================
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const twoMinutesAgo = now - 2 * 60 * 1000;
    let realtime = { totalActive: 0, trulyActive: 0, watching: 0, browsing: 0, livetv: 0 };
    
    try {
      // Count users with active watch sessions (updated in last 5 min, not ended)
      // Sessions are "active" if:
      // 1. ended_at is NULL (session not ended), OR
      // 2. updated_at is recent (player still sending updates)
      const watchingQuery = isNeon
        ? `SELECT 
             COUNT(DISTINCT user_id) as watching_count,
             COUNT(DISTINCT CASE WHEN content_type = 'livetv' THEN user_id END) as livetv_count,
             COUNT(DISTINCT CASE WHEN content_type != 'livetv' THEN user_id END) as vod_count
           FROM watch_sessions 
           WHERE (ended_at IS NULL OR updated_at >= $1)
             AND started_at >= $2`
        : `SELECT 
             COUNT(DISTINCT user_id) as watching_count,
             COUNT(DISTINCT CASE WHEN content_type = 'livetv' THEN user_id END) as livetv_count,
             COUNT(DISTINCT CASE WHEN content_type != 'livetv' THEN user_id END) as vod_count
           FROM watch_sessions 
           WHERE (ended_at IS NULL OR updated_at >= ?)
             AND started_at >= ?`;
      
      const watchResult = await adapter.query(watchingQuery, 
        isNeon ? [fiveMinutesAgo, oneDayAgo] : [fiveMinutesAgo, oneDayAgo]
      );
      
      const watchingUsers = parseInt(watchResult[0]?.watching_count) || 0;
      realtime.watching = parseInt(watchResult[0]?.vod_count) || 0;
      realtime.livetv = parseInt(watchResult[0]?.livetv_count) || 0;
      
      // Get users who are browsing (active in user_activity but NOT watching)
      // These are users who have been active recently but don't have an active watch session
      const browsingQuery = isNeon
        ? `SELECT COUNT(DISTINCT ua.user_id) as browsing_count
           FROM user_activity ua
           WHERE ua.last_seen >= $1
             AND ua.user_id NOT IN (
               SELECT DISTINCT user_id FROM watch_sessions 
               WHERE (ended_at IS NULL OR updated_at >= $2)
                 AND started_at >= $3
             )`
        : `SELECT COUNT(DISTINCT ua.user_id) as browsing_count
           FROM user_activity ua
           WHERE ua.last_seen >= ?
             AND ua.user_id NOT IN (
               SELECT DISTINCT user_id FROM watch_sessions 
               WHERE (ended_at IS NULL OR updated_at >= ?)
                 AND started_at >= ?
             )`;
      
      const browsingResult = await adapter.query(browsingQuery,
        isNeon ? [fiveMinutesAgo, fiveMinutesAgo, oneDayAgo] : [fiveMinutesAgo, fiveMinutesAgo, oneDayAgo]
      );
      
      realtime.browsing = parseInt(browsingResult[0]?.browsing_count) || 0;
      realtime.totalActive = watchingUsers + realtime.browsing;
      
      // "Truly active" = sessions updated in last 2 minutes (stricter)
      const strictQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count
           FROM watch_sessions 
           WHERE (ended_at IS NULL OR updated_at >= $1)
             AND started_at >= $2`
        : `SELECT COUNT(DISTINCT user_id) as count
           FROM watch_sessions 
           WHERE (ended_at IS NULL OR updated_at >= ?)
             AND started_at >= ?`;
      
      const strictResult = await adapter.query(strictQuery,
        isNeon ? [twoMinutesAgo, oneDayAgo] : [twoMinutesAgo, oneDayAgo]
      );
      
      realtime.trulyActive = parseInt(strictResult[0]?.count) || 0;
      
    } catch (e) {
      console.error('Error fetching realtime stats:', e);
    }

    // ============================================
    // 2. USER METRICS (from user_activity ONLY)
    // ALWAYS use COUNT(DISTINCT user_id) for accurate unique user counts
    // ============================================
    let users = { total: 0, dau: 0, wau: 0, mau: 0, newToday: 0, returning: 0 };
    try {
      // Total UNIQUE users with valid timestamps
      const totalQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as total FROM user_activity 
           WHERE first_seen >= $1 AND last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as total FROM user_activity 
           WHERE first_seen >= ? AND last_seen >= ? AND last_seen <= ?`;
      
      const totalResult = await adapter.query(totalQuery, 
        isNeon ? [MIN_VALID_TIMESTAMP, now] : [MIN_VALID_TIMESTAMP, MIN_VALID_TIMESTAMP, now]);
      users.total = parseInt(totalResult[0]?.total) || 0;
      
      // DAU - UNIQUE users active in last 24h
      const dauQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE last_seen >= ? AND last_seen <= ?`;
      const dauResult = await adapter.query(dauQuery, [oneDayAgo, now]);
      users.dau = parseInt(dauResult[0]?.count) || 0;
      
      // WAU - UNIQUE users active in last week
      const wauQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE last_seen >= ? AND last_seen <= ?`;
      const wauResult = await adapter.query(wauQuery, [oneWeekAgo, now]);
      users.wau = parseInt(wauResult[0]?.count) || 0;
      
      // MAU - UNIQUE users active in last month
      const mauQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE last_seen >= ? AND last_seen <= ?`;
      const mauResult = await adapter.query(mauQuery, [oneMonthAgo, now]);
      users.mau = parseInt(mauResult[0]?.count) || 0;
      
      // New users today - UNIQUE users whose first_seen is within last 24h
      const newQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE first_seen >= $1 AND first_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE first_seen >= ? AND first_seen <= ?`;
      const newResult = await adapter.query(newQuery, [oneDayAgo, now]);
      users.newToday = parseInt(newResult[0]?.count) || 0;
      
      // Returning users - UNIQUE users who were first seen before today but active today
      const returningQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE first_seen < $1 AND last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity 
           WHERE first_seen < ? AND last_seen >= ? AND last_seen <= ?`;
      const returningResult = await adapter.query(returningQuery, 
        isNeon ? [oneDayAgo, now] : [oneDayAgo, oneDayAgo, now]);
      users.returning = parseInt(returningResult[0]?.count) || 0;
    } catch (e) {
      console.error('Error fetching user stats:', e);
    }

    // ============================================
    // 3. CONTENT METRICS (from watch_sessions)
    // Use validated timestamps and reasonable bounds
    // ============================================
    let content = { totalSessions: 0, totalWatchTime: 0, avgDuration: 0, completionRate: 0, allTimeWatchTime: 0 };
    try {
      // Count sessions from last 24h with valid data
      const contentQuery = isNeon
        ? `SELECT 
             COUNT(*) as total_sessions,
             COALESCE(SUM(CASE WHEN total_watch_time > 0 AND total_watch_time < 86400 THEN total_watch_time ELSE 0 END), 0) as total_watch_time,
             COALESCE(AVG(CASE WHEN total_watch_time > 0 AND total_watch_time < 86400 THEN total_watch_time ELSE NULL END), 0) as avg_duration,
             COALESCE(AVG(CASE WHEN completion_percentage >= 0 AND completion_percentage <= 100 THEN completion_percentage ELSE NULL END), 0) as avg_completion
           FROM watch_sessions 
           WHERE started_at >= $1 AND started_at <= $2`
        : `SELECT 
             COUNT(*) as total_sessions,
             COALESCE(SUM(CASE WHEN total_watch_time > 0 AND total_watch_time < 86400 THEN total_watch_time ELSE 0 END), 0) as total_watch_time,
             COALESCE(AVG(CASE WHEN total_watch_time > 0 AND total_watch_time < 86400 THEN total_watch_time ELSE NULL END), 0) as avg_duration,
             COALESCE(AVG(CASE WHEN completion_percentage >= 0 AND completion_percentage <= 100 THEN completion_percentage ELSE NULL END), 0) as avg_completion
           FROM watch_sessions 
           WHERE started_at >= ? AND started_at <= ?`;
      
      const contentResult = await adapter.query(contentQuery, [oneDayAgo, now]);
      
      if (contentResult[0]) {
        content.totalSessions = parseInt(contentResult[0].total_sessions) || 0;
        content.totalWatchTime = Math.round(parseFloat(contentResult[0].total_watch_time) / 60) || 0; // Convert to minutes
        content.avgDuration = Math.round(parseFloat(contentResult[0].avg_duration) / 60) || 0; // Convert to minutes
        content.completionRate = Math.round(parseFloat(contentResult[0].avg_completion)) || 0;
      }
      
      // Also get all-time watch time for reference
      const allTimeQuery = isNeon
        ? `SELECT COALESCE(SUM(CASE WHEN total_watch_time > 0 AND total_watch_time < 86400 THEN total_watch_time ELSE 0 END), 0) as total FROM watch_sessions`
        : `SELECT COALESCE(SUM(CASE WHEN total_watch_time > 0 AND total_watch_time < 86400 THEN total_watch_time ELSE 0 END), 0) as total FROM watch_sessions`;
      const allTimeResult = await adapter.query(allTimeQuery);
      content.allTimeWatchTime = Math.round(parseFloat(allTimeResult[0]?.total || 0) / 60) || 0; // Convert to minutes
    } catch (e) {
      console.error('Error fetching content stats:', e);
    }

    // ============================================
    // 4. GEOGRAPHIC DATA (from user_activity)
    // Count UNIQUE users per country
    // ============================================
    let geographic: Array<{ country: string; countryName: string; count: number }> = [];
    try {
      const geoQuery = isNeon
        ? `SELECT UPPER(country) as country, COUNT(DISTINCT user_id) as count 
           FROM user_activity 
           WHERE last_seen >= $1 AND last_seen <= $2
             AND country IS NOT NULL AND country != '' AND LENGTH(country) = 2
           GROUP BY UPPER(country) 
           ORDER BY count DESC 
           LIMIT 20`
        : `SELECT UPPER(country) as country, COUNT(DISTINCT user_id) as count 
           FROM user_activity 
           WHERE last_seen >= ? AND last_seen <= ?
             AND country IS NOT NULL AND country != '' AND LENGTH(country) = 2
           GROUP BY UPPER(country) 
           ORDER BY count DESC 
           LIMIT 20`;
      
      const geoResult = await adapter.query(geoQuery, [oneWeekAgo, now]);
      
      geographic = geoResult.map((row: any) => ({
        country: row.country,
        countryName: getCountryName(row.country) || row.country,
        count: parseInt(row.count) || 0,
      }));
    } catch (e) {
      console.error('Error fetching geographic stats:', e);
    }

    // ============================================
    // 5. DEVICE BREAKDOWN (from user_activity)
    // Count UNIQUE users per device type
    // ============================================
    let devices: Array<{ device: string; count: number }> = [];
    try {
      const deviceQuery = isNeon
        ? `SELECT COALESCE(device_type, 'unknown') as device, COUNT(DISTINCT user_id) as count 
           FROM user_activity 
           WHERE last_seen >= $1 AND last_seen <= $2
           GROUP BY device_type 
           ORDER BY count DESC`
        : `SELECT COALESCE(device_type, 'unknown') as device, COUNT(DISTINCT user_id) as count 
           FROM user_activity 
           WHERE last_seen >= ? AND last_seen <= ?
           GROUP BY device_type 
           ORDER BY count DESC`;
      
      const deviceResult = await adapter.query(deviceQuery, [oneWeekAgo, now]);
      
      devices = deviceResult.map((row: any) => ({
        device: row.device || 'unknown',
        count: parseInt(row.count) || 0,
      }));
    } catch (e) {
      console.error('Error fetching device stats:', e);
    }

    // ============================================
    // 6. PAGE VIEWS (from analytics_events)
    // Note: user_id is stored in metadata JSON, not as a direct column
    // ============================================
    let pageViews = { total: 0, uniqueVisitors: 0 };
    try {
      const pageViewQuery = isNeon
        ? `SELECT 
             COUNT(*) as total,
             COUNT(DISTINCT COALESCE(metadata->>'userId', session_id)) as unique_visitors
           FROM analytics_events 
           WHERE event_type = 'page_view' 
             AND timestamp >= $1 AND timestamp <= $2`
        : `SELECT 
             COUNT(*) as total,
             COUNT(DISTINCT COALESCE(JSON_EXTRACT(metadata, '$.userId'), session_id)) as unique_visitors
           FROM analytics_events 
           WHERE event_type = 'page_view' 
             AND timestamp >= ? AND timestamp <= ?`;
      
      const pageViewResult = await adapter.query(pageViewQuery, [oneDayAgo, now]);
      
      if (pageViewResult[0]) {
        pageViews.total = parseInt(pageViewResult[0].total) || 0;
        pageViews.uniqueVisitors = parseInt(pageViewResult[0].unique_visitors) || 0;
      }
    } catch (e) {
      console.error('Error fetching page view stats:', e);
    }

    const responseData = {
      success: true,
      realtime,
      users,
      content,
      geographic,
      devices,
      pageViews,
      // Include time ranges for transparency
      timeRanges: {
        realtime: '5 minutes (session-based, 2 min for truly active)',
        dau: '24 hours',
        wau: '7 days',
        mau: '30 days',
        content: '24 hours',
        geographic: '7 days',
        devices: '7 days',
        pageViews: '24 hours',
      },
      timestamp: now,
      timestampISO: new Date(now).toISOString(),
    };
    
    // Cache the results
    statsCache = {
      data: responseData,
      timestamp: now,
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Unified stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unified stats' },
      { status: 500 }
    );
  }
}
