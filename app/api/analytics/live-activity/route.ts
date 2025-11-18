/**
 * Live Activity API
 * POST /api/analytics/live-activity - Update live activity heartbeat
 * GET /api/analytics/live-activity - Get current live activities
 * DELETE /api/analytics/live-activity - Deactivate activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

// POST - Update/create live activity
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    console.log('[Live Activity] Received heartbeat:', {
      userId: data.userId?.substring(0, 8),
      sessionId: data.sessionId?.substring(0, 8),
      activityType: data.activityType,
      contentId: data.contentId,
    });

    if (!data.userId || !data.sessionId || !data.activityType) {
      console.error('[Live Activity] Missing required fields:', data);
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await initializeDB();
    const db = getDB();

    const activityId = `live_${data.userId}_${data.sessionId}`;

    // Extract device type from user agent
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = userAgent.includes('Mobile') ? 'mobile' : 
                      userAgent.includes('Tablet') ? 'tablet' : 'desktop';

    // Get location from headers (Vercel provides these)
    const country = request.headers.get('x-vercel-ip-country') || 
                   request.headers.get('cf-ipcountry') || 
                   data.country || 
                   'Unknown';
    
    const city = request.headers.get('x-vercel-ip-city') || '';
    const region = request.headers.get('x-vercel-ip-country-region') || '';
    
    // Format location string
    const location = city && region 
      ? `${city}, ${region}, ${country}`
      : region 
      ? `${region}, ${country}`
      : country;

    console.log('[Live Activity] Location:', location, 'Device:', deviceType);

    await db.upsertLiveActivity({
      id: activityId,
      userId: data.userId,
      sessionId: data.sessionId,
      activityType: data.activityType,
      contentId: data.contentId,
      contentTitle: data.contentTitle,
      contentType: data.contentType,
      seasonNumber: data.seasonNumber,
      episodeNumber: data.episodeNumber,
      currentPosition: data.currentPosition,
      duration: data.duration,
      quality: data.quality,
      deviceType,
      country: location,
    });

    console.log('[Live Activity] Activity saved:', activityId);

    return NextResponse.json({ success: true, activityId });
  } catch (error) {
    console.error('Failed to update live activity:', error);
    return NextResponse.json(
      { error: 'Failed to update live activity' },
      { status: 500 }
    );
  }
}

// GET - Retrieve live activities
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxAge = parseInt(searchParams.get('maxAge') || '5');

    console.log('[Live Activity] Fetching activities, maxAge:', maxAge);

    await initializeDB();
    const db = getDB();

    // Get live activities
    const activities = await db.getLiveActivities(maxAge);

    console.log('[Live Activity] Found', activities.length, 'active users');

    // Clean up stale activities
    const cleaned = await db.cleanupStaleActivities(maxAge * 2);
    if (cleaned > 0) {
      console.log('[Live Activity] Cleaned up', cleaned, 'stale activities');
    }

    // Calculate summary stats
    const stats = {
      totalActive: activities.length,
      watching: activities.filter(a => a.activity_type === 'watching').length,
      browsing: activities.filter(a => a.activity_type === 'browsing').length,
      byDevice: activities.reduce((acc: any, a) => {
        const device = a.device_type || 'unknown';
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {}),
      byCountry: activities.reduce((acc: any, a) => {
        const country = a.country || 'unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {}),
      topContent: activities
        .filter(a => a.content_id)
        .reduce((acc: any, a) => {
          const key = a.content_id;
          if (!acc[key]) {
            acc[key] = {
              contentId: a.content_id,
              contentTitle: a.content_title,
              contentType: a.content_type,
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {}),
    };

    // Convert topContent to array and sort
    const topContentArray = Object.values(stats.topContent)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      activities,
      stats: {
        ...stats,
        topContent: topContentArray,
      },
    });
  } catch (error) {
    console.error('Failed to get live activities:', error);
    return NextResponse.json(
      { error: 'Failed to get live activities' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate activity
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get('id');

    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }

    await initializeDB();
    const db = getDB();

    await db.deactivateLiveActivity(activityId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to deactivate activity:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate activity' },
      { status: 500 }
    );
  }
}
