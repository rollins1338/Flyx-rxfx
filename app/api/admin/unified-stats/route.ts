/**
 * Unified Stats API - SINGLE SOURCE OF TRUTH
 * GET /api/admin/unified-stats
 * 
 * ALL admin pages MUST use this endpoint for key metrics.
 * This ensures consistent data across the entire admin panel.
 * 
 * Data Sources:
 * - live_activity: Real-time user presence (last 5 min heartbeat)
 * - user_activity: User sessions and activity history
 * - watch_sessions: Content viewing data
 * - analytics_events: Page views and events
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { getCountryName } from '@/app/lib/utils/geolocation';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // ============================================
    // 1. REAL-TIME DATA (from live_activity)
    // ============================================
    let realtime = { totalActive: 0, watching: 0, browsing: 0, livetv: 0 };
    try {
      const liveQuery = isNeon
        ? `SELECT activity_type, COUNT(*) as count 
           FROM live_activity 
           WHERE is_active = TRUE AND last_heartbeat >= $1 
           GROUP BY activity_type`
        : `SELECT activity_type, COUNT(*) as count 
           FROM live_activity 
           WHERE is_active = 1 AND last_heartbeat >= ? 
           GROUP BY activity_type`;
      
      const liveResult = await adapter.query(liveQuery, [fiveMinutesAgo]);
      
      let total = 0;
      for (const row of liveResult) {
        const count = parseInt(row.count) || 0;
        total += count;
        if (row.activity_type === 'watching') realtime.watching = count;
        else if (row.activity_type === 'browsing') realtime.browsing = count;
        else if (row.activity_type === 'livetv') realtime.livetv = count;
      }
      realtime.totalActive = total;
    } catch (e) {
      console.error('Error fetching realtime stats:', e);
    }

    // ============================================
    // 2. USER METRICS (from user_activity ONLY - single source)
    // ============================================
    let users = { total: 0, dau: 0, wau: 0, mau: 0, newToday: 0, returning: 0 };
    try {
      // Simple query first to check if table exists and has data
      const simpleQuery = isNeon
        ? `SELECT COUNT(*) as total FROM user_activity WHERE first_seen > 0 AND last_seen > 0`
        : `SELECT COUNT(*) as total FROM user_activity WHERE first_seen > 0 AND last_seen > 0`;
      
      const simpleResult = await adapter.query(simpleQuery);
      users.total = parseInt(simpleResult[0]?.total) || 0;
      
      // Get DAU (active in last 24h)
      const dauQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ? AND last_seen <= ?`;
      const dauResult = await adapter.query(dauQuery, [oneDayAgo, now]);
      users.dau = parseInt(dauResult[0]?.count) || 0;
      
      // Get WAU (active in last week)
      const wauQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ? AND last_seen <= ?`;
      const wauResult = await adapter.query(wauQuery, [oneWeekAgo, now]);
      users.wau = parseInt(wauResult[0]?.count) || 0;
      
      // Get MAU (active in last month)
      const mauQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ? AND last_seen <= ?`;
      const mauResult = await adapter.query(mauQuery, [oneMonthAgo, now]);
      users.mau = parseInt(mauResult[0]?.count) || 0;
      
      // Get new users today
      const newQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE first_seen >= $1 AND first_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE first_seen >= ? AND first_seen <= ?`;
      const newResult = await adapter.query(newQuery, [oneDayAgo, now]);
      users.newToday = parseInt(newResult[0]?.count) || 0;
      
      // Get returning users
      const returningQuery = isNeon
        ? `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE first_seen < $1 AND last_seen >= $1 AND last_seen <= $2`
        : `SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE first_seen < ? AND last_seen >= ? AND last_seen <= ?`;
      const returningResult = await adapter.query(returningQuery, isNeon ? [oneDayAgo, now] : [oneDayAgo, oneDayAgo, now]);
      users.returning = parseInt(returningResult[0]?.count) || 0;
    } catch (e) {
      console.error('Error fetching user stats:', e);
    }

    // ============================================
    // 3. CONTENT METRICS (from watch_sessions - validated timestamps)
    // ============================================
    let content = { totalSessions: 0, totalWatchTime: 0, avgDuration: 0, completionRate: 0 };
    try {
      // Only count sessions with valid timestamps (within reasonable range)
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
        content.totalWatchTime = Math.round(parseFloat(contentResult[0].total_watch_time) / 60) || 0;
        content.avgDuration = Math.round(parseFloat(contentResult[0].avg_duration) / 60) || 0;
        content.completionRate = Math.round(parseFloat(contentResult[0].avg_completion)) || 0;
      }
    } catch (e) {
      console.error('Error fetching content stats:', e);
    }

    // ============================================
    // 4. GEOGRAPHIC DATA (from user_activity)
    // ============================================
    let geographic: Array<{ country: string; countryName: string; count: number }> = [];
    try {
      const geoQuery = isNeon
        ? `SELECT UPPER(country) as country, COUNT(DISTINCT user_id) as count 
           FROM user_activity 
           WHERE last_seen >= $1 AND country IS NOT NULL AND LENGTH(country) = 2
           GROUP BY UPPER(country) 
           ORDER BY count DESC 
           LIMIT 10`
        : `SELECT UPPER(country) as country, COUNT(DISTINCT user_id) as count 
           FROM user_activity 
           WHERE last_seen >= ? AND country IS NOT NULL AND LENGTH(country) = 2
           GROUP BY UPPER(country) 
           ORDER BY count DESC 
           LIMIT 10`;
      
      const geoResult = await adapter.query(geoQuery, [oneWeekAgo]);
      
      geographic = geoResult.map((row: any) => ({
        country: row.country,
        countryName: getCountryName(row.country) || row.country,
        count: parseInt(row.count) || 0,
      }));
    } catch (e) {
      console.error('Error fetching geographic stats:', e);
    }

    // ============================================
    // 5. DEVICE BREAKDOWN (from user_activity + watch_sessions)
    // ============================================
    let devices: Array<{ device: string; count: number }> = [];
    try {
      const deviceQuery = isNeon
        ? `SELECT COALESCE(device_type, 'unknown') as device, COUNT(*) as count 
           FROM user_activity 
           WHERE last_seen >= $1
           GROUP BY device_type 
           ORDER BY count DESC`
        : `SELECT COALESCE(device_type, 'unknown') as device, COUNT(*) as count 
           FROM user_activity 
           WHERE last_seen >= ?
           GROUP BY device_type 
           ORDER BY count DESC`;
      
      const deviceResult = await adapter.query(deviceQuery, [oneWeekAgo]);
      
      devices = deviceResult.map((row: any) => ({
        device: row.device || 'unknown',
        count: parseInt(row.count) || 0,
      }));
    } catch (e) {
      console.error('Error fetching device stats:', e);
    }

    return NextResponse.json({
      success: true,
      realtime,
      users,
      content,
      geographic,
      devices,
      timestamp: now,
      timestampISO: new Date(now).toISOString(),
    });

  } catch (error) {
    console.error('Unified stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unified stats' },
      { status: 500 }
    );
  }
}
