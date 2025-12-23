/**
 * Flyx Analytics Worker - D1 Version
 * 
 * Cloudflare Worker for analytics tracking using D1 SQLite database.
 * Handles: presence/heartbeat, page views, watch sessions, live activity
 * 
 * Endpoints:
 *   POST /presence      - Heartbeat for presence tracking
 *   POST /page-view     - Track page views
 *   POST /watch-session - Track watch sessions
 *   POST /livetv-session - Track Live TV sessions
 *   POST /live-activity - Track live activity from client
 *   GET  /live-activity - Get current live activity (admin)
 *   GET  /stats         - Get analytics stats (admin)
 *   GET  /health        - Health check
 */

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  LOG_LEVEL?: string;
  HEARTBEAT_INTERVAL?: string;
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
  };
  timestamp: number;
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

// Media player patterns - these are LEGITIMATE users watching in external players
const MEDIA_PLAYER_PATTERNS = [
  // Desktop players
  { pattern: /vlc/i, name: 'VLC', category: 'player' },
  { pattern: /mpv/i, name: 'mpv', category: 'player' },
  { pattern: /mpc-hc/i, name: 'MPC-HC', category: 'player' },
  { pattern: /potplayer/i, name: 'PotPlayer', category: 'player' },
  { pattern: /kmplayer/i, name: 'KMPlayer', category: 'player' },
  { pattern: /gom\s?player/i, name: 'GOM Player', category: 'player' },
  { pattern: /smplayer/i, name: 'SMPlayer', category: 'player' },
  { pattern: /iina/i, name: 'IINA', category: 'player' },
  { pattern: /infuse/i, name: 'Infuse', category: 'player' },
  { pattern: /plex/i, name: 'Plex', category: 'player' },
  { pattern: /emby/i, name: 'Emby', category: 'player' },
  { pattern: /jellyfin/i, name: 'Jellyfin', category: 'player' },
  
  // Streaming boxes / TV apps
  { pattern: /kodi/i, name: 'Kodi', category: 'player' },
  { pattern: /xbmc/i, name: 'XBMC/Kodi', category: 'player' },
  { pattern: /roku/i, name: 'Roku', category: 'player' },
  { pattern: /firetv/i, name: 'Fire TV', category: 'player' },
  { pattern: /appletv/i, name: 'Apple TV', category: 'player' },
  { pattern: /chromecast/i, name: 'Chromecast', category: 'player' },
  { pattern: /androidtv/i, name: 'Android TV', category: 'player' },
  { pattern: /tizen/i, name: 'Samsung TV', category: 'player' },
  { pattern: /webos/i, name: 'LG TV', category: 'player' },
  { pattern: /playstation/i, name: 'PlayStation', category: 'player' },
  { pattern: /xbox/i, name: 'Xbox', category: 'player' },
  
  // Mobile players
  { pattern: /mx\s?player/i, name: 'MX Player', category: 'player' },
  { pattern: /nplayer/i, name: 'nPlayer', category: 'player' },
  { pattern: /vimu/i, name: 'Vimu Player', category: 'player' },
  { pattern: /just\s?\(video\)/i, name: 'Just Video Player', category: 'player' },
  
  // IPTV apps
  { pattern: /iptv/i, name: 'IPTV App', category: 'iptv' },
  { pattern: /tivimate/i, name: 'TiviMate', category: 'iptv' },
  { pattern: /ott\s?navigator/i, name: 'OTT Navigator', category: 'iptv' },
  { pattern: /perfect\s?player/i, name: 'Perfect Player', category: 'iptv' },
  { pattern: /smarters/i, name: 'IPTV Smarters', category: 'iptv' },
  { pattern: /xciptv/i, name: 'XCIPTV', category: 'iptv' },
  { pattern: /gse\s?smart/i, name: 'GSE Smart IPTV', category: 'iptv' },
  { pattern: /lazy\s?iptv/i, name: 'Lazy IPTV', category: 'iptv' },
  
  // Streaming libraries/frameworks
  { pattern: /lavf/i, name: 'FFmpeg/Lavf', category: 'player' },
  { pattern: /ffmpeg/i, name: 'FFmpeg', category: 'player' },
  { pattern: /libmpv/i, name: 'libmpv', category: 'player' },
  { pattern: /exoplayer/i, name: 'ExoPlayer', category: 'player' },
  { pattern: /avplayer/i, name: 'AVPlayer', category: 'player' },
  { pattern: /stagefright/i, name: 'Stagefright', category: 'player' },
];

// Bot detection patterns - these are actual bots/crawlers
const BOT_PATTERNS = [
  // Search engine bots
  { pattern: /googlebot/i, name: 'Googlebot', category: 'search' },
  { pattern: /bingbot/i, name: 'Bingbot', category: 'search' },
  { pattern: /yandexbot/i, name: 'Yandex', category: 'search' },
  { pattern: /duckduckbot/i, name: 'DuckDuckBot', category: 'search' },
  { pattern: /baiduspider/i, name: 'Baidu', category: 'search' },
  { pattern: /slurp/i, name: 'Yahoo Slurp', category: 'search' },
  
  // Social media bots
  { pattern: /facebookexternalhit/i, name: 'Facebook', category: 'social' },
  { pattern: /twitterbot/i, name: 'Twitter', category: 'social' },
  { pattern: /linkedinbot/i, name: 'LinkedIn', category: 'social' },
  { pattern: /telegrambot/i, name: 'Telegram', category: 'social' },
  { pattern: /discordbot/i, name: 'Discord', category: 'social' },
  { pattern: /whatsapp/i, name: 'WhatsApp', category: 'social' },
  { pattern: /slackbot/i, name: 'Slack', category: 'social' },
  
  // SEO/Analytics tools
  { pattern: /semrushbot/i, name: 'SEMrush', category: 'seo' },
  { pattern: /ahrefsbot/i, name: 'Ahrefs', category: 'seo' },
  { pattern: /mj12bot/i, name: 'Majestic', category: 'seo' },
  { pattern: /dotbot/i, name: 'Moz', category: 'seo' },
  { pattern: /rogerbot/i, name: 'Moz Roger', category: 'seo' },
  { pattern: /screaming frog/i, name: 'Screaming Frog', category: 'seo' },
  
  // Monitoring/Uptime
  { pattern: /uptimerobot/i, name: 'UptimeRobot', category: 'monitoring' },
  { pattern: /pingdom/i, name: 'Pingdom', category: 'monitoring' },
  { pattern: /statuscake/i, name: 'StatusCake', category: 'monitoring' },
  { pattern: /site24x7/i, name: 'Site24x7', category: 'monitoring' },
  
  // Scrapers/Crawlers (NOT media players)
  { pattern: /scrapy/i, name: 'Scrapy', category: 'scraper' },
  { pattern: /python-requests/i, name: 'Python Requests', category: 'scraper' },
  { pattern: /python-urllib/i, name: 'Python urllib', category: 'scraper' },
  { pattern: /wget\//i, name: 'Wget', category: 'scraper' },
  { pattern: /httpie/i, name: 'HTTPie', category: 'scraper' },
  { pattern: /go-http-client/i, name: 'Go HTTP', category: 'scraper' },
  { pattern: /axios/i, name: 'Axios', category: 'scraper' },
  { pattern: /node-fetch/i, name: 'Node Fetch', category: 'scraper' },
  
  // Headless browsers
  { pattern: /headlesschrome/i, name: 'Headless Chrome', category: 'headless' },
  { pattern: /phantomjs/i, name: 'PhantomJS', category: 'headless' },
  { pattern: /selenium/i, name: 'Selenium', category: 'headless' },
  { pattern: /puppeteer/i, name: 'Puppeteer', category: 'headless' },
  { pattern: /playwright/i, name: 'Playwright', category: 'headless' },
  
  // Generic bot patterns (but NOT matching player patterns)
  { pattern: /\bbot\b/i, name: 'Generic Bot', category: 'other' },
  { pattern: /crawler/i, name: 'Generic Crawler', category: 'other' },
  { pattern: /spider/i, name: 'Generic Spider', category: 'other' },
  { pattern: /\bscraper\b/i, name: 'Generic Scraper', category: 'other' },
];

interface DetectionResult {
  isBot: boolean;
  isPlayer: boolean;
  name?: string;
  category?: string;
  confidence: number;
  userAgent: string;
}

function detectUserAgent(userAgent: string | null): DetectionResult {
  if (!userAgent) {
    return { isBot: true, isPlayer: false, name: 'No User-Agent', category: 'suspicious', confidence: 90, userAgent: '' };
  }
  
  // FIRST check for media players - these are legitimate users!
  for (const player of MEDIA_PLAYER_PATTERNS) {
    if (player.pattern.test(userAgent)) {
      return {
        isBot: false,
        isPlayer: true,
        name: player.name,
        category: player.category,
        confidence: 95,
        userAgent,
      };
    }
  }
  
  // Check for cURL - could be player or scraper, check context
  if (/curl\//i.test(userAgent)) {
    // cURL with Lavf or media hints = player
    if (/lavf|media|stream|video|audio/i.test(userAgent)) {
      return { isBot: false, isPlayer: true, name: 'cURL (media)', category: 'player', confidence: 70, userAgent };
    }
    // Plain cURL = likely scraper
    return { isBot: true, isPlayer: false, name: 'cURL', category: 'scraper', confidence: 80, userAgent };
  }
  
  // Check for Java - could be player or bot
  if (/java\//i.test(userAgent)) {
    if (/player|media|stream/i.test(userAgent)) {
      return { isBot: false, isPlayer: true, name: 'Java Player', category: 'player', confidence: 70, userAgent };
    }
    return { isBot: true, isPlayer: false, name: 'Java HTTP', category: 'scraper', confidence: 75, userAgent };
  }
  
  // Check against known bot patterns
  for (const bot of BOT_PATTERNS) {
    if (bot.pattern.test(userAgent)) {
      return {
        isBot: true,
        isPlayer: false,
        name: bot.name,
        category: bot.category,
        confidence: 95,
        userAgent,
      };
    }
  }
  
  // Suspicious indicators (lower confidence)
  const suspiciousPatterns = [
    { pattern: /^Mozilla\/5\.0$/, reason: 'Bare Mozilla UA' },
    { pattern: /^Mozilla\/4\.0/, reason: 'Old Mozilla UA' },
  ];
  
  for (const sus of suspiciousPatterns) {
    if (sus.pattern.test(userAgent)) {
      return {
        isBot: true,
        isPlayer: false,
        name: sus.reason,
        category: 'suspicious',
        confidence: 60,
        userAgent,
      };
    }
  }
  
  return { isBot: false, isPlayer: false, confidence: 0, userAgent };
}

// Keep old function name for compatibility
function detectBot(userAgent: string | null): DetectionResult {
  return detectUserAgent(userAgent);
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
      let dbOk = false;
      try {
        await env.DB.prepare('SELECT 1').first();
        dbOk = true;
      } catch (e) {
        console.error('[Health] DB check failed:', e);
      }
      return Response.json({ 
        status: dbOk ? 'ok' : 'degraded', 
        service: 'flyx-analytics',
        database: dbOk ? 'connected' : 'error',
        timestamp: Date.now(),
      }, { headers: corsHeaders });
    }

    // Initialize database tables if needed
    if (url.pathname === '/init') {
      try {
        await initDatabase(env.DB);
        return Response.json({ success: true, message: 'Database initialized' }, { headers: corsHeaders });
      } catch (error) {
        console.error('[Init] Error:', error);
        return Response.json({ error: 'Failed to initialize database' }, { status: 500, headers: corsHeaders });
      }
    }

    try {
      // Support both /endpoint and /analytics/endpoint paths
      const path = url.pathname.replace(/^\/analytics/, '');
      
      switch (path) {
        case '/presence':
          if (request.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handlePresence(request, env, corsHeaders);

        case '/page-view':
          if (request.method === 'POST') {
            return await handlePageView(request, env, corsHeaders);
          } else if (request.method === 'GET') {
            return await handleGetPageViews(url, env, corsHeaders);
          }
          return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

        case '/watch-session':
          if (request.method === 'POST') {
            return await handleWatchSession(request, env, corsHeaders);
          } else if (request.method === 'GET') {
            return await handleGetWatchSessions(url, env, corsHeaders);
          }
          return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

        case '/livetv-session':
          if (request.method === 'POST') {
            return await handleLiveTVSession(request, env, corsHeaders);
          } else if (request.method === 'GET') {
            return await handleGetLiveTVSessions(url, env, corsHeaders);
          }
          return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

        case '/live-activity':
          if (request.method === 'GET') {
            return await handleGetLiveActivity(url, env, corsHeaders);
          } else if (request.method === 'POST') {
            return await handlePostLiveActivity(request, env, corsHeaders);
          }
          return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

        case '/stats':
        case '/admin/analytics':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetStats(url, env, corsHeaders);

        case '/admin/traffic-sources':
        case '/traffic-sources':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetTrafficSources(url, env, corsHeaders);

        case '/admin/presence-stats':
        case '/presence-stats':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetPresenceStats(url, env, corsHeaders);

        case '/admin/users':
        case '/users':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetUsers(url, env, corsHeaders);

        case '/user-engagement':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetUserEngagement(url, env, corsHeaders);

        case '/unified-stats':
          if (request.method !== 'GET') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleGetUnifiedStats(url, env, corsHeaders);

        case '/events':
        case '/event':
          if (request.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
          }
          return await handleEvents(request, env, corsHeaders);

        default:
          return Response.json({ error: 'Not found', path: url.pathname }, { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('[Analytics Worker] Error:', error);
      return Response.json(
        { error: 'Internal server error', details: String(error) },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

// Initialize D1 database tables
async function initDatabase(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS live_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        session_id TEXT,
        activity_type TEXT DEFAULT 'browsing',
        content_id TEXT,
        content_title TEXT,
        content_type TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        country TEXT,
        city TEXT,
        region TEXT,
        started_at INTEGER,
        last_heartbeat INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER,
        updated_at INTEGER
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_live_activity_user ON live_activity(user_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_live_activity_heartbeat ON live_activity(last_heartbeat)`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        session_id TEXT,
        first_seen INTEGER,
        last_seen INTEGER,
        total_sessions INTEGER DEFAULT 1,
        country TEXT,
        city TEXT,
        region TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id)`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS page_views (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        session_id TEXT,
        page_path TEXT,
        page_title TEXT,
        referrer TEXT,
        entry_time INTEGER,
        time_on_page INTEGER DEFAULT 0,
        scroll_depth INTEGER DEFAULT 0,
        interactions INTEGER DEFAULT 0,
        device_type TEXT,
        country TEXT,
        created_at INTEGER
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_page_views_time ON page_views(entry_time)`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS watch_sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT,
        content_id TEXT,
        content_type TEXT,
        content_title TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        started_at INTEGER,
        ended_at INTEGER,
        last_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        completion_percentage INTEGER DEFAULT 0,
        quality TEXT,
        is_completed INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_watch_sessions_content ON watch_sessions(content_id)`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS livetv_sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT,
        channel_id TEXT,
        channel_name TEXT,
        category TEXT,
        country TEXT,
        started_at INTEGER,
        ended_at INTEGER,
        watch_duration INTEGER DEFAULT 0,
        quality TEXT,
        buffer_count INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_livetv_sessions_user ON livetv_sessions(user_id)`),
    // Bot hits tracking table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS bot_hits (
        id TEXT PRIMARY KEY,
        hit_type TEXT DEFAULT 'bot',
        bot_name TEXT,
        bot_category TEXT,
        user_agent TEXT,
        ip_hash TEXT,
        country TEXT,
        city TEXT,
        page_path TEXT,
        referrer TEXT,
        confidence INTEGER,
        hit_time INTEGER,
        created_at INTEGER
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_hits_time ON bot_hits(hit_time)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_hits_name ON bot_hits(bot_name)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_hits_category ON bot_hits(bot_category)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_bot_hits_type ON bot_hits(hit_type)`),
  ]);
}


// POST /presence - Heartbeat for presence tracking
async function handlePresence(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as PresencePayload;
  const geo = getGeoInfo(request);
  const userAgent = request.headers.get('User-Agent');
  const uaCheck = detectUserAgent(userAgent);
  
  if (!payload.userId || !payload.sessionId) {
    return Response.json({ error: 'Missing userId or sessionId' }, { status: 400, headers: corsHeaders });
  }

  const now = Date.now();

  // Track external player hits - these are legitimate users!
  if (uaCheck.isPlayer) {
    try {
      await env.DB.prepare(`
        INSERT INTO bot_hits (id, hit_type, bot_name, bot_category, user_agent, country, city, page_path, referrer, confidence, hit_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `player_${generateId()}`,
        'player',
        uaCheck.name || 'Unknown Player',
        uaCheck.category || 'player',
        userAgent || '',
        geo.country || null,
        geo.city || null,
        payload.entryPage || null,
        payload.referrer || null,
        uaCheck.confidence,
        now,
        now
      ).run();
    } catch (e) {
      console.error('[Presence] Player tracking error:', e);
    }
    return Response.json({ success: true, tracked: 'player', player: uaCheck.name }, { headers: corsHeaders });
  }

  // Track bot hits separately
  if (uaCheck.isBot || (payload.validation?.isBot && (payload.validation.botConfidence ?? 0) >= 70)) {
    try {
      await env.DB.prepare(`
        INSERT INTO bot_hits (id, hit_type, bot_name, bot_category, user_agent, country, city, page_path, referrer, confidence, hit_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `bot_${generateId()}`,
        'bot',
        uaCheck.name || (payload.validation?.isBot ? 'Client Detected' : 'Unknown'),
        uaCheck.category || 'client',
        userAgent || '',
        geo.country || null,
        geo.city || null,
        payload.entryPage || null,
        payload.referrer || null,
        uaCheck.confidence || payload.validation?.botConfidence || 50,
        now,
        now
      ).run();
    } catch (e) {
      console.error('[Presence] Bot tracking error:', e);
    }
    return Response.json({ success: true, tracked: 'bot' }, { headers: corsHeaders });
  }

  const id = `la_${generateId()}`;

  try {
    // Upsert live activity
    await env.DB.prepare(`
      INSERT INTO live_activity (
        id, user_id, session_id, activity_type, content_id, content_title, 
        content_type, season_number, episode_number, country, city, region,
        started_at, last_heartbeat, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        session_id = excluded.session_id,
        activity_type = excluded.activity_type,
        content_id = excluded.content_id,
        content_title = excluded.content_title,
        content_type = excluded.content_type,
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        last_heartbeat = excluded.last_heartbeat,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).bind(
      id,
      payload.userId,
      payload.sessionId,
      payload.activityType || 'browsing',
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
      payload.isActive && !payload.isLeaving ? 1 : 0,
      now,
      now
    ).run();

    // Upsert user activity
    await env.DB.prepare(`
      INSERT INTO user_activity (
        id, user_id, session_id, first_seen, last_seen, total_sessions,
        country, city, region, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        session_id = excluded.session_id,
        last_seen = excluded.last_seen,
        total_sessions = CASE 
          WHEN user_activity.session_id != excluded.session_id 
          THEN user_activity.total_sessions + 1 
          ELSE user_activity.total_sessions 
        END,
        updated_at = excluded.updated_at
    `).bind(
      `ua_${generateId()}`,
      payload.userId,
      payload.sessionId,
      now,
      now,
      geo.country || null,
      geo.city || null,
      geo.region || null,
      now,
      now
    ).run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Presence] DB error:', error);
    return Response.json({ error: 'Database error', details: String(error) }, { status: 500, headers: corsHeaders });
  }
}

// POST /events - Handle batch events (generic analytics events)
async function handleEvents(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  try {
    const payload = await request.json() as any;
    const events = payload.events || [];
    
    // Just acknowledge the events - we don't need to store generic events in D1
    // The important data (page views, watch sessions, presence) is tracked separately
    // This endpoint exists to prevent 400 errors from the client's flushEvents
    
    if (env.LOG_LEVEL === 'debug') {
      console.log(`[Events] Received ${events.length} events`);
    }
    
    return Response.json({ success: true, received: events.length }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Events] Error:', error);
    return Response.json({ error: 'Invalid request', details: String(error) }, { status: 400, headers: corsHeaders });
  }
}

// POST /page-view - Track page views
async function handlePageView(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as any;
  const geo = getGeoInfo(request);
  const userAgent = request.headers.get('User-Agent');
  const uaCheck = detectUserAgent(userAgent);

  if (!payload.userId || !payload.pagePath) {
    return Response.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
  }

  const now = Date.now();

  // Track external player page views - legitimate users!
  if (uaCheck.isPlayer) {
    try {
      await env.DB.prepare(`
        INSERT INTO bot_hits (id, hit_type, bot_name, bot_category, user_agent, country, city, page_path, referrer, confidence, hit_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `player_${generateId()}`,
        'player',
        uaCheck.name || 'Unknown Player',
        uaCheck.category || 'player',
        userAgent || '',
        geo.country || null,
        geo.city || null,
        payload.pagePath,
        payload.referrer || null,
        uaCheck.confidence,
        now,
        now
      ).run();
    } catch (e) {
      console.error('[PageView] Player tracking error:', e);
    }
    return Response.json({ success: true, tracked: 'player', player: uaCheck.name }, { headers: corsHeaders });
  }

  // Track bot page views separately
  if (uaCheck.isBot) {
    try {
      await env.DB.prepare(`
        INSERT INTO bot_hits (id, hit_type, bot_name, bot_category, user_agent, country, city, page_path, referrer, confidence, hit_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `bot_${generateId()}`,
        'bot',
        uaCheck.name || 'Unknown',
        uaCheck.category || 'unknown',
        userAgent || '',
        geo.country || null,
        geo.city || null,
        payload.pagePath,
        payload.referrer || null,
        uaCheck.confidence,
        now,
        now
      ).run();
    } catch (e) {
      console.error('[PageView] Bot tracking error:', e);
    }
    return Response.json({ success: true, tracked: 'bot' }, { headers: corsHeaders });
  }

  const id = payload.id || `pv_${generateId()}`;

  try {
    await env.DB.prepare(`
      INSERT INTO page_views (
        id, user_id, session_id, page_path, page_title, referrer,
        entry_time, time_on_page, scroll_depth, interactions,
        device_type, country, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      payload.userId,
      payload.sessionId || null,
      payload.pagePath,
      payload.pageTitle || null,
      payload.referrer || null,
      payload.entryTime || now,
      payload.timeOnPage || 0,
      payload.scrollDepth || 0,
      payload.interactions || 0,
      payload.deviceType || null,
      geo.country || payload.country || null,
      now
    ).run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PageView] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// POST /watch-session - Track watch sessions
async function handleWatchSession(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as any;

  if (!payload.userId || !payload.contentId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
  }

  const now = Date.now();
  const id = payload.id || `ws_${payload.userId}_${payload.contentId}`;

  try {
    await env.DB.prepare(`
      INSERT INTO watch_sessions (
        id, session_id, user_id, content_id, content_type, content_title,
        season_number, episode_number, started_at, ended_at, last_position, 
        duration, completion_percentage, quality, is_completed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_position = excluded.last_position,
        duration = excluded.duration,
        completion_percentage = excluded.completion_percentage,
        is_completed = excluded.is_completed,
        ended_at = excluded.ended_at,
        updated_at = excluded.updated_at
    `).bind(
      id,
      payload.sessionId || null,
      payload.userId,
      payload.contentId,
      payload.contentType || null,
      payload.contentTitle || null,
      payload.seasonNumber || null,
      payload.episodeNumber || null,
      payload.startedAt || now,
      payload.endedAt || null,
      payload.lastPosition || 0,
      payload.duration || 0,
      payload.completionPercentage || 0,
      payload.quality || null,
      payload.isCompleted ? 1 : 0,
      now,
      now
    ).run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[WatchSession] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// POST /livetv-session - Track Live TV sessions
async function handleLiveTVSession(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as any;

  if (!payload.userId || !payload.channelId) {
    return Response.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
  }

  const now = Date.now();
  const id = `ltv_${payload.userId}_${payload.channelId}`;

  try {
    await env.DB.prepare(`
      INSERT INTO livetv_sessions (
        id, session_id, user_id, channel_id, channel_name, category,
        country, started_at, ended_at, watch_duration, quality, buffer_count, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        watch_duration = excluded.watch_duration,
        quality = excluded.quality,
        buffer_count = excluded.buffer_count,
        ended_at = excluded.ended_at,
        updated_at = excluded.updated_at
    `).bind(
      id,
      payload.sessionId || null,
      payload.userId,
      payload.channelId,
      payload.channelName || null,
      payload.category || null,
      payload.country || null,
      payload.startedAt || now,
      payload.action === 'stop' ? now : null,
      payload.watchDuration || 0,
      payload.quality || null,
      payload.bufferCount || 0,
      now,
      now
    ).run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[LiveTVSession] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// POST /live-activity - Track live activity from client
async function handlePostLiveActivity(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const payload = await request.json() as any;

  if (!payload.contentId) {
    return Response.json({ error: 'Missing contentId' }, { status: 400, headers: corsHeaders });
  }

  const now = Date.now();
  const userId = payload.userId || `anon_${Date.now()}`;
  const id = `la_${generateId()}`;

  try {
    await env.DB.prepare(`
      INSERT INTO live_activity (
        id, user_id, session_id, activity_type, content_id, content_title, 
        content_type, season_number, episode_number, started_at, last_heartbeat, 
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        activity_type = excluded.activity_type,
        content_id = excluded.content_id,
        content_title = excluded.content_title,
        content_type = excluded.content_type,
        season_number = excluded.season_number,
        episode_number = excluded.episode_number,
        last_heartbeat = excluded.last_heartbeat,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).bind(
      id,
      userId,
      payload.sessionId || null,
      payload.action === 'completed' ? 'browsing' : 'watching',
      payload.contentId,
      payload.contentTitle || null,
      payload.contentType || null,
      payload.season || null,
      payload.episode || null,
      now,
      now,
      payload.action !== 'completed' && payload.action !== 'paused' ? 1 : 0,
      now,
      now
    ).run();

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[PostLiveActivity] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /live-activity - Get current live activity
async function handleGetLiveActivity(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  // Get activities from last X minutes (default 5)
  const maxAge = parseInt(url.searchParams.get('maxAge') || '5');
  const cutoff = Date.now() - maxAge * 60 * 1000;

  try {
    const result = await env.DB.prepare(`
      SELECT 
        user_id, activity_type, content_id, content_title, content_type,
        season_number, episode_number, country, city, last_heartbeat
      FROM live_activity
      WHERE is_active = 1 AND last_heartbeat >= ?
      ORDER BY last_heartbeat DESC
      LIMIT 200
    `).bind(cutoff).all();

    const activities = result.results || [];
    const watching = activities.filter((a: any) => a.activity_type === 'watching').length;
    const browsing = activities.filter((a: any) => a.activity_type === 'browsing').length;
    const livetv = activities.filter((a: any) => a.activity_type === 'livetv').length;

    return Response.json({
      success: true,
      summary: { total: activities.length, watching, browsing, livetv },
      activities,
      timestamp: Date.now(),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetLiveActivity] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /stats - Get analytics stats
async function handleGetStats(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const period = url.searchParams.get('period') || '24h';
  let cutoff: number;

  switch (period) {
    case '1h': cutoff = Date.now() - 60 * 60 * 1000; break;
    case '24h': cutoff = Date.now() - 24 * 60 * 60 * 1000; break;
    case '7d': cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; break;
    case '30d': cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; break;
    default: cutoff = Date.now() - 24 * 60 * 60 * 1000;
  }

  try {
    const [userStats, pageStats, watchStats] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(DISTINCT user_id) as unique_users, COUNT(DISTINCT session_id) as total_sessions
        FROM user_activity WHERE last_seen >= ?
      `).bind(cutoff).first(),
      env.DB.prepare(`
        SELECT COUNT(*) as total_views, COUNT(DISTINCT user_id) as unique_visitors
        FROM page_views WHERE entry_time >= ?
      `).bind(cutoff).first(),
      env.DB.prepare(`
        SELECT COUNT(*) as total_watches, COUNT(DISTINCT user_id) as unique_watchers, AVG(completion_percentage) as avg_completion
        FROM watch_sessions WHERE started_at >= ?
      `).bind(cutoff).first(),
    ]);

    return Response.json({
      success: true,
      period,
      stats: {
        users: userStats || { unique_users: 0, total_sessions: 0 },
        pageViews: pageStats || { total_views: 0, unique_visitors: 0 },
        watching: watchStats || { total_watches: 0, unique_watchers: 0, avg_completion: 0 },
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetStats] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}


// GET /watch-session - Get watch sessions for admin
async function handleGetWatchSessions(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const userId = url.searchParams.get('userId');
  const contentId = url.searchParams.get('contentId');
  const days = parseInt(url.searchParams.get('days') || '7');
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    let query = `SELECT * FROM watch_sessions WHERE started_at >= ?`;
    const params: any[] = [cutoff];

    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    if (contentId) {
      query += ` AND content_id = ?`;
      params.push(contentId);
    }

    query += ` ORDER BY started_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM watch_sessions WHERE started_at >= ?`;
    const countParams: any[] = [cutoff];
    if (userId) { countQuery += ` AND user_id = ?`; countParams.push(userId); }
    if (contentId) { countQuery += ` AND content_id = ?`; countParams.push(contentId); }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    return Response.json({
      success: true,
      sessions: result.results || [],
      total: (countResult as any)?.total || 0,
      limit,
      offset,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetWatchSessions] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /page-view - Get page views for admin
async function handleGetPageViews(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const days = parseInt(url.searchParams.get('days') || '7');
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    // Get page view stats grouped by path
    const pageStats = await env.DB.prepare(`
      SELECT 
        page_path,
        COUNT(*) as views,
        COUNT(DISTINCT user_id) as unique_visitors,
        AVG(time_on_page) as avg_time_on_page,
        AVG(scroll_depth) as avg_scroll_depth
      FROM page_views 
      WHERE entry_time >= ?
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 100
    `).bind(cutoff).all();

    // Get total stats
    const totals = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT user_id) as unique_visitors,
        AVG(time_on_page) as avg_time_on_page
      FROM page_views WHERE entry_time >= ?
    `).bind(cutoff).first();

    return Response.json({
      success: true,
      pages: pageStats.results || [],
      totals: totals || { total_views: 0, unique_visitors: 0, avg_time_on_page: 0 },
      days,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetPageViews] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /livetv-session - Get Live TV sessions for admin
async function handleGetLiveTVSessions(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const history = url.searchParams.get('history') === 'true';
  const days = parseInt(url.searchParams.get('days') || '7');
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    if (history) {
      // Get historical stats
      const stats = await env.DB.prepare(`
        SELECT 
          channel_name,
          category,
          COUNT(*) as session_count,
          SUM(watch_duration) as total_watch_time,
          AVG(watch_duration) as avg_watch_time,
          COUNT(DISTINCT user_id) as unique_viewers
        FROM livetv_sessions 
        WHERE started_at >= ?
        GROUP BY channel_name, category
        ORDER BY session_count DESC
        LIMIT 50
      `).bind(cutoff).all();

      return Response.json({
        success: true,
        channels: stats.results || [],
        days,
      }, { headers: corsHeaders });
    }

    // Get current/recent sessions
    const sessions = await env.DB.prepare(`
      SELECT * FROM livetv_sessions 
      WHERE started_at >= ? 
      ORDER BY started_at DESC 
      LIMIT 100
    `).bind(cutoff).all();

    return Response.json({
      success: true,
      sessions: sessions.results || [],
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetLiveTVSessions] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /traffic-sources - Get traffic source analytics
async function handleGetTrafficSources(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const days = parseInt(url.searchParams.get('days') || '7');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 10000);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    // Get totals
    const totals = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_hits,
        COUNT(DISTINCT user_id) as unique_visitors
      FROM page_views WHERE entry_time >= ?
    `).bind(cutoff).first();

    // Get referrer stats (top referrers)
    const topReferrers = await env.DB.prepare(`
      SELECT 
        referrer as referrer_domain,
        'referral' as referrer_medium,
        COUNT(*) as hit_count,
        MAX(entry_time) as last_hit
      FROM page_views 
      WHERE entry_time >= ? AND referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer
      ORDER BY hit_count DESC
      LIMIT ?
    `).bind(cutoff, limit).all();

    // Get detailed referrers
    const detailedReferrers = await env.DB.prepare(`
      SELECT 
        referrer as referrer_url,
        referrer as referrer_domain,
        'referral' as referrer_medium,
        COUNT(*) as hit_count,
        COUNT(DISTINCT user_id) as unique_visitors,
        MAX(entry_time) as last_hit
      FROM page_views 
      WHERE entry_time >= ? AND referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer
      ORDER BY hit_count DESC
      LIMIT ?
    `).bind(cutoff, limit).all();

    // Get country stats (geoStats)
    const geoStats = await env.DB.prepare(`
      SELECT 
        country,
        COUNT(*) as hit_count,
        COUNT(DISTINCT user_id) as unique_visitors
      FROM page_views 
      WHERE entry_time >= ? AND country IS NOT NULL
      GROUP BY country
      ORDER BY hit_count DESC
      LIMIT 50
    `).bind(cutoff).all();

    // Get hourly pattern
    const hourlyPattern = await env.DB.prepare(`
      SELECT 
        CAST(strftime('%H', datetime(entry_time/1000, 'unixepoch')) AS INTEGER) as hour,
        COUNT(*) as hit_count,
        0 as bot_hits
      FROM page_views 
      WHERE entry_time >= ?
      GROUP BY hour
      ORDER BY hour
    `).bind(cutoff).all();

    // Get medium stats (derive from referrers)
    const mediumStats = await env.DB.prepare(`
      SELECT 
        CASE 
          WHEN referrer IS NULL OR referrer = '' THEN 'direct'
          WHEN referrer LIKE '%google%' OR referrer LIKE '%bing%' OR referrer LIKE '%duckduckgo%' THEN 'organic'
          WHEN referrer LIKE '%facebook%' OR referrer LIKE '%twitter%' OR referrer LIKE '%instagram%' OR referrer LIKE '%t.co%' OR referrer LIKE '%telegram%' THEN 'social'
          ELSE 'referral'
        END as referrer_medium,
        COUNT(*) as hit_count,
        COUNT(DISTINCT user_id) as unique_visitors
      FROM page_views 
      WHERE entry_time >= ?
      GROUP BY referrer_medium
      ORDER BY hit_count DESC
    `).bind(cutoff).all();

    // Get bot stats from bot_hits table (only actual bots)
    const botTotals = await env.DB.prepare(`
      SELECT COUNT(*) as total_bot_hits FROM bot_hits WHERE hit_time >= ? AND (hit_type = 'bot' OR hit_type IS NULL)
    `).bind(cutoff).first();

    const botByName = await env.DB.prepare(`
      SELECT 
        bot_name,
        bot_category,
        COUNT(*) as hit_count,
        MAX(hit_time) as last_hit
      FROM bot_hits 
      WHERE hit_time >= ? AND (hit_type = 'bot' OR hit_type IS NULL)
      GROUP BY bot_name, bot_category
      ORDER BY hit_count DESC
      LIMIT 50
    `).bind(cutoff).all();

    const botByCategory = await env.DB.prepare(`
      SELECT 
        bot_category,
        COUNT(*) as hit_count
      FROM bot_hits 
      WHERE hit_time >= ? AND (hit_type = 'bot' OR hit_type IS NULL)
      GROUP BY bot_category
      ORDER BY hit_count DESC
    `).bind(cutoff).all();

    const botByCountry = await env.DB.prepare(`
      SELECT 
        country,
        COUNT(*) as hit_count
      FROM bot_hits 
      WHERE hit_time >= ? AND country IS NOT NULL AND (hit_type = 'bot' OR hit_type IS NULL)
      GROUP BY country
      ORDER BY hit_count DESC
      LIMIT 20
    `).bind(cutoff).all();

    const botHourly = await env.DB.prepare(`
      SELECT 
        CAST(strftime('%H', datetime(hit_time/1000, 'unixepoch')) AS INTEGER) as hour,
        COUNT(*) as hit_count
      FROM bot_hits 
      WHERE hit_time >= ? AND (hit_type = 'bot' OR hit_type IS NULL)
      GROUP BY hour
      ORDER BY hour
    `).bind(cutoff).all();

    // Get PLAYER stats (external media players - legitimate users!)
    const playerTotals = await env.DB.prepare(`
      SELECT COUNT(*) as total_player_hits FROM bot_hits WHERE hit_time >= ? AND hit_type = 'player'
    `).bind(cutoff).first();

    const playerByName = await env.DB.prepare(`
      SELECT 
        bot_name as player_name,
        bot_category as player_category,
        COUNT(*) as hit_count,
        MAX(hit_time) as last_hit
      FROM bot_hits 
      WHERE hit_time >= ? AND hit_type = 'player'
      GROUP BY bot_name, bot_category
      ORDER BY hit_count DESC
      LIMIT 50
    `).bind(cutoff).all();

    const playerByCategory = await env.DB.prepare(`
      SELECT 
        bot_category as player_category,
        COUNT(*) as hit_count
      FROM bot_hits 
      WHERE hit_time >= ? AND hit_type = 'player'
      GROUP BY bot_category
      ORDER BY hit_count DESC
    `).bind(cutoff).all();

    const playerByCountry = await env.DB.prepare(`
      SELECT 
        country,
        COUNT(*) as hit_count
      FROM bot_hits 
      WHERE hit_time >= ? AND country IS NOT NULL AND hit_type = 'player'
      GROUP BY country
      ORDER BY hit_count DESC
      LIMIT 20
    `).bind(cutoff).all();

    // Merge bot hourly into main hourly pattern
    const botHourlyMap: Record<number, number> = {};
    (botHourly.results || []).forEach((b: any) => { botHourlyMap[b.hour] = b.hit_count; });
    const mergedHourly = (hourlyPattern.results || []).map((h: any) => ({
      ...h,
      bot_hits: botHourlyMap[h.hour] || 0,
    }));

    // Source type stats
    const humanHits = Number(totals?.total_hits) || 0;
    const botHits = Number(botTotals?.total_bot_hits) || 0;
    const playerHits = Number(playerTotals?.total_player_hits) || 0;
    const sourceTypeStats = [
      { source_type: 'browser', source_name: 'Website Users', hit_count: humanHits, unique_visitors: Number(totals?.unique_visitors) || 0 },
      { source_type: 'player', source_name: 'External Players', hit_count: playerHits, unique_visitors: 0 },
      { source_type: 'bot', source_name: 'Bots & Crawlers', hit_count: botHits, unique_visitors: 0 }
    ];

    return Response.json({
      success: true,
      totals: {
        total_hits: humanHits + botHits + playerHits,
        unique_visitors: Number(totals?.unique_visitors) || 0,
        bot_hits: botHits,
        player_hits: playerHits,
        human_hits: humanHits,
      },
      sourceTypeStats,
      mediumStats: mediumStats.results || [],
      topReferrers: topReferrers.results || [],
      detailedReferrers: detailedReferrers.results || [],
      // Bot stats
      botStats: botByName.results || [],
      botByCategory: botByCategory.results || [],
      botByCountry: botByCountry.results || [],
      // Player stats (external media players)
      playerStats: playerByName.results || [],
      playerByCategory: playerByCategory.results || [],
      playerByCountry: playerByCountry.results || [],
      hourlyPattern: mergedHourly,
      geoStats: geoStats.results || [],
      days,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetTrafficSources] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /presence-stats - Get presence/active user stats
async function handleGetPresenceStats(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const minutes = parseInt(url.searchParams.get('minutes') || '30');
  const cutoff = Date.now() - minutes * 60 * 1000;
  const strictCutoff = Date.now() - 2 * 60 * 1000; // 2 minutes for "truly active"

  try {
    // Get active users totals
    const totals = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_active,
        SUM(CASE WHEN last_heartbeat >= ? THEN 1 ELSE 0 END) as truly_active,
        COUNT(DISTINCT session_id) as total_sessions
      FROM live_activity 
      WHERE is_active = 1 AND last_heartbeat >= ?
    `).bind(strictCutoff, cutoff).first();

    // Get activity breakdown
    const activityBreakdown = await env.DB.prepare(`
      SELECT 
        activity_type,
        COUNT(*) as user_count,
        SUM(CASE WHEN last_heartbeat >= ? THEN 1 ELSE 0 END) as truly_active
      FROM live_activity 
      WHERE is_active = 1 AND last_heartbeat >= ?
      GROUP BY activity_type
    `).bind(strictCutoff, cutoff).all();

    // Get geo distribution
    const geoDistribution = await env.DB.prepare(`
      SELECT 
        country,
        city,
        COUNT(*) as user_count
      FROM live_activity 
      WHERE is_active = 1 AND last_heartbeat >= ? AND country IS NOT NULL
      GROUP BY country, city
      ORDER BY user_count DESC
      LIMIT 20
    `).bind(cutoff).all();

    // Get active content
    const activeContent = await env.DB.prepare(`
      SELECT 
        content_title,
        content_type,
        activity_type,
        COUNT(*) as viewer_count
      FROM live_activity 
      WHERE is_active = 1 AND last_heartbeat >= ? AND content_title IS NOT NULL
      GROUP BY content_title, content_type, activity_type
      ORDER BY viewer_count DESC
      LIMIT 20
    `).bind(cutoff).all();

    return Response.json({
      success: true,
      totals: {
        total_active: totals?.total_active || 0,
        truly_active: totals?.truly_active || 0,
        total_sessions: totals?.total_sessions || 0,
      },
      activityBreakdown: activityBreakdown.results || [],
      validationScores: [],
      entropyStats: [],
      geoDistribution: geoDistribution.results || [],
      deviceDistribution: [],
      activeContent: activeContent.results || [],
      minutes,
      timestamp: Date.now(),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetPresenceStats] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /users - Get user list for admin
async function handleGetUsers(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const userId = url.searchParams.get('userId');

  try {
    if (userId) {
      // Get specific user
      const user = await env.DB.prepare(`
        SELECT * FROM user_activity WHERE user_id = ?
      `).bind(userId).first();

      if (!user) {
        return Response.json({ success: false, error: 'User not found' }, { status: 404, headers: corsHeaders });
      }

      // Get user's watch sessions
      const sessions = await env.DB.prepare(`
        SELECT * FROM watch_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50
      `).bind(userId).all();

      return Response.json({
        success: true,
        user,
        watchSessions: sessions.results || [],
      }, { headers: corsHeaders });
    }

    // Get user list
    const users = await env.DB.prepare(`
      SELECT * FROM user_activity ORDER BY last_seen DESC LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM user_activity`).first();

    return Response.json({
      success: true,
      users: users.results || [],
      total: (countResult as any)?.total || 0,
      limit,
      offset,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetUsers] DB error:', error);
    return Response.json({ error: 'Database error' }, { status: 500, headers: corsHeaders });
  }
}

// GET /user-engagement - Get user engagement metrics
async function handleGetUserEngagement(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const days = parseInt(url.searchParams.get('days') || '7');
  const sortBy = url.searchParams.get('sortBy') || 'last_visit';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    // Build sort clause - using page_views as primary source for consistency with DAU
    let orderBy = 'last_visit DESC';
    switch (sortBy) {
      case 'engagement': orderBy = 'engagement_score DESC'; break;
      case 'visits': orderBy = 'total_visits DESC'; break;
      case 'watch_time': orderBy = 'total_watch_time DESC'; break;
      case 'page_views': orderBy = 'total_page_views DESC'; break;
      case 'first_visit': orderBy = 'first_visit ASC'; break;
      default: orderBy = 'last_visit DESC';
    }

    // Get user engagement data from page_views as primary source (consistent with DAU)
    const usersResult = await env.DB.prepare(`
      SELECT 
        pv.user_id,
        MIN(pv.entry_time) as first_visit,
        MAX(pv.entry_time) as last_visit,
        COUNT(DISTINCT pv.session_id) as total_visits,
        COUNT(*) as total_page_views,
        COALESCE(SUM(pv.time_on_page), 0) as total_time_on_site,
        COALESCE(ws.watch_time, 0) as total_watch_time,
        CASE 
          WHEN COUNT(DISTINCT pv.session_id) > 0 
          THEN COALESCE(SUM(pv.time_on_page), 0) / COUNT(DISTINCT pv.session_id) 
          ELSE 0 
        END as avg_session_duration,
        CASE 
          WHEN COUNT(DISTINCT pv.session_id) > 0 
          THEN COUNT(*) * 1.0 / COUNT(DISTINCT pv.session_id) 
          ELSE 0 
        END as avg_pages_per_session,
        CASE 
          WHEN COUNT(DISTINCT pv.session_id) >= 10 AND COALESCE(ws.watch_time, 0) > 3600000 THEN 90
          WHEN COUNT(DISTINCT pv.session_id) >= 5 AND COALESCE(ws.watch_time, 0) > 1800000 THEN 70
          WHEN COUNT(DISTINCT pv.session_id) >= 3 AND COUNT(*) > 10 THEN 50
          WHEN COUNT(DISTINCT pv.session_id) >= 2 THEN 30
          ELSE 10
        END as engagement_score,
        pv.country as countries,
        '' as device_types,
        CASE WHEN COUNT(*) <= 1 AND COUNT(DISTINCT pv.session_id) = 1 THEN 1 ELSE 0 END as bounce_count
      FROM page_views pv
      LEFT JOIN (
        SELECT user_id, SUM(duration) as watch_time
        FROM watch_sessions WHERE started_at >= ?
        GROUP BY user_id
      ) ws ON pv.user_id = ws.user_id
      WHERE pv.entry_time >= ?
      GROUP BY pv.user_id
      ORDER BY ${orderBy}
      LIMIT ?
    `).bind(cutoff, cutoff, limit).all();

    const users = usersResult.results || [];

    // Calculate aggregate stats
    const totalUsers = users.length;
    const totalVisits = users.reduce((sum: number, u: any) => sum + (u.total_visits || 0), 0);
    const totalPages = users.reduce((sum: number, u: any) => sum + (u.total_page_views || 0), 0);
    const totalTime = users.reduce((sum: number, u: any) => sum + (u.total_time_on_site || 0), 0);
    const totalEngagement = users.reduce((sum: number, u: any) => sum + (u.engagement_score || 0), 0);
    const totalBounces = users.reduce((sum: number, u: any) => sum + (u.bounce_count || 0), 0);
    const returningUsers = users.filter((u: any) => u.total_visits > 1).length;

    const aggregateStats = {
      total_users: totalUsers,
      avg_visits_per_user: totalUsers > 0 ? totalVisits / totalUsers : 0,
      avg_pages_per_user: totalUsers > 0 ? totalPages / totalUsers : 0,
      avg_time_per_user: totalUsers > 0 ? totalTime / totalUsers : 0,
      avg_engagement_score: totalUsers > 0 ? totalEngagement / totalUsers : 0,
      return_rate: totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0,
      overall_bounce_rate: totalUsers > 0 ? (totalBounces / totalUsers) * 100 : 0,
    };

    // Calculate engagement distribution
    const engagementDistribution = [
      { segment: 'highly_engaged', count: users.filter((u: any) => u.engagement_score >= 80).length },
      { segment: 'engaged', count: users.filter((u: any) => u.engagement_score >= 50 && u.engagement_score < 80).length },
      { segment: 'casual', count: users.filter((u: any) => u.engagement_score >= 20 && u.engagement_score < 50).length },
      { segment: 'new', count: users.filter((u: any) => u.engagement_score < 20).length },
    ];

    // Calculate visit frequency distribution
    const visitFrequency = [
      { visits_range: '1', count: users.filter((u: any) => u.total_visits === 1).length },
      { visits_range: '2-5', count: users.filter((u: any) => u.total_visits >= 2 && u.total_visits <= 5).length },
      { visits_range: '6-10', count: users.filter((u: any) => u.total_visits >= 6 && u.total_visits <= 10).length },
      { visits_range: '11+', count: users.filter((u: any) => u.total_visits > 10).length },
    ];

    return Response.json({
      success: true,
      users,
      aggregateStats,
      engagementDistribution,
      visitFrequency,
      days,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetUserEngagement] DB error:', error);
    return Response.json({ error: 'Database error', details: String(error) }, { status: 500, headers: corsHeaders });
  }
}

// GET /unified-stats - Get unified stats for admin dashboard
async function handleGetUnifiedStats(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const twoMinAgo = now - 2 * 60 * 1000;
  const oneMinAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  try {
    const [
      liveActivity,
      userStats,
      contentStats,
      pageViewStats,
      geoStats,
      topContent
    ] = await Promise.all([
      // Real-time activity (5 min window, truly active = 1 min)
      env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN activity_type = 'watching' THEN 1 ELSE 0 END) as watching,
          SUM(CASE WHEN activity_type = 'browsing' THEN 1 ELSE 0 END) as browsing,
          SUM(CASE WHEN activity_type = 'livetv' THEN 1 ELSE 0 END) as livetv,
          SUM(CASE WHEN last_heartbeat >= ? THEN 1 ELSE 0 END) as truly_active
        FROM live_activity 
        WHERE is_active = 1 AND last_heartbeat >= ?
      `).bind(oneMinAgo, fiveMinAgo).first(),

      // User stats (DAU, WAU, MAU from page_views for consistency with unique visitors)
      env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as total,
          COUNT(DISTINCT CASE WHEN entry_time >= ? THEN user_id END) as dau,
          COUNT(DISTINCT CASE WHEN entry_time >= ? THEN user_id END) as wau,
          COUNT(DISTINCT CASE WHEN entry_time >= ? THEN user_id END) as mau
        FROM page_views
      `).bind(oneDayAgo, sevenDaysAgo, thirtyDaysAgo).first(),

      // Content/watch stats (last 24h)
      env.DB.prepare(`
        SELECT 
          COUNT(*) as total_sessions,
          COALESCE(SUM(duration), 0) / 60 as total_watch_time,
          COALESCE(AVG(duration), 0) / 60 as avg_duration,
          COALESCE(AVG(completion_percentage), 0) as completion_rate,
          SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
          SUM(CASE WHEN content_type = 'movie' THEN 1 ELSE 0 END) as movie_sessions,
          SUM(CASE WHEN content_type = 'tv' THEN 1 ELSE 0 END) as tv_sessions,
          COUNT(DISTINCT content_id) as unique_content
        FROM watch_sessions WHERE started_at >= ?
      `).bind(oneDayAgo).first(),

      // Page views (last 24h)
      env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT user_id) as unique_visitors
        FROM page_views WHERE entry_time >= ?
      `).bind(oneDayAgo).first(),

      // Geographic stats (last 7 days)
      env.DB.prepare(`
        SELECT 
          country,
          COUNT(DISTINCT user_id) as count
        FROM page_views 
        WHERE entry_time >= ? AND country IS NOT NULL
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `).bind(sevenDaysAgo).all(),

      // Top content (last 7 days)
      env.DB.prepare(`
        SELECT 
          content_id as contentId,
          content_title as contentTitle,
          content_type as contentType,
          COUNT(*) as watchCount,
          SUM(duration) / 60 as totalWatchTime
        FROM watch_sessions 
        WHERE started_at >= ? AND content_title IS NOT NULL
        GROUP BY content_id, content_title, content_type
        ORDER BY watchCount DESC
        LIMIT 10
      `).bind(sevenDaysAgo).all(),
    ]);

    // All-time watch time
    const allTimeWatch = await env.DB.prepare(`
      SELECT COALESCE(SUM(duration), 0) / 60 as total FROM watch_sessions
    `).first() as { total: number } | null;

    return Response.json({
      success: true,
      realtime: {
        totalActive: liveActivity?.total || 0,
        trulyActive: liveActivity?.truly_active || 0,
        watching: liveActivity?.watching || 0,
        browsing: liveActivity?.browsing || 0,
        livetv: liveActivity?.livetv || 0,
      },
      users: {
        total: userStats?.total || 0,
        dau: userStats?.dau || 0,
        wau: userStats?.wau || 0,
        mau: userStats?.mau || 0,
        newToday: 0, // Not tracked in page_views
        returning: 0, // Not tracked in page_views
      },
      content: {
        totalSessions: Number(contentStats?.total_sessions) || 0,
        totalWatchTime: Math.round(Number(contentStats?.total_watch_time) || 0),
        allTimeWatchTime: Math.round(Number(allTimeWatch?.total) || 0),
        avgDuration: Math.round(Number(contentStats?.avg_duration) || 0),
        completionRate: Math.round(Number(contentStats?.completion_rate) || 0),
        completedSessions: Number(contentStats?.completed_sessions) || 0,
        movieSessions: Number(contentStats?.movie_sessions) || 0,
        tvSessions: Number(contentStats?.tv_sessions) || 0,
        uniqueContentWatched: Number(contentStats?.unique_content) || 0,
      },
      pageViews: {
        total: pageViewStats?.total || 0,
        uniqueVisitors: pageViewStats?.unique_visitors || 0,
      },
      geographic: (geoStats.results || []).map((g: any) => ({
        country: g.country,
        countryName: g.country, // Could add country name lookup
        count: g.count,
      })),
      devices: [], // Not tracked in current schema
      topContent: topContent.results || [],
      timeRanges: {
        realtime: '5 minutes',
        dau: '24 hours',
        wau: '7 days',
        mau: '30 days',
        content: '24 hours',
        geographic: '7 days',
        devices: '7 days',
        pageViews: '24 hours',
      },
      timestamp: now,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[GetUnifiedStats] DB error:', error);
    return Response.json({ error: 'Database error', details: String(error) }, { status: 500, headers: corsHeaders });
  }
}
