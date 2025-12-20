-- Migration: Add server_hits and referrer_stats tables
-- Run this against your Neon PostgreSQL database

-- Server-side hit tracking (non-browser hits, bots, API calls)
CREATE TABLE IF NOT EXISTS server_hits (
  id TEXT PRIMARY KEY,
  page_path TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  source_type TEXT,
  source_name TEXT,
  is_bot BOOLEAN DEFAULT FALSE,
  referrer_full TEXT,
  referrer_domain TEXT,
  referrer_path TEXT,
  referrer_source TEXT,
  referrer_medium TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  timestamp BIGINT NOT NULL,
  created_at BIGINT
);

-- Aggregated referrer statistics
CREATE TABLE IF NOT EXISTS referrer_stats (
  referrer_domain TEXT PRIMARY KEY,
  hit_count INTEGER DEFAULT 0,
  last_hit BIGINT,
  referrer_medium TEXT,
  created_at BIGINT,
  updated_at BIGINT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_server_hits_timestamp ON server_hits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_server_hits_page ON server_hits(page_path);
CREATE INDEX IF NOT EXISTS idx_server_hits_source ON server_hits(source_type);
CREATE INDEX IF NOT EXISTS idx_server_hits_referrer ON server_hits(referrer_domain);
CREATE INDEX IF NOT EXISTS idx_referrer_stats_hits ON referrer_stats(hit_count DESC);

-- Verify tables were created
SELECT 'server_hits' as table_name, COUNT(*) as row_count FROM server_hits
UNION ALL
SELECT 'referrer_stats' as table_name, COUNT(*) as row_count FROM referrer_stats;
