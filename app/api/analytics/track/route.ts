/**
 * Analytics Tracking API
 * POST /api/analytics/track - Track user events
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/connection';
import { getClientIP } from '@/lib/utils/api-rate-limiter';
// Generate a simple ID function
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

interface TrackingEvent {
  event_type: string;
  content_id?: string;
  content_type?: 'movie' | 'tv';
  watch_time?: number;
  duration?: number;
  quality?: string;
  country?: string;
  region?: string;
  user_agent?: string;
  referrer?: string;
  [key: string]: any;
}

// Get session ID from cookie or create new one
function getSessionId(request: NextRequest): string {
  const sessionCookie = request.cookies.get('session_id');
  if (sessionCookie?.value) {
    return sessionCookie.value;
  }
  return generateId();
}

// Get geolocation from IP (simplified - in production use a proper service)
function getLocationFromIP(_ip: string): { country?: string; region?: string } {
  // This is a placeholder - integrate with a real IP geolocation service
  // like MaxMind GeoIP2, ipapi.co, or similar
  return {
    country: 'Unknown',
    region: 'Unknown',
  };
}

export async function POST(request: NextRequest) {
  try {
    const events: TrackingEvent[] = await request.json();
    
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Invalid events data' },
        { status: 400 }
      );
    }

    const sessionId = getSessionId(request);
    const clientIP = getClientIP(request);
    const location = getLocationFromIP(clientIP);
    const userAgent = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';

    // Initialize database and insert events
    await initializeDB();
    const db = getDB();
    const insertStmt = db.query(`
      INSERT INTO analytics_events (id, session_id, timestamp, event_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertTransaction = db.transaction(() => {
      for (const event of events) {
        const metadata = {
          ...event,
          country: location.country,
          region: location.region,
          user_agent: userAgent,
          referrer: referrer,
          ip_hash: hashIP(clientIP), // Store hashed IP for privacy
        };

        insertStmt.run(
          generateId(),
          sessionId,
          Date.now(),
          event.event_type,
          JSON.stringify(metadata)
        );
      }
    });

    insertTransaction();

    // Update content statistics for watch events
    for (const event of events) {
      if (event.event_type === 'watch_progress' && event.content_id) {
        await updateContentStats(event);
      }
    }

    const response = NextResponse.json({ success: true });
    
    // Set session cookie if new
    if (!request.cookies.get('session_id')) {
      response.cookies.set('session_id', sessionId, {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track events' },
      { status: 500 }
    );
  }
}

// Hash IP address for privacy
function hashIP(ip: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'salt')).digest('hex').substring(0, 16);
}

// Update content statistics
async function updateContentStats(event: TrackingEvent) {
  try {
    if (!event.content_id) return;

    await initializeDB();
    const db = getDB();
    const upsertStmt = db.query(`
      INSERT INTO content_stats (content_id, content_type, view_count, total_watch_time, last_viewed, updated_at)
      VALUES (?, ?, 1, ?, ?, ?)
      ON CONFLICT(content_id) DO UPDATE SET
        view_count = view_count + 1,
        total_watch_time = total_watch_time + ?,
        last_viewed = ?,
        updated_at = ?
    `);

    const watchTime = event.watch_time || 0;
    const now = Date.now();

    upsertStmt.run(
      event.content_id,
      event.content_type || 'unknown',
      watchTime,
      now,
      now,
      watchTime,
      now,
      now
    );
  } catch (error) {
    console.error('Failed to update content stats:', error);
  }
}