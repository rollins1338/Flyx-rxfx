/**
 * Admin Analytics API
 * GET /api/admin/analytics - Get analytics data for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';



export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const contentType = searchParams.get('contentType') || undefined;

    // Calculate date range
    const now = new Date();
    let start: Date;
    let end = new Date(now);

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case 'day':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    // Initialize database and get analytics data
    await initializeDB();
    const db = getDB();

    // Get overview statistics
    const overview = getOverviewStats(db, startTimestamp, endTimestamp, contentType);
    
    // Get daily metrics
    const dailyMetrics = getDailyMetrics(db, startTimestamp, endTimestamp, contentType);
    
    // Get top content
    const topContent = getTopContent(db, startTimestamp, endTimestamp, contentType);
    
    // Get geographic data
    const geographic = getGeographicData(db, startTimestamp, endTimestamp);
    
    // Get device/browser data
    const devices = getDeviceData(db, startTimestamp, endTimestamp);

    return NextResponse.json({
      success: true,
      data: {
        overview,
        dailyMetrics,
        topContent,
        geographic,
        devices,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          period,
        },
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}


function getOverviewStats(db: any, startTimestamp: number, endTimestamp: number, contentType?: string) {
  const contentFilter = contentType ? `AND JSON_EXTRACT(metadata, '$.content_type') = '${contentType}'` : '';
  
  // Total views
  const viewsStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE timestamp BETWEEN ? AND ?
    AND event_type = 'content_view'
    ${contentFilter}
  `);
  const views = viewsStmt.get(startTimestamp, endTimestamp) as { count: number };

  // Total watch time
  const watchTimeStmt = db.prepare(`
    SELECT SUM(CAST(JSON_EXTRACT(metadata, '$.watch_time') AS INTEGER)) as total
    FROM analytics_events
    WHERE timestamp BETWEEN ? AND ?
    AND event_type = 'watch_progress'
    AND JSON_EXTRACT(metadata, '$.watch_time') IS NOT NULL
    ${contentFilter}
  `);
  const watchTime = watchTimeStmt.get(startTimestamp, endTimestamp) as { total: number };

  // Unique sessions
  const sessionsStmt = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count
    FROM analytics_events
    WHERE timestamp BETWEEN ? AND ?
    ${contentFilter}
  `);
  const sessions = sessionsStmt.get(startTimestamp, endTimestamp) as { count: number };

  // Average session duration
  const avgSessionStmt = db.prepare(`
    SELECT AVG(session_duration) as avg_duration
    FROM (
      SELECT session_id, (MAX(timestamp) - MIN(timestamp)) / 1000 as session_duration
      FROM analytics_events
      WHERE timestamp BETWEEN ? AND ?
      ${contentFilter}
      GROUP BY session_id
      HAVING session_duration > 0
    )
  `);
  const avgSession = avgSessionStmt.get(startTimestamp, endTimestamp) as { avg_duration: number };

  return {
    totalViews: views.count || 0,
    totalWatchTime: Math.round((watchTime.total || 0) / 60), // Convert to minutes
    uniqueSessions: sessions.count || 0,
    avgSessionDuration: Math.round(avgSession.avg_duration || 0),
  };
}

function getDailyMetrics(db: any, startTimestamp: number, endTimestamp: number, contentType?: string) {
  const contentFilter = contentType ? `AND JSON_EXTRACT(metadata, '$.content_type') = '${contentType}'` : '';
  
  const stmt = db.prepare(`
    SELECT 
      DATE(timestamp / 1000, 'unixepoch') as date,
      COUNT(CASE WHEN event_type = 'content_view' THEN 1 END) as views,
      SUM(CASE WHEN event_type = 'watch_progress' THEN CAST(JSON_EXTRACT(metadata, '$.watch_time') AS INTEGER) ELSE 0 END) as watch_time,
      COUNT(DISTINCT session_id) as sessions
    FROM analytics_events
    WHERE timestamp BETWEEN ? AND ?
    ${contentFilter}
    GROUP BY DATE(timestamp / 1000, 'unixepoch')
    ORDER BY date
  `);

  const results = stmt.all(startTimestamp, endTimestamp) as Array<{
    date: string;
    views: number;
    watch_time: number;
    sessions: number;
  }>;

  return results.map(row => ({
    date: row.date,
    views: row.views || 0,
    watchTime: Math.round((row.watch_time || 0) / 60), // Convert to minutes
    sessions: row.sessions || 0,
  }));
}

function getTopContent(db: any, startTimestamp: number, endTimestamp: number, contentType?: string) {
  const contentFilter = contentType ? `AND content_type = '${contentType}'` : '';
  
  const stmt = db.prepare(`
    SELECT 
      content_id,
      content_type,
      view_count,
      total_watch_time / 60 as watch_time_minutes,
      completion_rate
    FROM content_stats
    WHERE last_viewed BETWEEN ? AND ?
    ${contentFilter}
    ORDER BY view_count DESC
    LIMIT 20
  `);

  return stmt.all(startTimestamp, endTimestamp);
}

function getGeographicData(db: any, startTimestamp: number, endTimestamp: number) {
  const stmt = db.prepare(`
    SELECT 
      JSON_EXTRACT(metadata, '$.country') as country,
      JSON_EXTRACT(metadata, '$.region') as region,
      COUNT(DISTINCT session_id) as sessions,
      COUNT(*) as events
    FROM analytics_events
    WHERE timestamp BETWEEN ? AND ?
    AND JSON_EXTRACT(metadata, '$.country') IS NOT NULL
    GROUP BY country, region
    ORDER BY sessions DESC
    LIMIT 50
  `);

  return stmt.all(startTimestamp, endTimestamp);
}

function getDeviceData(db: any, startTimestamp: number, endTimestamp: number) {
  const stmt = db.prepare(`
    SELECT 
      CASE 
        WHEN JSON_EXTRACT(metadata, '$.user_agent') LIKE '%Mobile%' THEN 'Mobile'
        WHEN JSON_EXTRACT(metadata, '$.user_agent') LIKE '%Tablet%' THEN 'Tablet'
        ELSE 'Desktop'
      END as device_type,
      COUNT(DISTINCT session_id) as sessions
    FROM analytics_events
    WHERE timestamp BETWEEN ? AND ?
    AND JSON_EXTRACT(metadata, '$.user_agent') IS NOT NULL
    GROUP BY device_type
    ORDER BY sessions DESC
  `);

  return stmt.all(startTimestamp, endTimestamp);
}
