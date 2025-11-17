/**
 * Neon Serverless Database Connection
 * Uses Neon PostgreSQL for production and SQLite for local development
 */

import { neon } from '@neondatabase/serverless';
import * as path from 'path';
import * as fs from 'fs';

// Database interface for consistent API
interface DatabaseAdapter {
  query(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<any>;
  close(): void;
}

// Neon PostgreSQL adapter
class NeonAdapter implements DatabaseAdapter {
  private sql: any;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  private createTemplateString(sql: string): any {
    // Create a proper template literal for Neon
    const templateStrings = [sql];
    (templateStrings as any).raw = [sql];
    return templateStrings;
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (params.length === 0) {
      // For DDL statements without parameters, use template literal
      const templateStrings = this.createTemplateString(sql);
      return await this.sql(templateStrings);
    }
    // Use neon's query method for parameterized queries
    return await this.sql.query(sql, params);
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (params.length === 0) {
      // For DDL statements without parameters, use template literal
      const templateStrings = this.createTemplateString(sql);
      return await this.sql(templateStrings);
    }
    // Use neon's query method for parameterized queries
    const result = await this.sql.query(sql, params);
    return result;
  }

  close(): void {
    // Neon connections are automatically managed
  }
}

// SQLite adapter for local development
class SQLiteAdapter implements DatabaseAdapter {
  private db: any;

  constructor(dbPath: string) {
    // Dynamic import based on runtime
    let Database: any;
    if (typeof Bun !== 'undefined') {
      const { Database: BunDatabase } = require('bun:sqlite');
      Database = BunDatabase;
    } else {
      Database = require('better-sqlite3');
    }
    
    this.db = new Database(dbPath);
    
    // Configure SQLite
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  close(): void {
    this.db.close();
  }
}

class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private adapter: DatabaseAdapter | null = null;
  private isInitialized = false;
  private isNeon = false;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized && this.adapter) {
      return;
    }

    try {
      // Check for Neon connection string
      const neonConnectionString = process.env.DATABASE_URL;
      

      
      if (neonConnectionString && neonConnectionString.includes('neon.tech')) {
        // Use Neon for production
        console.log('Initializing Neon PostgreSQL connection...');
        this.adapter = new NeonAdapter(neonConnectionString);
        this.isNeon = true;
        
        // Create PostgreSQL tables
        await this.createPostgreSQLTables();
        
        console.log('✓ Neon PostgreSQL database initialized successfully');
      } else {
        // Use SQLite for local development
        console.log('Initializing SQLite for local development...');
        const dbDir = path.join(process.cwd(), 'data');
        
        try {
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
          }
        } catch (error) {
          console.warn('Cannot create data directory, using in-memory SQLite');
        }
        
        const dbPath = fs.existsSync(dbDir) 
          ? path.join(dbDir, 'analytics.db')
          : ':memory:';
          
        this.adapter = new SQLiteAdapter(dbPath);
        this.isNeon = false;
        
        // Create SQLite tables
        await this.createSQLiteTables();
        
        console.log('✓ SQLite database initialized successfully');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  private async createPostgreSQLTables(): Promise<void> {
    if (!this.adapter) throw new Error('Database adapter not initialized');

    const tables = [
      // Schema migrations table
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at BIGINT
      )`,
      
      // Analytics events table
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        event_type TEXT NOT NULL,
        metadata JSONB NOT NULL,
        created_at BIGINT
      )`,
      
      // Content stats table
      `CREATE TABLE IF NOT EXISTS content_stats (
        content_id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        completion_rate REAL DEFAULT 0,
        avg_watch_time REAL DEFAULT 0,
        last_viewed BIGINT,
        updated_at BIGINT
      )`,
      
      // Admin users table
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT,
        last_login BIGINT
      )`,
      
      // Daily metrics table
      `CREATE TABLE IF NOT EXISTS metrics_daily (
        date TEXT PRIMARY KEY,
        total_views INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        unique_sessions INTEGER DEFAULT 0,
        avg_session_duration REAL DEFAULT 0,
        top_content TEXT,
        updated_at BIGINT
      )`,
      
      // Watch sessions table - detailed tracking
      `CREATE TABLE IF NOT EXISTS watch_sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_title TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        started_at BIGINT NOT NULL,
        ended_at BIGINT,
        total_watch_time INTEGER DEFAULT 0,
        last_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        completion_percentage REAL DEFAULT 0,
        quality TEXT,
        device_type TEXT,
        is_completed BOOLEAN DEFAULT FALSE,
        pause_count INTEGER DEFAULT 0,
        seek_count INTEGER DEFAULT 0,
        created_at BIGINT,
        updated_at BIGINT
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_type ON content_stats(content_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_views ON content_stats(view_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_content ON watch_sessions(content_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_started ON watch_sessions(started_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_session ON watch_sessions(session_id)'
    ];

    for (const table of tables) {
      await this.adapter.execute(table);
    }

    for (const index of indexes) {
      await this.adapter.execute(index);
    }

    // Insert initial schema version if not exists
    const existingVersion = await this.adapter.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
    );
    
    if (existingVersion.length === 0) {
      await this.adapter.execute(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [1, 'initial_schema']
      );
    }
  }

  private async createSQLiteTables(): Promise<void> {
    if (!this.adapter) throw new Error('Database adapter not initialized');

    const tables = [
      // Schema migrations table
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      
      // Analytics events table
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      
      // Content stats table
      `CREATE TABLE IF NOT EXISTS content_stats (
        content_id TEXT PRIMARY KEY,
        content_type TEXT NOT NULL,
        view_count INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        completion_rate REAL DEFAULT 0,
        avg_watch_time REAL DEFAULT 0,
        last_viewed INTEGER,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      
      // Admin users table
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_login INTEGER
      )`,
      
      // Daily metrics table
      `CREATE TABLE IF NOT EXISTS metrics_daily (
        date TEXT PRIMARY KEY,
        total_views INTEGER DEFAULT 0,
        total_watch_time INTEGER DEFAULT 0,
        unique_sessions INTEGER DEFAULT 0,
        avg_session_duration REAL DEFAULT 0,
        top_content TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      
      // Watch sessions table - detailed tracking
      `CREATE TABLE IF NOT EXISTS watch_sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_title TEXT,
        season_number INTEGER,
        episode_number INTEGER,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        total_watch_time INTEGER DEFAULT 0,
        last_position INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        completion_percentage REAL DEFAULT 0,
        quality TEXT,
        device_type TEXT,
        is_completed INTEGER DEFAULT 0,
        pause_count INTEGER DEFAULT 0,
        seek_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_analytics_session_id ON analytics_events(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_type ON content_stats(content_type)',
      'CREATE INDEX IF NOT EXISTS idx_content_stats_views ON content_stats(view_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_user ON watch_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_content ON watch_sessions(content_id)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_started ON watch_sessions(started_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_watch_sessions_session ON watch_sessions(session_id)'
    ];

    for (const table of tables) {
      await this.adapter.execute(table);
    }

    for (const index of indexes) {
      await this.adapter.execute(index);
    }

    // Insert initial schema version if not exists
    const existingVersion = await this.adapter.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
    );
    
    if (existingVersion.length === 0) {
      await this.adapter.execute(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        [1, 'initial_schema']
      );
    }
  }

  getAdapter(): DatabaseAdapter {
    if (!this.adapter || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  isUsingNeon(): boolean {
    return this.isNeon;
  }

  async insertAnalyticsEvent(event: {
    id: string;
    sessionId: string;
    timestamp: number;
    eventType: string;
    metadata: any;
  }): Promise<void> {
    const adapter = this.getAdapter();
    
    if (this.isNeon) {
      await adapter.execute(
        'INSERT INTO analytics_events (id, session_id, timestamp, event_type, metadata) VALUES ($1, $2, $3, $4, $5)',
        [event.id, event.sessionId, event.timestamp, event.eventType, JSON.stringify(event.metadata)]
      );
    } else {
      await adapter.execute(
        'INSERT INTO analytics_events (id, session_id, timestamp, event_type, metadata) VALUES (?, ?, ?, ?, ?)',
        [event.id, event.sessionId, event.timestamp, event.eventType, JSON.stringify(event.metadata)]
      );
    }
  }

  async getAnalyticsOverview(startTime: number, endTime: number): Promise<any> {
    const adapter = this.getAdapter();
    
    if (this.isNeon) {
      const [views, watchTime, sessions] = await Promise.all([
        adapter.query(
          "SELECT COUNT(*) as count FROM analytics_events WHERE timestamp BETWEEN $1 AND $2 AND event_type = 'content_view'",
          [startTime, endTime]
        ),
        adapter.query(
          "SELECT SUM(CAST(metadata->>'watch_time' AS INTEGER)) as total FROM analytics_events WHERE timestamp BETWEEN $1 AND $2 AND event_type = 'watch_progress' AND metadata->>'watch_time' IS NOT NULL",
          [startTime, endTime]
        ),
        adapter.query(
          'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp BETWEEN $1 AND $2',
          [startTime, endTime]
        )
      ]);

      return {
        totalViews: views[0]?.count || 0,
        totalWatchTime: Math.round((watchTime[0]?.total || 0) / 60),
        uniqueSessions: sessions[0]?.count || 0,
        avgSessionDuration: 0 // Calculate separately if needed
      };
    } else {
      const [views, watchTime, sessions] = await Promise.all([
        adapter.query(
          "SELECT COUNT(*) as count FROM analytics_events WHERE timestamp BETWEEN ? AND ? AND event_type = 'content_view'",
          [startTime, endTime]
        ),
        adapter.query(
          "SELECT SUM(CAST(JSON_EXTRACT(metadata, '$.watch_time') AS INTEGER)) as total FROM analytics_events WHERE timestamp BETWEEN ? AND ? AND event_type = 'watch_progress' AND JSON_EXTRACT(metadata, '$.watch_time') IS NOT NULL",
          [startTime, endTime]
        ),
        adapter.query(
          'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE timestamp BETWEEN ? AND ?',
          [startTime, endTime]
        )
      ]);

      return {
        totalViews: views[0]?.count || 0,
        totalWatchTime: Math.round((watchTime[0]?.total || 0) / 60),
        uniqueSessions: sessions[0]?.count || 0,
        avgSessionDuration: 0 // Calculate separately if needed
      };
    }
  }

  async upsertWatchSession(session: {
    id: string;
    sessionId: string;
    userId: string;
    contentId: string;
    contentType: string;
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    startedAt: number;
    endedAt?: number;
    totalWatchTime: number;
    lastPosition: number;
    duration: number;
    completionPercentage: number;
    quality?: string;
    deviceType?: string;
    isCompleted: boolean;
    pauseCount: number;
    seekCount: number;
  }): Promise<void> {
    const adapter = this.getAdapter();
    const now = Date.now();
    
    if (this.isNeon) {
      await adapter.execute(`
        INSERT INTO watch_sessions (
          id, session_id, user_id, content_id, content_type, content_title,
          season_number, episode_number, started_at, ended_at, total_watch_time,
          last_position, duration, completion_percentage, quality, device_type,
          is_completed, pause_count, seek_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT(id) DO UPDATE SET
          ended_at = $22,
          total_watch_time = $23,
          last_position = $24,
          completion_percentage = $25,
          is_completed = $26,
          pause_count = $27,
          seek_count = $28,
          updated_at = $29
      `, [
        session.id, session.sessionId, session.userId, session.contentId, session.contentType,
        session.contentTitle || null, session.seasonNumber || null, session.episodeNumber || null,
        session.startedAt, session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.duration, session.completionPercentage, session.quality || null, session.deviceType || null,
        session.isCompleted, session.pauseCount, session.seekCount, now, now,
        // Update values
        session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.completionPercentage, session.isCompleted, session.pauseCount, session.seekCount, now
      ]);
    } else {
      await adapter.execute(`
        INSERT INTO watch_sessions (
          id, session_id, user_id, content_id, content_type, content_title,
          season_number, episode_number, started_at, ended_at, total_watch_time,
          last_position, duration, completion_percentage, quality, device_type,
          is_completed, pause_count, seek_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ended_at = ?,
          total_watch_time = ?,
          last_position = ?,
          completion_percentage = ?,
          is_completed = ?,
          pause_count = ?,
          seek_count = ?,
          updated_at = ?
      `, [
        session.id, session.sessionId, session.userId, session.contentId, session.contentType,
        session.contentTitle || null, session.seasonNumber || null, session.episodeNumber || null,
        session.startedAt, session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.duration, session.completionPercentage, session.quality || null, session.deviceType || null,
        session.isCompleted ? 1 : 0, session.pauseCount, session.seekCount, now, now,
        // Update values
        session.endedAt || null, session.totalWatchTime, session.lastPosition,
        session.completionPercentage, session.isCompleted ? 1 : 0, session.pauseCount, session.seekCount, now
      ]);
    }
  }

  async getWatchSessions(filters?: {
    userId?: string;
    contentId?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
  }): Promise<any[]> {
    const adapter = this.getAdapter();
    let query = 'SELECT * FROM watch_sessions WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      query += this.isNeon ? ` AND user_id = $${paramIndex++}` : ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters?.contentId) {
      query += this.isNeon ? ` AND content_id = $${paramIndex++}` : ' AND content_id = ?';
      params.push(filters.contentId);
    }

    if (filters?.startDate) {
      query += this.isNeon ? ` AND started_at >= $${paramIndex++}` : ' AND started_at >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += this.isNeon ? ` AND started_at <= $${paramIndex++}` : ' AND started_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY started_at DESC';

    if (filters?.limit) {
      query += this.isNeon ? ` LIMIT $${paramIndex++}` : ' LIMIT ?';
      params.push(filters.limit);
    }

    return await adapter.query(query, params);
  }

  close(): void {
    if (this.adapter) {
      this.adapter.close();
      this.adapter = null;
      this.isInitialized = false;
      DatabaseConnection.instance = null;
      console.log('✓ Database connection closed');
    }
  }
}

// Export singleton instance
let dbInstance: DatabaseConnection | null = null;

export const initializeDB = async () => {
  if (!dbInstance) {
    dbInstance = DatabaseConnection.getInstance();
    await dbInstance.initialize();
  }
  return dbInstance;
};

export const getDB = () => {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDB() first.');
  }
  return dbInstance;
};

export { DatabaseConnection };