/**
 * Unified Stats API
 * GET /api/admin/unified-stats - Single source of truth for all admin stats
 * 
 * This endpoint consolidates data from all tables to provide consistent
 * metrics across the entire admin panel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { getCountryName } from '@/app/lib/utils/geolocation';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
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
    // 2. USER METRICS (from user_activity + analytics_events)
    // ============================================
    let users = { total: 0, dau: 0, wau: 0, mau: 0, newToday: 0, returning: 0 };
    try {
      // Total unique users ever
      const totalQuery = isNeon
        ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity'
        : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity';
      const totalResult = await adapter.query(totalQuery);
      users.total = parseInt(totalResult[0]?.count) || 0;

      // DAU - users active in last 24 hours
      const dauQuery = isNeon
        ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1'
        : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ?';
      const dauResult = await adapter.query(dauQuery, [oneDayAgo]);
      users.dau = parseInt(dauResult[0]?.count) || 0;

      // If no user_activity data, try analytics_events
      if (users.dau === 0) {
        const dauEventsQuery = isNeon
          ? 'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= $1'
          : 'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= ?';
        const dauEventsResult = await adapter.query(dauEventsQuery, [oneDayAgo]);
        users.dau = parseInt(dauEventsResult[0]?.count) || 0;
      }

      // WAU - users active in last 7 days
      const wauQuery = isNeon
        ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1'
        : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ?';
      const wauResult = await adapter.query(wauQuery, [oneWeekAgo]);
      users.wau = parseInt(wauResult[0]?.count) || 0;

      if (users.wau === 0) {
        const wauEventsQuery = isNeon
          ? 'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= $1'
          : 'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= ?';
        const wauEventsResult = await adapter.query(wauEventsQuery, [oneWeekAgo]);
        users.wau = parseInt(wauEventsResult[0]?.count) || 0;
      }

      // MAU - users active in last 30 days
      const mauQuery = isNeon
        ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= $1'
        : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen >= ?';
      const mauResult = await adapter.query(mauQuery, [oneMonthAgo]);
      users.mau = parseInt(mauResult[0]?.count) || 0;

      if (users.mau === 0) {
        const mauEventsQuery = isNeon
          ? 'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= $1'
          : 'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp >= ?';
        const mauEventsResult = await adapter.query(mauEventsQuery, [oneMonthAgo]);
        users.mau = parseInt(mauEventsResult[0]?.count) || 0;
      }

      // New users today
      const newQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen >= $1'
        : 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen >= ?';
      const newResult = await adapter.query(newQuery, [oneDayAgo]);
      users.newToday = parseInt(newResult[0]?.count) || 0;

      // Returning users (first seen before today, active today)
      const returningQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen < $1 AND last_seen >= $2'
        : 'SELECT COUNT(*) as count FROM user_activity WHERE first_seen < ? AND last_seen >= ?';
      const returningResult = await adapter.query(returningQuery, [oneDayAgo, oneDayAgo]);
      users.returning = parseInt(returningResult[0]?.count) || 0;

    } catch (e) {
      console.error('Error fetching user stats:', e);
    }

    // ============================================
    // 3. CONTENT METRICS (from watch_sessions)
    // ============================================
    let content = { totalSessions: 0, totalWatchTime: 0, avgDuration: 0, completionRate: 0 };
    try {
      const contentQuery = isNeon
        ? `SELECT 
             COUNT(*) as total_sessions,
             COALESCE(SUM(total_watch_time), 0) as total_watch_time,
             COALESCE(AVG(total_watch_time), 0) as avg_duration,
             COALESCE(AVG(completion_percentage), 0) as avg_completion
           FROM watch_sessions 
           WHERE started_at >= $1`
        : `SELECT 
             COUNT(*) as total_sessions,
             COALESCE(SUM(total_watch_time), 0) as total_watch_time,
             COALESCE(AVG(total_watch_time), 0) as avg_duration,
             COALESCE(AVG(completion_percentage), 0) as avg_completion
           FROM watch_sessions 
           WHERE started_at >= ?`;
      
      const contentResult = await adapter.query(contentQuery, [oneDayAgo]);
      
      if (contentResult[0]) {
        content.totalSessions = parseInt(contentResult[0].total_sessions) || 0;
        content.totalWatchTime = Math.round(parseFloat(contentResult[0].total_watch_time) / 60) || 0; // Convert to minutes
        content.avgDuration = Math.round(parseFloat(contentResult[0].avg_duration) / 60) || 0; // Convert to minutes
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
