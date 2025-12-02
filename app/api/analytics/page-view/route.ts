/**
 * Page View Tracking API
 * POST /api/analytics/page-view - Track detailed page view metrics
 * GET /api/analytics/page-view - Get page view analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { getLocationFromHeaders } from '@/app/lib/utils/geolocation';

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

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
    
    if (!data.userId || !data.sessionId || !data.pagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, sessionId, pagePath' },
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
    
    const pageViewId = data.id || generateId();

    // Normalize values with explicit types
    const entryTime = parseInt(String(data.entryTime || now));
    const exitTime = data.exitTime ? parseInt(String(data.exitTime)) : null;
    const timeOnPageVal = parseInt(String(data.timeOnPage || 0));
    const scrollDepthVal = parseInt(String(data.scrollDepth || 0));
    const interactionsVal = parseInt(String(data.interactions || 0));
    const isBounceVal = data.isBounce === true;

    if (db.isUsingNeon()) {
      // PostgreSQL - upsert page view
      await adapter.execute(`
        INSERT INTO page_views (
          id, user_id, session_id, page_path, page_title, referrer,
          entry_time, exit_time, time_on_page, scroll_depth, interactions,
          device_type, country, is_bounce, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::BIGINT, $8::BIGINT, $9::INTEGER, $10::INTEGER, $11::INTEGER, $12, $13, $14::BOOLEAN, $15::BIGINT)
        ON CONFLICT (id) DO UPDATE SET
          exit_time = COALESCE($8::BIGINT, page_views.exit_time),
          time_on_page = $9::INTEGER,
          scroll_depth = GREATEST(page_views.scroll_depth, $10::INTEGER),
          interactions = $11::INTEGER,
          is_bounce = $14::BOOLEAN
      `, [
        pageViewId,
        data.userId,
        data.sessionId,
        data.pagePath,
        data.pageTitle || '',
        data.referrer || '',
        entryTime,
        exitTime,
        timeOnPageVal,
        scrollDepthVal,
        interactionsVal,
        deviceType,
        location.countryCode,
        isBounceVal,
        now
      ]);

      // Update page metrics aggregate
      const timeOnPage = parseInt(String(data.timeOnPage || 0));
      const scrollDepth = parseFloat(String(data.scrollDepth || 0));
      const bounceValue = data.isBounce ? 100.0 : 0.0;
      const entryCount = data.isFirstPage ? 1 : 0;
      const exitCount = data.isExit ? 1 : 0;
      
      await adapter.execute(`
        INSERT INTO page_metrics (
          page_path, total_views, unique_visitors, total_time_on_page,
          avg_time_on_page, bounce_rate, avg_scroll_depth,
          entry_count, exit_count, updated_at
        ) VALUES ($1, 1, 1, $2::INTEGER, $2::REAL, $3::REAL, $4::REAL, $5::INTEGER, $6::INTEGER, $7::BIGINT)
        ON CONFLICT (page_path) DO UPDATE SET
          total_views = page_metrics.total_views + 1,
          total_time_on_page = page_metrics.total_time_on_page + $2::INTEGER,
          avg_time_on_page = (page_metrics.total_time_on_page + $2::INTEGER)::REAL / (page_metrics.total_views + 1),
          bounce_rate = CASE 
            WHEN $3::REAL > 0 THEN (page_metrics.bounce_rate * page_metrics.total_views + 100.0) / (page_metrics.total_views + 1)
            ELSE (page_metrics.bounce_rate * page_metrics.total_views) / (page_metrics.total_views + 1)
          END,
          avg_scroll_depth = (page_metrics.avg_scroll_depth * page_metrics.total_views + $4::REAL) / (page_metrics.total_views + 1),
          entry_count = page_metrics.entry_count + $5::INTEGER,
          exit_count = page_metrics.exit_count + $6::INTEGER,
          updated_at = $7::BIGINT
      `, [
        data.pagePath,
        timeOnPage,
        bounceValue,
        scrollDepth,
        entryCount,
        exitCount,
        now
      ]);
    } else {
      // SQLite
      await adapter.execute(`
        INSERT INTO page_views (
          id, user_id, session_id, page_path, page_title, referrer,
          entry_time, exit_time, time_on_page, scroll_depth, interactions,
          device_type, country, is_bounce, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          exit_time = COALESCE(?, exit_time),
          time_on_page = ?,
          scroll_depth = MAX(scroll_depth, ?),
          interactions = ?,
          is_bounce = ?
      `, [
        pageViewId,
        data.userId,
        data.sessionId,
        data.pagePath,
        data.pageTitle || '',
        data.referrer || '',
        data.entryTime,
        data.exitTime || null,
        data.timeOnPage || 0,
        data.scrollDepth || 0,
        data.interactions || 0,
        deviceType,
        location.countryCode,
        data.isBounce ? 1 : 0,
        now,
        // For ON CONFLICT UPDATE
        data.exitTime || null,
        data.timeOnPage || 0,
        data.scrollDepth || 0,
        data.interactions || 0,
        data.isBounce ? 1 : 0
      ]);

      // Update page metrics aggregate
      await adapter.execute(`
        INSERT INTO page_metrics (
          page_path, total_views, unique_visitors, total_time_on_page,
          avg_time_on_page, bounce_rate, avg_scroll_depth,
          entry_count, exit_count, updated_at
        ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (page_path) DO UPDATE SET
          total_views = total_views + 1,
          total_time_on_page = total_time_on_page + ?,
          avg_time_on_page = (total_time_on_page + ?) / (total_views + 1),
          bounce_rate = CASE 
            WHEN ? THEN (bounce_rate * total_views + 100) / (total_views + 1)
            ELSE (bounce_rate * total_views) / (total_views + 1)
          END,
          avg_scroll_depth = (avg_scroll_depth * total_views + ?) / (total_views + 1),
          entry_count = entry_count + ?,
          exit_count = exit_count + ?,
          updated_at = ?
      `, [
        data.pagePath,
        data.timeOnPage || 0,
        data.timeOnPage || 0,
        data.isBounce ? 100 : 0,
        data.scrollDepth || 0,
        data.isFirstPage ? 1 : 0,
        data.isExit ? 1 : 0,
        now,
        // For ON CONFLICT UPDATE
        data.timeOnPage || 0,
        data.timeOnPage || 0,
        data.isBounce ? 1 : 0,
        data.scrollDepth || 0,
        data.isFirstPage ? 1 : 0,
        data.isExit ? 1 : 0,
        now
      ]);
    }

    return NextResponse.json({ success: true, id: pageViewId });
  } catch (error) {
    console.error('Failed to track page view:', error);
    return NextResponse.json(
      { error: 'Failed to track page view' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '50');

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();

    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get page metrics
    let pageMetrics;
    if (db.isUsingNeon()) {
      pageMetrics = await adapter.query(`
        SELECT 
          page_path,
          total_views,
          unique_visitors,
          ROUND(avg_time_on_page::numeric, 1) as avg_time_on_page,
          ROUND(bounce_rate::numeric, 1) as bounce_rate,
          ROUND(avg_scroll_depth::numeric, 1) as avg_scroll_depth,
          entry_count,
          exit_count
        FROM page_metrics
        ORDER BY total_views DESC
        LIMIT $1
      `, [limit]);
    } else {
      pageMetrics = await adapter.query(`
        SELECT 
          page_path,
          total_views,
          unique_visitors,
          ROUND(avg_time_on_page, 1) as avg_time_on_page,
          ROUND(bounce_rate, 1) as bounce_rate,
          ROUND(avg_scroll_depth, 1) as avg_scroll_depth,
          entry_count,
          exit_count
        FROM page_metrics
        ORDER BY total_views DESC
        LIMIT ?
      `, [limit]);
    }

    // Get recent page views with time on page
    let recentViews;
    if (db.isUsingNeon()) {
      recentViews = await adapter.query(`
        SELECT 
          page_path,
          COUNT(*) as views,
          AVG(time_on_page) as avg_time,
          AVG(scroll_depth) as avg_scroll,
          SUM(interactions) as total_interactions
        FROM page_views
        WHERE entry_time > $1
        GROUP BY page_path
        ORDER BY views DESC
        LIMIT $2
      `, [startTime, limit]);
    } else {
      recentViews = await adapter.query(`
        SELECT 
          page_path,
          COUNT(*) as views,
          AVG(time_on_page) as avg_time,
          AVG(scroll_depth) as avg_scroll,
          SUM(interactions) as total_interactions
        FROM page_views
        WHERE entry_time > ?
        GROUP BY page_path
        ORDER BY views DESC
        LIMIT ?
      `, [startTime, limit]);
    }

    // Get overall stats
    let overallStats;
    if (db.isUsingNeon()) {
      overallStats = await adapter.query(`
        SELECT 
          COUNT(*) as total_page_views,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as total_sessions,
          AVG(time_on_page) as avg_time_on_page,
          AVG(scroll_depth) as avg_scroll_depth,
          SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as bounce_rate
        FROM page_views
        WHERE entry_time > $1
      `, [startTime]);
    } else {
      overallStats = await adapter.query(`
        SELECT 
          COUNT(*) as total_page_views,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as total_sessions,
          AVG(time_on_page) as avg_time_on_page,
          AVG(scroll_depth) as avg_scroll_depth,
          CAST(SUM(CASE WHEN is_bounce THEN 1 ELSE 0 END) AS FLOAT) / MAX(COUNT(*), 1) * 100 as bounce_rate
        FROM page_views
        WHERE entry_time > ?
      `, [startTime]);
    }

    return NextResponse.json({
      success: true,
      pageMetrics,
      recentViews,
      overallStats: overallStats[0] || {},
      period: { days, startTime }
    });
  } catch (error) {
    console.error('Failed to get page view analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get page view analytics' },
      { status: 500 }
    );
  }
}
