/**
 * Geographic Analytics API
 * GET /api/admin/analytics/geographic - Get detailed geographic data for heatmaps
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { getCountryName, isValidCountryCode } from '@/app/lib/utils/geolocation';

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
    const groupBy = searchParams.get('groupBy') || 'country'; // country, city, region

    // Calculate date range
    const now = new Date();
    let start: Date;

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

    const startTimestamp = start.getTime();
    const endTimestamp = now.getTime();

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    // Get geographic data by country
    const countryDataRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            COALESCE(country, 'Unknown') as country,
            COUNT(DISTINCT session_id) as sessions,
            COUNT(DISTINCT user_id) as unique_users,
            COALESCE(SUM(total_watch_time), 0) as total_watch_time
          FROM user_activity
          WHERE last_seen BETWEEN $1 AND $2
          AND country IS NOT NULL
          AND country != ''
          GROUP BY country
          ORDER BY sessions DESC
        `
        : `
          SELECT 
            COALESCE(country, 'Unknown') as country,
            COUNT(DISTINCT session_id) as sessions,
            COUNT(DISTINCT user_id) as unique_users,
            COALESCE(SUM(total_watch_time), 0) as total_watch_time
          FROM user_activity
          WHERE last_seen BETWEEN ? AND ?
          AND country IS NOT NULL
          AND country != ''
          GROUP BY country
          ORDER BY sessions DESC
        `,
      [startTimestamp, endTimestamp]
    );

    // Get city-level data if requested
    let cityData: any[] = [];
    if (groupBy === 'city') {
      const cityDataRaw = await adapter.query(
        isNeon
          ? `
            SELECT 
              COALESCE(country, 'Unknown') as country,
              COALESCE(city, 'Unknown') as city,
              COUNT(DISTINCT session_id) as sessions,
              COUNT(DISTINCT user_id) as unique_users
            FROM user_activity
            WHERE last_seen BETWEEN $1 AND $2
            AND city IS NOT NULL
            AND city != ''
            AND city != 'Unknown'
            GROUP BY country, city
            ORDER BY sessions DESC
            LIMIT 50
          `
          : `
            SELECT 
              COALESCE(country, 'Unknown') as country,
              COALESCE(city, 'Unknown') as city,
              COUNT(DISTINCT session_id) as sessions,
              COUNT(DISTINCT user_id) as unique_users
            FROM user_activity
            WHERE last_seen BETWEEN ? AND ?
            AND city IS NOT NULL
            AND city != ''
            AND city != 'Unknown'
            GROUP BY country, city
            ORDER BY sessions DESC
            LIMIT 50
          `,
        [startTimestamp, endTimestamp]
      );

      cityData = cityDataRaw.map((row: any) => ({
        country: row.country,
        countryName: getCountryName(row.country),
        city: row.city,
        sessions: parseInt(row.sessions) || 0,
        uniqueUsers: parseInt(row.unique_users) || 0,
      }));
    }

    // Get live activity geographic data (real-time)
    const liveGeoRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            COALESCE(country, 'Unknown') as country,
            COALESCE(city, 'Unknown') as city,
            COUNT(*) as active_users
          FROM live_activity
          WHERE is_active = TRUE
          AND last_heartbeat >= $1
          GROUP BY country, city
          ORDER BY active_users DESC
        `
        : `
          SELECT 
            COALESCE(country, 'Unknown') as country,
            COALESCE(city, 'Unknown') as city,
            COUNT(*) as active_users
          FROM live_activity
          WHERE is_active = 1
          AND last_heartbeat >= ?
          GROUP BY country, city
          ORDER BY active_users DESC
        `,
      [Date.now() - 5 * 60 * 1000] // Last 5 minutes
    );

    // Process country data - only include valid ISO country codes
    const countryData = countryDataRaw
      .filter((row: any) => {
        const code = row.country;
        // Only include valid 2-letter ISO country codes
        return code && code.length === 2 && isValidCountryCode(code);
      })
      .map((row: any) => ({
        country: row.country.toUpperCase(),
        countryName: getCountryName(row.country),
        sessions: parseInt(row.sessions) || 0,
        uniqueUsers: parseInt(row.unique_users) || 0,
        totalWatchTime: Math.round((parseInt(row.total_watch_time) || 0) / 60), // Convert to minutes
      }));

    // Process live geo data - only include valid ISO country codes
    const liveGeo = liveGeoRaw
      .filter((row: any) => {
        const code = row.country;
        return code && code.length === 2 && isValidCountryCode(code);
      })
      .map((row: any) => ({
        country: row.country.toUpperCase(),
        countryName: getCountryName(row.country),
        city: row.city,
        activeUsers: parseInt(row.active_users) || 0,
      }));

    // Calculate totals
    const totals = {
      totalSessions: countryData.reduce((sum: number, c: any) => sum + c.sessions, 0),
      totalUniqueUsers: countryData.reduce((sum: number, c: any) => sum + c.uniqueUsers, 0),
      totalWatchTime: countryData.reduce((sum: number, c: any) => sum + c.totalWatchTime, 0),
      totalCountries: countryData.length,
      currentlyActive: liveGeo.reduce((sum: number, l: any) => sum + l.activeUsers, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        countries: countryData,
        cities: cityData,
        liveActivity: liveGeo,
        totals,
        period: {
          start: start.toISOString(),
          end: now.toISOString(),
          days: Math.round((endTimestamp - startTimestamp) / (24 * 60 * 60 * 1000)),
        },
      },
    });
  } catch (error) {
    console.error('Geographic Analytics API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
