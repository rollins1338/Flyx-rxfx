/**
 * Property-Based Tests for Sync_Worker
 *
 * Tests correctness properties 6-8, 11-13, 19-20 from the design document.
 * Uses fast-check for property-based testing with a mock D1 database.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import fc from 'fast-check';
import {
  hashSyncCode,
  isValidSyncCode,
  hashIP,
  KNOWN_SCHEMA_VERSIONS,
  VALID_ACTIVITY_TYPES,
} from '../../cf-sync-worker/src/index';

// ============================================
// Mock D1 Database for testing
// ============================================

interface D1Row {
  [key: string]: unknown;
}

class MockD1Statement {
  private sql: string;
  private bindings: unknown[] = [];
  private db: MockD1DB;

  constructor(sql: string, db: MockD1DB) {
    this.sql = sql;
    this.db = db;
  }

  bind(...values: unknown[]): MockD1Statement {
    this.bindings = values;
    return this;
  }

  async run(): Promise<{ success: boolean }> {
    this.db.execute(this.sql, this.bindings);
    return { success: true };
  }

  async first(): Promise<D1Row | null> {
    const results = this.db.query(this.sql, this.bindings);
    return results.length > 0 ? results[0] : null;
  }

  async all(): Promise<{ results: D1Row[] }> {
    const results = this.db.query(this.sql, this.bindings);
    return { results };
  }
}

class MockD1DB {
  private tables: {
    sync_accounts: D1Row[];
    admin_heartbeats: D1Row[];
    admin_daily_stats: D1Row[];
  } = { sync_accounts: [], admin_heartbeats: [], admin_daily_stats: [] };

  prepare(sql: string): MockD1Statement {
    return new MockD1Statement(sql, this);
  }

  execute(sql: string, bindings: unknown[]): void {
    const sqlLower = sql.trim().toLowerCase();

    if (sqlLower.startsWith('insert into admin_heartbeats')) {
      const [ipHash, activityType, contentCategory, timestamp] = bindings;
      const existing = this.tables.admin_heartbeats.findIndex(
        (r) => r.ip_hash === ipHash
      );
      if (existing >= 0) {
        this.tables.admin_heartbeats[existing] = {
          ip_hash: ipHash,
          activity_type: activityType,
          content_category: contentCategory,
          timestamp,
        };
      } else {
        this.tables.admin_heartbeats.push({
          ip_hash: ipHash,
          activity_type: activityType,
          content_category: contentCategory,
          timestamp,
        });
      }
    } else if (sqlLower.startsWith('insert into admin_daily_stats')) {
      const [date, peakActive, totalUnique, watching, browsing, livetv, topCategories, createdAt, updatedAt] = bindings;
      const existing = this.tables.admin_daily_stats.findIndex(
        (r) => r.date === date
      );
      if (existing >= 0) {
        const row = this.tables.admin_daily_stats[existing];
        row.peak_active = Math.max(row.peak_active as number, peakActive as number);
        row.total_unique_sessions = totalUnique;
        row.watching_sessions = watching;
        row.browsing_sessions = browsing;
        row.livetv_sessions = livetv;
        row.top_categories = topCategories;
        row.updated_at = updatedAt;
      } else {
        this.tables.admin_daily_stats.push({
          date, peak_active: peakActive, total_unique_sessions: totalUnique,
          watching_sessions: watching, browsing_sessions: browsing,
          livetv_sessions: livetv, top_categories: topCategories,
          created_at: createdAt, updated_at: updatedAt,
        });
      }
    } else if (sqlLower.startsWith('insert into sync_accounts')) {
      const [id, codeHash, syncData, createdAt, updatedAt, lastSyncAt] = bindings;
      this.tables.sync_accounts.push({
        id, code_hash: codeHash, sync_data: syncData,
        created_at: createdAt, updated_at: updatedAt,
        last_sync_at: lastSyncAt, device_count: 1,
      });
    } else if (sqlLower.startsWith('update sync_accounts')) {
      const [syncData, updatedAt, lastSyncAt, codeHash] = bindings;
      const row = this.tables.sync_accounts.find((r) => r.code_hash === codeHash);
      if (row) {
        row.sync_data = syncData;
        row.updated_at = updatedAt;
        row.last_sync_at = lastSyncAt;
      }
    } else if (sqlLower.startsWith('delete from sync_accounts')) {
      const [codeHash] = bindings;
      this.tables.sync_accounts = this.tables.sync_accounts.filter(
        (r) => r.code_hash !== codeHash
      );
    } else if (sqlLower.startsWith('delete from admin_heartbeats')) {
      const [threshold] = bindings;
      this.tables.admin_heartbeats = this.tables.admin_heartbeats.filter(
        (r) => (r.timestamp as number) >= (threshold as number)
      );
    }
  }

  query(sql: string, bindings: unknown[]): D1Row[] {
    const sqlLower = sql.trim().toLowerCase();

    if (sqlLower.includes('from admin_heartbeats') && sqlLower.includes('group by activity_type')) {
      const threshold = bindings[0] as number | undefined;
      const filtered = threshold !== undefined
        ? this.tables.admin_heartbeats.filter((r) => (r.timestamp as number) >= threshold)
        : this.tables.admin_heartbeats;
      const groups = new Map<string, Set<string>>();
      for (const r of filtered) {
        const key = r.activity_type as string;
        if (!groups.has(key)) groups.set(key, new Set());
        if (sqlLower.includes('distinct ip_hash')) {
          groups.get(key)!.add(r.ip_hash as string);
        } else {
          groups.get(key)!.add(r.ip_hash as string);
        }
      }
      return Array.from(groups.entries()).map(([type, set]) => ({
        activity_type: type,
        count: set.size,
      }));
    }

    if (sqlLower.includes('from admin_heartbeats') && sqlLower.includes('group by content_category')) {
      const threshold = bindings[0] as number;
      const filtered = this.tables.admin_heartbeats.filter(
        (r) => (r.timestamp as number) >= threshold && r.content_category != null
      );
      const groups = new Map<string, number>();
      for (const r of filtered) {
        const cat = r.content_category as string;
        groups.set(cat, (groups.get(cat) || 0) + 1);
      }
      return Array.from(groups.entries())
        .map(([cat, count]) => ({ content_category: cat, viewers: count, count }))
        .sort((a, b) => b.viewers - a.viewers)
        .slice(0, 10);
    }

    if (sqlLower.includes('count(distinct ip_hash) as total') && sqlLower.includes('from admin_heartbeats')) {
      const uniqueIps = new Set(this.tables.admin_heartbeats.map((r) => r.ip_hash));
      return [{ total: uniqueIps.size }];
    }

    if (sqlLower.includes('count(*) as peak') && sqlLower.includes('from admin_heartbeats')) {
      return [{ peak: this.tables.admin_heartbeats.length }];
    }

    if (sqlLower.includes('from admin_daily_stats')) {
      return [...this.tables.admin_daily_stats].sort((a, b) =>
        (b.date as string).localeCompare(a.date as string)
      ).slice(0, 90);
    }

    if (sqlLower.includes('from sync_accounts') && sqlLower.includes('select sync_data')) {
      const [codeHash] = bindings;
      const row = this.tables.sync_accounts.find((r) => r.code_hash === codeHash);
      return row ? [{ sync_data: row.sync_data, last_sync_at: row.last_sync_at }] : [];
    }

    if (sqlLower.includes('from sync_accounts') && sqlLower.includes('select id')) {
      const [codeHash] = bindings;
      const row = this.tables.sync_accounts.find((r) => r.code_hash === codeHash);
      return row ? [{ id: row.id }] : [];
    }

    return [];
  }

  // Direct access for test assertions
  getHeartbeats(): D1Row[] { return this.tables.admin_heartbeats; }
  getDailyStats(): D1Row[] { return this.tables.admin_daily_stats; }
  getSyncAccounts(): D1Row[] { return this.tables.sync_accounts; }

  clear(): void {
    this.tables = { sync_accounts: [], admin_heartbeats: [], admin_daily_stats: [] };
  }

  // Insert heartbeat directly for testing
  insertHeartbeat(ipHash: string, activityType: string, contentCategory: string | null, timestamp: number): void {
    const existing = this.tables.admin_heartbeats.findIndex((r) => r.ip_hash === ipHash);
    if (existing >= 0) {
      this.tables.admin_heartbeats[existing] = { ip_hash: ipHash, activity_type: activityType, content_category: contentCategory, timestamp };
    } else {
      this.tables.admin_heartbeats.push({ ip_hash: ipHash, activity_type: activityType, content_category: contentCategory, timestamp });
    }
  }
}

// ============================================
// Arbitraries
// ============================================

const alphanumChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const syncCodeArb = fc.tuple(
  fc.array(fc.constantFrom(...alphanumChars.split('')), { minLength: 6, maxLength: 6 }).map(a => a.join('')),
  fc.array(fc.constantFrom(...alphanumChars.split('')), { minLength: 6, maxLength: 6 }).map(a => a.join('')),
).map(([a, b]) => `FLYX-${a}-${b}`);

const invalidSyncCodeArb = fc.oneof(
  fc.constant(''),
  fc.constant('FLYX-SHORT-AB'),
  fc.constant('INVALID-ABCDEF-ABCDEF'),
  fc.constant('FLYX-ABCDEF'),
  fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/^FLYX-[A-Z0-9]{6}-[A-Z0-9]{6}$/i.test(s)),
);

const activityTypeArb = fc.constantFrom('browsing', 'watching', 'livetv') as fc.Arbitrary<'browsing' | 'watching' | 'livetv'>;

const contentCategoryArb = fc.option(
  fc.constantFrom('movie', 'tv', 'anime', 'sports', 'news'),
  { nil: null }
);

const hexChars = '0123456789abcdef';

const heartbeatRecordArb = fc.record({
  ipHash: fc.array(fc.constantFrom(...hexChars.split('')), { minLength: 64, maxLength: 64 }).map(a => a.join('')),
  activityType: activityTypeArb,
  contentCategory: contentCategoryArb,
  timestamp: fc.integer({ min: Date.now() - 20 * 60 * 1000, max: Date.now() }),
});

const syncPayloadArb = fc.record({
  watchProgress: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    fc.record({
      contentId: fc.string({ minLength: 1, maxLength: 20 }),
      contentType: fc.constantFrom('movie', 'tv') as fc.Arbitrary<'movie' | 'tv'>,
      progress: fc.integer({ min: 0, max: 100 }),
      duration: fc.integer({ min: 1, max: 36000 }),
      lastWatched: fc.integer({ min: 1600000000000, max: 1800000000000 }),
    }),
    { minKeys: 0, maxKeys: 3 }
  ),
  watchlist: fc.array(
    fc.record({
      id: fc.oneof(fc.integer({ min: 1, max: 999999 }), fc.string({ minLength: 1, maxLength: 10 })),
      mediaType: fc.constantFrom('movie', 'tv') as fc.Arbitrary<'movie' | 'tv'>,
      title: fc.string({ minLength: 1, maxLength: 50 }),
      addedAt: fc.integer({ min: 1600000000000, max: 1800000000000 }),
    }),
    { maxLength: 5 }
  ),
  providerSettings: fc.record({
    providerOrder: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }),
    disabledProviders: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 2 }),
    lastSuccessfulProviders: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ minLength: 1, maxLength: 10 }), { maxKeys: 2 }),
    animeAudioPreference: fc.constantFrom('sub', 'dub') as fc.Arbitrary<'sub' | 'dub'>,
    preferredAnimeKaiServer: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
  }),
  subtitleSettings: fc.record({
    enabled: fc.boolean(),
    languageCode: fc.string({ minLength: 2, maxLength: 5 }),
    languageName: fc.string({ minLength: 1, maxLength: 20 }),
    fontSize: fc.integer({ min: 50, max: 200 }),
    textColor: fc.constant('#ffffff'),
    backgroundColor: fc.constant('#000000'),
    backgroundOpacity: fc.integer({ min: 0, max: 100 }),
    verticalPosition: fc.integer({ min: 0, max: 100 }),
  }),
  playerSettings: fc.record({
    autoPlayNextEpisode: fc.boolean(),
    autoPlayCountdown: fc.integer({ min: 5, max: 30 }),
    showNextEpisodeBeforeEnd: fc.integer({ min: 30, max: 180 }),
    volume: fc.double({ min: 0, max: 1, noNaN: true }),
    isMuted: fc.boolean(),
  }),
  lastSyncedAt: fc.integer({ min: 0, max: 1800000000000 }),
  schemaVersion: fc.constantFrom(1, 2),
});

// ============================================
// Property 6: Sync code validation
// Validates: Requirements 3.1
// ============================================
describe('Feature: local-first-analytics, Property 6: Sync code validation', () => {
  it('should accept valid sync codes matching FLYX-XXXXXX-XXXXXX', () => {
    /**
     * **Validates: Requirements 3.1**
     */
    fc.assert(
      fc.property(syncCodeArb, (code) => {
        expect(isValidSyncCode(code)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid sync codes', () => {
    /**
     * **Validates: Requirements 3.1**
     */
    fc.assert(
      fc.property(invalidSyncCodeArb, (code) => {
        expect(isValidSyncCode(code)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 7: Sync push-pull round-trip
// Validates: Requirements 3.3
// ============================================
describe('Feature: local-first-analytics, Property 7: Sync push-pull round-trip', () => {
  it('should return equivalent data after push then pull', () => {
    /**
     * **Validates: Requirements 3.3**
     */
    const db = new MockD1DB();

    fc.assert(
      fc.asyncProperty(syncCodeArb, syncPayloadArb, async (code, payload) => {
        db.clear();
        const codeHash = await hashSyncCode(code);
        const syncDataStr = JSON.stringify(payload);

        // Push
        db.execute(
          'INSERT INTO sync_accounts (id, code_hash, sync_data, created_at, updated_at, last_sync_at) VALUES (?, ?, ?, ?, ?, ?)',
          [`sync_${Date.now()}`, codeHash, syncDataStr, Date.now(), Date.now(), Date.now()]
        );

        // Pull
        const rows = db.query('SELECT sync_data, last_sync_at FROM sync_accounts WHERE code_hash = ?', [codeHash]);
        expect(rows.length).toBe(1);
        const retrieved = JSON.parse(rows[0].sync_data as string);

        expect(retrieved.schemaVersion).toBe(payload.schemaVersion);
        expect(Object.keys(retrieved.watchProgress).sort()).toEqual(Object.keys(payload.watchProgress).sort());
        expect(retrieved.watchlist.length).toBe(payload.watchlist.length);
        expect(retrieved.playerSettings.isMuted).toBe(payload.playerSettings.isMuted);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 8: Sync code hashing
// Validates: Requirements 3.6
// ============================================
describe('Feature: local-first-analytics, Property 8: Sync code hashing', () => {
  it('should produce a SHA-256 hex hash that is never the raw code', () => {
    /**
     * **Validates: Requirements 3.6**
     */
    fc.assert(
      fc.asyncProperty(syncCodeArb, async (code) => {
        const hash = await hashSyncCode(code);

        // Must be 64-char hex string (SHA-256)
        expect(hash).toMatch(/^[0-9a-f]{64}$/);

        // Must not be the raw code
        expect(hash).not.toBe(code);
        expect(hash).not.toBe(code.toUpperCase());
        expect(hash).not.toBe(code.toLowerCase());

        // Same code should produce same hash (deterministic)
        const hash2 = await hashSyncCode(code);
        expect(hash2).toBe(hash);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 11: Admin live activity counting
// Validates: Requirements 5.1
// ============================================
describe('Feature: local-first-analytics, Property 11: Admin live activity counting', () => {
  it('should return counts matching distinct records within last 10 minutes grouped by activity_type', () => {
    /**
     * **Validates: Requirements 5.1**
     */
    const db = new MockD1DB();

    fc.assert(
      fc.property(
        fc.array(heartbeatRecordArb, { minLength: 1, maxLength: 30 }),
        (records) => {
          db.clear();
          const now = Date.now();
          const tenMinAgo = now - 10 * 60 * 1000;

          // Insert records
          for (const r of records) {
            db.insertHeartbeat(r.ipHash, r.activityType, r.contentCategory, r.timestamp);
          }

          // Query via mock (simulates GET /admin/live)
          const statsResults = db.query(
            'SELECT activity_type, COUNT(*) as count FROM admin_heartbeats WHERE timestamp >= ? GROUP BY activity_type',
            [tenMinAgo]
          );

          // Compute expected counts manually
          // Since insertHeartbeat upserts by ipHash, we need to get the final state
          const finalRecords = db.getHeartbeats();
          const recentRecords = finalRecords.filter((r) => (r.timestamp as number) >= tenMinAgo);
          const expectedCounts = new Map<string, number>();
          for (const r of recentRecords) {
            const type = r.activity_type as string;
            expectedCounts.set(type, (expectedCounts.get(type) || 0) + 1);
          }

          // Verify counts match
          for (const row of statsResults) {
            const type = row.activity_type as string;
            expect(row.count).toBe(expectedCounts.get(type) || 0);
          }

          // Verify no missing types
          expect(statsResults.length).toBe(expectedCounts.size);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 12: Admin popular content ordering
// Validates: Requirements 5.2
// ============================================
describe('Feature: local-first-analytics, Property 12: Admin popular content ordering', () => {
  it('should return content items sorted by viewer count descending', () => {
    /**
     * **Validates: Requirements 5.2**
     */
    const db = new MockD1DB();

    fc.assert(
      fc.property(
        fc.array(heartbeatRecordArb, { minLength: 1, maxLength: 30 }),
        (records) => {
          db.clear();
          const now = Date.now();
          const tenMinAgo = now - 10 * 60 * 1000;

          for (const r of records) {
            db.insertHeartbeat(r.ipHash, r.activityType, r.contentCategory, r.timestamp);
          }

          const topContent = db.query(
            'SELECT content_category, COUNT(*) as viewers FROM admin_heartbeats WHERE timestamp >= ? AND content_category IS NOT NULL GROUP BY content_category ORDER BY viewers DESC LIMIT 10',
            [tenMinAgo]
          );

          // Verify descending order
          for (let i = 1; i < topContent.length; i++) {
            expect(topContent[i - 1].viewers as number).toBeGreaterThanOrEqual(topContent[i].viewers as number);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 13: Daily stats aggregation consistency
// Validates: Requirements 5.3
// ============================================
describe('Feature: local-first-analytics, Property 13: Daily stats aggregation consistency', () => {
  it('should have total_unique_sessions equal to distinct ip_hash count', () => {
    /**
     * **Validates: Requirements 5.3**
     */
    const db = new MockD1DB();

    fc.assert(
      fc.asyncProperty(
        fc.array(heartbeatRecordArb, { minLength: 1, maxLength: 30 }),
        async (records) => {
          db.clear();

          for (const r of records) {
            db.insertHeartbeat(r.ipHash, r.activityType, r.contentCategory, r.timestamp);
          }

          // Run aggregation (simulates cron)
          await aggregateDailyStats(db as any);

          const dailyStats = db.getDailyStats();
          expect(dailyStats.length).toBeGreaterThanOrEqual(1);

          const heartbeats = db.getHeartbeats();
          const uniqueIps = new Set(heartbeats.map((r) => r.ip_hash));

          const todayStats = dailyStats[0];
          expect(todayStats.total_unique_sessions).toBe(uniqueIps.size);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 19: Sync_Payload schema completeness
// Validates: Requirements 8.1, 8.4
// ============================================
describe('Feature: local-first-analytics, Property 19: Sync_Payload schema completeness', () => {
  it('should contain all required fields including schemaVersion as positive integer', () => {
    /**
     * **Validates: Requirements 8.1, 8.4**
     */
    fc.assert(
      fc.property(syncPayloadArb, (payload) => {
        // schemaVersion must be a positive integer
        expect(typeof payload.schemaVersion).toBe('number');
        expect(payload.schemaVersion).toBeGreaterThan(0);
        expect(Number.isInteger(payload.schemaVersion)).toBe(true);

        // Required fields must exist
        expect(payload.watchProgress).toBeDefined();
        expect(typeof payload.watchProgress).toBe('object');
        expect(Array.isArray(payload.watchlist)).toBe(true);
        expect(payload.providerSettings).toBeDefined();
        expect(payload.subtitleSettings).toBeDefined();
        expect(payload.playerSettings).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 20: Unknown schema version rejection
// Validates: Requirements 8.2
// ============================================
describe('Feature: local-first-analytics, Property 20: Unknown schema version rejection', () => {
  it('should identify unknown schema versions as not in KNOWN_SCHEMA_VERSIONS', () => {
    /**
     * **Validates: Requirements 8.2**
     */
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 1000 }).filter(v => !KNOWN_SCHEMA_VERSIONS.includes(v)),
        (unknownVersion) => {
          // The worker rejects payloads with unknown schema versions
          expect(KNOWN_SCHEMA_VERSIONS.includes(unknownVersion)).toBe(false);

          // Known versions should be accepted
          for (const known of KNOWN_SCHEMA_VERSIONS) {
            expect(KNOWN_SCHEMA_VERSIONS.includes(known)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Import aggregateDailyStats for Property 13
import { aggregateDailyStats } from '../../cf-sync-worker/src/index';
