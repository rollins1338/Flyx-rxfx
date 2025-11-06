/**
 * Database Schema Definitions
 * SQLite schema for analytics, metrics, and admin data
 */

export const SCHEMA_VERSION = 1;

/**
 * Analytics Events Table
 * Stores all user interaction events
 */
export const CREATE_ANALYTICS_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_type ON analytics_events(event_type);
`;

/**
 * Aggregated Metrics Table
 * Pre-computed daily metrics for faster dashboard queries
 */
export const CREATE_METRICS_DAILY_TABLE = `
CREATE TABLE IF NOT EXISTS metrics_daily (
  date TEXT PRIMARY KEY,
  total_views INTEGER DEFAULT 0,
  total_watch_time INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  avg_session_duration REAL DEFAULT 0,
  top_content TEXT,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`;

/**
 * Content Statistics Table
 * Aggregated stats per content item
 */
export const CREATE_CONTENT_STATS_TABLE = `
CREATE TABLE IF NOT EXISTS content_stats (
  content_id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  view_count INTEGER DEFAULT 0,
  total_watch_time INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0,
  avg_watch_time REAL DEFAULT 0,
  last_viewed INTEGER,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_content_type ON content_stats(content_type);
CREATE INDEX IF NOT EXISTS idx_view_count ON content_stats(view_count DESC);
`;

/**
 * Search Queries Table
 * Tracks search queries for popular searches analytics
 */
export const CREATE_SEARCH_QUERIES_TABLE = `
CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  session_id TEXT,
  results_count INTEGER DEFAULT 0,
  clicked_result BOOLEAN DEFAULT FALSE,
  timestamp INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_normalized_query ON search_queries(normalized_query);
CREATE INDEX IF NOT EXISTS idx_timestamp_search ON search_queries(timestamp);
CREATE INDEX IF NOT EXISTS idx_clicked_result ON search_queries(clicked_result);
`;

/**
 * Popular Searches Table
 * Aggregated popular search terms with counts
 */
export const CREATE_POPULAR_SEARCHES_TABLE = `
CREATE TABLE IF NOT EXISTS popular_searches (
  normalized_query TEXT PRIMARY KEY,
  display_query TEXT NOT NULL,
  search_count INTEGER DEFAULT 1,
  click_count INTEGER DEFAULT 0,
  last_searched INTEGER NOT NULL,
  trending_score REAL DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_search_count ON popular_searches(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_trending_score ON popular_searches(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_last_searched ON popular_searches(last_searched DESC);
`;

/**
 * Admin Users Table
 * Stores admin credentials and login info
 */
export const CREATE_ADMIN_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_login INTEGER
);

CREATE INDEX IF NOT EXISTS idx_username ON admin_users(username);
`;

/**
 * Schema Migrations Table
 * Tracks applied database migrations
 */
export const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`;

/**
 * All table creation statements in order
 */
export const ALL_TABLES = [
  CREATE_MIGRATIONS_TABLE,
  CREATE_ANALYTICS_EVENTS_TABLE,
  CREATE_METRICS_DAILY_TABLE,
  CREATE_CONTENT_STATS_TABLE,
  CREATE_SEARCH_QUERIES_TABLE,
  CREATE_POPULAR_SEARCHES_TABLE,
  CREATE_ADMIN_USERS_TABLE,
];

/**
 * Table names for reference
 */
export const TABLES = {
  ANALYTICS_EVENTS: 'analytics_events',
  METRICS_DAILY: 'metrics_daily',
  CONTENT_STATS: 'content_stats',
  SEARCH_QUERIES: 'search_queries',
  POPULAR_SEARCHES: 'popular_searches',
  ADMIN_USERS: 'admin_users',
  SCHEMA_MIGRATIONS: 'schema_migrations',
} as const;
