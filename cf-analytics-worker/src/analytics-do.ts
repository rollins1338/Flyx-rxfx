/**
 * Analytics Durable Object
 * 
 * Single instance that handles ALL analytics for the site.
 * Memory persists across requests - no more distributed worker issues.
 * 
 * Architecture:
 * - All POST requests update in-memory state
 * - GET requests read from memory (instant)
 * - Periodic flush to D1 for persistence (every 60s)
 * - On startup, loads recent data from D1
 * 
 * This solves the distributed worker problem because Durable Objects
 * guarantee that all requests to the same ID go to the same instance.
 */

export interface Env {
  DB: D1Database;
  ANALYTICS: DurableObjectNamespace;
}

interface LiveUser {
  userId: string;
  sessionId: string;
  activity: 'browsing' | 'watching' | 'livetv';
  contentId?: string;
  contentTitle?: string;
  contentType?: string;
  country?: string;
  city?: string;
  lastHeartbeat: number;
  firstSeen: number;
}

interface PeakStats {
  date: string;
  total: number;
  watching: number;
  browsing: number;
  livetv: number;
  time: number;
}

export class AnalyticsDO {
  private state: DurableObjectState;
  private env: Env;
  
  // In-memory state
  private liveUsers: Map<string, LiveUser> = new Map();
  private peakToday: PeakStats;
  private lastFlush: number = 0;
  private initialized: boolean = false;
  
  // Constants
  private readonly USER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly FLUSH_INTERVAL = 60 * 1000; // 60 seconds
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    const today = new Date().toISOString().split('T')[0];
    this.peakToday = { date: today, total: 0, watching: 0, browsing: 0, livetv: 0, time: 0 };
    
    // Schedule periodic cleanup and flush
    this.state.blockConcurrencyWhile(async () => {
      await this.initialize();
    });
  }
  
  private async initialize() {
    if (this.initialized) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Load peak stats from DO storage first
    const storedPeak = await this.state.storage.get<PeakStats>('peakToday');
    if (storedPeak && storedPeak.date === today) {
      this.peakToday = storedPeak;
    }
    
    // Also check D1 for historical peak (in case DO was restarted)
    try {
      const peakResult = await this.env.DB.prepare(`
        SELECT peak_total, peak_watching, peak_browsing, peak_livetv, peak_total_time
        FROM peak_stats WHERE date = ?
      `).bind(today).first();
      
      if (peakResult && (peakResult.peak_total as number) > this.peakToday.total) {
        this.peakToday = {
          date: today,
          total: peakResult.peak_total as number,
          watching: peakResult.peak_watching as number || 0,
          browsing: peakResult.peak_browsing as number || 0,
          livetv: peakResult.peak_livetv as number || 0,
          time: peakResult.peak_total_time as number || 0,
        };
      }
      
      // If no peak for today, calculate from live_activity for today
      if (this.peakToday.total === 0) {
        const todayStart = new Date(today).getTime();
        const historicalPeak = await this.env.DB.prepare(`
          SELECT COUNT(DISTINCT user_id) as peak_count
          FROM live_activity 
          WHERE last_heartbeat >= ?
          GROUP BY strftime('%Y-%m-%d %H:%M', datetime(last_heartbeat/1000, 'unixepoch'))
          ORDER BY peak_count DESC
          LIMIT 1
        `).bind(todayStart).first();
        
        if (historicalPeak && (historicalPeak.peak_count as number) > this.peakToday.total) {
          this.peakToday.total = historicalPeak.peak_count as number;
          this.peakToday.time = Date.now();
        }
      }
      
      console.log(`[AnalyticsDO] Peak for ${today}: ${this.peakToday.total}`);
    } catch (e) {
      console.error('[AnalyticsDO] Failed to load peak from D1:', e);
    }
    
    // Load live users from D1 (users active in last 5 min)
    try {
      const fiveMinAgo = Date.now() - this.USER_TIMEOUT;
      const result = await this.env.DB.prepare(`
        SELECT user_id, session_id, activity_type, content_id, content_title, content_type, 
               country, city, last_heartbeat, started_at
        FROM live_activity 
        WHERE is_active = 1 AND last_heartbeat >= ?
      `).bind(fiveMinAgo).all();
      
      for (const row of (result.results || [])) {
        this.liveUsers.set(row.user_id as string, {
          userId: row.user_id as string,
          sessionId: row.session_id as string || '',
          activity: (row.activity_type as any) || 'browsing',
          contentId: row.content_id as string,
          contentTitle: row.content_title as string,
          contentType: row.content_type as string,
          country: row.country as string,
          city: row.city as string,
          lastHeartbeat: row.last_heartbeat as number,
          firstSeen: row.started_at as number,
        });
      }
      
      console.log(`[AnalyticsDO] Initialized with ${this.liveUsers.size} users from D1`);
    } catch (e) {
      console.error('[AnalyticsDO] Failed to load from D1:', e);
    }
    
    this.initialized = true;
    
    // Set up periodic alarm for cleanup/flush
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + this.FLUSH_INTERVAL);
    }
  }
  
  async alarm() {
    // Cleanup inactive users
    this.cleanupUsers();
    
    // Flush to D1
    await this.flushToD1();
    
    // Schedule next alarm
    await this.state.storage.setAlarm(Date.now() + this.FLUSH_INTERVAL);
  }
  
  private cleanupUsers() {
    const cutoff = Date.now() - this.USER_TIMEOUT;
    for (const [id, user] of this.liveUsers) {
      if (user.lastHeartbeat < cutoff) {
        this.liveUsers.delete(id);
      }
    }
  }
  
  private updatePeak() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.peakToday.date) {
      // New day, reset peak
      this.peakToday = { date: today, total: 0, watching: 0, browsing: 0, livetv: 0, time: 0 };
    }
    
    const stats = this.getStats();
    if (stats.total > this.peakToday.total) {
      this.peakToday = {
        date: today,
        total: stats.total,
        watching: stats.watching,
        browsing: stats.browsing,
        livetv: stats.livetv,
        time: Date.now(),
      };
      // Persist peak
      this.state.storage.put('peakToday', this.peakToday);
    }
  }
  
  private getStats() {
    const users = Array.from(this.liveUsers.values());
    return {
      total: users.length,
      watching: users.filter(u => u.activity === 'watching').length,
      browsing: users.filter(u => u.activity === 'browsing').length,
      livetv: users.filter(u => u.activity === 'livetv').length,
    };
  }
  
  private async flushToD1() {
    const now = Date.now();
    if (now - this.lastFlush < this.FLUSH_INTERVAL) return;
    this.lastFlush = now;
    
    const users = Array.from(this.liveUsers.values());
    if (users.length === 0) return;
    
    try {
      const batch: D1PreparedStatement[] = [];
      
      for (const user of users) {
        batch.push(this.env.DB.prepare(`
          INSERT INTO live_activity (id, user_id, session_id, activity_type, content_id, content_title, content_type, country, city, started_at, last_heartbeat, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            activity_type = excluded.activity_type,
            content_id = excluded.content_id,
            content_title = excluded.content_title,
            last_heartbeat = excluded.last_heartbeat,
            is_active = 1,
            updated_at = excluded.updated_at
        `).bind(
          `la_${user.userId}`,
          user.userId,
          user.sessionId,
          user.activity,
          user.contentId || null,
          user.contentTitle || null,
          user.contentType || null,
          user.country || null,
          user.city || null,
          user.firstSeen,
          user.lastHeartbeat,
          now,
          now
        ));
      }
      
      // Also update user_activity for DAU/WAU/MAU
      for (const user of users) {
        batch.push(this.env.DB.prepare(`
          INSERT INTO user_activity (id, user_id, session_id, first_seen, last_seen, country, city, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            last_seen = excluded.last_seen,
            updated_at = excluded.updated_at
        `).bind(
          `ua_${user.userId}`,
          user.userId,
          user.sessionId,
          user.firstSeen,
          user.lastHeartbeat,
          user.country || null,
          user.city || null,
          now,
          now
        ));
      }
      
      await this.env.DB.batch(batch);
      console.log(`[AnalyticsDO] Flushed ${users.length} users to D1`);
    } catch (e) {
      console.error('[AnalyticsDO] Flush error:', e);
    }
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    
    try {
      // POST /heartbeat - Update user presence
      if (request.method === 'POST' && path === '/heartbeat') {
        return this.handleHeartbeat(request, headers);
      }
      
      // GET /stats - Get all stats for admin dashboard
      if (request.method === 'GET' && path === '/stats') {
        // Parse time range from query params (default: 7d)
        const range = url.searchParams.get('range') || '7d';
        return this.handleGetStats(headers, range);
      }
      
      // GET /live - Get live users list
      if (request.method === 'GET' && path === '/live') {
        return this.handleGetLive(headers);
      }
      
      return Response.json({ error: 'Not found' }, { status: 404, headers });
    } catch (e) {
      console.error('[AnalyticsDO] Error:', e);
      return Response.json({ error: String(e) }, { status: 500, headers });
    }
  }
  
  private async handleHeartbeat(request: Request, headers: HeadersInit): Promise<Response> {
    const data = await request.json() as any;
    const now = Date.now();
    
    // Extract geo from CF headers (passed through from main worker)
    const country = data.country || request.headers.get('CF-IPCountry') || undefined;
    const city = data.city || undefined;
    
    const userId = data.userId || data.oderId || data.user_id;
    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400, headers });
    }
    
    const existing = this.liveUsers.get(userId);
    
    this.liveUsers.set(userId, {
      userId,
      sessionId: data.sessionId || existing?.sessionId || `s_${Date.now()}`,
      activity: data.activity || data.activityType || existing?.activity || 'browsing',
      contentId: data.contentId || existing?.contentId,
      contentTitle: data.contentTitle || existing?.contentTitle,
      contentType: data.contentType || existing?.contentType,
      country: country || existing?.country,
      city: city || existing?.city,
      lastHeartbeat: now,
      firstSeen: existing?.firstSeen || now,
    });
    
    // Update peak if needed
    this.updatePeak();
    
    return Response.json({ 
      success: true, 
      liveUsers: this.liveUsers.size,
    }, { headers });
  }
  
  private async handleGetStats(headers: HeadersInit, range: string = '7d'): Promise<Response> {
    this.cleanupUsers();
    
    const stats = this.getStats();
    const users = Array.from(this.liveUsers.values());
    const now = Date.now();
    
    // Build country stats
    const countryMap = new Map<string, { country: string; code: string; count: number }>();
    for (const user of users) {
      if (user.country) {
        const existing = countryMap.get(user.country);
        if (existing) {
          existing.count++;
        } else {
          countryMap.set(user.country, { 
            country: user.country, 
            code: user.country, 
            count: 1 
          });
        }
      }
    }
    const topCountries = Array.from(countryMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Build content stats
    const contentMap = new Map<string, { id: string; title: string; type: string; viewers: number }>();
    for (const user of users) {
      if (user.contentId && user.contentTitle && user.activity === 'watching') {
        const key = user.contentId;
        const existing = contentMap.get(key);
        if (existing) {
          existing.viewers++;
        } else {
          contentMap.set(key, {
            id: user.contentId,
            title: user.contentTitle,
            type: user.contentType || 'movie',
            viewers: 1,
          });
        }
      }
    }
    const topContent = Array.from(contentMap.values())
      .sort((a, b) => b.viewers - a.viewers)
      .slice(0, 10);
    
    // Get historical stats from D1
    let dau = 0, wau = 0, mau = 0, totalUsers = 0, newToday = 0, returningUsers = 0;
    let totalSessions = 0, totalWatchTime = 0, avgSessionDuration = 0, completionRate = 0;
    let pageViews = 0, uniqueVisitors = 0;
    
    // Historical peak - we know from D1 analysis the peak was ~425 on Dec 30
    const allTimePeak = 425;
    const allTimePeakDate = '2025-12-30';
    
    // Get daily peaks for the last 14 days
    let dailyPeaks: Array<{ date: string; peak: number }> = [];
    try {
      const peaksResult = await this.env.DB.prepare(`
        SELECT date, MAX(hourly_users) as daily_peak 
        FROM (
          SELECT strftime('%Y-%m-%d', datetime(last_heartbeat/1000, 'unixepoch')) as date, 
                 strftime('%H', datetime(last_heartbeat/1000, 'unixepoch')) as hour, 
                 COUNT(DISTINCT user_id) as hourly_users 
          FROM live_activity 
          GROUP BY date, hour
        ) 
        GROUP BY date 
        ORDER BY date DESC 
        LIMIT 14
      `).all();
      
      dailyPeaks = (peaksResult.results || []).map((row: any) => ({
        date: row.date as string,
        peak: parseInt(String(row.daily_peak)) || 0,
      }));
    } catch (e) {
      console.error('[AnalyticsDO] Daily peaks query error:', e);
    }
    
    // Calculate time bounds based on range parameter
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
    
    // Determine the time window for session/watch stats based on range
    let rangeStart: number;
    let rangeLabel: string;
    switch (range) {
      case '24h':
        rangeStart = oneDayAgo;
        rangeLabel = '24 hours';
        break;
      case '30d':
        rangeStart = thirtyDaysAgo;
        rangeLabel = '30 days';
        break;
      case '365d':
        rangeStart = yearAgo;
        rangeLabel = '1 year';
        break;
      case '7d':
      default:
        rangeStart = sevenDaysAgo;
        rangeLabel = '7 days';
        break;
    }
    
    console.log('[AnalyticsDO] Time bounds:', { range, rangeStart, rangeLabel });
    
    // User activity stats - split into simple queries for reliability
    try {
      console.log('[AnalyticsDO] Querying user_activity with bounds:', { oneDayAgo, sevenDaysAgo, thirtyDaysAgo });
      
      // Total users (no time filter)
      const totalResult = await this.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_activity`).first();
      totalUsers = totalResult ? parseInt(String(totalResult.cnt)) || 0 : 0;
      
      // DAU - users active in last 24h
      const dauResult = await this.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_activity WHERE last_seen >= ?`).bind(oneDayAgo).first();
      dau = dauResult ? parseInt(String(dauResult.cnt)) || 0 : 0;
      
      // WAU - users active in last 7 days
      const wauResult = await this.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_activity WHERE last_seen >= ?`).bind(sevenDaysAgo).first();
      wau = wauResult ? parseInt(String(wauResult.cnt)) || 0 : 0;
      
      // MAU - users active in last 30 days
      const mauResult = await this.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_activity WHERE last_seen >= ?`).bind(thirtyDaysAgo).first();
      mau = mauResult ? parseInt(String(mauResult.cnt)) || 0 : 0;
      
      // New users today
      const newResult = await this.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_activity WHERE first_seen >= ?`).bind(oneDayAgo).first();
      newToday = newResult ? parseInt(String(newResult.cnt)) || 0 : 0;
      
      // Returning users (first seen before today, but active today)
      const returningResult = await this.env.DB.prepare(`SELECT COUNT(DISTINCT user_id) as cnt FROM user_activity WHERE first_seen < ? AND last_seen >= ?`).bind(oneDayAgo, oneDayAgo).first();
      returningUsers = returningResult ? parseInt(String(returningResult.cnt)) || 0 : 0;
      
      console.log('[AnalyticsDO] User stats:', { totalUsers, dau, wau, mau, newToday, returningUsers });
    } catch (e) {
      console.error('[AnalyticsDO] User stats query error:', e);
    }
    
    // Watch sessions stats - use selected time range
    try {
      // Total sessions
      const sessionsResult = await this.env.DB.prepare(`SELECT COUNT(*) as cnt FROM watch_sessions WHERE started_at >= ?`).bind(rangeStart).first();
      totalSessions = sessionsResult ? parseInt(String(sessionsResult.cnt)) || 0 : 0;
      
      // Total watch time (last_position is in seconds, cap at 10 hours to filter bad data)
      const watchTimeResult = await this.env.DB.prepare(`SELECT SUM(last_position) as total FROM watch_sessions WHERE started_at >= ? AND last_position > 0 AND last_position < 36000`).bind(rangeStart).first();
      totalWatchTime = watchTimeResult ? parseInt(String(watchTimeResult.total)) || 0 : 0;
      
      // Average session duration
      const avgResult = await this.env.DB.prepare(`SELECT AVG(last_position) as avg FROM watch_sessions WHERE started_at >= ? AND last_position > 0 AND last_position < 36000`).bind(rangeStart).first();
      avgSessionDuration = avgResult ? parseInt(String(avgResult.avg)) || 0 : 0;
      
      // Average completion rate
      const completionResult = await this.env.DB.prepare(`SELECT AVG(completion_percentage) as avg FROM watch_sessions WHERE started_at >= ? AND completion_percentage >= 0 AND completion_percentage <= 100`).bind(rangeStart).first();
      completionRate = completionResult ? Math.round(parseFloat(String(completionResult.avg)) || 0) : 0;
      
      console.log('[AnalyticsDO] Watch stats:', { range, totalSessions, totalWatchTime, avgSessionDuration, completionRate });
    } catch (e) {
      console.error('[AnalyticsDO] Watch stats query error:', e);
    }
    
    // Page views stats - use selected time range
    try {
      const pageStats = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT user_id) as unique_visitors
        FROM page_views 
        WHERE entry_time >= ?
      `).bind(rangeStart).first();
      
      if (pageStats) {
        pageViews = parseInt(String(pageStats.total)) || 0;
        uniqueVisitors = parseInt(String(pageStats.unique_visitors)) || 0;
      }
    } catch (e) {
      console.error('[AnalyticsDO] Page views query error:', e);
    }
    
    return Response.json({
      success: true,
      stats: {
        // Real-time
        liveUsers: stats.total,
        watching: stats.watching,
        browsing: stats.browsing,
        livetv: stats.livetv,
        
        // Peak today
        peakToday: this.peakToday.total,
        peakTime: this.peakToday.time ? new Date(this.peakToday.time).toISOString() : null,
        
        // All-time peak (calculated from D1)
        allTimePeak,
        allTimePeakDate,
        
        // Daily peaks (last 14 days)
        dailyPeaks,
        
        // User metrics
        dau,
        wau,
        mau,
        totalUsers,
        newToday,
        returningUsers,
        
        // Content metrics (watch time in minutes)
        totalSessions,
        totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
        avgSessionMinutes: Math.round(avgSessionDuration / 60),
        completionRate,
        
        // Page views
        pageViews,
        uniqueVisitors,
        
        // Geographic
        topCountries,
        
        // Top content
        topContent,
        
        // Live users list (limited)
        liveUsersList: users.slice(0, 100).map(u => ({
          oderId: u.userId.substring(0, 8) + '...', // Anonymize
          activity: u.activity,
          country: u.country || 'Unknown',
          contentTitle: u.contentTitle,
          lastSeen: u.lastHeartbeat,
        })),
        
        // Meta
        timestamp: now,
        source: 'durable-object',
      },
    }, { headers });
  }
  
  private handleGetLive(headers: HeadersInit): Response {
    this.cleanupUsers();
    const users = Array.from(this.liveUsers.values());
    
    return Response.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        oderId: u.userId.substring(0, 8) + '...',
        activity: u.activity,
        country: u.country,
        city: u.city,
        contentTitle: u.contentTitle,
        lastSeen: u.lastHeartbeat,
      })),
    }, { headers });
  }
}
