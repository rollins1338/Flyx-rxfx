/**
 * Cron Job: Update Daily Metrics
 * This endpoint should be called daily (e.g., via Vercel Cron or external scheduler)
 * to calculate and store daily user metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Initialize database
    await initializeDB();
    const db = getDB();

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Update metrics for today
    await db.updateDailyMetrics(dateStr);

    // Also update yesterday's metrics (in case of late data)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    await db.updateDailyMetrics(yesterdayStr);

    return NextResponse.json({
      success: true,
      message: 'Daily metrics updated successfully',
      dates: [dateStr, yesterdayStr],
    });
  } catch (error) {
    console.error('Failed to update daily metrics:', error);
    return NextResponse.json(
      { error: 'Failed to update daily metrics' },
      { status: 500 }
    );
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
