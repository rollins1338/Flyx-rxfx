/**
 * Consolidated Stats API - Slice-based queries with cache routing
 *
 * Accepts a `slices` query param to return only requested data slices.
 * For completed time periods: reads from aggregation_cache.
 * For current incomplete period: combines cache with lightweight delta query.
 * Single consolidated query per slice.
 *
 * Requirements: 3.3, 3.4, 5.2, 5.3, 5.4
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid slice names that clients can request */
export const VALID_SLICES = ['realtime', 'content', 'users', 'geographic'] as const;
export type StatsSlice = (typeof VALID_SLICES)[number];

export interface StatsAPIResponse {
  success: boolean;
  slices: Record<string, unknown>;
  source: 'cache' | 'cache+delta' | 'live';
  timestamp: number;
}

/** Maps slice names to the metric_type values stored in aggregation_cache */
const SLICE_TO_METRIC_TYPE: Record<StatsSlice, string[]> = {
  realtime: ['hourly_activity'],
  content: ['hourly_activity', 'daily_users'],
  users: ['daily_users'],
  geographic: ['daily_users'],
};

// ---------------------------------------------------------------------------
// Cache routing helpers (exported for property testing)
// ---------------------------------------------------------------------------

/**
 * Get the current hour boundary as a timestamp.
 * Everything before this boundary is a "completed period" and should be served from cache.
 */
export function getCurrentHourBoundary(now?: number): number {
  const d = new Date(now ?? Date.now());
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

/**
 * Determine whether a time range falls entirely within completed periods.
 * A completed period is any time before the current hour boundary.
 *
 * Property 6: For any stats request with a time range that falls entirely
 * before the current hour boundary, the query should read exclusively from cache.
 */
export function isCompletedPeriod(rangeStart: number, rangeEnd: number, now?: number): boolean {
  const boundary = getCurrentHourBoundary(now);
  return rangeEnd <= boundary;
}

/**
 * Parse a range string like '24h', '7d', '30d' into a start timestamp.
 * Returns [rangeStart, rangeEnd] tuple.
 */
export function parseTimeRange(range: string, now?: number): [number, number] {
  const currentTime = now ?? Date.now();
  const rangeEnd = currentTime;

  const match = range.match(/^(\d+)([hdm])$/);
  if (!match) {
    // Default to 24h
    return [currentTime - 24 * 60 * 60 * 1000, rangeEnd];
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  let ms: number;
  switch (unit) {
    case 'h': ms = value * 60 * 60 * 1000; break;
    case 'd': ms = value * 24 * 60 * 60 * 1000; break;
    case 'm': ms = value * 30 * 24 * 60 * 60 * 1000; break;
    default: ms = 24 * 60 * 60 * 1000;
  }

  return [currentTime - ms, rangeEnd];
}

/**
 * Determine the query source for a given time range.
 * - 'cache': range falls entirely in completed periods
 * - 'cache+delta': range spans completed + current incomplete period
 * - 'live': no cache available (fallback)
 */
export function determineQuerySource(
  rangeStart: number,
  rangeEnd: number,
  hasCacheData: boolean,
  now?: number
): 'cache' | 'cache+delta' | 'live' {
  if (!hasCacheData) return 'live';
  if (isCompletedPeriod(rangeStart, rangeEnd, now)) return 'cache';
  return 'cache+delta';
}

// ---------------------------------------------------------------------------
// Slice query builders
// ---------------------------------------------------------------------------

/**
 * Fetch cached aggregation data for a set of metric types within a time range.
 * Returns entries from aggregation_cache, filtered by metric_type and time_bucket.
 */
async function fetchCachedSliceData(
  db: D1Database,
  metricTypes: string[],
  rangeStart: number,
  rangeEnd: number
): Promise<Array<{ timeBucket: string; metricType: string; payload: unknown; computedAt: number }>> {
  // Convert timestamps to time_bucket format for comparison
  const startBucket = new Date(rangeStart).toISOString().slice(0, 16);
  const endBucket = new Date(rangeEnd).toISOString().slice(0, 16);

  const placeholders = metricTypes.map(() => '?').join(',');
  const result = await db.prepare(`
    SELECT time_bucket, metric_type, payload, computed_at
    FROM aggregation_cache
    WHERE metric_type IN (${placeholders})
      AND time_bucket >= ?
      AND time_bucket <= ?
    ORDER BY time_bucket DESC
    LIMIT 200
  `).bind(...metricTypes, startBucket, endBucket).all();

  return (result.results || []).map(row => ({
    timeBucket: row.time_bucket as string,
    metricType: row.metric_type as string,
    payload: JSON.parse(row.payload as string),
    computedAt: row.computed_at as number,
  }));
}

/**
 * Fetch a lightweight delta from raw heartbeat data for the current incomplete period.
 * Only queries from the hour boundary to now, keeping the scan minimal.
 * Requirements: 3.4, 5.4
 */
async function fetchCurrentPeriodDelta(
  db: D1Database,
  slice: StatsSlice,
  hourBoundary: number
): Promise<Record<string, unknown>> {
  const now = Date.now();

  switch (slice) {
    case 'realtime': {
      // Live activity counts from current incomplete hour
      const result = await db.prepare(`
        SELECT activity_type, COUNT(DISTINCT ip_hash) as count
        FROM admin_heartbeats
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY activity_type
        LIMIT 10
      `).bind(hourBoundary, now).all();

      let watching = 0, browsing = 0, livetv = 0;
      for (const row of (result.results || [])) {
        const count = row.count as number;
        switch (row.activity_type) {
          case 'watching': watching = count; break;
          case 'browsing': browsing = count; break;
          case 'livetv': livetv = count; break;
        }
      }

      const uniqueResult = await db.prepare(`
        SELECT COUNT(DISTINCT ip_hash) as total
        FROM admin_heartbeats
        WHERE timestamp >= ? AND timestamp <= ?
        LIMIT 1
      `).bind(hourBoundary, now).first();

      return {
        currentPeriodActive: (uniqueResult?.total as number) || 0,
        currentPeriodWatching: watching,
        currentPeriodBrowsing: browsing,
        currentPeriodLivetv: livetv,
      };
    }

    case 'content': {
      const result = await db.prepare(`
        SELECT content_category, COUNT(DISTINCT ip_hash) as count
        FROM admin_heartbeats
        WHERE timestamp >= ? AND timestamp <= ? AND content_category IS NOT NULL
        GROUP BY content_category
        ORDER BY count DESC
        LIMIT 10
      `).bind(hourBoundary, now).all();

      return {
        currentPeriodTopContent: (result.results || []).map(r => ({
          category: r.content_category as string,
          count: r.count as number,
        })),
      };
    }

    case 'users': {
      const result = await db.prepare(`
        SELECT COUNT(DISTINCT ip_hash) as count
        FROM admin_heartbeats
        WHERE timestamp >= ? AND timestamp <= ?
        LIMIT 1
      `).bind(hourBoundary, now).first();

      return {
        currentPeriodActiveUsers: (result?.count as number) || 0,
      };
    }

    case 'geographic': {
      // No geographic data in heartbeats currently — return empty delta
      return {};
    }

    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Handle consolidated /admin/stats requests.
 * Accepts `slices` and `range` query params.
 *
 * Requirements: 3.3, 3.4, 5.2, 5.3, 5.4
 */
export async function handleConsolidatedStats(
  request: Request,
  db: D1Database
): Promise<StatsAPIResponse> {
  const url = new URL(request.url);
  const requestedSlices = parseSlices(url.searchParams.get('slices'));
  const range = url.searchParams.get('range') || '24h';
  const now = Date.now();

  const [rangeStart, rangeEnd] = parseTimeRange(range, now);
  const hourBoundary = getCurrentHourBoundary(now);

  const responseSlices: Record<string, unknown> = {};
  let overallSource: 'cache' | 'cache+delta' | 'live' = 'cache';

  for (const slice of requestedSlices) {
    const metricTypes = SLICE_TO_METRIC_TYPE[slice];
    if (!metricTypes) continue;

    try {
      // Fetch cached data for this slice
      const cachedData = await fetchCachedSliceData(db, metricTypes, rangeStart, rangeEnd);
      const hasCacheData = cachedData.length > 0;
      const source = determineQuerySource(rangeStart, rangeEnd, hasCacheData, now);

      if (source === 'live') {
        // No cache — fall back to legacy query
        const legacyData = await fetchLegacySliceData(db, slice, rangeStart, rangeEnd);
        responseSlices[slice] = legacyData;
        overallSource = 'live';
      } else if (source === 'cache') {
        // Completed period — serve entirely from cache
        responseSlices[slice] = groupCachedData(cachedData);
      } else {
        // cache+delta — combine cache with current period delta
        const delta = await fetchCurrentPeriodDelta(db, slice, hourBoundary);
        responseSlices[slice] = {
          cached: groupCachedData(cachedData),
          currentPeriod: delta,
        };
        if (overallSource === 'cache') overallSource = 'cache+delta';
      }
    } catch (err) {
      console.error(`[Stats API] Error fetching slice "${slice}":`, err);
      // On error, try legacy fallback for this slice
      try {
        const legacyData = await fetchLegacySliceData(db, slice, rangeStart, rangeEnd);
        responseSlices[slice] = legacyData;
        overallSource = 'live';
      } catch {
        responseSlices[slice] = { error: 'Failed to fetch data' };
      }
    }
  }

  return {
    success: true,
    slices: responseSlices,
    source: overallSource,
    timestamp: now,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the `slices` query param into an array of valid slice names.
 * If empty or invalid, returns all valid slices.
 */
export function parseSlices(slicesParam: string | null): StatsSlice[] {
  if (!slicesParam) return [...VALID_SLICES];

  const requested = slicesParam.split(',').map(s => s.trim()) as StatsSlice[];
  const valid = requested.filter(s => VALID_SLICES.includes(s));
  return valid.length > 0 ? valid : [...VALID_SLICES];
}

/**
 * Group cached aggregation entries by metric type.
 */
function groupCachedData(
  entries: Array<{ timeBucket: string; metricType: string; payload: unknown; computedAt: number }>
): Record<string, unknown[]> {
  const grouped: Record<string, unknown[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.metricType]) grouped[entry.metricType] = [];
    grouped[entry.metricType].push({
      timeBucket: entry.timeBucket,
      ...entry.payload as Record<string, unknown>,
      computedAt: entry.computedAt,
    });
  }
  return grouped;
}

/**
 * Legacy fallback: read from admin_daily_stats when aggregation_cache is empty.
 */
async function fetchLegacySliceData(
  db: D1Database,
  slice: StatsSlice,
  rangeStart: number,
  rangeEnd: number
): Promise<unknown> {
  const startDate = new Date(rangeStart).toISOString().slice(0, 10);
  const endDate = new Date(rangeEnd).toISOString().slice(0, 10);

  const result = await db.prepare(`
    SELECT * FROM admin_daily_stats
    WHERE date >= ? AND date <= ?
    ORDER BY date DESC
    LIMIT 90
  `).bind(startDate, endDate).all();

  return result.results || [];
}
