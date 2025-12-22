/**
 * Flyx Analytics Worker
 * 
 * Cloudflare Worker for analytics tracking.
 * Handles: presence/heartbeat, page views, watch sessions, live activity
 * 
 * Endpoints:
 *   POST /presence      - Heartbeat for presence tracking
 *   POST /page-view     - Track page views
 *   POST /watch-session - Track watch sessions
 *   GET  /live-activity - Get current live activity (admin)
 *   GET  /stats         - Get analytics stats (admin)
 *   GET  /health        - Health check
 */

export interface Env {
  DATABASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  LOG_LEVEL?: string;
  HEARTBEAT_INTERVAL?: string;
  // KV for rate limiting
  ANALYTICS_KV?: KVNamespace;
}

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
  referrer?: string;
  entryPage?: string;
  validation?: {
    isBot?: boolean;
    botConfidence?: number;
    hasInteracted?: boolean;
    mouseEntropy?: number;
    screenResolution?: string;
    timezone?: string;
    language?: string;
  };
  timestamp: number;
}

interface PageViewPayload {
  userId: string;
  sessionId: string;
  pagePath: string;
  pageTitle?: string;
  referrer?: string;
  entryTime: number;
  exitTime?: number;
  timeOnPage?: number;
  scrollDepth?: number;
  interactions?: number;
  deviceType?: string;
  country?: string;
}

interface WatchSessionPayload {
  userId: string;
  sessionId: string;
  contentId: string;
  contentType: 'movie' | 'tv';
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  action: 'start' | 'progress' | 'pause' | 'complete';
  currentTime: number;
  duration: number;
  quality?: string;
}

// CORS headers
function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];
  
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// Get geolocation from Cloudflare headers
function getGeoInfo(request: Request): { country?: string; city?: string; region?: string } {
  return {
    country: request.headers.get('CF-IPCountry') || undefined,
    city: (request as any).cf?.city || undefined,
    region: (request as any).cf?.region || undefined,
  };
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ 
        status: 'ok', 
        service: 'flyx-analytics',
        timestamp: Date.now(),
        hasDatabase: !!env.DATABASE_URL,
      }, { headers: corsHeaders });
    }

    try {
      switch (url.pathname) {
        case '/presence':
          if (request.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handlePresence(request, env, corsHeaders);

        case '/page-view':
          if (request.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handlePageView(request, env, corsHeaders);

        case '/watch-session':
          if (request.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleWatchSession(request, env, corsHeaders);

        case '/live-activity':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetLiveActivity(env, corsHeaders);

        case '/stats':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetStats(url, env, corsHeaders);

        default:
          return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('[Analytics Worker] Error:', error);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

// POST /presence - Heartbeat for presence tracking
async function handlePresence(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as PresencePayload;
  const geo = getGeoInfo(request);
  
  // Validate required fields
  if (!payload.userId || !payload.sessionId) {
    return Response.json(
      { error: 'Missing userId or sessionId' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Skip obvious bots
  if (payload.validation?.isBot && (payload.validation.botConfidence ?? 0) >= 70) {
    return Response.json({ success: true, skipped: 'bot' }, { headers: corsHeaders });
  }

  if (!env.DATABASE_URL) {
    return Response.json(
      { error: 'No database configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const now = Date.now();
  const id = `la_${generateId()}`;

  // Upsert live activity
  await neonQuery(env.DATABASE_URL, `
    INSERT INTO live_activity (
      id, user_id, session_id, activity_type, content_id, content_title, 
      content_type, season_number, episode_number, country, city, region,
      started_at, last_heartbeat, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (user_id) DO UPDATE SET
      session_id = EXCLUDED.session_id,
      activity_type = EXCLUDED.activity_type,
      content_id = EXCLUDED.content_id,
      content_title = EXCLUDED.content_title,
      content_type = EXCLUDED.content_type,
      season_number = EXCLUDED.season_number,
      episode_number = EXCLUDED.episode_number,
      last_heartbeat = EXCLUDED.last_heartbeat,
      is_active = EXCLUDED.is_active,
      updated_at = EXCLUDED.updated_at
  `, [
    id,
    payload.userId,
    payload.sessionId,
    payload.activityType,
    payload.contentId || null,
    payload.contentTitle || null,
    payload.contentType || null,
    payload.seasonNumber || null,
    payload.episodeNumber || null,
    geo.country || null,
    geo.city || null,
    geo.region || null,
    now,
    now,
    payload.isActive && !payload.isLeaving,
    now,
    now,
  ]);

  // Also update user_activity for long-term tracking
  await neonQuery(env.DATABASE_URL, `
    INSERT INTO user_activity (
      id, user_id, session_id, first_seen, last_seen, total_sessions,
      country, city, region, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10)
    ON CONFLICT (user_id) DO UPDATE SET
      session_id = EXCLUDED.session_id,
      last_seen = EXCLUDED.last_seen,
      total_sessions = user_activity.total_sessions + 
        CASE WHEN user_activity.session_id != EXCLUDED.session_id THEN 1 ELSE 0 END,
      updated_at = EXCLUDED.updated_at
  `, [
    `ua_${generateId()}`,
    payload.userId,
    payload.sessionId,
    now,
    now,
    geo.country || null,
    geo.city || null,
    geo.region || null,
    now,
    now,
  ]);

  return Response.json({ success: true }, { headers: corsHeaders });
}

// POST /page-view - Track page views
async function handlePageView(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as PageViewPayload;
  const geo = getGeoInfo(request);

  if (!payload.userId || !payload.sessionId || !payload.pagePath) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!env.DATABASE_URL) {
    return Response.json(
      { error: 'No database configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const now = Date.now();
  const id = `pv_${generateId()}`;

  await neonQuery(env.DATABASE_URL, `
    INSERT INTO page_views (
      id, user_id, session_id, page_path, page_title, referrer,
      entry_time, time_on_page, scroll_depth, interactions,
      device_type, country, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, [
    id,
    payload.userId,
    payload.sessionId,
    payload.pagePath,
    payload.pageTitle || null,
    payload.referrer || null,
    payload.entryTime || now,
    payload.timeOnPage || 0,
    payload.scrollDepth || 0,
    payload.interactions || 0,
    payload.deviceType || null,
    geo.country || payload.country || null,
    now,
  ]);

  // Update page metrics
  await neonQuery(env.DATABASE_URL, `
    INSERT INTO page_metrics (page_path, total_views, unique_visitors, updated_at)
    VALUES ($1, 1, 1, $2)
    ON CONFLICT (page_path) DO UPDATE SET
      total_views = page_metrics.total_views + 1,
      updated_at = EXCLUDED.updated_at
  `, [payload.pagePath, now]);

  return Response.json({ success: true }, { headers: corsHeaders });
}

// POST /watch-session - Track watch sessions
async function handleWatchSession(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as WatchSessionPayload;

  if (!payload.userId || !payload.sessionId || !payload.contentId) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!env.DATABASE_URL) {
    return Response.json(
      { error: 'No database configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const now = Date.now();
  const watchSessionId = `ws_${payload.userId}_${payload.contentId}`;
  const progress = payload.duration > 0 ? (payload.currentTime / payload.duration) * 100 : 0;

  if (payload.action === 'start') {
    // Create or update watch session
    await neonQuery(env.DATABASE_URL, `
      INSERT INTO watch_sessions (
        id, session_id, user_id, content_id, content_type, content_title,
        season_number, episode_number, started_at, last_position, duration,
        completion_percentage, quality, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        last_position = EXCLUDED.last_position,
        duration = EXCLUDED.duration,
        completion_percentage = EXCLUDED.completion_percentage,
        updated_at = EXCLUDED.updated_at
    `, [
      watchSessionId,
      payload.sessionId,
      payload.userId,
      payload.contentId,
      payload.contentType,
      payload.contentTitle || null,
      payload.seasonNumber || null,
      payload.episodeNumber || null,
      now,
      payload.currentTime,
      payload.duration,
      progress,
      payload.quality || null,
      now,
      now,
    ]);
  } else {
    // Update existing session
    await neonQuery(env.DATABASE_URL, `
      UPDATE watch_sessions SET
        last_position = $1,
        duration = $2,
        completion_percentage = $3,
        is_completed = $4,
        ended_at = $5,
        updated_at = $6
      WHERE id = $7
    `, [
      payload.currentTime,
      payload.duration,
      progress,
      payload.action === 'complete',
      payload.action === 'complete' ? now : null,
      now,
      watchSessionId,
    ]);
  }

  // Update content stats
  await neonQuery(env.DATABASE_URL, `
    INSERT INTO content_stats (content_id, content_type, view_count, last_viewed, updated_at)
    VALUES ($1, $2, 1, $3, $4)
    ON CONFLICT (content_id) DO UPDATE SET
      view_count = content_stats.view_count + CASE WHEN $5 = 'start' THEN 1 ELSE 0 END,
      last_viewed = EXCLUDED.last_viewed,
      updated_at = EXCLUDED.updated_at
  `, [payload.contentId, payload.contentType, now, now, payload.action]);

  return Response.json({ success: true }, { headers: corsHeaders });
}

// GET /live-activity - Get current live activity
async function handleGetLiveActivity(
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.DATABASE_URL) {
    return Response.json(
      { error: 'No database configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  // Get activities from last 5 minutes
  const cutoff = Date.now() - 5 * 60 * 1000;

  const result = await neonQuery(env.DATABASE_URL, `
    SELECT 
      user_id, activity_type, content_id, content_title, content_type,
      season_number, episode_number, country, city, last_heartbeat
    FROM live_activity
    WHERE is_active = true AND last_heartbeat >= $1
    ORDER BY last_heartbeat DESC
    LIMIT 100
  `, [cutoff]);

  const data = await result.json() as { rows: any[] };

  // Calculate summary
  const activities = data.rows || [];
  const watching = activities.filter(a => a.activity_type === 'watching').length;
  const browsing = activities.filter(a => a.activity_type === 'browsing').length;
  const livetv = activities.filter(a => a.activity_type === 'livetv').length;

  return Response.json({
    success: true,
    summary: {
      total: activities.length,
      watching,
      browsing,
      livetv,
    },
    activities,
  }, { headers: corsHeaders });
}

// GET /stats - Get analytics stats
async function handleGetStats(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.DATABASE_URL) {
    return Response.json(
      { error: 'No database configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const period = url.searchParams.get('period') || '24h';
  let cutoff: number;

  switch (period) {
    case '1h':
      cutoff = Date.now() - 60 * 60 * 1000;
      break;
    case '24h':
      cutoff = Date.now() - 24 * 60 * 60 * 1000;
      break;
    case '7d':
      cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      cutoff = Date.now() - 24 * 60 * 60 * 1000;
  }

  // Get user stats
  const userStats = await neonQuery(env.DATABASE_URL, `
    SELECT 
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT session_id) as total_sessions
    FROM user_activity
    WHERE last_seen >= $1
  `, [cutoff]);

  // Get page view stats
  const pageStats = await neonQuery(env.DATABASE_URL, `
    SELECT 
      COUNT(*) as total_views,
      COUNT(DISTINCT user_id) as unique_visitors
    FROM page_views
    WHERE entry_time >= $1
  `, [cutoff]);

  // Get watch stats
  const watchStats = await neonQuery(env.DATABASE_URL, `
    SELECT 
      COUNT(*) as total_watches,
      COUNT(DISTINCT user_id) as unique_watchers,
      AVG(completion_percentage) as avg_completion
    FROM watch_sessions
    WHERE started_at >= $1
  `, [cutoff]);

  const [userData, pageData, watchData] = await Promise.all([
    userStats.json() as Promise<{ rows: any[] }>,
    pageStats.json() as Promise<{ rows: any[] }>,
    watchStats.json() as Promise<{ rows: any[] }>,
  ]);

  return Response.json({
    success: true,
    period,
    stats: {
      users: userData.rows?.[0] || { unique_users: 0, total_sessions: 0 },
      pageViews: pageData.rows?.[0] || { total_views: 0, unique_visitors: 0 },
      watching: watchData.rows?.[0] || { total_watches: 0, unique_watchers: 0, avg_completion: 0 },
    },
  }, { headers: corsHeaders });
}

// Neon HTTP API helper
async function neonQuery(databaseUrl: string, query: string, params: any[]): Promise<Response> {
  const url = new URL(databaseUrl.replace('postgresql://', 'https://').replace('postgres://', 'https://'));
  const host = url.hostname;
  const password = url.password;

  const response = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${password}`,
    },
    body: JSON.stringify({ query, params }),
  });

  return response;
}
