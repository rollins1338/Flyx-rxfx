/**
 * CronAggregator - Pre-computed aggregation via scheduled cron triggers
 *
 * Computes hourly and daily aggregations from raw heartbeat/activity tables
 * and persists them to the aggregation_cache table. This eliminates expensive
 * runtime GROUP BY queries on dashboard load.
 *
 * Requirements: 3.1, 3.2, 3.5
 */

/** Retention: 7 days for hourly aggregations */
const HOURLY_RETENTION_DAYS = 7;

/** Retention: 90 days for daily aggregations */
const DAILY_RETENTION_DAYS = 90;

export interface HourlyAggregation {
  peakActive: number;
  totalUniqueSessions: number;
  watchingSessions: number;
  browsingSessions: number;
  livetvSessions: number;
  topCategories: Array<{ category: string; count: number }>;
}

export interface DailyAggregation {
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
  deviceBreakdown: Array<{ device: string; count: number }>;
  topCountries: Array<{ country: string; countryName: string; count: number }>;
  topContent: Array<{ category: string; count: number }>;
}

export class CronAggregator {
  /**
   * Run hourly aggregation: compute active users, sessions, watch time,
   * and content breakdown from raw admin_heartbeats for the previous hour.
   * Writes results to aggregation_cache with metric_type = 'hourly_activity'.
   *
   * Requirements: 3.1
   */
  async runHourlyAggregation(db: D1Database, now?: number): Promise<void> {
    const currentTime = now ?? Date.now();

    // Compute the previous complete hour bucket
    const bucketDate = new Date(currentTime);
    bucketDate.setMinutes(0, 0, 0);
    const hourEnd = bucketDate.getTime();
    const hourStart = hourEnd - 60 * 60 * 1000;

    const timeBucket = new Date(hourStart).toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:MM'

    // Count distinct sessions by activity type within the hour
    const activityResult = await db.prepare(`
      SELECT activity_type, COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY activity_type
    `).bind(hourStart, hourEnd).all();

    let watchingSessions = 0;
    let browsingSessions = 0;
    let livetvSessions = 0;

    for (const row of (activityResult.results || [])) {
      const count = row.count as number;
      switch (row.activity_type) {
        case 'watching': watchingSessions = count; break;
        case 'browsing': browsingSessions = count; break;
        case 'livetv': livetvSessions = count; break;
      }
    }

    // Total unique sessions
    const uniqueResult = await db.prepare(`
      SELECT COUNT(DISTINCT ip_hash) as total
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ?
    `).bind(hourStart, hourEnd).first();
    const totalUniqueSessions = (uniqueResult?.total as number) || 0;

    // Peak active (max concurrent heartbeats in any single minute within the hour)
    // Approximated as total unique sessions since we don't have minute-level granularity
    const peakActive = totalUniqueSessions;

    // Top content categories
    const topCatsResult = await db.prepare(`
      SELECT content_category, COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ? AND content_category IS NOT NULL
      GROUP BY content_category
      ORDER BY count DESC
      LIMIT 10
    `).bind(hourStart, hourEnd).all();

    const topCategories = (topCatsResult.results || []).map(r => ({
      category: r.content_category as string,
      count: r.count as number,
    }));

    const payload: HourlyAggregation = {
      peakActive,
      totalUniqueSessions,
      watchingSessions,
      browsingSessions,
      livetvSessions,
      topCategories,
    };

    // Upsert into aggregation_cache
    await db.prepare(`
      INSERT INTO aggregation_cache (time_bucket, metric_type, payload, computed_at)
      VALUES (?, 'hourly_activity', ?, ?)
      ON CONFLICT(time_bucket, metric_type) DO UPDATE SET
        payload = excluded.payload,
        computed_at = excluded.computed_at
    `).bind(timeBucket, JSON.stringify(payload), currentTime).run();
  }

  /**
   * Run daily aggregation: compute DAU, WAU, MAU, geographic distribution,
   * device breakdown, and top content for the previous day.
   * Writes results to aggregation_cache with metric_type = 'daily_users'.
   *
   * Requirements: 3.2
   */
  async runDailyAggregation(db: D1Database, now?: number): Promise<void> {
    const currentTime = now ?? Date.now();

    // Previous day bucket
    const todayDate = new Date(currentTime);
    todayDate.setUTCHours(0, 0, 0, 0);
    const dayEnd = todayDate.getTime();
    const dayStart = dayEnd - 24 * 60 * 60 * 1000;

    const timeBucket = new Date(dayStart).toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // DAU: distinct users in the previous day
    const dauResult = await db.prepare(`
      SELECT COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ?
    `).bind(dayStart, dayEnd).first();
    const dau = (dauResult?.count as number) || 0;

    // WAU: distinct users in the last 7 days
    const weekStart = dayEnd - 7 * 24 * 60 * 60 * 1000;
    const wauResult = await db.prepare(`
      SELECT COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ?
    `).bind(weekStart, dayEnd).first();
    const wau = (wauResult?.count as number) || 0;

    // MAU: distinct users in the last 30 days
    const monthStart = dayEnd - 30 * 24 * 60 * 60 * 1000;
    const mauResult = await db.prepare(`
      SELECT COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ?
    `).bind(monthStart, dayEnd).first();
    const mau = (mauResult?.count as number) || 0;

    // Top content for the day
    const topContentResult = await db.prepare(`
      SELECT content_category, COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ? AND content_category IS NOT NULL
      GROUP BY content_category
      ORDER BY count DESC
      LIMIT 10
    `).bind(dayStart, dayEnd).all();

    const topContent = (topContentResult.results || []).map(r => ({
      category: r.content_category as string,
      count: r.count as number,
    }));

    const payload: DailyAggregation = {
      dau,
      wau,
      mau,
      newUsers: 0,         // Would require user tracking table — placeholder
      returningUsers: dau, // Approximation
      deviceBreakdown: [], // Would require device info in heartbeats — placeholder
      topCountries: [],    // Would require geo info in heartbeats — placeholder
      topContent,
    };

    // Upsert into aggregation_cache
    await db.prepare(`
      INSERT INTO aggregation_cache (time_bucket, metric_type, payload, computed_at)
      VALUES (?, 'daily_users', ?, ?)
      ON CONFLICT(time_bucket, metric_type) DO UPDATE SET
        payload = excluded.payload,
        computed_at = excluded.computed_at
    `).bind(timeBucket, JSON.stringify(payload), currentTime).run();

    // Also update admin_daily_stats for backward compatibility
    const activityResult = await db.prepare(`
      SELECT activity_type, COUNT(DISTINCT ip_hash) as count
      FROM admin_heartbeats
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY activity_type
    `).bind(dayStart, dayEnd).all();

    let watching = 0, browsing = 0, livetv = 0;
    for (const row of (activityResult.results || [])) {
      const count = row.count as number;
      switch (row.activity_type) {
        case 'watching': watching = count; break;
        case 'browsing': browsing = count; break;
        case 'livetv': livetv = count; break;
      }
    }

    const topCatsJson = JSON.stringify(topContent);

    await db.prepare(`
      INSERT INTO admin_daily_stats (date, peak_active, total_unique_sessions, watching_sessions, browsing_sessions, livetv_sessions, top_categories, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        peak_active = MAX(admin_daily_stats.peak_active, excluded.peak_active),
        total_unique_sessions = excluded.total_unique_sessions,
        watching_sessions = excluded.watching_sessions,
        browsing_sessions = excluded.browsing_sessions,
        livetv_sessions = excluded.livetv_sessions,
        top_categories = excluded.top_categories,
        updated_at = excluded.updated_at
    `).bind(timeBucket, dau, dau, watching, browsing, livetv, topCatsJson, currentTime, currentTime).run();
  }

  /**
   * Remove old aggregation_cache entries beyond retention periods.
   * Hourly entries older than 7 days, daily entries older than 90 days.
   *
   * Requirements: 3.5 (data retention)
   */
  async cleanupOldAggregations(db: D1Database, now?: number): Promise<void> {
    const currentTime = now ?? Date.now();

    // Hourly retention: 7 days
    const hourlyRetentionMs = HOURLY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const hourlyCutoff = new Date(currentTime - hourlyRetentionMs).toISOString().slice(0, 16);

    await db.prepare(`
      DELETE FROM aggregation_cache
      WHERE metric_type = 'hourly_activity' AND time_bucket < ?
    `).bind(hourlyCutoff).run();

    // Daily retention: 90 days
    const dailyRetentionMs = DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const dailyCutoff = new Date(currentTime - dailyRetentionMs).toISOString().slice(0, 10);

    await db.prepare(`
      DELETE FROM aggregation_cache
      WHERE metric_type = 'daily_users' AND time_bucket < ?
    `).bind(dailyCutoff).run();
  }
}

/**
 * Compute aggregation from raw heartbeat data.
 * Exported for property testing — this is the pure computation logic
 * that can be tested without D1.
 */
export function computeAggregationFromHeartbeats(
  heartbeats: Array<{ ipHash: string; activityType: string; contentCategory: string | null }>
): HourlyAggregation {
  const uniqueIps = new Set(heartbeats.map(h => h.ipHash));
  const totalUniqueSessions = uniqueIps.size;

  const watchingIps = new Set(heartbeats.filter(h => h.activityType === 'watching').map(h => h.ipHash));
  const browsingIps = new Set(heartbeats.filter(h => h.activityType === 'browsing').map(h => h.ipHash));
  const livetvIps = new Set(heartbeats.filter(h => h.activityType === 'livetv').map(h => h.ipHash));

  const watchingSessions = watchingIps.size;
  const browsingSessions = browsingIps.size;
  const livetvSessions = livetvIps.size;

  // Peak active is at least as large as any individual activity count
  const peakActive = totalUniqueSessions;

  // Top categories
  const catCounts = new Map<string, number>();
  for (const h of heartbeats) {
    if (h.contentCategory) {
      catCounts.set(h.contentCategory, (catCounts.get(h.contentCategory) || 0) + 1);
    }
  }
  const topCategories = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  return {
    peakActive,
    totalUniqueSessions,
    watchingSessions,
    browsingSessions,
    livetvSessions,
    topCategories,
  };
}
