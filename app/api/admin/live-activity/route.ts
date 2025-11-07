/**
 * Live Activity API - Real-time monitoring of user activity
 * GET /api/admin/live-activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

export const dynamic = 'force-dynamic';

interface LiveActivity {
  id: string;
  userId: string;
  contentId: string;
  contentTitle: string;
  contentType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  action: 'started' | 'watching' | 'paused' | 'completed';
  progress: number;
  location: {
    country?: string;
    city?: string;
    ip: string;
  };
  device: {
    userAgent: string;
    platform?: string;
    browser?: string;
  };
  timestamp: string;
  duration: number;
}

// In-memory store for recent activities (last 24 hours)
const recentActivities: LiveActivity[] = [];
const MAX_ACTIVITIES = 1000;

// Helper to get client location info
function getLocationInfo(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Cloudflare headers for location
  const country = request.headers.get('cf-ipcountry') || 'Unknown';
  const city = request.headers.get('cf-ipcity') || 'Unknown';
  
  const ip = cfConnectingIp || realIp || (forwarded ? forwarded.split(',')[0].trim() : 'unknown');
  
  return {
    country: country !== 'XX' ? country : 'Unknown',
    city: city !== 'Unknown' ? decodeURIComponent(city) : 'Unknown',
    ip: ip.substring(0, 8) + '***' // Anonymize IP for privacy
  };
}

// Helper to parse user agent
function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  
  let browser = 'Unknown';
  let platform = 'Unknown';
  
  // Detect browser
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // Detect platform
  if (ua.includes('windows')) platform = 'Windows';
  else if (ua.includes('mac')) platform = 'macOS';
  else if (ua.includes('linux')) platform = 'Linux';
  else if (ua.includes('android')) platform = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) platform = 'iOS';
  
  return { browser, platform };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type') || 'all'; // 'all', 'active', 'recent'
    
    let activities: LiveActivity[] = [];
    
    try {
      // Try to get recent activities from database (analytics events)
      await initializeDB();
      const dbConnection = getDB();
      const db = dbConnection.getAdapter();
      
      // Query for recent analytics events (last 24 hours)
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      let query: string;
      let params: any[];
      
      if (dbConnection.isUsingNeon()) {
        query = `
          SELECT id, session_id, timestamp, event_type, metadata
          FROM analytics_events 
          WHERE timestamp >= $1 
            AND (event_type = 'watch_start' OR event_type = 'watch_progress' OR event_type = 'watch_complete')
          ORDER BY timestamp DESC 
          LIMIT $2
        `;
        params = [twentyFourHoursAgo, limit];
      } else {
        query = `
          SELECT id, session_id, timestamp, event_type, metadata
          FROM analytics_events 
          WHERE timestamp >= ? 
            AND (event_type = 'watch_start' OR event_type = 'watch_progress' OR event_type = 'watch_complete')
          ORDER BY timestamp DESC 
          LIMIT ?
        `;
        params = [twentyFourHoursAgo, limit];
      }
      
      const result = await db.query(query, params);
      
      // Transform analytics events to live activity format
      activities = result.map((row: any) => {
        const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        const device = parseUserAgent(metadata.userAgent || '');
        
        let action: 'started' | 'watching' | 'paused' | 'completed' = 'watching';
        if (row.event_type === 'watch_start') action = 'started';
        else if (row.event_type === 'watch_complete') action = 'completed';
        else if (metadata.progress && metadata.progress < 5) action = 'started';
        else if (Date.now() - row.timestamp > 5 * 60 * 1000) action = 'paused';
        
        return {
          id: row.id,
          userId: row.session_id,
          contentId: metadata.contentId || 'unknown',
          contentTitle: metadata.title || metadata.contentTitle || 'Unknown Title',
          contentType: metadata.mediaType || metadata.contentType || 'movie',
          season: metadata.season,
          episode: metadata.episode,
          action,
          progress: Math.round(metadata.progress || 0),
          location: {
            country: metadata.country || 'Unknown',
            city: metadata.city || 'Unknown',
            ip: metadata.ip || 'unknown'
          },
          device: {
            userAgent: metadata.userAgent || 'Unknown',
            platform: device.platform,
            browser: device.browser
          },
          timestamp: new Date(row.timestamp).toISOString(),
          duration: metadata.duration || 0
        };
      });
    } catch (dbError) {
      console.warn('Database not available for live activity, using in-memory data:', dbError);
      // Fallback to in-memory activities if database is not available
      activities = recentActivities.slice(0, limit);
    }

    
    // Filter by type if specified
    let filteredActivities = activities;
    if (type === 'active') {
      // Only show activities from last 10 minutes
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      filteredActivities = activities.filter(activity => 
        new Date(activity.timestamp).getTime() > tenMinutesAgo &&
        activity.action === 'watching'
      );
    } else if (type === 'recent') {
      // Only show activities from last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      filteredActivities = activities.filter(activity => 
        new Date(activity.timestamp).getTime() > oneHourAgo
      );
    }
    
    // Get summary statistics
    const stats = {
      totalActivities: activities.length,
      activeNow: activities.filter(a => {
        const timeDiff = Date.now() - new Date(a.timestamp).getTime();
        return timeDiff < 10 * 60 * 1000 && a.action === 'watching';
      }).length,
      uniqueUsers: new Set(activities.map(a => a.userId)).size,
      topContent: activities.reduce((acc: Record<string, number>, activity) => {
        const key = activity.contentTitle;
        if (key) {
          acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
      }, {}),
      topCountries: activities.reduce((acc: Record<string, number>, activity) => {
        const country = activity.location.country;
        if (country && country !== 'Unknown') {
          acc[country] = (acc[country] || 0) + 1;
        }
        return acc;
      }, {}),
      deviceBreakdown: activities.reduce((acc: Record<string, number>, activity) => {
        const platform = activity.device.platform;
        if (platform && platform !== 'Unknown') {
          acc[platform] = (acc[platform] || 0) + 1;
        }
        return acc;
      }, {})
    };
    
    return NextResponse.json({
      success: true,
      data: {
        activities: filteredActivities,
        stats,
        timestamp: new Date().toISOString(),
        totalCount: filteredActivities.length
      }
    });
    
  } catch (error) {
    console.error('Live activity API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch live activity data'
    }, { status: 500 });
  }
}

// POST endpoint to add new activity (called by analytics tracking)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      contentId,
      contentTitle,
      contentType,
      season,
      episode,
      action,
      progress,
      duration
    } = body;
    
    // Create activity entry
    const activity: LiveActivity = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId || `anon_${Date.now()}`,
      contentId,
      contentTitle,
      contentType,
      season,
      episode,
      action,
      progress: progress || 0,
      location: getLocationInfo(request),
      device: {
        userAgent: request.headers.get('user-agent') || 'Unknown',
        ...parseUserAgent(request.headers.get('user-agent') || '')
      },
      timestamp: new Date().toISOString(),
      duration: duration || 0
    };
    
    // Add to in-memory store
    recentActivities.unshift(activity);
    
    // Keep only recent activities
    if (recentActivities.length > MAX_ACTIVITIES) {
      recentActivities.splice(MAX_ACTIVITIES);
    }
    
    return NextResponse.json({
      success: true,
      activityId: activity.id
    });
    
  } catch (error) {
    console.error('Live activity POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to record activity'
    }, { status: 500 });
  }
}