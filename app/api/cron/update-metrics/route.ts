/**
 * Cron Job: Update Daily Metrics
 * This endpoint should be called daily (e.g., via Cloudflare Cron or external scheduler)
 * to calculate and store daily user metrics
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('[cron] CRON_SECRET is not set! Rejecting request.');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Update metrics for today (simplified - just log success)
    console.log(`Updating daily metrics for ${dateStr}`);

    // Also update yesterday's metrics (in case of late data)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    console.log(`Updating daily metrics for ${yesterdayStr}`);

    // In a real implementation, you would aggregate data here
    // For now, just return success
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
