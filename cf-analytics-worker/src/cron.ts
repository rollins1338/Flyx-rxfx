/**
 * Cron Handler for Analytics Worker
 * 
 * Runs daily at midnight UTC to aggregate metrics from the previous day.
 * Aggregates data from watch_sessions, page_views, and user_activity tables
 * into the metrics_daily table for faster dashboard queries.
 * 
 * Requirements: 5.1, 5.2
 */

export interface Env {
  DB: D1Database;
  ANALYTICS_DO: DurableObjectNamespace;
}

export interface DailyMetrics {
  date: string;
  total_sessions: number;
  total_watch_time: number;
  unique_users: number;
  avg_completion_rate: number;
  movie_sessions: number;
  tv_sessions: number;
  livetv_sessions: number;
  page_views: number;
  unique_visitors: number;
  new_users: number;
  returning_users: number;
}

/**
 * Aggregate daily metrics for a specific date
 * @param db D1 database instance
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Aggregated metrics for the day
 */
export async function aggregateDailyMetrics(
  db: D1Database,
  dateStr: string
): Promise<DailyMetrics> {
  // Calculate time bounds for the day
  const dayStart = new Date(dateStr + 'T00:00:00Z').getTime();
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z').getTime();

  console.log(`[Cron] Aggregating metrics for ${dateStr} (${dayStart} - ${dayEnd})`);

  // Aggregate watch session stats
  const watchStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      COALESCE(SUM(CASE WHEN last_position > 0 AND last_position < 36000 THEN last_position ELSE 0 END), 0) as total_watch_time,
      COUNT(DISTINCT user_id) as unique_users,
      COALESCE(AVG(CASE WHEN completion_percentage >= 0 AND completion_percentage <= 100 THEN completion_percentage END), 0) as avg_completion_rate,
      SUM(CASE WHEN content_type = 'movie' THEN 1 ELSE 0 END) as movie_sessions,
      SUM(CASE WHEN content_type = 'tv' THEN 1 ELSE 0 END) as tv_sessions,
      SUM(CASE WHEN content_type = 'livetv' THEN 1 ELSE 0 END) as livetv_sessions
    FROM watch_sessions
    WHERE started_at >= ? AND started_at <= ?
  `).bind(dayStart, dayEnd).first();

  // Aggregate page view stats
  const pageStats = await db.prepare(`
    SELECT 
      COUNT(*) as page_views,
      COUNT(DISTINCT user_id) as unique_visitors
    FROM page_views
    WHERE entry_time >= ? AND entry_time <= ?
  `).bind(dayStart, dayEnd).first();

  // Aggregate user activity stats
  const userStats = await db.prepare(`
    SELECT 
      COUNT(DISTINCT CASE WHEN first_seen >= ? AND first_seen <= ? THEN user_id END) as new_users,
      COUNT(DISTINCT CASE WHEN first_seen < ? AND last_seen >= ? AND last_seen <= ? THEN user_id END) as returning_users
    FROM user_activity
  `).bind(dayStart, dayEnd, dayStart, dayStart, dayEnd).first();

  const metrics: DailyMetrics = {
    date: dateStr,
    total_sessions: parseInt(String(watchStats?.total_sessions)) || 0,
    total_watch_time: parseInt(String(watchStats?.total_watch_time)) || 0,
    unique_users: parseInt(String(watchStats?.unique_users)) || 0,
    avg_completion_rate: Math.round(parseFloat(String(watchStats?.avg_completion_rate)) || 0),
    movie_sessions: parseInt(String(watchStats?.movie_sessions)) || 0,
    tv_sessions: parseInt(String(watchStats?.tv_sessions)) || 0,
    livetv_sessions: parseInt(String(watchStats?.livetv_sessions)) || 0,
    page_views: parseInt(String(pageStats?.page_views)) || 0,
    unique_visitors: parseInt(String(pageStats?.unique_visitors)) || 0,
    new_users: parseInt(String(userStats?.new_users)) || 0,
    returning_users: parseInt(String(userStats?.returning_users)) || 0,
  };

  console.log(`[Cron] Aggregated metrics for ${dateStr}:`, metrics);

  return metrics;
}

/**
 * Save daily metrics to the metrics_daily table
 * @param db D1 database instance
 * @param metrics Aggregated metrics to save
 */
export async function saveDailyMetrics(
  db: D1Database,
  metrics: DailyMetrics
): Promise<void> {
  const now = Date.now();

  // Ensure the metrics_daily table exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS metrics_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_sessions INTEGER DEFAULT 0,
      total_watch_time INTEGER DEFAULT 0,
      unique_users INTEGER DEFAULT 0,
      avg_completion_rate REAL DEFAULT 0,
      movie_sessions INTEGER DEFAULT 0,
      tv_sessions INTEGER DEFAULT 0,
      livetv_sessions INTEGER DEFAULT 0,
      page_views INTEGER DEFAULT 0,
      unique_visitors INTEGER DEFAULT 0,
      new_users INTEGER DEFAULT 0,
      returning_users INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `).run();

  // Create index if not exists
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(date)
  `).run();

  // Upsert the metrics
  await db.prepare(`
    INSERT INTO metrics_daily (
      date, total_sessions, total_watch_time, unique_users, avg_completion_rate,
      movie_sessions, tv_sessions, livetv_sessions, page_views, unique_visitors,
      new_users, returning_users, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_sessions = excluded.total_sessions,
      total_watch_time = excluded.total_watch_time,
      unique_users = excluded.unique_users,
      avg_completion_rate = excluded.avg_completion_rate,
      movie_sessions = excluded.movie_sessions,
      tv_sessions = excluded.tv_sessions,
      livetv_sessions = excluded.livetv_sessions,
      page_views = excluded.page_views,
      unique_visitors = excluded.unique_visitors,
      new_users = excluded.new_users,
      returning_users = excluded.returning_users,
      updated_at = excluded.updated_at
  `).bind(
    metrics.date,
    metrics.total_sessions,
    metrics.total_watch_time,
    metrics.unique_users,
    metrics.avg_completion_rate,
    metrics.movie_sessions,
    metrics.tv_sessions,
    metrics.livetv_sessions,
    metrics.page_views,
    metrics.unique_visitors,
    metrics.new_users,
    metrics.returning_users,
    now,
    now
  ).run();

  console.log(`[Cron] Saved metrics for ${metrics.date}`);
}

/**
 * Cleanup old data to prevent unbounded D1 table growth
 * - page_views: delete rows older than 30 days (already aggregated into metrics_daily)
 * - watch_sessions: delete rows older than 90 days
 * - live_activity: delete inactive users older than 7 days
 * - bot_detections: delete rows older than 30 days
 */
async function cleanupOldData(db: D1Database): Promise<void> {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  try {
    const results = await db.batch([
      db.prepare(`DELETE FROM page_views WHERE entry_time < ?`).bind(thirtyDaysAgo),
      db.prepare(`DELETE FROM watch_sessions WHERE started_at < ?`).bind(ninetyDaysAgo),
      db.prepare(`DELETE FROM live_activity WHERE is_active = 0 AND last_heartbeat < ?`).bind(sevenDaysAgo),
      db.prepare(`DELETE FROM bot_detections WHERE created_at < ?`).bind(thirtyDaysAgo),
    ]);

    const changes = results.map(r => r.meta?.changes || 0);
    console.log(`[Cron] Cleanup: page_views=${changes[0]}, watch_sessions=${changes[1]}, live_activity=${changes[2]}, bot_detections=${changes[3]}`);
  } catch (error) {
    console.error('[Cron] Cleanup error:', error);
    // Don't throw - cleanup failure shouldn't fail the whole cron job
  }
}

/**
 * Main cron handler - called by Cloudflare Workers scheduled trigger
 * Aggregates metrics for the previous day
 * 
 * @param event Scheduled event from Cloudflare
 * @param env Environment bindings
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: Env
): Promise<void> {
  console.log(`[Cron] Scheduled event triggered at ${new Date(event.scheduledTime).toISOString()}`);

  try {
    // Calculate yesterday's date
    const yesterday = new Date(event.scheduledTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`[Cron] Aggregating metrics for ${dateStr}`);

    // Aggregate metrics for yesterday
    const metrics = await aggregateDailyMetrics(env.DB, dateStr);

    // Save to metrics_daily table
    await saveDailyMetrics(env.DB, metrics);

    // Cleanup old data to prevent unbounded table growth
    await cleanupOldData(env.DB);

    console.log(`[Cron] Successfully aggregated metrics for ${dateStr}`);
  } catch (error) {
    console.error('[Cron] Error aggregating metrics:', error);
    throw error; // Re-throw to mark the cron job as failed
  }
}
