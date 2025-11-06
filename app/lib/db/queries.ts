/**
 * Database Query Functions
 * CRUD operations for all tables
 */

import { getDB } from './connection';
import { TABLES } from './schema';
import type {
  AnalyticsEvent,
  MetricsData,
  ContentStats,
} from '../../types/analytics';

/**
 * Analytics Events Queries
 */
export class AnalyticsQueries {
  /**
   * Insert a new analytics event
   */
  static insertEvent(event: AnalyticsEvent): void {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO ${TABLES.ANALYTICS_EVENTS} 
      (id, session_id, timestamp, event_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.id,
      event.sessionId,
      event.timestamp,
      event.eventType,
      JSON.stringify(event.metadata)
    );
  }

  /**
   * Batch insert multiple events (more efficient)
   */
  static insertEventsBatch(events: AnalyticsEvent[]): void {
    const db = getDB();
    
    const insertTransaction = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO ${TABLES.ANALYTICS_EVENTS} 
        (id, session_id, timestamp, event_type, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const event of events) {
        stmt.run(
          event.id,
          event.sessionId,
          event.timestamp,
          event.eventType,
          JSON.stringify(event.metadata)
        );
      }
    });
    
    insertTransaction();
  }

  /**
   * Get events by session ID
   */
  static getEventsBySession(sessionId: string): AnalyticsEvent[] {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.ANALYTICS_EVENTS}
      WHERE session_id = ?
      ORDER BY timestamp DESC
    `);
    
    const rows = stmt.all(sessionId) as any[];
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      metadata: JSON.parse(row.metadata),
    }));
  }

  /**
   * Get events by type within time range
   */
  static getEventsByType(
    eventType: string,
    startTime: number,
    endTime: number
  ): AnalyticsEvent[] {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.ANALYTICS_EVENTS}
      WHERE event_type = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `);
    
    const rows = stmt.all(eventType, startTime, endTime) as any[];
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      metadata: JSON.parse(row.metadata),
    }));
  }

  /**
   * Get events within time range
   */
  static getEventsByTimeRange(startTime: number, endTime: number): AnalyticsEvent[] {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.ANALYTICS_EVENTS}
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `);
    
    const rows = stmt.all(startTime, endTime) as any[];
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      metadata: JSON.parse(row.metadata),
    }));
  }

  /**
   * Delete old events (for data retention)
   */
  static deleteOldEvents(beforeTimestamp: number): number {
    const db = getDB();
    const stmt = db.prepare(`
      DELETE FROM ${TABLES.ANALYTICS_EVENTS}
      WHERE timestamp < ?
    `);
    
    const result = stmt.run(beforeTimestamp);
    return result.changes;
  }

  /**
   * Get event count by type
   */
  static getEventCountByType(startTime: number, endTime: number): Record<string, number> {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM ${TABLES.ANALYTICS_EVENTS}
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY event_type
    `);
    
    const rows = stmt.all(startTime, endTime) as any[];
    return rows.reduce((acc, row) => {
      acc[row.event_type] = row.count;
      return acc;
    }, {} as Record<string, number>);
  }
}

/**
 * Metrics Daily Queries
 */
export class MetricsQueries {
  /**
   * Insert or update daily metrics
   */
  static upsertDailyMetrics(metrics: MetricsData): void {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO ${TABLES.METRICS_DAILY} 
      (date, total_views, total_watch_time, unique_sessions, avg_session_duration, top_content)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_views = excluded.total_views,
        total_watch_time = excluded.total_watch_time,
        unique_sessions = excluded.unique_sessions,
        avg_session_duration = excluded.avg_session_duration,
        top_content = excluded.top_content,
        updated_at = strftime('%s', 'now')
    `);
    
    stmt.run(
      metrics.date,
      metrics.totalViews,
      metrics.totalWatchTime,
      metrics.uniqueSessions,
      metrics.avgSessionDuration,
      metrics.topContent
    );
  }

  /**
   * Get daily metrics for a specific date
   */
  static getDailyMetrics(date: string): MetricsData | null {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.METRICS_DAILY}
      WHERE date = ?
    `);
    
    const row = stmt.get(date) as any;
    if (!row) return null;
    
    return {
      date: row.date,
      totalViews: row.total_views,
      totalWatchTime: row.total_watch_time,
      uniqueSessions: row.unique_sessions,
      avgSessionDuration: row.avg_session_duration,
      topContent: row.top_content,
    };
  }

  /**
   * Get metrics for date range
   */
  static getMetricsRange(startDate: string, endDate: string): MetricsData[] {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.METRICS_DAILY}
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC
    `);
    
    const rows = stmt.all(startDate, endDate) as any[];
    return rows.map(row => ({
      date: row.date,
      totalViews: row.total_views,
      totalWatchTime: row.total_watch_time,
      uniqueSessions: row.unique_sessions,
      avgSessionDuration: row.avg_session_duration,
      topContent: row.top_content,
    }));
  }

  /**
   * Get aggregated metrics for date range
   */
  static getAggregatedMetrics(startDate: string, endDate: string): {
    totalViews: number;
    totalWatchTime: number;
    uniqueSessions: number;
    avgSessionDuration: number;
  } {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT 
        SUM(total_views) as total_views,
        SUM(total_watch_time) as total_watch_time,
        SUM(unique_sessions) as unique_sessions,
        AVG(avg_session_duration) as avg_session_duration
      FROM ${TABLES.METRICS_DAILY}
      WHERE date BETWEEN ? AND ?
    `);
    
    const row = stmt.get(startDate, endDate) as any;
    return {
      totalViews: row.total_views || 0,
      totalWatchTime: row.total_watch_time || 0,
      uniqueSessions: row.unique_sessions || 0,
      avgSessionDuration: row.avg_session_duration || 0,
    };
  }
}

/**
 * Content Stats Queries
 */
export class ContentStatsQueries {
  /**
   * Insert or update content stats
   */
  static upsertContentStats(stats: ContentStats): void {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO ${TABLES.CONTENT_STATS}
      (content_id, content_type, view_count, total_watch_time, completion_rate, avg_watch_time, last_viewed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_id) DO UPDATE SET
        view_count = excluded.view_count,
        total_watch_time = excluded.total_watch_time,
        completion_rate = excluded.completion_rate,
        avg_watch_time = excluded.avg_watch_time,
        last_viewed = excluded.last_viewed,
        updated_at = strftime('%s', 'now')
    `);
    
    stmt.run(
      stats.contentId,
      stats.contentType,
      stats.viewCount,
      stats.totalWatchTime,
      stats.completionRate,
      stats.avgWatchTime,
      stats.lastViewed
    );
  }

  /**
   * Get stats for specific content
   */
  static getContentStats(contentId: string): ContentStats | null {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.CONTENT_STATS}
      WHERE content_id = ?
    `);
    
    const row = stmt.get(contentId) as any;
    if (!row) return null;
    
    return {
      contentId: row.content_id,
      contentType: row.content_type,
      viewCount: row.view_count,
      totalWatchTime: row.total_watch_time,
      completionRate: row.completion_rate,
      avgWatchTime: row.avg_watch_time,
      lastViewed: row.last_viewed,
    };
  }

  /**
   * Get top content by view count
   */
  static getTopContent(limit: number = 10, contentType?: 'movie' | 'tv'): ContentStats[] {
    const db = getDB();
    
    let query = `
      SELECT * FROM ${TABLES.CONTENT_STATS}
    `;
    
    const params: any[] = [];
    if (contentType) {
      query += ' WHERE content_type = ?';
      params.push(contentType);
    }
    
    query += ' ORDER BY view_count DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => ({
      contentId: row.content_id,
      contentType: row.content_type,
      viewCount: row.view_count,
      totalWatchTime: row.total_watch_time,
      completionRate: row.completion_rate,
      avgWatchTime: row.avg_watch_time,
      lastViewed: row.last_viewed,
    }));
  }

  /**
   * Increment view count for content
   */
  static incrementViewCount(contentId: string, contentType: 'movie' | 'tv'): void {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO ${TABLES.CONTENT_STATS}
      (content_id, content_type, view_count, last_viewed)
      VALUES (?, ?, 1, strftime('%s', 'now'))
      ON CONFLICT(content_id) DO UPDATE SET
        view_count = view_count + 1,
        last_viewed = strftime('%s', 'now'),
        updated_at = strftime('%s', 'now')
    `);
    
    stmt.run(contentId, contentType);
  }

  /**
   * Update watch time for content
   */
  static updateWatchTime(
    contentId: string,
    watchTime: number,
    completed: boolean
  ): void {
    const db = getDB();
    
    // Get current stats
    const current = this.getContentStats(contentId);
    
    if (current) {
      const newTotalWatchTime = current.totalWatchTime + watchTime;
      const newAvgWatchTime = newTotalWatchTime / current.viewCount;
      
      // Update completion rate if completed
      let newCompletionRate = current.completionRate;
      if (completed) {
        const completedViews = Math.round(current.viewCount * current.completionRate) + 1;
        newCompletionRate = completedViews / current.viewCount;
      }
      
      const stmt = db.prepare(`
        UPDATE ${TABLES.CONTENT_STATS}
        SET 
          total_watch_time = ?,
          avg_watch_time = ?,
          completion_rate = ?,
          updated_at = strftime('%s', 'now')
        WHERE content_id = ?
      `);
      
      stmt.run(newTotalWatchTime, newAvgWatchTime, newCompletionRate, contentId);
    }
  }
}

/**
 * Admin Users Queries
 */
export class AdminQueries {
  /**
   * Create admin user
   */
  static createAdmin(id: string, username: string, passwordHash: string): void {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO ${TABLES.ADMIN_USERS}
      (id, username, password_hash)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(id, username, passwordHash);
  }

  /**
   * Get admin by username
   */
  static getAdminByUsername(username: string): {
    id: string;
    username: string;
    passwordHash: string;
    createdAt: number;
    lastLogin: number | null;
  } | null {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT * FROM ${TABLES.ADMIN_USERS}
      WHERE username = ?
    `);
    
    const row = stmt.get(username) as any;
    if (!row) return null;
    
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
      lastLogin: row.last_login,
    };
  }

  /**
   * Update last login time
   */
  static updateLastLogin(username: string): void {
    const db = getDB();
    const stmt = db.prepare(`
      UPDATE ${TABLES.ADMIN_USERS}
      SET last_login = strftime('%s', 'now')
      WHERE username = ?
    `);
    
    stmt.run(username);
  }

  /**
   * Check if admin exists
   */
  static adminExists(username: string): boolean {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM ${TABLES.ADMIN_USERS}
      WHERE username = ?
    `);
    
    const result = stmt.get(username) as { count: number };
    return result.count > 0;
  }

  /**
   * Get all admins (without password hashes)
   */
  static getAllAdmins(): Array<{
    id: string;
    username: string;
    createdAt: number;
    lastLogin: number | null;
  }> {
    const db = getDB();
    const stmt = db.prepare(`
      SELECT id, username, created_at, last_login
      FROM ${TABLES.ADMIN_USERS}
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      username: row.username,
      createdAt: row.created_at,
      lastLogin: row.last_login,
    }));
  }
}

/**
 * Export all query classes
 */
export const queries = {
  analytics: AnalyticsQueries,
  metrics: MetricsQueries,
  contentStats: ContentStatsQueries,
  admin: AdminQueries,
};
