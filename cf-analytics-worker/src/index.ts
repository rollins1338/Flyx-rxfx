/**
 * Flyx Analytics Worker - MEMORY-FIRST ARCHITECTURE
 * 
 * ARCHITECTURE:
 * - All tracking data stored in memory first (instant, no D1 cost)
 * - Periodic flush to D1 every 30 seconds (batched writes)
 * - GET requests served from memory (instant, no D1 reads for real-time)
 * - D1 only used for persistence and historical queries
 * 
 * This handles hundreds of concurrent users with minimal D1 usage:
 * - 500 users × 1 heartbeat/30s = 1000 heartbeats/min
 * - But only 1-2 D1 batch writes/min (flush every 30s)
 * 
 * D1 Usage Estimate:
 * - Writes: ~2 batches/min × 60 min × 24 hr = ~2,880 batch operations/day
 * - Reads: Only for historical stats, cached for 30s
 * 
 * Endpoints:
 *   POST /presence      - Heartbeat (memory only, instant)
 *   POST /page-view     - Track page views (memory + eventual D1)
 *   POST /watch-session - Track watch sessions (memory + eventual D1)
 *   POST /livetv-session - Track LiveTV sessions
 *   GET  /live-activity - Get current activity (from memory, instant)
 *   GET  /unified-stats - Get stats (memory + D1 for historical)
 *   GET  /health        - Health check
 *   POST /init-db       - Initialize database tables
 *   POST /flush         - Force flush to D1
 */

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

// =============================================================================
// IN-MEMORY STATE - Source of truth for real-time data
// =============================================================================

interface LiveUser {
  userId: string;
  sessionId: string;
  activityType: 'browsing' | 'watching' | 'livetv';
  contentId?: string;
  contentTitle?: string;
  contentType?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  country?: string;
  city?: string;
  lastHeartbeat: number;
  firstSeen: number;
}

interface PendingPageView {
  id: string;
  userId: string;
  sessionId?: string;
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
  entryTime: number;
  country?: string;
  deviceType?: string;
}

interface PendingWatchSession {
  id: string;
  userId: string;
  sessionId?: string;
  contentId: string;
  contentType: string;
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  startedAt: number;
  lastUpdate: number;
  watchTime: number;
  lastPosition: number;
  duration: number;
  completionPercentage: number;
  isCompleted: boolean;
}

interface BotDetection {
  userId: string;
  ipAddress: string;
  userAgent: string;
  confidenceScore: number;
  reasons: string[];
  fingerprint?: string;
  timestamp: number;
}

// Live users map - keyed by userId
const liveUsers = new Map<string, LiveUser>();

// Pending writes queue
const pendingPageViews: PendingPageView[] = [];
const pendingWatchSessions = new Map<string, PendingWatchSession>();
const pendingBotDetections = new Map<string, BotDetection>(); // Keyed by userId to avoid duplicates

// Timing
let lastFlushTime = 0;
const FLUSH_INTERVAL = 30000; // 30 seconds
const USER_TIMEOUT = 120000; // 2 minutes inactive = gone

// Stats cache for historical data
let historicalStatsCache: { data: any; timestamp: number } | null = null;
const HISTORICAL_CACHE_TTL = 30000; // 30 seconds

// Peak tracking
let currentDate = new Date().toISOString().split('T')[0];
let peakStats = { date: currentDate, total: 0, watching: 0, browsing: 0, livetv: 0, time: 0 };

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getGeo(request: Request): { country?: string; city?: string } {
  return {
    country: request.headers.get('CF-IPCountry') || undefined,
    city: (request as any).cf?.city || undefined,
  };
}

function cors(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Clean inactive users
function cleanupUsers(): void {
  const cutoff = Date.now() - USER_TIMEOUT;
  for (const [id, user] of liveUsers) {
    if (user.lastHeartbeat < cutoff) liveUsers.delete(id);
  }
}

// Reset peak stats if date changed
function checkDateReset(): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== currentDate) {
    currentDate = today;
    peakStats = { date: today, total: 0, watching: 0, browsing: 0, livetv: 0, time: 0 };
  }
}

// Get real-time stats from memory (NO D1!)
function getRealtimeStats() {
  cleanupUsers();
  checkDateReset();
  
  const users = Array.from(liveUsers.values());
  const stats = {
    total: users.length,
    watching: users.filter(u => u.activityType === 'watching').length,
    browsing: users.filter(u => u.activityType === 'browsing').length,
    livetv: users.filter(u => u.activityType === 'livetv').length,
  };
  
  // Update peak
  if (stats.total > peakStats.total) {
    peakStats = { date: currentDate, ...stats, time: Date.now() };
  }
  
  return { stats, users, peak: peakStats };
}


// =============================================================================
// D1 FLUSH - Batch write every 30 seconds
// =============================================================================

async function flushToD1(db: D1Database, force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFlushTime < FLUSH_INTERVAL) return;
  lastFlushTime = now;
  
  const batch: D1PreparedStatement[] = [];
  
  // 1. Upsert all live users to live_activity
  for (const user of liveUsers.values()) {
    batch.push(db.prepare(`
      INSERT INTO live_activity (id, user_id, session_id, activity_type, content_id, content_title, content_type, season_number, episode_number, country, city, started_at, last_heartbeat, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        activity_type = excluded.activity_type, content_id = excluded.content_id, content_title = excluded.content_title,
        last_heartbeat = excluded.last_heartbeat, is_active = 1, updated_at = excluded.updated_at
    `).bind(
      `la_${user.userId}`, user.userId, user.sessionId, user.activityType,
      user.contentId || null, user.contentTitle || null, user.contentType || null,
      user.seasonNumber || null, user.episodeNumber || null,
      user.country || null, user.city || null, user.firstSeen, user.lastHeartbeat, now, now
    ));
  }
  
  // 2. Insert page views
  for (const pv of pendingPageViews) {
    batch.push(db.prepare(`
      INSERT INTO page_views (id, user_id, session_id, page_path, page_title, referrer, entry_time, device_type, country, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(pv.id, pv.userId, pv.sessionId || null, pv.pagePath, pv.pageTitle || null, pv.referrer || null, pv.entryTime, pv.deviceType || null, pv.country || null, now));
  }
  pendingPageViews.length = 0;
  
  // 3. Upsert watch sessions
  for (const ws of pendingWatchSessions.values()) {
    batch.push(db.prepare(`
      INSERT INTO watch_sessions (id, session_id, user_id, content_id, content_type, content_title, season_number, episode_number, started_at, total_watch_time, last_position, duration, completion_percentage, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        total_watch_time = excluded.total_watch_time, last_position = excluded.last_position,
        completion_percentage = excluded.completion_percentage, is_completed = excluded.is_completed, updated_at = excluded.updated_at
    `).bind(
      ws.id, ws.sessionId || null, ws.userId, ws.contentId, ws.contentType, ws.contentTitle || null,
      ws.seasonNumber || null, ws.episodeNumber || null, ws.startedAt,
      Math.round(ws.watchTime), Math.round(ws.lastPosition), Math.round(ws.duration),
      Math.round(ws.completionPercentage), ws.isCompleted ? 1 : 0, now, now
    ));
  }
  pendingWatchSessions.clear();
  
  // 4. Update user_activity for all live users
  for (const user of liveUsers.values()) {
    batch.push(db.prepare(`
      INSERT INTO user_activity (id, user_id, session_id, first_seen, last_seen, country, city, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen, updated_at = excluded.updated_at
    `).bind(`ua_${user.userId}`, user.userId, user.sessionId, user.firstSeen, user.lastHeartbeat, user.country || null, user.city || null, now, now));
  }
  
  // 5. Update peak stats
  if (peakStats.total > 0) {
    batch.push(db.prepare(`
      INSERT INTO peak_stats (date, peak_total, peak_total_time, peak_watching, peak_watching_time, peak_livetv, peak_livetv_time, peak_browsing, peak_browsing_time, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        peak_total = MAX(peak_stats.peak_total, excluded.peak_total),
        peak_total_time = CASE WHEN excluded.peak_total > peak_stats.peak_total THEN excluded.peak_total_time ELSE peak_stats.peak_total_time END,
        peak_watching = MAX(peak_stats.peak_watching, excluded.peak_watching),
        peak_livetv = MAX(peak_stats.peak_livetv, excluded.peak_livetv),
        peak_browsing = MAX(peak_stats.peak_browsing, excluded.peak_browsing),
        updated_at = excluded.updated_at
    `).bind(peakStats.date, peakStats.total, peakStats.time, peakStats.watching, peakStats.time, peakStats.livetv, peakStats.time, peakStats.browsing, peakStats.time, now, now));
  }
  
  // 6. Insert bot detections (upsert to update if higher confidence)
  for (const detection of pendingBotDetections.values()) {
    // Determine status based on confidence score
    let status = 'confirmed_human';
    if (detection.confidenceScore >= 80) status = 'confirmed_bot';
    else if (detection.confidenceScore >= 50) status = 'suspected';
    else if (detection.confidenceScore >= 30) status = 'pending_review';
    
    batch.push(db.prepare(`
      INSERT INTO bot_detections (user_id, ip_address, user_agent, confidence_score, detection_reasons, fingerprint, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        confidence_score = CASE WHEN excluded.confidence_score > bot_detections.confidence_score THEN excluded.confidence_score ELSE bot_detections.confidence_score END,
        detection_reasons = CASE WHEN excluded.confidence_score > bot_detections.confidence_score THEN excluded.detection_reasons ELSE bot_detections.detection_reasons END,
        status = CASE WHEN excluded.confidence_score > bot_detections.confidence_score THEN excluded.status ELSE bot_detections.status END,
        updated_at = excluded.updated_at
    `).bind(
      detection.userId, detection.ipAddress, detection.userAgent,
      detection.confidenceScore, JSON.stringify(detection.reasons),
      detection.fingerprint || null, status, detection.timestamp, now
    ));
  }
  pendingBotDetections.clear();
  
  if (batch.length > 0) {
    try {
      await db.batch(batch);
      console.log(`[Flush] Wrote ${batch.length} statements to D1`);
    } catch (e) {
      console.error('[Flush] Error:', e);
    }
  }
}

// =============================================================================
// HANDLERS - POST handlers update memory, GET handlers read from memory
// =============================================================================

// POST /presence - Update user presence (MEMORY ONLY - instant)
async function handlePresence(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const data = await request.json() as any;
  if (!data.userId) return Response.json({ error: 'Missing userId' }, { status: 400, headers });
  
  const geo = getGeo(request);
  const now = Date.now();
  
  // Update or create user in memory
  const existing = liveUsers.get(data.userId);
  liveUsers.set(data.userId, {
    userId: data.userId,
    sessionId: data.sessionId || existing?.sessionId || generateId(),
    activityType: data.activityType || 'browsing',
    contentId: data.contentId,
    contentTitle: data.contentTitle,
    contentType: data.contentType,
    seasonNumber: data.seasonNumber,
    episodeNumber: data.episodeNumber,
    country: geo.country || existing?.country,
    city: geo.city || existing?.city,
    lastHeartbeat: now,
    firstSeen: existing?.firstSeen || now,
  });
  
  // If user is leaving, remove them
  if (data.isLeaving) {
    liveUsers.delete(data.userId);
  }
  
  // Store bot detection data if present and confidence is notable (>= 30%)
  // This captures both suspected bots AND suspicious activity for review
  if (data.validation && typeof data.validation.botConfidence === 'number' && data.validation.botConfidence >= 30) {
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    
    // Only update if this detection has higher confidence than existing
    const existingDetection = pendingBotDetections.get(data.userId);
    if (!existingDetection || data.validation.botConfidence > existingDetection.confidenceScore) {
      pendingBotDetections.set(data.userId, {
        userId: data.userId,
        ipAddress,
        userAgent,
        confidenceScore: data.validation.botConfidence,
        reasons: data.validation.botReasons || [],
        fingerprint: data.validation.fingerprint,
        timestamp: now,
      });
    }
  }
  
  // Trigger flush in background (non-blocking)
  flushToD1(env.DB).catch(() => {});
  
  return Response.json({ success: true, tracked: true }, { headers });
}

// POST /page-view - Track page view (queued for batch write)
async function handlePageView(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const data = await request.json() as any;
  if (!data.userId || !data.pagePath) return Response.json({ error: 'Missing fields' }, { status: 400, headers });
  
  const geo = getGeo(request);
  
  pendingPageViews.push({
    id: `pv_${generateId()}`,
    userId: data.userId,
    sessionId: data.sessionId,
    pagePath: data.pagePath,
    pageTitle: data.pageTitle,
    referrer: data.referrer,
    entryTime: data.entryTime || Date.now(),
    country: geo.country,
    deviceType: data.deviceType,
  });
  
  // Trigger flush in background
  flushToD1(env.DB).catch(() => {});
  
  return Response.json({ success: true }, { headers });
}

// POST /watch-session - Track watch session (memory + queued)
async function handleWatchSession(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const data = await request.json() as any;
  if (!data.userId || !data.contentId) return Response.json({ error: 'Missing fields' }, { status: 400, headers });
  
  const key = `${data.userId}_${data.contentId}_${data.seasonNumber || 0}_${data.episodeNumber || 0}`;
  const existing = pendingWatchSessions.get(key);
  const now = Date.now();
  
  pendingWatchSessions.set(key, {
    id: data.id || existing?.id || `ws_${generateId()}`,
    userId: data.userId,
    sessionId: data.sessionId,
    contentId: data.contentId,
    contentType: data.contentType || 'movie',
    contentTitle: data.contentTitle,
    seasonNumber: data.seasonNumber,
    episodeNumber: data.episodeNumber,
    startedAt: existing?.startedAt || data.startedAt || now,
    lastUpdate: now,
    watchTime: data.totalWatchTime || existing?.watchTime || 0,
    lastPosition: data.lastPosition || existing?.lastPosition || 0,
    duration: data.duration || existing?.duration || 0,
    completionPercentage: data.completionPercentage || existing?.completionPercentage || 0,
    isCompleted: data.isCompleted || existing?.isCompleted || false,
  });
  
  // Trigger flush in background
  flushToD1(env.DB).catch(() => {});
  
  return Response.json({ success: true }, { headers });
}

// POST /livetv-session - Track LiveTV
async function handleLiveTVSession(request: Request, env: Env, headers: HeadersInit): Promise<Response> {
  const data = await request.json() as any;
  if (!data.userId || !data.channelId) return Response.json({ error: 'Missing fields' }, { status: 400, headers });
  
  const key = `${data.userId}_livetv_${data.channelId}`;
  const existing = pendingWatchSessions.get(key);
  const now = Date.now();
  
  pendingWatchSessions.set(key, {
    id: `ltv_${generateId()}`,
    userId: data.userId,
    sessionId: data.sessionId,
    contentId: data.channelId,
    contentType: 'livetv',
    contentTitle: data.channelName,
    startedAt: existing?.startedAt || now,
    lastUpdate: now,
    watchTime: data.watchDuration || existing?.watchTime || 0,
    lastPosition: 0,
    duration: 0,
    completionPercentage: 0,
    isCompleted: false,
  });
  
  flushToD1(env.DB).catch(() => {});
  return Response.json({ success: true }, { headers });
}


// GET /live-activity - Get current live users (FROM MEMORY - instant, no D1!)
async function handleGetLiveActivity(headers: HeadersInit): Promise<Response> {
  const { stats, users } = getRealtimeStats();
  
  return Response.json({
    success: true,
    summary: stats,
    activities: users.map(u => ({
      user_id: u.userId,
      activity_type: u.activityType,
      content_id: u.contentId,
      content_title: u.contentTitle,
      content_type: u.contentType,
      country: u.country,
      city: u.city,
      last_heartbeat: u.lastHeartbeat,
    })),
    timestamp: Date.now(),
  }, { headers });
}

// GET /unified-stats - Get all stats (memory for realtime, D1 for historical)
async function handleGetUnifiedStats(env: Env, headers: HeadersInit): Promise<Response> {
  const now = Date.now();
  const { stats, peak, users } = getRealtimeStats();
  
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // Get historical data from cache or D1
  let historical = historicalStatsCache;
  if (!historical || now - historical.timestamp > HISTORICAL_CACHE_TTL) {
    try {
      const [userStats, contentStats, pageStats, geoStats, cityStats, deviceStats, topContentStats, botStats] = await Promise.all([
        // User activity stats
        env.DB.prepare(`
          SELECT COUNT(DISTINCT user_id) as total,
            COUNT(DISTINCT CASE WHEN last_seen >= ? THEN user_id END) as dau,
            COUNT(DISTINCT CASE WHEN last_seen >= ? THEN user_id END) as wau,
            COUNT(DISTINCT CASE WHEN last_seen >= ? THEN user_id END) as mau,
            COUNT(DISTINCT CASE WHEN first_seen >= ? THEN user_id END) as new_today,
            COUNT(DISTINCT CASE WHEN first_seen < ? AND last_seen >= ? THEN user_id END) as returning
          FROM user_activity
        `).bind(oneDayAgo, sevenDaysAgo, thirtyDaysAgo, oneDayAgo, oneDayAgo, oneDayAgo).first(),
        
        // Content/watch session stats
        env.DB.prepare(`
          SELECT 
            COUNT(*) as sessions, 
            COALESCE(SUM(total_watch_time), 0) as watch_time,
            COALESCE(AVG(total_watch_time), 0) as avg_duration,
            COALESCE(AVG(completion_percentage), 0) as avg_completion,
            SUM(CASE WHEN is_completed = 1 OR completion_percentage >= 90 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN content_type = 'movie' THEN 1 ELSE 0 END) as movie_sessions,
            SUM(CASE WHEN content_type = 'tv' THEN 1 ELSE 0 END) as tv_sessions,
            COUNT(DISTINCT content_id) as unique_content
          FROM watch_sessions WHERE started_at >= ?
        `).bind(oneDayAgo).first(),
        
        // Page view stats
        env.DB.prepare(`
          SELECT COUNT(*) as views, COUNT(DISTINCT user_id) as visitors
          FROM page_views WHERE entry_time >= ?
        `).bind(oneDayAgo).first(),
        
        // Geographic stats (countries)
        env.DB.prepare(`
          SELECT country, COUNT(DISTINCT user_id) as count
          FROM user_activity WHERE last_seen >= ? AND country IS NOT NULL AND country != ''
          GROUP BY country ORDER BY count DESC LIMIT 20
        `).bind(sevenDaysAgo).all(),
        
        // City stats
        env.DB.prepare(`
          SELECT city, country, COUNT(DISTINCT user_id) as count
          FROM user_activity WHERE last_seen >= ? AND city IS NOT NULL AND city != '' AND country IS NOT NULL
          GROUP BY city, country ORDER BY count DESC LIMIT 30
        `).bind(sevenDaysAgo).all(),
        
        // Device stats (from live_activity since user_activity may not have device_type)
        env.DB.prepare(`
          SELECT 
            CASE 
              WHEN content_type LIKE '%mobile%' THEN 'mobile'
              WHEN content_type LIKE '%tablet%' THEN 'tablet'
              ELSE 'desktop'
            END as device,
            COUNT(DISTINCT user_id) as count
          FROM user_activity WHERE last_seen >= ?
          GROUP BY device ORDER BY count DESC
        `).bind(sevenDaysAgo).all(),
        
        // Top content
        env.DB.prepare(`
          SELECT content_id, content_title, content_type, COUNT(*) as watch_count, SUM(total_watch_time) as total_watch_time
          FROM watch_sessions WHERE started_at >= ? AND content_title IS NOT NULL
          GROUP BY content_id, content_title, content_type
          ORDER BY watch_count DESC LIMIT 10
        `).bind(sevenDaysAgo).all(),
        
        // Bot detection stats
        env.DB.prepare(`
          SELECT 
            COUNT(*) as total_detections,
            COUNT(CASE WHEN status = 'suspected' THEN 1 END) as suspected,
            COUNT(CASE WHEN status = 'confirmed_bot' THEN 1 END) as confirmed,
            COUNT(CASE WHEN status = 'pending_review' THEN 1 END) as pending,
            AVG(confidence_score) as avg_confidence
          FROM bot_detections WHERE created_at >= ?
        `).bind(sevenDaysAgo).first(),
      ]);
      
      historical = {
        timestamp: now,
        data: { 
          userStats, 
          contentStats, 
          pageStats, 
          geoStats: geoStats.results || [],
          cityStats: cityStats.results || [],
          deviceStats: deviceStats.results || [],
          topContentStats: topContentStats.results || [],
          botStats,
        }
      };
      historicalStatsCache = historical;
    } catch (e) {
      console.error('[Stats] D1 error:', e);
      historical = { 
        timestamp: now, 
        data: { 
          userStats: {}, 
          contentStats: {}, 
          pageStats: {}, 
          geoStats: [],
          cityStats: [],
          deviceStats: [],
          topContentStats: [],
          botStats: {},
        } 
      };
    }
  }
  
  const h = historical.data;
  
  // Build realtime geographic from live users
  const realtimeGeoMap = new Map<string, number>();
  for (const user of users) {
    if (user.country) {
      realtimeGeoMap.set(user.country, (realtimeGeoMap.get(user.country) || 0) + 1);
    }
  }
  const realtimeGeographic = Array.from(realtimeGeoMap.entries())
    .map(([country, count]) => ({ country, countryName: country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  
  return Response.json({
    success: true,
    // Real-time data from memory
    realtime: { 
      totalActive: stats.total, 
      trulyActive: stats.total, // Same as totalActive for now
      watching: stats.watching, 
      browsing: stats.browsing, 
      livetv: stats.livetv 
    },
    realtimeGeographic,
    // Peak stats
    peakStats: { 
      date: peak.date, 
      peakTotal: peak.total, 
      peakWatching: peak.watching, 
      peakLiveTV: peak.livetv, 
      peakBrowsing: peak.browsing,
      peakTotalTime: peak.time,
      peakWatchingTime: peak.time,
      peakLiveTVTime: peak.time,
      peakBrowsingTime: peak.time,
    },
    // User metrics
    users: { 
      total: h.userStats?.total || 0, 
      dau: h.userStats?.dau || 0, 
      wau: h.userStats?.wau || 0, 
      mau: h.userStats?.mau || 0,
      newToday: h.userStats?.new_today || 0,
      returning: h.userStats?.returning || 0,
    },
    // Content metrics
    content: { 
      totalSessions: parseInt(h.contentStats?.sessions) || 0, 
      totalWatchTime: Math.round((parseFloat(h.contentStats?.watch_time) || 0) / 60),
      avgDuration: Math.round((parseFloat(h.contentStats?.avg_duration) || 0) / 60),
      completionRate: Math.round(parseFloat(h.contentStats?.avg_completion) || 0),
      completedSessions: parseInt(h.contentStats?.completed) || 0,
      movieSessions: parseInt(h.contentStats?.movie_sessions) || 0,
      tvSessions: parseInt(h.contentStats?.tv_sessions) || 0,
      uniqueContentWatched: parseInt(h.contentStats?.unique_content) || 0,
      allTimeWatchTime: Math.round((parseFloat(h.contentStats?.watch_time) || 0) / 60),
      totalPauses: 0,
      totalSeeks: 0,
    },
    // Top content
    topContent: (h.topContentStats || []).map((c: any) => ({
      contentId: c.content_id,
      contentTitle: c.content_title || 'Unknown',
      contentType: c.content_type || 'unknown',
      watchCount: parseInt(c.watch_count) || 0,
      totalWatchTime: Math.round((parseFloat(c.total_watch_time) || 0) / 60),
    })),
    // Page views
    pageViews: { 
      total: parseInt(h.pageStats?.views) || 0, 
      uniqueVisitors: parseInt(h.pageStats?.visitors) || 0 
    },
    // Geographic data
    geographic: (h.geoStats || []).map((g: any) => ({ 
      country: g.country, 
      countryName: g.country, // Could add country name lookup
      count: parseInt(g.count) || 0 
    })),
    // Cities
    cities: (h.cityStats || []).map((c: any) => ({
      city: c.city,
      country: c.country,
      countryName: c.country,
      count: parseInt(c.count) || 0,
    })),
    // Devices
    devices: (h.deviceStats || []).length > 0 
      ? (h.deviceStats || []).map((d: any) => ({
          device: d.device || 'desktop',
          count: parseInt(d.count) || 0,
        }))
      : [{ device: 'desktop', count: stats.total }], // Fallback
    // Bot detection
    botDetection: {
      totalDetections: parseInt(h.botStats?.total_detections) || 0,
      suspectedBots: parseInt(h.botStats?.suspected) || 0,
      confirmedBots: parseInt(h.botStats?.confirmed) || 0,
      pendingReview: parseInt(h.botStats?.pending) || 0,
      avgConfidenceScore: Math.round(parseFloat(h.botStats?.avg_confidence) || 0),
      recentDetections: [],
    },
    // Time ranges for transparency
    timeRanges: {
      realtime: '2 minutes',
      realtimeGeographic: '2 minutes',
      dau: '24 hours',
      wau: '7 days',
      mau: '30 days',
      content: '24 hours',
      geographic: '7 days',
      cities: '7 days',
      devices: '7 days',
      pageViews: '24 hours',
      botDetection: '7 days',
    },
    selectedTimeRange: '24h',
    timestamp: now,
  }, { headers });
}

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

async function handleInitDb(env: Env, headers: HeadersInit): Promise<Response> {
  try {
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_activity (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          session_id TEXT,
          activity_type TEXT DEFAULT 'browsing',
          content_id TEXT,
          content_title TEXT,
          content_type TEXT,
          season_number INTEGER,
          episode_number INTEGER,
          country TEXT,
          city TEXT,
          started_at INTEGER,
          last_heartbeat INTEGER,
          is_active INTEGER DEFAULT 1,
          created_at INTEGER,
          updated_at INTEGER
        )
      `),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_live_activity_user ON live_activity(user_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_live_activity_active ON live_activity(is_active, last_heartbeat)`),
      
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS page_views (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          session_id TEXT,
          page_path TEXT NOT NULL,
          page_title TEXT,
          referrer TEXT,
          entry_time INTEGER,
          device_type TEXT,
          country TEXT,
          created_at INTEGER
        )
      `),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_page_views_time ON page_views(entry_time)`),
      
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS watch_sessions (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          user_id TEXT NOT NULL,
          content_id TEXT NOT NULL,
          content_type TEXT,
          content_title TEXT,
          season_number INTEGER,
          episode_number INTEGER,
          started_at INTEGER,
          total_watch_time INTEGER DEFAULT 0,
          last_position INTEGER DEFAULT 0,
          duration INTEGER DEFAULT 0,
          completion_percentage INTEGER DEFAULT 0,
          is_completed INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER
        )
      `),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_watch_sessions_content ON watch_sessions(content_id)`),
      
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS user_activity (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          session_id TEXT,
          first_seen INTEGER,
          last_seen INTEGER,
          country TEXT,
          city TEXT,
          created_at INTEGER,
          updated_at INTEGER
        )
      `),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_activity_seen ON user_activity(last_seen)`),
      
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS peak_stats (
          date TEXT PRIMARY KEY,
          peak_total INTEGER DEFAULT 0,
          peak_total_time INTEGER,
          peak_watching INTEGER DEFAULT 0,
          peak_watching_time INTEGER,
          peak_livetv INTEGER DEFAULT 0,
          peak_livetv_time INTEGER,
          peak_browsing INTEGER DEFAULT 0,
          peak_browsing_time INTEGER,
          created_at INTEGER,
          updated_at INTEGER
        )
      `),
      
      // Bot detection table
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS bot_detections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE,
          ip_address TEXT NOT NULL,
          user_agent TEXT,
          confidence_score INTEGER NOT NULL,
          detection_reasons TEXT,
          fingerprint TEXT,
          status TEXT DEFAULT 'suspected',
          reviewed_by TEXT,
          reviewed_at INTEGER,
          created_at INTEGER,
          updated_at INTEGER
        )
      `),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_detections_user ON bot_detections(user_id)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_detections_confidence ON bot_detections(confidence_score)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_detections_status ON bot_detections(status)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_detections_created ON bot_detections(created_at)`),
    ]);
    
    return Response.json({ success: true, message: 'Database initialized' }, { headers });
  } catch (error) {
    console.error('[InitDB] Error:', error);
    return Response.json({ success: false, error: String(error) }, { status: 500, headers });
  }
}

// =============================================================================
// MAIN HANDLER - Route requests to appropriate handlers
// =============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const headers = cors(request);
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    
    // Health check
    if (path === '/health' || path === '/') {
      const { stats } = getRealtimeStats();
      return Response.json({
        status: 'ok',
        architecture: 'memory-first',
        liveUsers: stats.total,
        pendingPageViews: pendingPageViews.length,
        pendingWatchSessions: pendingWatchSessions.size,
        pendingBotDetections: pendingBotDetections.size,
        lastFlush: lastFlushTime,
        timestamp: Date.now(),
      }, { headers });
    }
    
    // Force flush (admin endpoint)
    if (path === '/flush' && method === 'POST') {
      await flushToD1(env.DB, true);
      return Response.json({ success: true, flushed: true }, { headers });
    }
    
    // Initialize database tables
    if (path === '/init-db' && method === 'POST') {
      return handleInitDb(env, headers);
    }
    
    // Route handlers
    try {
      // POST endpoints - write to memory (instant)
      if (method === 'POST') {
        switch (path) {
          case '/presence':
          case '/api/presence':
            return handlePresence(request, env, headers);
          case '/page-view':
          case '/api/page-view':
            return handlePageView(request, env, headers);
          case '/watch-session':
          case '/api/watch-session':
            return handleWatchSession(request, env, headers);
          case '/livetv-session':
          case '/api/livetv-session':
            return handleLiveTVSession(request, env, headers);
        }
      }
      
      // GET endpoints - read from memory (instant for realtime)
      if (method === 'GET') {
        switch (path) {
          case '/live-activity':
          case '/api/live-activity':
            return handleGetLiveActivity(headers);
          case '/unified-stats':
          case '/api/unified-stats':
            return handleGetUnifiedStats(env, headers);
          case '/debug':
            return Response.json({
              liveUsers: Array.from(liveUsers.entries()),
              pendingPageViews: pendingPageViews.length,
              pendingWatchSessions: Array.from(pendingWatchSessions.keys()),
              pendingBotDetections: Array.from(pendingBotDetections.entries()).map(([k, v]) => ({
                userId: k,
                confidence: v.confidenceScore,
                reasons: v.reasons,
              })),
              lastFlush: lastFlushTime,
              peak: peakStats,
            }, { headers });
        }
      }
      
      return Response.json({ error: 'Not found', path }, { status: 404, headers });
    } catch (error) {
      console.error('[Worker] Error:', error);
      return Response.json({ error: 'Internal error' }, { status: 500, headers });
    }
  },
};
