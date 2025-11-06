/**
 * Initialize Analytics Database
 * Run with: node scripts/init-analytics.js
 */

const path = require('path');
const fs = require('fs');
const { Database } = require('bun:sqlite');

// Database schema
const SCHEMA_VERSION = 1;

const CREATE_ANALYTICS_EVENTS_TABLE = `
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

const CREATE_METRICS_DAILY_TABLE = `
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

const CREATE_CONTENT_STATS_TABLE = `
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

const CREATE_ADMIN_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_login INTEGER
);

CREATE INDEX IF NOT EXISTS idx_username ON admin_users(username);
`;

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`;

const ALL_TABLES = [
  CREATE_MIGRATIONS_TABLE,
  CREATE_ANALYTICS_EVENTS_TABLE,
  CREATE_METRICS_DAILY_TABLE,
  CREATE_CONTENT_STATS_TABLE,
  CREATE_ADMIN_USERS_TABLE,
];

async function initializeDatabase() {
  try {
    // Ensure data directory exists
    const dbDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✓ Created database directory');
    }

    const dbPath = path.join(dbDir, 'analytics.db');
    const db = new Database(dbPath);

    console.log('🔧 Initializing analytics database...');

    // Enable WAL mode for better concurrency
    db.exec('PRAGMA journal_mode = WAL;');
    
    // Enable foreign keys
    db.exec('PRAGMA foreign_keys = ON;');
    
    // Set synchronous mode for better performance
    db.exec('PRAGMA synchronous = NORMAL;');
    
    // Set cache size (64MB)
    db.exec('PRAGMA cache_size = -64000;');

    // Create all tables
    for (const tableSQL of ALL_TABLES) {
      db.exec(tableSQL);
    }

    // Check and set schema version
    const existingVersion = db
      .query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')
      .get();

    if (!existingVersion) {
      db.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
        .run(SCHEMA_VERSION, 'initial_schema');
      console.log('✓ Schema version set to', SCHEMA_VERSION);
    }

    // Verify tables exist
    const tables = db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    console.log('✓ Database initialized successfully');
    console.log('📊 Created tables:', tables.map(t => t.name).join(', '));
    
    // Show database stats
    const stats = {
      path: dbPath,
      size: fs.statSync(dbPath).size,
      tables: tables.length,
    };

    console.log('\n📈 Database Statistics:');
    console.log(`   Path: ${stats.path}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   Tables: ${stats.tables}`);

    db.close();
    console.log('\n🎉 Analytics database is ready!');
    console.log('\nNext steps:');
    console.log('1. Create an admin user: npm run admin:create admin password');
    console.log('2. Start the application: npm run dev');
    console.log('3. Access admin panel at: /admin');

  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    process.exit(1);
  }
}

initializeDatabase();