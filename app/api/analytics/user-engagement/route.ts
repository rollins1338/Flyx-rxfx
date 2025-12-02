/**
 * User Engagement Tracking API
 * POST /api/analytics/user-engagement - Track user engagement metrics
 * GET /api/analytics/user-engagement - Get user engagement analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { getLocationFromHeaders } from '@/app/lib/utils/geolocation';

function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  } else if (ua.includes('smart-tv') || ua.includes('smarttv')) {
    return 'tv';
  }
  return 'desktop';
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    if (!data.userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);
    const location = getLocationFromHeaders(request);
    const now = Date.now();

    // Normalize values with explicit types
    const pageViews = parseInt(String(data.pageViews || 1));
    const sessionDuration = parseInt(String(data.sessionDuration || 0));
    const bounceCount = data.isBounce ? 1 : 0;
    const engagementScore = Math.min(100, Math.round(sessionDuration / 60 * 2));
    const countryCode = location.countryCode || 'Unknown';

    if (db.isUsingNeon()) {
      // PostgreSQL - upsert user engagement
      await adapter.execute(`
        INSERT INTO user_engagement (
          user_id, first_visit, last_visit, total_visits, total_page_views,
          total_time_on_site, avg_session_duration, avg_pages_per_session,
          device_types, countries, bounce_count, return_visits,
          engagement_score, created_at, updated_at
        ) VALUES ($1, $2::BIGINT, $2::BIGINT, 1, $3::INTEGER, $4::INTEGER, $4::INTEGER, $3::REAL, $5, $6, $7::INTEGER, 0, $8::INTEGER, $2::BIGINT, $2::BIGINT)
        ON CONFLICT (user_id) DO UPDATE SET
          last_visit = $2::BIGINT,
          total_visits = user_engagement.total_visits + 1,
          total_page_views = user_engagement.total_page_views + $3::INTEGER,
          total_time_on_site = user_engagement.total_time_on_site + $4::INTEGER,
          avg_session_duration = (user_engagement.total_time_on_site + $4::INTEGER) / (user_engagement.total_visits + 1),
          avg_pages_per_session = (user_engagement.total_page_views + $3::INTEGER)::REAL / (user_engagement.total_visits + 1),
          device_types = CASE 
            WHEN user_engagement.device_types NOT LIKE '%' || $5 || '%' 
            THEN user_engagement.device_types || ',' || $5 
            ELSE user_engagement.device_types 
          END,
          countries = CASE 
            WHEN user_engagement.countries NOT LIKE '%' || $6 || '%' 
            THEN user_engagement.countries || ',' || $6 
            ELSE user_engagement.countries 
          END,
          bounce_count = user_engagement.bounce_count + $7::INTEGER,
          return_visits = user_engagement.return_visits + 1,
          engagement_score = LEAST(100, user_engagement.engagement_score + CASE 
            WHEN $4::INTEGER > 300 THEN 5
            WHEN $4::INTEGER > 60 THEN 3
            ELSE 1
          END),
          updated_at = $2::BIGINT
      `, [
        data.userId,
        now,
        pageViews,
        sessionDuration,
        deviceType,
        countryCode,
        bounceCount,
        engagementScore
      ]);

      // Also update/insert session details
      if (data.sessionId) {
        const startedAt = now - sessionDuration * 1000;
        const isBounce = data.isBounce === true;
        const isReturning = data.isReturning === true;
        
        await adapter.execute(`
          INSERT INTO session_details (
            session_id, user_id, started_at, ended_at, duration,
            page_views, device_type, country, city, is_bounce,
            is_returning, created_at, updated_at
          ) VALUES ($1, $2, $3::BIGINT, $4::BIGINT, $5::INTEGER, $6::INTEGER, $7, $8, $9, $10::BOOLEAN, $11::BOOLEAN, $3::BIGINT, $4::BIGINT)
          ON CONFLICT (session_id) DO UPDATE SET
            ended_at = $4::BIGINT,
            duration = $5::INTEGER,
            page_views = $6::INTEGER,
            is_bounce = $10::BOOLEAN,
            updated_at = $4::BIGINT
        `, [
          data.sessionId,
          data.userId,
          startedAt,
          now,
          sessionDuration,
          pageViews,
          deviceType,
          location.countryCode,
          location.city,
          isBounce,
          isReturning
        ]);
      }
    } else {
      // SQLite
      await adapter.execute(`
        INSERT INTO user_engagement (
          user_id, first_visit, last_visit, total_visits, total_page_views,
          total_time_on_site, avg_session_duration, avg_pages_per_session,
          device_types, countries, bounce_count, return_visits,
          engagement_score, created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        ON CONFLICT (user_id) DO UPDATE SET
          last_visit = ?,
          total_visits = total_visits + 1,
          total_page_views = total_page_views + ?,
          total_time_on_site = total_time_on_site + ?,
          avg_session_duration = (total_time_on_site + ?) / (total_visits + 1),
          avg_pages_per_session = CAST((total_page_views + ?) AS FLOAT) / (total_visits + 1),
          device_types = CASE 
            WHEN device_types NOT LIKE '%' || ? || '%' 
            THEN device_types || ',' || ? 
            ELSE device_types 
          END,
          countries = CASE 
            WHEN countries NOT LIKE '%' || ? || '%' 
            THEN countries || ',' || ? 
            ELSE countries 
          END,
          bounce_count = bounce_count + ?,
          return_visits = return_visits + 1,
          engagement_score = MIN(100, engagement_score + CASE 
            WHEN ? > 300 THEN 5
            WHEN ? > 60 THEN 3
            ELSE 1
          END),
          updated_at = ?
      `, [
        data.userId,
        now,
        now,
        data.pageViews || 1,
        data.sessionDuration || 0,
        data.sessionDuration || 0,
        data.pageViews || 1,
        deviceType,
        location.countryCode || 'Unknown',
        data.isBounce ? 1 : 0,
        Math.min(100, Math.round((data.sessionDuration || 0) / 60 * 2)),
        now,
        now,
        // For ON CONFLICT UPDATE
        now,
        data.pageViews || 1,
        data.sessionDuration || 0,
        data.sessionDuration || 0,
        data.pageViews || 1,
        deviceType,
        deviceType,
        location.countryCode || 'Unknown',
        location.countryCode || 'Unknown',
        data.isBounce ? 1 : 0,
        data.sessionDuration || 0,
        data.sessionDuration || 0,
        now
      ]);

      // Also update/insert session details
      if (data.sessionId) {
        await adapter.execute(`
          INSERT INTO session_details (
            session_id, user_id, started_at, ended_at, duration,
            page_views, device_type, country, city, is_bounce,
            is_returning, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (session_id) DO UPDATE SET
            ended_at = ?,
            duration = ?,
            page_views = ?,
            is_bounce = ?,
            updated_at = ?
        `, [
          data.sessionId,
          data.userId,
          now - (data.sessionDuration || 0) * 1000,
          now,
          data.sessionDuration || 0,
          data.pageViews || 1,
          deviceType,
          location.countryCode,
          location.city,
          data.isBounce ? 1 : 0,
          data.isReturning ? 1 : 0,
          now,
          now,
          // For ON CONFLICT UPDATE
          now,
          data.sessionDuration || 0,
          data.pageViews || 1,
          data.isBounce ? 1 : 0,
          now
        ]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to track user engagement:', error);
    return NextResponse.json(
      { error: 'Failed to track user engagement' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '100');
    const sortBy = searchParams.get('sortBy') || 'last_visit';

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();

    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get user engagement data - try user_engagement first, fallback to user_activity
    let users: any[] = [];
    const orderColumn = sortBy === 'engagement' ? 'engagement_score' : 
                        sortBy === 'visits' ? 'total_visits' : 
                        sortBy === 'watch_time' ? 'total_watch_time' : 'last_visit';
    
    if (db.isUsingNeon()) {
      // First try user_engagement table
      users = await adapter.query(`
        SELECT 
          user_id,
          first_visit,
          last_visit,
          total_visits,
          total_page_views,
          total_time_on_site,
          total_watch_time,
          total_content_watched,
          ROUND(avg_session_duration::numeric, 0) as avg_session_duration,
          ROUND(avg_pages_per_session::numeric, 1) as avg_pages_per_session,
          favorite_content_type,
          preferred_quality,
          device_types,
          countries,
          bounce_count,
          return_visits,
          engagement_score
        FROM user_engagement
        WHERE last_visit > $1
        ORDER BY ${orderColumn} DESC
        LIMIT $2
      `, [startTime, limit]);
      
      // Fallback to user_activity if user_engagement is empty
      if (users.length === 0) {
        users = await adapter.query(`
          SELECT 
            user_id,
            first_seen as first_visit,
            last_seen as last_visit,
            total_sessions as total_visits,
            total_sessions as total_page_views,
            total_watch_time as total_time_on_site,
            total_watch_time,
            0 as total_content_watched,
            ROUND(COALESCE(total_watch_time::numeric / NULLIF(total_sessions, 0), 0), 0) as avg_session_duration,
            1.0 as avg_pages_per_session,
            NULL as favorite_content_type,
            NULL as preferred_quality,
            device_type as device_types,
            country as countries,
            0 as bounce_count,
            CASE WHEN total_sessions > 1 THEN total_sessions - 1 ELSE 0 END as return_visits,
            LEAST(100, GREATEST(0, total_sessions * 10 + COALESCE(total_watch_time / 60, 0))) as engagement_score
          FROM user_activity
          WHERE last_seen > $1
          ORDER BY last_seen DESC
          LIMIT $2
        `, [startTime, limit]);
      }
    } else {
      users = await adapter.query(`
        SELECT 
          user_id,
          first_visit,
          last_visit,
          total_visits,
          total_page_views,
          total_time_on_site,
          total_watch_time,
          total_content_watched,
          ROUND(avg_session_duration, 0) as avg_session_duration,
          ROUND(avg_pages_per_session, 1) as avg_pages_per_session,
          favorite_content_type,
          preferred_quality,
          device_types,
          countries,
          bounce_count,
          return_visits,
          engagement_score
        FROM user_engagement
        WHERE last_visit > ?
        ORDER BY ${orderColumn} DESC
        LIMIT ?
      `, [startTime, limit]);
      
      // Fallback to user_activity if user_engagement is empty
      if (users.length === 0) {
        users = await adapter.query(`
          SELECT 
            user_id,
            first_seen as first_visit,
            last_seen as last_visit,
            total_sessions as total_visits,
            total_sessions as total_page_views,
            total_watch_time as total_time_on_site,
            total_watch_time,
            0 as total_content_watched,
            ROUND(COALESCE(CAST(total_watch_time AS FLOAT) / MAX(total_sessions, 1), 0), 0) as avg_session_duration,
            1.0 as avg_pages_per_session,
            NULL as favorite_content_type,
            NULL as preferred_quality,
            device_type as device_types,
            country as countries,
            0 as bounce_count,
            CASE WHEN total_sessions > 1 THEN total_sessions - 1 ELSE 0 END as return_visits,
            MIN(100, MAX(0, total_sessions * 10 + COALESCE(total_watch_time / 60, 0))) as engagement_score
          FROM user_activity
          WHERE last_seen > ?
          ORDER BY last_seen DESC
          LIMIT ?
        `, [startTime, limit]);
      }
    }

    // Get aggregate stats - use user_activity as fallback
    let aggregateStats;
    if (db.isUsingNeon()) {
      // Try user_engagement first
      aggregateStats = await adapter.query(`
        SELECT 
          COUNT(*) as total_users,
          AVG(total_visits) as avg_visits_per_user,
          AVG(total_page_views) as avg_pages_per_user,
          AVG(total_time_on_site) as avg_time_per_user,
          AVG(engagement_score) as avg_engagement_score,
          SUM(CASE WHEN total_visits > 1 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as return_rate,
          SUM(bounce_count)::float / NULLIF(SUM(total_visits), 0) * 100 as overall_bounce_rate
        FROM user_engagement
        WHERE last_visit > $1
      `, [startTime]);
      
      // Fallback to user_activity
      if (!aggregateStats[0]?.total_users || parseInt(aggregateStats[0].total_users) === 0) {
        aggregateStats = await adapter.query(`
          SELECT 
            COUNT(*) as total_users,
            AVG(total_sessions) as avg_visits_per_user,
            AVG(total_sessions) as avg_pages_per_user,
            AVG(total_watch_time) as avg_time_per_user,
            50 as avg_engagement_score,
            SUM(CASE WHEN total_sessions > 1 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as return_rate,
            0 as overall_bounce_rate
          FROM user_activity
          WHERE last_seen > $1
        `, [startTime]);
      }
    } else {
      aggregateStats = await adapter.query(`
        SELECT 
          COUNT(*) as total_users,
          AVG(total_visits) as avg_visits_per_user,
          AVG(total_page_views) as avg_pages_per_user,
          AVG(total_time_on_site) as avg_time_per_user,
          AVG(engagement_score) as avg_engagement_score,
          CAST(SUM(CASE WHEN total_visits > 1 THEN 1 ELSE 0 END) AS FLOAT) / MAX(COUNT(*), 1) * 100 as return_rate,
          CAST(SUM(bounce_count) AS FLOAT) / MAX(SUM(total_visits), 1) * 100 as overall_bounce_rate
        FROM user_engagement
        WHERE last_visit > ?
      `, [startTime]);
      
      // Fallback to user_activity
      if (!aggregateStats[0]?.total_users || parseInt(aggregateStats[0].total_users) === 0) {
        aggregateStats = await adapter.query(`
          SELECT 
            COUNT(*) as total_users,
            AVG(total_sessions) as avg_visits_per_user,
            AVG(total_sessions) as avg_pages_per_user,
            AVG(total_watch_time) as avg_time_per_user,
            50 as avg_engagement_score,
            CAST(SUM(CASE WHEN total_sessions > 1 THEN 1 ELSE 0 END) AS FLOAT) / MAX(COUNT(*), 1) * 100 as return_rate,
            0 as overall_bounce_rate
          FROM user_activity
          WHERE last_seen > ?
        `, [startTime]);
      }
    }

    // Get engagement distribution
    let engagementDistribution;
    if (db.isUsingNeon()) {
      engagementDistribution = await adapter.query(`
        SELECT 
          CASE 
            WHEN engagement_score >= 80 THEN 'highly_engaged'
            WHEN engagement_score >= 50 THEN 'engaged'
            WHEN engagement_score >= 20 THEN 'casual'
            ELSE 'new'
          END as segment,
          COUNT(*) as count
        FROM user_engagement
        WHERE last_visit > $1
        GROUP BY segment
        ORDER BY count DESC
      `, [startTime]);
    } else {
      engagementDistribution = await adapter.query(`
        SELECT 
          CASE 
            WHEN engagement_score >= 80 THEN 'highly_engaged'
            WHEN engagement_score >= 50 THEN 'engaged'
            WHEN engagement_score >= 20 THEN 'casual'
            ELSE 'new'
          END as segment,
          COUNT(*) as count
        FROM user_engagement
        WHERE last_visit > ?
        GROUP BY segment
        ORDER BY count DESC
      `, [startTime]);
    }

    // Get visit frequency distribution
    let visitFrequency;
    if (db.isUsingNeon()) {
      visitFrequency = await adapter.query(`
        SELECT 
          CASE 
            WHEN total_visits >= 20 THEN '20+'
            WHEN total_visits >= 10 THEN '10-19'
            WHEN total_visits >= 5 THEN '5-9'
            WHEN total_visits >= 2 THEN '2-4'
            ELSE '1'
          END as visits_range,
          COUNT(*) as count
        FROM user_engagement
        WHERE last_visit > $1
        GROUP BY visits_range
        ORDER BY count DESC
      `, [startTime]);
    } else {
      visitFrequency = await adapter.query(`
        SELECT 
          CASE 
            WHEN total_visits >= 20 THEN '20+'
            WHEN total_visits >= 10 THEN '10-19'
            WHEN total_visits >= 5 THEN '5-9'
            WHEN total_visits >= 2 THEN '2-4'
            ELSE '1'
          END as visits_range,
          COUNT(*) as count
        FROM user_engagement
        WHERE last_visit > ?
        GROUP BY visits_range
        ORDER BY count DESC
      `, [startTime]);
    }

    return NextResponse.json({
      success: true,
      users,
      aggregateStats: aggregateStats[0] || {},
      engagementDistribution,
      visitFrequency,
      period: { days, startTime }
    });
  } catch (error) {
    console.error('Failed to get user engagement:', error);
    return NextResponse.json(
      { error: 'Failed to get user engagement' },
      { status: 500 }
    );
  }
}
