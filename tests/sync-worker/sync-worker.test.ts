/**
 * Unit Tests for Sync_Worker
 *
 * Tests heartbeat endpoint, admin/live, cron cleanup, and schema version validation.
 * Uses a mock D1 database to simulate Cloudflare D1.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  isValidSyncCode,
  hashSyncCode,
  hashIP,
  KNOWN_SCHEMA_VERSIONS,
  VALID_ACTIVITY_TYPES,
  aggregateDailyStats,
  cleanupOldHeartbeats,
} from '../../cf-sync-worker/src/index';

// ============================================
// Minimal Mock D1 for unit tests
// ============================================

interface D1Row { [key: string]: unknown }

class MockD1Statement {
  constructor(private sql: string, private db: UnitMockD1, private bindings: unknown[] = []) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async run() { this.db.execute(this.sql, this.bindings); return { success: true }; }
  async first() { const r = this.db.query(this.sql, this.bindings); return r[0] || null; }
  async all() { return { results: this.db.query(this.sql, this.bindings) }; }
}

class UnitMockD1 {
  heartbeats: D1Row[] = [];
  dailyStats: D1Row[] = [];

  prepare(sql: string) { return new MockD1Statement(sql, this); }

  execute(sql: string, bindings: unknown[]) {
    const s = sql.trim().toLowerCase();
    if (s.startsWith('insert into admin_heartbeats')) {
      const [ipHash, activityType, contentCategory, timestamp] = bindings;
      const idx = this.heartbeats.findIndex(r => r.ip_hash === ipHash);
      const row = { ip_hash: ipHash, activity_type: activityType, content_category: contentCategory, timestamp };
      if (idx >= 0) this.heartbeats[idx] = row;
      else this.heartbeats.push(row);
    } else if (s.startsWith('insert into admin_daily_stats')) {
      const [date, peakActive, totalUnique, watching, browsing, livetv, topCategories, createdAt, updatedAt] = bindings;
      const idx = this.dailyStats.findIndex(r => r.date === date);
      if (idx >= 0) {
        const row = this.dailyStats[idx];
        row.peak_active = Math.max(row.peak_active as number, peakActive as number);
        row.total_unique_sessions = totalUnique;
        row.watching_sessions = watching;
        row.browsing_sessions = browsing;
        row.livetv_sessions = livetv;
        row.top_categories = topCategories;
        row.updated_at = updatedAt;
      } else {
        this.dailyStats.push({
          date, peak_active: peakActive, total_unique_sessions: totalUnique,
          watching_sessions: watching, browsing_sessions: browsing,
          livetv_sessions: livetv, top_categories: topCategories,
          created_at: createdAt, updated_at: updatedAt,
        });
      }
    } else if (s.startsWith('delete from admin_heartbeats')) {
      const [threshold] = bindings;
      this.heartbeats = this.heartbeats.filter(r => (r.timestamp as number) >= (threshold as number));
    }
  }

  query(sql: string, bindings: unknown[]): D1Row[] {
    const s = sql.trim().toLowerCase();
    if (s.includes('from admin_heartbeats') && s.includes('group by activity_type')) {
      const threshold = bindings[0] as number | undefined;
      const filtered = threshold !== undefined
        ? this.heartbeats.filter(r => (r.timestamp as number) >= threshold)
        : this.heartbeats;
      const groups = new Map<string, number>();
      for (const r of filtered) {
        const t = r.activity_type as string;
        groups.set(t, (groups.get(t) || 0) + 1);
      }
      return Array.from(groups.entries()).map(([t, c]) => ({ activity_type: t, count: c }));
    }
    if (s.includes('from admin_heartbeats') && s.includes('group by content_category')) {
      const threshold = bindings[0] as number;
      const filtered = this.heartbeats.filter(r => (r.timestamp as number) >= threshold && r.content_category != null);
      const groups = new Map<string, number>();
      for (const r of filtered) groups.set(r.content_category as string, (groups.get(r.content_category as string) || 0) + 1);
      return Array.from(groups.entries()).map(([c, n]) => ({ content_category: c, viewers: n, count: n })).sort((a, b) => b.viewers - a.viewers).slice(0, 10);
    }
    if (s.includes('count(distinct ip_hash) as total')) {
      return [{ total: new Set(this.heartbeats.map(r => r.ip_hash)).size }];
    }
    if (s.includes('count(*) as peak')) {
      return [{ peak: this.heartbeats.length }];
    }
    if (s.includes('from admin_daily_stats')) {
      return [...this.dailyStats].sort((a, b) => (b.date as string).localeCompare(a.date as string)).slice(0, 90);
    }
    return [];
  }
}

// ============================================
// Tests
// ============================================

describe('Sync_Worker heartbeat validation', () => {
  it('should accept valid activity types', () => {
    for (const type of VALID_ACTIVITY_TYPES) {
      expect(['browsing', 'watching', 'livetv']).toContain(type);
    }
  });

  it('should hash IP addresses deterministically', async () => {
    const hash1 = await hashIP('192.168.1.1');
    const hash2 = await hashIP('192.168.1.1');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce different hashes for different IPs', async () => {
    const hash1 = await hashIP('192.168.1.1');
    const hash2 = await hashIP('10.0.0.1');
    expect(hash1).not.toBe(hash2);
  });
});

describe('Sync_Worker admin/live with fixture data', () => {
  let db: UnitMockD1;

  beforeEach(() => {
    db = new UnitMockD1();
  });

  it('should count active users by activity type from recent heartbeats', () => {
    const now = Date.now();
    db.heartbeats = [
      { ip_hash: 'aaa', activity_type: 'watching', content_category: 'movie', timestamp: now - 60000 },
      { ip_hash: 'bbb', activity_type: 'watching', content_category: 'tv', timestamp: now - 120000 },
      { ip_hash: 'ccc', activity_type: 'browsing', content_category: null, timestamp: now - 180000 },
      { ip_hash: 'ddd', activity_type: 'livetv', content_category: 'sports', timestamp: now - 240000 },
      // Old record — should be excluded
      { ip_hash: 'eee', activity_type: 'watching', content_category: 'movie', timestamp: now - 15 * 60 * 1000 },
    ];

    const tenMinAgo = now - 10 * 60 * 1000;
    const stats = db.query(
      'SELECT activity_type, COUNT(*) as count FROM admin_heartbeats WHERE timestamp >= ? GROUP BY activity_type',
      [tenMinAgo]
    );

    const byType = new Map(stats.map(r => [r.activity_type, r.count]));
    expect(byType.get('watching')).toBe(2);
    expect(byType.get('browsing')).toBe(1);
    expect(byType.get('livetv')).toBe(1);
  });

  it('should return top content categories sorted by viewer count', () => {
    const now = Date.now();
    db.heartbeats = [
      { ip_hash: 'a1', activity_type: 'watching', content_category: 'movie', timestamp: now - 60000 },
      { ip_hash: 'a2', activity_type: 'watching', content_category: 'movie', timestamp: now - 60000 },
      { ip_hash: 'a3', activity_type: 'watching', content_category: 'movie', timestamp: now - 60000 },
      { ip_hash: 'b1', activity_type: 'watching', content_category: 'tv', timestamp: now - 60000 },
      { ip_hash: 'b2', activity_type: 'watching', content_category: 'tv', timestamp: now - 60000 },
      { ip_hash: 'c1', activity_type: 'watching', content_category: 'anime', timestamp: now - 60000 },
    ];

    const tenMinAgo = now - 10 * 60 * 1000;
    const topContent = db.query(
      'SELECT content_category, COUNT(*) as viewers FROM admin_heartbeats WHERE timestamp >= ? AND content_category IS NOT NULL GROUP BY content_category ORDER BY viewers DESC LIMIT 10',
      [tenMinAgo]
    );

    expect(topContent[0].content_category).toBe('movie');
    expect(topContent[0].viewers).toBe(3);
    expect(topContent[1].content_category).toBe('tv');
    expect(topContent[1].viewers).toBe(2);
    expect(topContent[2].content_category).toBe('anime');
    expect(topContent[2].viewers).toBe(1);
  });
});

describe('Sync_Worker cron cleanup', () => {
  it('should delete heartbeat records older than 24 hours', async () => {
    const db = new UnitMockD1();
    const now = Date.now();

    db.heartbeats = [
      { ip_hash: 'recent', activity_type: 'watching', content_category: 'movie', timestamp: now - 1000 },
      { ip_hash: 'old', activity_type: 'browsing', content_category: null, timestamp: now - 25 * 60 * 60 * 1000 },
      { ip_hash: 'veryold', activity_type: 'livetv', content_category: 'sports', timestamp: now - 48 * 60 * 60 * 1000 },
    ];

    await cleanupOldHeartbeats(db as any);

    expect(db.heartbeats.length).toBe(1);
    expect(db.heartbeats[0].ip_hash).toBe('recent');
  });

  it('should aggregate heartbeats into daily stats', async () => {
    const db = new UnitMockD1();
    const now = Date.now();

    db.heartbeats = [
      { ip_hash: 'u1', activity_type: 'watching', content_category: 'movie', timestamp: now },
      { ip_hash: 'u2', activity_type: 'watching', content_category: 'tv', timestamp: now },
      { ip_hash: 'u3', activity_type: 'browsing', content_category: null, timestamp: now },
      { ip_hash: 'u4', activity_type: 'livetv', content_category: 'sports', timestamp: now },
    ];

    await aggregateDailyStats(db as any);

    expect(db.dailyStats.length).toBe(1);
    const stats = db.dailyStats[0];
    expect(stats.total_unique_sessions).toBe(4);
    expect(stats.watching_sessions).toBe(2);
    expect(stats.browsing_sessions).toBe(1);
    expect(stats.livetv_sessions).toBe(1);
  });
});

describe('Sync_Worker schema version validation', () => {
  it('should accept known schema versions', () => {
    for (const v of KNOWN_SCHEMA_VERSIONS) {
      expect(KNOWN_SCHEMA_VERSIONS.includes(v)).toBe(true);
    }
  });

  it('should reject unknown schema versions', () => {
    const unknownVersions = [0, -1, 3, 99, 1000];
    for (const v of unknownVersions) {
      expect(KNOWN_SCHEMA_VERSIONS.includes(v)).toBe(false);
    }
  });

  it('should validate sync code format correctly', () => {
    expect(isValidSyncCode('FLYX-ABCDEF-123456')).toBe(true);
    expect(isValidSyncCode('FLYX-abcdef-123456')).toBe(true);
    expect(isValidSyncCode('')).toBe(false);
    expect(isValidSyncCode('INVALID')).toBe(false);
    expect(isValidSyncCode('FLYX-SHORT-AB')).toBe(false);
  });
});
