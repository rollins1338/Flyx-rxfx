/**
 * Admin Analytics API
 * GET /api/admin/analytics - Get analytics data for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { isValidCountryCode, getCountryName } from '@/app/lib/utils/geolocation';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Calculate date range
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      // Set end date to end of day if it's just a date string
      if (endDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      end = new Date();
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
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    // 1. Overview Statistics
    const overviewRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            COUNT(*) as "totalViews",
            COALESCE(SUM(total_watch_time), 0) / 60 as "totalWatchTime",
            COUNT(DISTINCT session_id) as "uniqueSessions"
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
        `
        : `
          SELECT 
            COUNT(*) as totalViews,
            COALESCE(SUM(total_watch_time), 0) / 60 as totalWatchTime,
            COUNT(DISTINCT session_id) as uniqueSessions
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
        `,
      [startTimestamp, endTimestamp]
    );

    // 2. Daily Metrics (for charts)
    const dailyMetricsRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            TO_CHAR(TO_TIMESTAMP(started_at / 1000), 'YYYY-MM-DD') as date,
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as "watchTime",
            COUNT(DISTINCT session_id) as sessions
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY TO_CHAR(TO_TIMESTAMP(started_at / 1000), 'YYYY-MM-DD')
          ORDER BY date ASC
        `
        : `
          SELECT 
            DATE(started_at / 1000, 'unixepoch') as date,
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as watchTime,
            COUNT(DISTINCT session_id) as sessions
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
          GROUP BY DATE(started_at / 1000, 'unixepoch')
          ORDER BY date ASC
        `,
      [startTimestamp, endTimestamp]
    );

    // 3. Content Performance (Enhanced)
    const contentPerformanceRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            content_id as "contentId",
            MAX(content_title) as "contentTitle",
            MAX(content_type) as "contentType",
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as "totalWatchTime",
            AVG(CASE WHEN duration > 0 THEN (total_watch_time::float / duration) * 100 ELSE 0 END) as "avgCompletion",
            COUNT(DISTINCT user_id) as "uniqueViewers"
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY content_id
          ORDER BY views DESC
          LIMIT 20
        `
        : `
          SELECT 
            content_id as contentId,
            MAX(content_title) as contentTitle,
            MAX(content_type) as contentType,
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as totalWatchTime,
            AVG(CASE WHEN duration > 0 THEN (CAST(total_watch_time AS FLOAT) / duration) * 100 ELSE 0 END) as avgCompletion,
            COUNT(DISTINCT user_id) as uniqueViewers
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
          GROUP BY content_id
          ORDER BY views DESC
          LIMIT 20
        `,
      [startTimestamp, endTimestamp]
    );

    // 4. User Stats (Enhanced - combines watch_sessions and user_activity)
    let usersStatsRaw: any[] = [];
    try {
      // First get from user_activity which has the most complete user data
      const userActivityStats = await adapter.query(
        isNeon
          ? `
            SELECT 
              ua.user_id as "userId",
              MAX(u.username) as username,
              MAX(u.email) as email,
              MAX(u.image) as image,
              MAX(ua.total_sessions) as "totalSessions",
              COALESCE(MAX(ua.total_watch_time), 0) / 60 as "totalWatchTime",
              MAX(ua.last_seen) as "lastActive",
              MAX(ua.country) as country,
              MAX(ua.city) as city,
              MAX(ua.device_type) as "deviceType"
            FROM user_activity ua
            LEFT JOIN users u ON ua.user_id = u.id
            WHERE ua.last_seen BETWEEN $1 AND $2
            GROUP BY ua.user_id
            ORDER BY "lastActive" DESC
            LIMIT 100
          `
          : `
            SELECT 
              ua.user_id as userId,
              MAX(u.username) as username,
              MAX(u.email) as email,
              MAX(u.image) as image,
              MAX(ua.total_sessions) as totalSessions,
              COALESCE(MAX(ua.total_watch_time), 0) / 60 as totalWatchTime,
              MAX(ua.last_seen) as lastActive,
              MAX(ua.country) as country,
              MAX(ua.city) as city,
              MAX(ua.device_type) as deviceType
            FROM user_activity ua
            LEFT JOIN users u ON ua.user_id = u.id
            WHERE ua.last_seen BETWEEN ? AND ?
            GROUP BY ua.user_id
            ORDER BY lastActive DESC
            LIMIT 100
          `,
        [startTimestamp, endTimestamp]
      );
      
      // Also get watch session data to supplement
      const watchSessionStats = await adapter.query(
        isNeon
          ? `
            SELECT 
              ws.user_id as "userId",
              COUNT(DISTINCT ws.session_id) as "sessionCount",
              COALESCE(SUM(ws.total_watch_time), 0) / 60 as "watchTime",
              MAX(ws.started_at) as "lastWatched"
            FROM watch_sessions ws
            WHERE ws.started_at BETWEEN $1 AND $2
            GROUP BY ws.user_id
          `
          : `
            SELECT 
              ws.user_id as userId,
              COUNT(DISTINCT ws.session_id) as sessionCount,
              COALESCE(SUM(ws.total_watch_time), 0) / 60 as watchTime,
              MAX(ws.started_at) as lastWatched
            FROM watch_sessions ws
            WHERE ws.started_at BETWEEN ? AND ?
            GROUP BY ws.user_id
          `,
        [startTimestamp, endTimestamp]
      );
      
      // Create a map of watch session data
      const watchMap = new Map();
      for (const ws of watchSessionStats) {
        watchMap.set(ws.userId, {
          sessionCount: parseInt(ws.sessionCount) || 0,
          watchTime: parseFloat(ws.watchTime) || 0,
          lastWatched: parseInt(ws.lastWatched) || 0
        });
      }
      
      // Merge data - prefer user_activity but supplement with watch_sessions
      usersStatsRaw = userActivityStats.map((ua: any) => {
        const wsData = watchMap.get(ua.userId) || {};
        return {
          ...ua,
          totalSessions: Math.max(parseInt(ua.totalSessions) || 0, wsData.sessionCount || 0),
          totalWatchTime: Math.max(parseFloat(ua.totalWatchTime) || 0, wsData.watchTime || 0),
          lastActive: Math.max(parseInt(ua.lastActive) || 0, wsData.lastWatched || 0)
        };
      });
      
      // Add any users from watch_sessions not in user_activity
      watchMap.forEach((wsData, userId) => {
        if (!usersStatsRaw.find((u: any) => u.userId === userId)) {
          usersStatsRaw.push({
            userId,
            username: null,
            email: null,
            image: null,
            totalSessions: wsData.sessionCount,
            totalWatchTime: wsData.watchTime,
            lastActive: wsData.lastWatched,
            country: 'Unknown',
            city: null,
            deviceType: null
          });
        }
      });
      
      // Sort by lastActive
      usersStatsRaw.sort((a: any, b: any) => (b.lastActive || 0) - (a.lastActive || 0));
      usersStatsRaw = usersStatsRaw.slice(0, 100);
      
    } catch (userStatsError) {
      console.error('User stats query error:', userStatsError);
      usersStatsRaw = [];
    }

    // 5. Geographic Heatmap - Only use valid ISO country codes
    // The country field should contain ISO 3166-1 alpha-2 codes (e.g., "US", "CA", "GB")
    let geographicRaw: any[] = [];
    
    try {
      // Use SQL aggregation for accurate counts - count unique users per country
      // This avoids double-counting and gives accurate geographic distribution
      
      const geoQuery = isNeon
        ? `
          SELECT 
            UPPER(country) as country,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT session_id) as sessions
          FROM user_activity
          WHERE last_seen BETWEEN $1 AND $2
          AND country IS NOT NULL
          AND country != ''
          AND LENGTH(country) = 2
          GROUP BY UPPER(country)
          ORDER BY unique_users DESC
        `
        : `
          SELECT 
            UPPER(country) as country,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT session_id) as sessions
          FROM user_activity
          WHERE last_seen BETWEEN ? AND ?
          AND country IS NOT NULL
          AND country != ''
          AND LENGTH(country) = 2
          GROUP BY UPPER(country)
          ORDER BY unique_users DESC
        `;
      
      const userActivityGeo = await adapter.query(geoQuery, [startTimestamp, endTimestamp]);
      
      // Filter to only valid ISO country codes and format the data
      geographicRaw = userActivityGeo
        .filter((row: any) => {
          const code = row.country;
          return code && code.length === 2 && isValidCountryCode(code);
        })
        .map((row: any) => ({
          country: row.country,
          countryName: getCountryName(row.country),
          count: parseInt(row.unique_users) || 0, // Use unique users as the primary count
          unique_users: parseInt(row.unique_users) || 0,
          sessions: parseInt(row.sessions) || 0
        }))
        .filter((g: any) => g.count > 0)
        .sort((a: any, b: any) => b.count - a.count);
        
      console.log(`Geographic data: Found ${geographicRaw.length} valid countries with data`);
        
    } catch (geoError) {
      console.error('Geographic query error:', geoError);
      geographicRaw = [];
    }

    // 6. Device Breakdown
    const deviceBreakdownRaw = await adapter.query(
      `
        SELECT 
          device_type as "deviceType",
          COUNT(*) as count
        FROM watch_sessions
        WHERE started_at BETWEEN ${isNeon ? '$1' : '?'} AND ${isNeon ? '$2' : '?'}
        GROUP BY device_type
        ORDER BY count DESC
      `,
      [startTimestamp, endTimestamp]
    );

    // 7. Peak Hours
    const peakHoursRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            EXTRACT(HOUR FROM TO_TIMESTAMP(started_at / 1000)) as hour,
            COUNT(*) as count
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY hour
          ORDER BY hour ASC
        `
        : `
          SELECT 
            strftime('%H', datetime(started_at / 1000, 'unixepoch')) as hour,
            COUNT(*) as count
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
          GROUP BY hour
          ORDER BY hour ASC
        `,
      [startTimestamp, endTimestamp]
    );

    // 8. Advanced Metrics - Enhanced with real bounce rate and session data
    const advancedMetricsRaw = await adapter.query(
      isNeon
        ? `
          WITH session_stats AS (
            SELECT session_id, COUNT(*) as view_count, SUM(total_watch_time) as session_duration
            FROM watch_sessions
            WHERE started_at BETWEEN $1 AND $2
            GROUP BY session_id
          )
          SELECT
            COUNT(*) as "uniqueViewers",
            AVG(session_duration) / 60 as "avgSessionDuration",
            (COUNT(*) FILTER (WHERE view_count = 1)::float / NULLIF(COUNT(*), 0)) * 100 as "bounceRate"
          FROM session_stats
        `
        : `
          SELECT
            COUNT(*) as uniqueViewers,
            AVG(session_duration) / 60 as avgSessionDuration,
            (CAST(SUM(CASE WHEN view_count = 1 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0)) * 100 as bounceRate
          FROM (
            SELECT session_id, COUNT(*) as view_count, SUM(total_watch_time) as session_duration
            FROM watch_sessions
            WHERE started_at BETWEEN ? AND ?
            GROUP BY session_id
          )
        `,
      [startTimestamp, endTimestamp]
    );
    
    // 9. Traffic & Landing Page Metrics from analytics_events
    let trafficMetrics: any = { totalPageViews: 0, uniqueVisitors: 0, avgTimeOnSite: 0, landingPages: [] };
    try {
      // Get page view counts
      const pageViewsQuery = isNeon
        ? `
          SELECT 
            COUNT(*) as "totalPageViews",
            COUNT(DISTINCT session_id) as "uniqueVisitors"
          FROM analytics_events
          WHERE timestamp BETWEEN $1 AND $2
          AND event_type = 'page_view'
        `
        : `
          SELECT 
            COUNT(*) as totalPageViews,
            COUNT(DISTINCT session_id) as uniqueVisitors
          FROM analytics_events
          WHERE timestamp BETWEEN ? AND ?
          AND event_type = 'page_view'
        `;
      const pageViewsRaw = await adapter.query(pageViewsQuery, [startTimestamp, endTimestamp]);
      
      // Get landing pages (first page view per session)
      const landingPagesQuery = isNeon
        ? `
          WITH first_pages AS (
            SELECT DISTINCT ON (session_id) 
              session_id,
              metadata->>'page' as page
            FROM analytics_events
            WHERE timestamp BETWEEN $1 AND $2
            AND event_type = 'page_view'
            ORDER BY session_id, timestamp ASC
          )
          SELECT page, COUNT(*) as count
          FROM first_pages
          WHERE page IS NOT NULL
          GROUP BY page
          ORDER BY count DESC
          LIMIT 10
        `
        : `
          SELECT 
            JSON_EXTRACT(metadata, '$.page') as page,
            COUNT(*) as count
          FROM (
            SELECT session_id, metadata, MIN(timestamp) as first_ts
            FROM analytics_events
            WHERE timestamp BETWEEN ? AND ?
            AND event_type = 'page_view'
            GROUP BY session_id
          )
          WHERE page IS NOT NULL
          GROUP BY page
          ORDER BY count DESC
          LIMIT 10
        `;
      const landingPagesRaw = await adapter.query(landingPagesQuery, [startTimestamp, endTimestamp]);
      
      // Calculate average time on site from user_activity
      const avgTimeQuery = isNeon
        ? `
          SELECT AVG(total_watch_time) / 60 as "avgTimeOnSite"
          FROM user_activity
          WHERE last_seen BETWEEN $1 AND $2
        `
        : `
          SELECT AVG(total_watch_time) / 60 as avgTimeOnSite
          FROM user_activity
          WHERE last_seen BETWEEN ? AND ?
        `;
      const avgTimeRaw = await adapter.query(avgTimeQuery, [startTimestamp, endTimestamp]);
      
      trafficMetrics = {
        totalPageViews: parseInt(pageViewsRaw[0]?.totalPageViews) || 0,
        uniqueVisitors: parseInt(pageViewsRaw[0]?.uniqueVisitors) || 0,
        avgTimeOnSite: Math.round(parseFloat(avgTimeRaw[0]?.avgTimeOnSite) || 0),
        landingPages: landingPagesRaw.map((row: any) => ({
          page: row.page || '/',
          count: parseInt(row.count) || 0
        }))
      };
    } catch (trafficError) {
      console.error('Traffic metrics query error:', trafficError);
    }
    
    // 10. Real-time session duration from user_activity
    let sessionDurationMetrics: any = { avgDuration: 0, medianDuration: 0, totalSessions: 0 };
    try {
      const sessionDurationQuery = isNeon
        ? `
          SELECT 
            COUNT(*) as "totalSessions",
            AVG(EXTRACT(EPOCH FROM (TO_TIMESTAMP(last_seen / 1000) - TO_TIMESTAMP(first_seen / 1000)))) / 60 as "avgDuration"
          FROM user_activity
          WHERE last_seen BETWEEN $1 AND $2
          AND first_seen > 0
        `
        : `
          SELECT 
            COUNT(*) as totalSessions,
            AVG((last_seen - first_seen) / 60000.0) as avgDuration
          FROM user_activity
          WHERE last_seen BETWEEN ? AND ?
          AND first_seen > 0
        `;
      const sessionDurationRaw = await adapter.query(sessionDurationQuery, [startTimestamp, endTimestamp]);
      
      sessionDurationMetrics = {
        totalSessions: parseInt(sessionDurationRaw[0]?.totalSessions) || 0,
        avgDuration: Math.round(parseFloat(sessionDurationRaw[0]?.avgDuration) || 0)
      };
    } catch (sessionError) {
      console.error('Session duration query error:', sessionError);
    }

    // Process and format data
    const overview = {
      totalViews: parseInt(overviewRaw[0]?.totalViews) || 0,
      totalWatchTime: Math.round(parseFloat(overviewRaw[0]?.totalWatchTime) || 0),
      uniqueSessions: parseInt(overviewRaw[0]?.uniqueSessions) || 0,
      avgSessionDuration: Math.round(parseFloat(advancedMetricsRaw[0]?.avgSessionDuration) || 0)
    };

    const dailyMetrics = dailyMetricsRaw.map((row: any) => ({
      date: row.date,
      views: parseInt(row.views) || 0,
      watchTime: Math.round(parseFloat(row.watchTime || row.watchtime) || 0),
      sessions: parseInt(row.sessions) || 0
    }));

    const contentPerformance = contentPerformanceRaw.map((row: any) => ({
      contentId: row.contentId,
      contentTitle: row.contentTitle || 'Unknown Title',
      contentType: row.contentType,
      views: parseInt(row.views) || 0,
      totalWatchTime: Math.round(parseFloat(row.totalWatchTime) || 0),
      avgCompletion: Math.round(parseFloat(row.avgCompletion) || 0),
      uniqueViewers: parseInt(row.uniqueViewers) || 0
    }));

    const usersStats = usersStatsRaw.map((row: any) => ({
      userId: row.userId,
      username: row.username || 'Anonymous',
      email: row.email,
      image: row.image,
      totalSessions: parseInt(row.totalSessions) || 0,
      totalWatchTime: Math.round(parseFloat(row.totalWatchTime) || 0),
      lastActive: parseInt(row.lastActive) || 0,
      country: row.country || 'Unknown',
      city: row.city || null,
      deviceType: row.deviceType || 'unknown'
    }));

    const geographic = geographicRaw.map((row: any) => ({
      country: row.country || 'Unknown',
      countryName: row.countryName || getCountryName(row.country) || row.country,
      count: parseInt(row.count) || 0,
      uniqueUsers: parseInt(row.unique_users) || 0,
      sessions: parseInt(row.sessions) || parseInt(row.count) || 0
    }));

    const deviceBreakdown = deviceBreakdownRaw.map((row: any) => ({
      deviceType: row.deviceType || 'Unknown',
      count: parseInt(row.count) || 0
    }));

    const peakHours = peakHoursRaw.map((row: any) => ({
      hour: parseInt(row.hour) || 0,
      count: parseInt(row.count) || 0
    }));

    const advancedMetrics = {
      uniqueViewers: parseInt(advancedMetricsRaw[0]?.uniqueViewers) || 0,
      avgSessionDuration: Math.round(parseFloat(advancedMetricsRaw[0]?.avgSessionDuration) || 0),
      bounceRate: Math.round(parseFloat(advancedMetricsRaw[0]?.bounceRate) || 0),
      // Enhanced metrics
      totalPageViews: trafficMetrics.totalPageViews,
      uniqueVisitors: trafficMetrics.uniqueVisitors,
      avgTimeOnSite: trafficMetrics.avgTimeOnSite || sessionDurationMetrics.avgDuration,
      realSessionCount: sessionDurationMetrics.totalSessions
    };

    return NextResponse.json({
      success: true,
      data: {
        overview,
        dailyMetrics,
        contentPerformance, // Replaces topContent
        usersStats,        // New
        geographic,
        deviceBreakdown,
        peakHours,
        advancedMetrics,
        trafficMetrics,    // New - page views, landing pages
        sessionMetrics: sessionDurationMetrics, // New - real session durations
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
