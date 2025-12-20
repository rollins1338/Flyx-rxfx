/**
 * Debug Traffic API - Check traffic and presence data
 * GET /api/admin/debug/traffic
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

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    const twoMinutesAgo = now - 2 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const results: Record<string, any> = {
      currentTime: now,
      currentTimeISO: new Date(now).toISOString(),
      thirtyMinutesAgo,
      twoMinutesAgo,
    };

    // Check server_hits table
    try {
      const serverHitsCount = await adapter.query('SELECT COUNT(*) as count FROM server_hits');
      results.serverHits = {
        totalCount: parseInt(serverHitsCount[0]?.count) || 0,
      };

      if (results.serverHits.totalCount > 0) {
        // Get recent hits
        const recentHits = isNeon
          ? await adapter.query('SELECT * FROM server_hits ORDER BY timestamp DESC LIMIT 5')
          : await adapter.query('SELECT * FROM server_hits ORDER BY timestamp DESC LIMIT 5');
        results.serverHits.recentSamples = recentHits;

        // Get hits in last 24h
        const last24h = isNeon
          ? await adapter.query('SELECT COUNT(*) as count FROM server_hits WHERE timestamp > $1', [oneDayAgo])
          : await adapter.query('SELECT COUNT(*) as count FROM server_hits WHERE timestamp > ?', [oneDayAgo]);
        results.serverHits.last24hCount = parseInt(last24h[0]?.count) || 0;
      }
    } catch (e) {
      results.serverHits = { error: String(e) };
    }

    // Check referrer_stats table
    try {
      const referrerCount = await adapter.query('SELECT COUNT(*) as count FROM referrer_stats');
      results.referrerStats = {
        totalCount: parseInt(referrerCount[0]?.count) || 0,
      };

      if (results.referrerStats.totalCount > 0) {
        const topReferrers = await adapter.query('SELECT * FROM referrer_stats ORDER BY hit_count DESC LIMIT 5');
        results.referrerStats.topReferrers = topReferrers;
      }
    } catch (e) {
      results.referrerStats = { error: String(e) };
    }

    // Check live_activity - ACTIVE users
    try {
      // Total records
      const totalLive = await adapter.query('SELECT COUNT(*) as count FROM live_activity');
      results.liveActivity = {
        totalRecords: parseInt(totalLive[0]?.count) || 0,
      };

      // Active records (is_active = true)
      const activeQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = TRUE'
        : 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = 1';
      const activeCount = await adapter.query(activeQuery);
      results.liveActivity.activeRecords = parseInt(activeCount[0]?.count) || 0;

      // Active in last 2 minutes
      const recentActiveQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = TRUE AND last_heartbeat >= $1'
        : 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = 1 AND last_heartbeat >= ?';
      const recentActive = await adapter.query(recentActiveQuery, [twoMinutesAgo]);
      results.liveActivity.activeInLast2Min = parseInt(recentActive[0]?.count) || 0;

      // Active in last 30 minutes
      const thirtyMinQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = TRUE AND last_heartbeat >= $1'
        : 'SELECT COUNT(*) as count FROM live_activity WHERE is_active = 1 AND last_heartbeat >= ?';
      const thirtyMinActive = await adapter.query(thirtyMinQuery, [thirtyMinutesAgo]);
      results.liveActivity.activeInLast30Min = parseInt(thirtyMinActive[0]?.count) || 0;

      // Get most recent heartbeats
      const recentHeartbeats = isNeon
        ? await adapter.query('SELECT user_id, activity_type, last_heartbeat, is_active FROM live_activity ORDER BY last_heartbeat DESC LIMIT 5')
        : await adapter.query('SELECT user_id, activity_type, last_heartbeat, is_active FROM live_activity ORDER BY last_heartbeat DESC LIMIT 5');
      
      results.liveActivity.mostRecentHeartbeats = recentHeartbeats.map((r: any) => ({
        ...r,
        last_heartbeat_iso: new Date(parseInt(r.last_heartbeat)).toISOString(),
        age_seconds: Math.round((now - parseInt(r.last_heartbeat)) / 1000),
      }));

      // Check for future timestamps (bug indicator)
      const futureQuery = isNeon
        ? 'SELECT COUNT(*) as count FROM live_activity WHERE last_heartbeat > $1'
        : 'SELECT COUNT(*) as count FROM live_activity WHERE last_heartbeat > ?';
      const futureCount = await adapter.query(futureQuery, [now + 60000]); // 1 minute in future
      results.liveActivity.futureTimestamps = parseInt(futureCount[0]?.count) || 0;

    } catch (e) {
      results.liveActivity = { error: String(e) };
    }

    // Check user_activity recent data
    try {
      const recentUsers = isNeon
        ? await adapter.query('SELECT COUNT(*) as count FROM user_activity WHERE last_seen >= $1', [thirtyMinutesAgo])
        : await adapter.query('SELECT COUNT(*) as count FROM user_activity WHERE last_seen >= ?', [thirtyMinutesAgo]);
      results.userActivity = {
        activeInLast30Min: parseInt(recentUsers[0]?.count) || 0,
      };

      // Most recent user activity
      const recentUserSamples = await adapter.query('SELECT user_id, last_seen, country, human_score FROM user_activity ORDER BY last_seen DESC LIMIT 5');
      results.userActivity.mostRecent = recentUserSamples.map((r: any) => ({
        ...r,
        last_seen_iso: new Date(parseInt(r.last_seen)).toISOString(),
        age_seconds: Math.round((now - parseInt(r.last_seen)) / 1000),
      }));
    } catch (e) {
      results.userActivity = { error: String(e) };
    }

    return NextResponse.json({
      success: true,
      databaseType: isNeon ? 'PostgreSQL (Neon)' : 'SQLite',
      ...results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug traffic API error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
