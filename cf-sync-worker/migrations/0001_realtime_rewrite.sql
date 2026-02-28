-- Migration: Admin Panel Real-Time Rewrite
-- Adds aggregation_cache, sse_state tables, new indexes, and hourly_breakdown column
-- Run: npx wrangler d1 execute flyx-sync-db --file=migrations/0001_realtime_rewrite.sql

-- =============================================================================
-- New table: aggregation_cache
-- Stores pre-computed hourly/daily aggregations to avoid runtime GROUP BY queries
-- Requirements: 8.1, 5.1
-- =============================================================================
CREATE TABLE IF NOT EXISTS aggregation_cache (
  time_bucket TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (time_bucket, metric_type)
);

-- =============================================================================
-- New table: sse_state
-- Tracks last broadcast state per SSE channel for delta computation
-- Requirements: 8.2
-- =============================================================================
CREATE TABLE IF NOT EXISTS sse_state (
  channel TEXT PRIMARY KEY,
  last_state TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- =============================================================================
-- New covering index on admin_heartbeats for efficient aggregation queries
-- Requirements: 8.3, 5.5
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_heartbeats_ts_type_cat
  ON admin_heartbeats(timestamp, activity_type, content_category);

-- =============================================================================
-- New index on aggregation_cache for metric_type + time_bucket lookups
-- Requirements: 5.1
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_agg_cache_type_bucket
  ON aggregation_cache(metric_type, time_bucket);

-- =============================================================================
-- Extend admin_daily_stats with hourly_breakdown column
-- Stores JSON array of per-hour activity breakdowns
-- Requirements: 8.4
-- Note: SQLite doesn't support ADD COLUMN IF NOT EXISTS, so this will error
-- if the column already exists (safe to ignore if schema.sql was applied first)
-- =============================================================================
-- ALTER TABLE admin_daily_stats ADD COLUMN hourly_breakdown TEXT;
-- ^ Commented out: column is now included in schema.sql for fresh deployments.
--   Only uncomment if migrating a database that was created before this column existed
--   and hasn't had schema.sql re-applied.
