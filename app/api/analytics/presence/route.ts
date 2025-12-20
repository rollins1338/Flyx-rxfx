/**
 * Presence API - Real-time user presence tracking with validation
 * 
 * POST /api/analytics/presence - Update user presence heartbeat
 * GET /api/analytics/presence - Get current active users count
 * 
 * Features:
 * - Client-side bot detection validation (server-side is pointless - bots can just not call this)
 * - User interaction validation
 * - Tab visibility tracking
 * - Behavioral analysis validation
 * - Accurate "truly active" user counts
 * - Deduplication to prevent counting same user multiple times
 * - Referrer tracking for traffic source analysis
 * 
 * Note: All bot detection happens client-side. If a bot bypasses client detection,
 * they simply won't send heartbeats, which is fine - they won't be counted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { getLocationFromHeaders } from '@/app/lib/utils/geolocation';
import { checkHeartbeatDuplication, generateDeduplicationFingerprint } from '@/lib/utils/presence-deduplication';

// Validation thresholds
const VALIDATION_CONFIG = {
  // Minimum interactions required to be considered "validated"
  minInteractions: 1,
  // Maximum time since last interaction to be considered active (5 min)
  maxInactivityMs: 5 * 60 * 1000,
  // Heartbeat expiry time (2 min)
  heartbeatExpiryMs: 2 * 60 * 1000,
  // Strict validation expiry (30 sec) - for "truly active" count
  strictExpiryMs: 30 * 1000,
};

interface PresencePayload {
  userId: string;
  sessionId: string;
  activityType: 'browsing' | 'watching' | 'livetv';
  contentId?: string;
  contentTitle?: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  isActive: boolean;
  isVisible: boolean;
  isLeaving?: boolean;
  // Referrer tracking
  referrer?: string;
  entryPage?: string;
  validation?: {
    isBot: boolean;
    botConfidence?: number;
    botReasons?: string[];
    fingerprint?: string;
    hasInteracted: boolean;
    interactionCount: number;
    timeSinceLastInteraction?: number | null;
    // Behavioral analysis
    behaviorIsBot?: boolean;
    behaviorConfidence?: number;
    behaviorReasons?: string[];
    // Mouse entropy tracking
    mouseEntropy?: number;
    mouseSamples?: number;
    scrollSamples?: number;
    // Screen info for fingerprinting
    screenResolution?: string;
    timezone?: string;
    language?: string;
  };
  timestamp: number;
}

// POST - Update presence heartbeat
export async function POST(request: NextRequest) {
  try {
    const data: PresencePayload = await request.json();
    
    // Validate required fields
    if (!data.userId || !data.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const userAgent = request.headers.get('user-agent') || '';
    const serverReferrer = request.headers.get('referer') || data.referrer;
    
    // Generate server-side fingerprint for deduplication
    const serverFingerprint = generateDeduplicationFingerprint({
      userId: data.userId,
      userAgent,
      screenResolution: data.validation?.screenResolution,
      timezone: data.validation?.timezone,
      language: data.validation?.language,
    });
    
    // Check for duplicate heartbeats
    const dedupeResult = checkHeartbeatDuplication({
      userId: data.userId,
      sessionId: data.sessionId,
      fingerprint: data.validation?.fingerprint || serverFingerprint,
      activityType: data.activityType,
      contentId: data.contentId,
      timestamp: data.timestamp,
    });
    
    if (!dedupeResult.shouldTrack) {
      console.log('[Presence] Skipped duplicate/rate-limited:', {
        userId: data.userId.substring(0, 8),
        reason: dedupeResult.reason,
      });
      return NextResponse.json({
        success: true,
        tracked: false,
        reason: dedupeResult.reason,
      });
    }
    
    // Validate client-side bot detection results
    // Note: We trust the client's bot detection. If a bot bypasses it, they simply
    // won't send heartbeats (or will send fake ones), but that's fine - the behavioral
    // analysis and interaction tracking will catch most cases.
    const clientBotConfidence = data.validation?.botConfidence || 0;
    const behaviorBotConfidence = data.validation?.behaviorConfidence || 0;
    const combinedConfidence = Math.max(clientBotConfidence, behaviorBotConfidence);
    
    // Only reject if client-side detection is highly confident
    if (combinedConfidence >= 70) {
      console.log('[Presence] Bot detected by client:', {
        botConfidence: clientBotConfidence,
        behaviorConfidence: behaviorBotConfidence,
        reasons: [...(data.validation?.botReasons || []), ...(data.validation?.behaviorReasons || [])],
      });
      return NextResponse.json({ 
        success: true, 
        tracked: false, 
        reason: 'bot-detected',
        confidence: combinedConfidence,
      });
    }
    
    await initializeDB();
    const db = getDB();
    
    const now = Date.now();
    const activityId = `presence_${data.userId}_${data.sessionId}`;
    
    // Get location data
    const locationData = getLocationFromHeaders(request);
    
    // Determine device type
    const deviceType = userAgent.includes('Mobile') ? 'mobile' : 
                       userAgent.includes('Tablet') ? 'tablet' : 'desktop';
    
    // Calculate validation score
    const validationScore = calculateValidationScore(data);
    
    // Determine if user is "truly active" (validated human, visible tab, recent interaction)
    const isTrulyActive = 
      data.isActive && 
      data.isVisible && 
      !data.isLeaving &&
      validationScore >= 50 &&
      (data.validation?.hasInteracted || false);
    
    // Update live_activity table
    if (data.isLeaving) {
      // Deactivate the activity when user is leaving
      await db.deactivateLiveActivity(activityId);
    } else {
      // Upsert the activity (this sets is_active = true automatically)
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
        currentPosition: 0,
        duration: 0,
        quality: '',
        deviceType,
        country: locationData.countryCode,
        city: locationData.city,
        region: locationData.region,
      });
    }
    
    // Also update user_activity for long-term tracking
    await updateUserActivity(db, data, locationData, deviceType, now);
    
    console.log('[Presence] Updated:', {
      userId: data.userId.substring(0, 8),
      activityType: data.activityType,
      isTrulyActive,
      validationScore,
      mouseEntropy: data.validation?.mouseEntropy?.toFixed(3),
      mouseSamples: data.validation?.mouseSamples,
      isLeaving: data.isLeaving,
      isDuplicate: dedupeResult.isDuplicate,
      referrer: serverReferrer?.substring(0, 50),
    });
    
    return NextResponse.json({
      success: true,
      tracked: true,
      isTrulyActive,
      validationScore,
      deduplicated: dedupeResult.isDuplicate,
    });
    
  } catch (error) {
    console.error('[Presence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}

// GET - Get current active users
export async function GET(_request: NextRequest) {
  try {
    // Mode parameter available for future use: 'standard' or 'strict'
    // const { searchParams } = new URL(request.url);
    // const mode = searchParams.get('mode') || 'standard';
    
    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();
    
    const now = Date.now();
    
    // Standard mode: users with heartbeat in last 2 minutes
    const standardCutoff = now - VALIDATION_CONFIG.heartbeatExpiryMs;
    
    // Strict mode: users with heartbeat in last 30 seconds (truly active)
    const strictCutoff = now - VALIDATION_CONFIG.strictExpiryMs;
    
    // Get active user counts by activity type
    const query = isNeon
      ? `SELECT 
           activity_type,
           COUNT(DISTINCT user_id) as count,
           COUNT(DISTINCT CASE WHEN last_heartbeat >= $2 THEN user_id END) as strict_count
         FROM live_activity 
         WHERE is_active = TRUE AND last_heartbeat >= $1
         GROUP BY activity_type`
      : `SELECT 
           activity_type,
           COUNT(DISTINCT user_id) as count,
           COUNT(DISTINCT CASE WHEN last_heartbeat >= ? THEN user_id END) as strict_count
         FROM live_activity 
         WHERE is_active = 1 AND last_heartbeat >= ?
         GROUP BY activity_type`;
    
    const results = await adapter.query(query, 
      isNeon ? [standardCutoff, strictCutoff] : [strictCutoff, standardCutoff]
    );
    
    // Calculate totals
    let totalActive = 0;
    let totalStrict = 0;
    const breakdown: Record<string, { active: number; strict: number }> = {};
    
    for (const row of results) {
      const active = parseInt(row.count) || 0;
      const strict = parseInt(row.strict_count) || 0;
      totalActive += active;
      totalStrict += strict;
      breakdown[row.activity_type] = { active, strict };
    }
    
    // Get geographic distribution of active users
    const geoQuery = isNeon
      ? `SELECT country, COUNT(DISTINCT user_id) as count
         FROM live_activity 
         WHERE is_active = TRUE AND last_heartbeat >= $1 AND country IS NOT NULL
         GROUP BY country
         ORDER BY count DESC
         LIMIT 10`
      : `SELECT country, COUNT(DISTINCT user_id) as count
         FROM live_activity 
         WHERE is_active = 1 AND last_heartbeat >= ? AND country IS NOT NULL
         GROUP BY country
         ORDER BY count DESC
         LIMIT 10`;
    
    const geoResults = await adapter.query(geoQuery, [standardCutoff]);
    
    return NextResponse.json({
      success: true,
      timestamp: now,
      active: {
        total: totalActive,
        trulyActive: totalStrict, // Users with very recent heartbeat
        breakdown,
      },
      geographic: geoResults.map((r: any) => ({
        country: r.country,
        count: parseInt(r.count) || 0,
      })),
    });
    
  } catch (error) {
    console.error('[Presence] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get presence data' },
      { status: 500 }
    );
  }
}

// Calculate validation score (0-100) - higher = more likely human
function calculateValidationScore(data: PresencePayload): number {
  let score = 0;
  
  // Start with base score
  score += 20;
  
  // Not flagged as bot by client: +20 points
  const botConfidence = data.validation?.botConfidence || 0;
  if (botConfidence < 30) {
    score += 20;
  } else if (botConfidence < 50) {
    score += 10;
  }
  
  // Behavioral analysis passed: +15 points
  const behaviorConfidence = data.validation?.behaviorConfidence || 0;
  if (behaviorConfidence < 30) {
    score += 15;
  }
  
  // Has interacted: +10 points
  if (data.validation?.hasInteracted) {
    score += 10;
  }
  
  // Tab is visible: +5 points
  if (data.isVisible) {
    score += 5;
  }
  
  // Recent interaction (within 30 seconds): +5 points
  if (data.validation?.timeSinceLastInteraction !== null && 
      data.validation?.timeSinceLastInteraction !== undefined &&
      data.validation.timeSinceLastInteraction < 30000) {
    score += 5;
  }
  
  // Multiple interactions bonus: up to +5 points
  const interactionCount = data.validation?.interactionCount || 0;
  if (interactionCount > 10) {
    score += 5;
  } else if (interactionCount > 5) {
    score += 3;
  }
  
  // Has fingerprint (indicates real browser): +5 points
  if (data.validation?.fingerprint) {
    score += 5;
  }
  
  // MOUSE ENTROPY SCORING - Key human indicator
  const mouseEntropy = data.validation?.mouseEntropy || 0;
  const mouseSamples = data.validation?.mouseSamples || 0;
  
  // High entropy with enough samples = very likely human
  if (mouseSamples >= 50) {
    if (mouseEntropy >= 0.5) {
      score += 15; // Excellent entropy
    } else if (mouseEntropy >= 0.3) {
      score += 10; // Good entropy
    } else if (mouseEntropy >= 0.1) {
      score += 5; // Some entropy
    } else if (mouseEntropy < 0.05 && mouseSamples > 100) {
      score -= 10; // Very low entropy with many samples = suspicious
    }
  }
  
  // Scroll activity bonus
  const scrollSamples = data.validation?.scrollSamples || 0;
  if (scrollSamples >= 10) {
    score += 5;
  }
  
  // Penalty for suspicious behavior
  if (data.validation?.behaviorIsBot) {
    score -= 20;
  }
  
  return Math.max(0, Math.min(100, score));
}

// Update user_activity table with behavioral data
async function updateUserActivity(
  db: any, 
  data: PresencePayload, 
  locationData: any, 
  deviceType: string,
  now: number
) {
  const adapter = db.getAdapter();
  const isNeon = db.isUsingNeon();
  
  const activityId = `ua_${data.userId}`;
  
  // Extract behavioral metrics
  const mouseEntropy = data.validation?.mouseEntropy || 0;
  const mouseSamples = data.validation?.mouseSamples || 0;
  const scrollSamples = data.validation?.scrollSamples || 0;
  const validationScore = calculateValidationScore(data);
  
  // Check if user exists
  const existingQuery = isNeon
    ? 'SELECT id, first_seen, mouse_entropy_avg, total_mouse_samples, human_score FROM user_activity WHERE user_id = $1 LIMIT 1'
    : 'SELECT id, first_seen, mouse_entropy_avg, total_mouse_samples, human_score FROM user_activity WHERE user_id = ? LIMIT 1';
  
  const existing = await adapter.query(existingQuery, [data.userId]);
  
  if (existing.length > 0) {
    // Calculate rolling average of mouse entropy
    const prevEntropy = existing[0].mouse_entropy_avg || 0;
    const prevSamples = existing[0].total_mouse_samples || 0;
    const prevHumanScore = existing[0].human_score || 50;
    
    // Weighted average: new data gets 30% weight, historical gets 70%
    const newEntropyAvg = prevSamples > 0 
      ? (prevEntropy * 0.7 + mouseEntropy * 0.3)
      : mouseEntropy;
    
    // Rolling human score (slow to change)
    const newHumanScore = (prevHumanScore * 0.8 + validationScore * 0.2);
    
    // Update existing user with behavioral data
    const updateQuery = isNeon
      ? `UPDATE user_activity SET 
           last_seen = $1,
           device_type = COALESCE($2, device_type),
           country = COALESCE($3, country),
           city = COALESCE($4, city),
           region = COALESCE($5, region),
           mouse_entropy_avg = $6,
           total_mouse_samples = total_mouse_samples + $7,
           total_scroll_samples = total_scroll_samples + $8,
           human_score = $9,
           last_validation_score = $10,
           updated_at = $1
         WHERE user_id = $11`
      : `UPDATE user_activity SET 
           last_seen = ?,
           device_type = COALESCE(?, device_type),
           country = COALESCE(?, country),
           city = COALESCE(?, city),
           region = COALESCE(?, region),
           mouse_entropy_avg = ?,
           total_mouse_samples = total_mouse_samples + ?,
           total_scroll_samples = total_scroll_samples + ?,
           human_score = ?,
           last_validation_score = ?,
           updated_at = ?
         WHERE user_id = ?`;
    
    await adapter.query(updateQuery, 
      isNeon 
        ? [now, deviceType, locationData.countryCode, locationData.city, locationData.region, 
           newEntropyAvg, mouseSamples, scrollSamples, newHumanScore, validationScore, data.userId]
        : [now, deviceType, locationData.countryCode, locationData.city, locationData.region,
           newEntropyAvg, mouseSamples, scrollSamples, newHumanScore, validationScore, now, data.userId]
    );
  } else {
    // Insert new user with behavioral data
    const insertQuery = isNeon
      ? `INSERT INTO user_activity (id, user_id, session_id, first_seen, last_seen, device_type, country, city, region, 
           mouse_entropy_avg, total_mouse_samples, total_scroll_samples, human_score, last_validation_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $4, $4)`
      : `INSERT INTO user_activity (id, user_id, session_id, first_seen, last_seen, device_type, country, city, region,
           mouse_entropy_avg, total_mouse_samples, total_scroll_samples, human_score, last_validation_score, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    await adapter.query(insertQuery,
      isNeon
        ? [activityId, data.userId, data.sessionId, now, deviceType, locationData.countryCode, locationData.city, locationData.region,
           mouseEntropy, mouseSamples, scrollSamples, validationScore, validationScore]
        : [activityId, data.userId, data.sessionId, now, now, deviceType, locationData.countryCode, locationData.city, locationData.region,
           mouseEntropy, mouseSamples, scrollSamples, validationScore, validationScore, now, now]
    );
  }
}
