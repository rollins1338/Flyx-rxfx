/**
 * Admin Data Fix API
 * POST /api/admin/fix-data - Fix corrupted analytics data
 * 
 * Actions:
 * - fix-watch-time: Recalculate watch time from watch_sessions
 * - fix-sessions: Recalculate session counts from unique sessions
 * - fix-all: Run both fixes
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (!action || !['fix-watch-time', 'fix-sessions', 'fix-all'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use: fix-watch-time, fix-sessions, or fix-all' },
        { status: 400 }
      );
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const results: {
      watchTimeFix?: { usersFixed: number; errors: number; details: string[] };
      sessionsFix?: { usersFixed: number; errors: number; details: string[] };
    } = {};

    // Fix Watch Time
    if (action === 'fix-watch-time' || action === 'fix-all') {
      results.watchTimeFix = await fixWatchTime(adapter, isNeon);
    }

    // Fix Session Counts
    if (action === 'fix-sessions' || action === 'fix-all') {
      results.sessionsFix = await fixSessionCounts(adapter, isNeon);
    }

    return NextResponse.json({
      success: true,
      action,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data fix error:', error);
    return NextResponse.json(
      { error: 'Failed to fix data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function fixWatchTime(adapter: any, isNeon: boolean): Promise<{ usersFixed: number; errors: number; details: string[] }> {
  const details: string[] = [];
  let usersFixed = 0;
  let errors = 0;

  try {
    // Get all users
    const usersQuery = 'SELECT DISTINCT user_id FROM user_activity';
    const users = await adapter.query(usersQuery);
    details.push(`Found ${users.length} users to process`);

    for (const user of users) {
      const userId = user.user_id;

      try {
        // Calculate actual watch time from watch_sessions
        const watchTimeQuery = isNeon
          ? 'SELECT COALESCE(SUM(total_watch_time), 0) as total FROM watch_sessions WHERE user_id = $1'
          : 'SELECT COALESCE(SUM(total_watch_time), 0) as total FROM watch_sessions WHERE user_id = ?';
        
        const watchResult = await adapter.query(watchTimeQuery, [userId]);
        const actualWatchTime = parseInt(watchResult[0]?.total) || 0;

        // Update user_activity with correct watch time
        const updateQuery = isNeon
          ? 'UPDATE user_activity SET total_watch_time = $1, updated_at = $2 WHERE user_id = $3'
          : 'UPDATE user_activity SET total_watch_time = ?, updated_at = ? WHERE user_id = ?';
        
        await adapter.execute(updateQuery, [actualWatchTime, Date.now(), userId]);
        usersFixed++;

      } catch (err) {
        errors++;
        console.error(`Error fixing watch time for ${userId}:`, err);
      }
    }

    details.push(`Fixed watch time for ${usersFixed} users`);
    if (errors > 0) details.push(`${errors} errors occurred`);

  } catch (err) {
    details.push(`Fatal error: ${err instanceof Error ? err.message : 'Unknown'}`);
    errors++;
  }

  return { usersFixed, errors, details };
}

async function fixSessionCounts(adapter: any, isNeon: boolean): Promise<{ usersFixed: number; errors: number; details: string[] }> {
  const details: string[] = [];
  let usersFixed = 0;
  let errors = 0;

  try {
    // Step 1: Get aggregated data per user
    details.push('Aggregating user data...');
    
    const aggregateQuery = isNeon
      ? `SELECT 
           user_id,
           COUNT(DISTINCT session_id) as unique_sessions,
           MIN(first_seen) as first_seen,
           MAX(last_seen) as last_seen,
           SUM(total_watch_time) as total_watch_time,
           MAX(session_id) as latest_session_id,
           MAX(device_type) as device_type,
           MAX(user_agent) as user_agent,
           MAX(country) as country,
           MAX(city) as city,
           MAX(region) as region
         FROM user_activity
         GROUP BY user_id`
      : `SELECT 
           user_id,
           COUNT(DISTINCT session_id) as unique_sessions,
           MIN(first_seen) as first_seen,
           MAX(last_seen) as last_seen,
           SUM(total_watch_time) as total_watch_time,
           MAX(session_id) as latest_session_id,
           MAX(device_type) as device_type,
           MAX(user_agent) as user_agent,
           MAX(country) as country,
           MAX(city) as city,
           MAX(region) as region
         FROM user_activity
         GROUP BY user_id`;
    
    const aggregatedUsers = await adapter.query(aggregateQuery);
    details.push(`Found ${aggregatedUsers.length} unique users`);

    if (aggregatedUsers.length === 0) {
      details.push('No users to migrate');
      return { usersFixed: 0, errors: 0, details };
    }

    // Step 2: Also get unique session counts from watch_sessions for more accuracy
    const sessionCountsQuery = isNeon
      ? 'SELECT user_id, COUNT(DISTINCT session_id) as watch_sessions FROM watch_sessions GROUP BY user_id'
      : 'SELECT user_id, COUNT(DISTINCT session_id) as watch_sessions FROM watch_sessions GROUP BY user_id';
    
    const sessionCounts = await adapter.query(sessionCountsQuery);
    const sessionCountMap = new Map<string, number>(
      sessionCounts.map((s: any) => [s.user_id as string, parseInt(s.watch_sessions) || 0])
    );

    // Step 3: Create backup
    try {
      await adapter.execute('DROP TABLE IF EXISTS user_activity_backup_auto');
      if (isNeon) {
        await adapter.execute('CREATE TABLE user_activity_backup_auto AS SELECT * FROM user_activity');
      } else {
        await adapter.execute('CREATE TABLE user_activity_backup_auto AS SELECT * FROM user_activity');
      }
      details.push('Backup created: user_activity_backup_auto');
    } catch (e) {
      details.push('Warning: Could not create backup');
    }

    // Step 4: Clear and rebuild
    await adapter.execute('DELETE FROM user_activity');
    details.push('Cleared existing records');

    const now = Date.now();

    for (const user of aggregatedUsers) {
      try {
        const newId = `ua_${user.user_id}`;
        
        // Use the higher of: unique sessions from user_activity OR watch_sessions
        const uaSessionCount = parseInt(user.unique_sessions) || 1;
        const wsSessionCount = sessionCountMap.get(user.user_id) || 0;
        const uniqueSessions = Math.max(uaSessionCount, wsSessionCount, 1);
        
        const firstSeen = parseInt(user.first_seen) || now;
        const lastSeen = parseInt(user.last_seen) || now;
        const totalWatchTime = parseInt(user.total_watch_time) || 0;

        const insertQuery = isNeon
          ? `INSERT INTO user_activity (
               id, user_id, session_id, first_seen, last_seen, total_sessions,
               total_watch_time, device_type, user_agent, country, city, region,
               created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
          : `INSERT INTO user_activity (
               id, user_id, session_id, first_seen, last_seen, total_sessions,
               total_watch_time, device_type, user_agent, country, city, region,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await adapter.execute(insertQuery, [
          newId,
          user.user_id,
          user.latest_session_id || 'unknown',
          firstSeen,
          lastSeen,
          uniqueSessions,
          totalWatchTime,
          user.device_type || 'unknown',
          user.user_agent || null,
          user.country || null,
          user.city || null,
          user.region || null,
          now,
          now
        ]);

        usersFixed++;
      } catch (err) {
        errors++;
        console.error(`Error migrating user ${user.user_id}:`, err);
      }
    }

    details.push(`Migrated ${usersFixed} users with corrected session counts`);
    if (errors > 0) details.push(`${errors} errors occurred`);

    // Step 5: Verify
    const countResult = await adapter.query('SELECT COUNT(*) as count FROM user_activity');
    details.push(`Final record count: ${countResult[0]?.count}`);

  } catch (err) {
    details.push(`Fatal error: ${err instanceof Error ? err.message : 'Unknown'}`);
    errors++;
  }

  return { usersFixed, errors, details };
}

// GET endpoint to check current data status
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

    // Get stats about current data quality
    const statsQuery = isNeon
      ? `SELECT 
           COUNT(*) as total_records,
           COUNT(DISTINCT user_id) as unique_users,
           SUM(total_sessions) as total_sessions_sum,
           SUM(total_watch_time) as total_watch_time_sum,
           AVG(total_sessions) as avg_sessions,
           AVG(total_watch_time) as avg_watch_time,
           COUNT(CASE WHEN total_sessions > 100 THEN 1 END) as suspicious_session_counts,
           COUNT(CASE WHEN total_watch_time = 0 AND total_sessions > 1 THEN 1 END) as zero_watch_time_with_sessions
         FROM user_activity`
      : `SELECT 
           COUNT(*) as total_records,
           COUNT(DISTINCT user_id) as unique_users,
           SUM(total_sessions) as total_sessions_sum,
           SUM(total_watch_time) as total_watch_time_sum,
           AVG(total_sessions) as avg_sessions,
           AVG(total_watch_time) as avg_watch_time,
           SUM(CASE WHEN total_sessions > 100 THEN 1 ELSE 0 END) as suspicious_session_counts,
           SUM(CASE WHEN total_watch_time = 0 AND total_sessions > 1 THEN 1 ELSE 0 END) as zero_watch_time_with_sessions
         FROM user_activity`;

    const stats = await adapter.query(statsQuery);
    const data = stats[0] || {};

    // Check for data issues
    const issues: string[] = [];
    
    const totalRecords = parseInt(data.total_records) || 0;
    const uniqueUsers = parseInt(data.unique_users) || 0;
    const suspiciousSessions = parseInt(data.suspicious_session_counts) || 0;
    const zeroWatchTime = parseInt(data.zero_watch_time_with_sessions) || 0;

    if (totalRecords > uniqueUsers) {
      issues.push(`Duplicate records detected: ${totalRecords} records for ${uniqueUsers} users`);
    }
    if (suspiciousSessions > 0) {
      issues.push(`${suspiciousSessions} users have suspiciously high session counts (>100)`);
    }
    if (zeroWatchTime > 0) {
      issues.push(`${zeroWatchTime} users have sessions but 0 watch time`);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRecords,
        uniqueUsers,
        totalSessions: parseInt(data.total_sessions_sum) || 0,
        totalWatchTime: Math.round((parseInt(data.total_watch_time_sum) || 0) / 60), // minutes
        avgSessionsPerUser: parseFloat(data.avg_sessions || 0).toFixed(2),
        avgWatchTimePerUser: Math.round((parseFloat(data.avg_watch_time) || 0) / 60), // minutes
        suspiciousSessionCounts: suspiciousSessions,
        zeroWatchTimeWithSessions: zeroWatchTime,
      },
      issues,
      needsFix: issues.length > 0,
    });

  } catch (error) {
    console.error('Data status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check data status' },
      { status: 500 }
    );
  }
}
