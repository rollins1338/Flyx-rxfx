-- Flyx Sync Worker D1 Schema
-- Run: npx wrangler d1 execute flyx-sync-db --file=schema.sql

-- Table 1: Sync accounts (existing)
CREATE TABLE IF NOT EXISTS sync_accounts (
  id TEXT PRIMARY KEY,
  code_hash TEXT UNIQUE NOT NULL,
  sync_data TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_sync_at INTEGER NOT NULL,
  device_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sync_accounts_hash ON sync_accounts(code_hash);
CREATE INDEX IF NOT EXISTS idx_sync_accounts_updated ON sync_accounts(updated_at);

-- Table 2: Admin heartbeats (ephemeral — records deleted after 24h)
CREATE TABLE IF NOT EXISTS admin_heartbeats (
  ip_hash TEXT PRIMARY KEY,
  activity_type TEXT NOT NULL,
  content_category TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON admin_heartbeats(timestamp);

-- Covering index for efficient aggregation queries (timestamp + activity_type + content_category)
CREATE INDEX IF NOT EXISTS idx_heartbeats_ts_type_cat
  ON admin_heartbeats(timestamp, activity_type, content_category);

-- Table 3: Admin daily stats (aggregated — one row per day)
CREATE TABLE IF NOT EXISTS admin_daily_stats (
  date TEXT PRIMARY KEY,
  peak_active INTEGER DEFAULT 0,
  total_unique_sessions INTEGER DEFAULT 0,
  watching_sessions INTEGER DEFAULT 0,
  browsing_sessions INTEGER DEFAULT 0,
  livetv_sessions INTEGER DEFAULT 0,
  top_categories TEXT,  -- JSON array of {category, count}
  hourly_breakdown TEXT, -- JSON array of per-hour activity breakdowns
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Table 4: Aggregation cache (pre-computed hourly/daily stats)
CREATE TABLE IF NOT EXISTS aggregation_cache (
  time_bucket TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON blob with computed values
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (time_bucket, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_agg_cache_type_bucket
  ON aggregation_cache(metric_type, time_bucket);

-- Table 5: SSE state (last broadcast state per channel for delta computation)
CREATE TABLE IF NOT EXISTS sse_state (
  channel TEXT PRIMARY KEY,
  last_state TEXT NOT NULL,     -- JSON blob of last broadcast state
  sequence INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
