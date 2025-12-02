/**
 * Admin Debug API - Check database health and data
 * GET /api/admin/debug - Get database stats and sample data
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

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
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Get table counts
    const tables = ['analytics_events', 'watch_sessions', 'user_activity', 'live_activity', 'content_stats', 'page_views', 'user_engagement', 'session_details'];
    const tableCounts: Record<string, number> = {};
    
    for (const table of tables) {
      try {
        const result = await adapter.query(`SELECT COUNT(*) as count FROM ${table}`);
        tableCounts[table] = parseInt(result[0]?.count) || 0;
      } catch (e) {
        tableCounts[table] = -1; // Table doesn't exist or error
      }
    }

    // Get recent activity counts
    const recentCounts: Record<string, any> = {};
    
    // Analytics events in last 24h
    try {
      const eventsQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM analytics_events WHERE timestamp > $1'
        : 'SELECT COUNT(*) as count FROM analytics_events WHERE timestamp > ?';
      const eventsResult = await adapter.query(eventsQuery, [oneDayAgo]);
      recentCounts.events_24h = parseInt(eventsResult[0]?.count) || 0;
    } catch (e) {
      recentCounts.events_24h = 'error';
    }

    // Watch sessions in last 24h
    try {
      const sessionsQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM watch_sessions WHERE started_at > $1'
        : 'SELECT COUNT(*) as count FROM watch_sessions WHERE started_at > ?';
      const sessionsResult = await adapter.query(sessionsQuery, [oneDayAgo]);
      recentCounts.sessions_24h = parseInt(sessionsResult[0]?.count) || 0;
    } catch (e) {
      recentCounts.sessions_24h = 'error';
    }

    // User activity in last 24h
    try {
      const activityQuery = isNeon
        ? 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen > $1'
        : 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE last_seen > ?';
      const activityResult = await adapter.query(activityQuery, [oneDayAgo]);
      recentCounts.active_users_24h = parseInt(activityResult[0]?.count) || 0;
    } catch (e) {
      recentCounts.active_users_24h = 'error';
    }

    // Live activity (currently active)
    try {
      const liveQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = TRUE AND last_heartbeat > $1'
        : 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = 1 AND last_heartbeat > ?';
      const liveResult = await adapter.query(liveQuery, [now - 5 * 60 * 1000]); // Last 5 minutes
      recentCounts.live_now = parseInt(liveResult[0]?.count) || 0;
    } catch (e) {
      recentCounts.live_now = 'error';
    }

    // Get sample timestamps to check format
    const sampleTimestamps: Record<string, any> = {};
    
    try {
      const sampleQuery = isNeon
        ? 'SELECT timestamp, created_at FROM analytics_events ORDER BY timestamp DESC LIMIT 1'
        : 'SELECT timestamp, created_at FROM analytics_events ORDER BY timestamp DESC LIMIT 1';
      const sampleResult = await adapter.query(sampleQuery);
      if (sampleResult[0]) {
        sampleTimestamps.analytics_events = {
          timestamp: sampleResult[0].timestamp,
          created_at: sampleResult[0].created_at,
          timestamp_date: new Date(parseInt(sampleResult[0].timestamp)).toISOString(),
        };
      }
    } catch (e) {
      sampleTimestamps.analytics_events = 'error';
    }

    try {
      const sampleQuery = isNeon
        ? 'SELECT started_at, created_at FROM watch_sessions ORDER BY started_at DESC LIMIT 1'
        : 'SELECT started_at, created_at FROM watch_sessions ORDER BY started_at DESC LIMIT 1';
      const sampleResult = await adapter.query(sampleQuery);
      if (sampleResult[0]) {
        sampleTimestamps.watch_sessions = {
          started_at: sampleResult[0].started_at,
          created_at: sampleResult[0].created_at,
          started_at_date: new Date(parseInt(sampleResult[0].started_at)).toISOString(),
        };
      }
    } catch (e) {
      sampleTimestamps.watch_sessions = 'error';
    }

    try {
      const sampleQuery = isNeon
        ? 'SELECT first_seen, last_seen FROM user_activity ORDER BY last_seen DESC LIMIT 1'
        : 'SELECT first_seen, last_seen FROM user_activity ORDER BY last_seen DESC LIMIT 1';
      const sampleResult = await adapter.query(sampleQuery);
      if (sampleResult[0]) {
        sampleTimestamps.user_activity = {
          first_seen: sampleResult[0].first_seen,
          last_seen: sampleResult[0].last_seen,
          first_seen_date: new Date(parseInt(sampleResult[0].first_seen)).toISOString(),
          last_seen_date: new Date(parseInt(sampleResult[0].last_seen)).toISOString(),
        };
      }
    } catch (e) {
      sampleTimestamps.user_activity = 'error';
    }

    return NextResponse.json({
      success: true,
      database: isNeon ? 'PostgreSQL (Neon)' : 'SQLite',
      currentTime: now,
      currentTimeISO: new Date(now).toISOString(),
      tableCounts,
      recentCounts,
      sampleTimestamps,
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info', details: String(error) },
      { status: 500 }
    );
  }
}
