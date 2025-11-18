/**
 * User Metrics API
 * GET /api/analytics/user-metrics - Get DAU, WAU, MAU, and other user metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const includeDaily = searchParams.get('includeDaily') === 'true';

    // Initialize database
    await initializeDB();
    const db = getDB();

    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);

    // Get current metrics
    const metrics = await db.getUserMetrics({ start: startTime, end: now });

    // Get daily breakdown if requested
    let dailyMetrics = [];
    if (includeDaily) {
      dailyMetrics = await db.getDailyMetrics(days);
    }

    // Calculate growth rates
    const previousPeriodStart = startTime - (days * 24 * 60 * 60 * 1000);
    const previousMetrics = await db.getUserMetrics({ 
      start: previousPeriodStart, 
      end: startTime 
    });

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const growth = {
      dau: calculateGrowth(metrics.dau, previousMetrics.dau),
      wau: calculateGrowth(metrics.wau, previousMetrics.wau),
      mau: calculateGrowth(metrics.mau, previousMetrics.mau),
      newUsers: calculateGrowth(metrics.newUsers, previousMetrics.newUsers),
      sessions: calculateGrowth(metrics.totalSessions, previousMetrics.totalSessions),
    };

    // Calculate retention rate (returning users / total active users)
    const totalActiveUsers = metrics.newUsers + metrics.returningUsers;
    const retentionRate = totalActiveUsers > 0 
      ? Math.round((metrics.returningUsers / totalActiveUsers) * 100) 
      : 0;

    // Calculate engagement metrics
    const avgSessionsPerUser = totalActiveUsers > 0
      ? Math.round((metrics.totalSessions / totalActiveUsers) * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      metrics: {
        ...metrics,
        retentionRate,
        avgSessionsPerUser,
        totalActiveUsers,
      },
      growth,
      dailyMetrics,
      period: {
        days,
        start: startTime,
        end: now,
      },
    });
  } catch (error) {
    console.error('Failed to get user metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get user metrics' },
      { status: 500 }
    );
  }
}

// POST endpoint to manually update daily metrics
export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json();

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    // Initialize database
    await initializeDB();
    const db = getDB();

    // Update metrics for the specified date
    await db.updateDailyMetrics(date);

    return NextResponse.json({
      success: true,
      message: `Daily metrics updated for ${date}`,
    });
  } catch (error) {
    console.error('Failed to update daily metrics:', error);
    return NextResponse.json(
      { error: 'Failed to update daily metrics' },
      { status: 500 }
    );
  }
}
