/**
 * Property-based tests for legacy data migration
 *
 * Uses fast-check to verify:
 *   Property 14: Legacy data migration correctness (Req 6.1)
 *   Property 15: Migration idempotence (Req 6.2)
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import fc from 'fast-check';
import {
  migrateFromLegacy,
  migrateLegacyWatchProgress,
  migrateLegacyWatchlist,
} from '../../app/lib/local-store/migration';

// ---------------------------------------------------------------------------
// Generators — produce data shaped like the legacy formats
// ---------------------------------------------------------------------------

/** Legacy watch progress entry (user-tracking.ts / sync-client.ts shape) */
const legacyWatchProgressEntryArb = fc.record({
  contentId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('_')),
  contentType: fc.constantFrom('movie', 'tv'),
  title: fc.string({ minLength: 1, maxLength: 40 }),
  currentTime: fc.integer({ min: 0, max: 36000 }),
  duration: fc.integer({ min: 1, max: 36000 }),
  completionPercentage: fc.integer({ min: 0, max: 100 }),
  lastWatched: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  completed: fc.boolean(),
  seasonNumber: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
  episodeNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  poster: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

/** Legacy watchlist entry (useWatchlist.tsx shape) */
const legacyWatchlistEntryArb = fc.record({
  id: fc.oneof(
    fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
    fc.integer({ min: 1, max: 999999 }),
  ),
  title: fc.string({ minLength: 1, maxLength: 40 }),
  posterPath: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  mediaType: fc.constantFrom('movie' as const, 'tv' as const),
  addedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Property 14: Legacy data migration correctness
// Validates: Requirements 6.1
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 14: Legacy data migration correctness', () => {
  it('should preserve all legacy watch progress entries after migration', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 15 }).filter(s => !s.includes('_')),
          legacyWatchProgressEntryArb,
        ),
        (legacyProgress) => {
          localStorage.clear();

          // Seed legacy data
          localStorage.setItem('flyx_watch_progress', JSON.stringify(legacyProgress));

          // Run migration
          migrateFromLegacy();

          // Read migrated data
          const migratedRaw = localStorage.getItem('flyx_v2_watch_progress');
          expect(migratedRaw).not.toBeNull();
          const migrated = JSON.parse(migratedRaw!) as Record<string, any>;

          // Every legacy entry should appear in the migrated data
          for (const [_key, item] of Object.entries(legacyProgress)) {
            const contentId = item.contentId || _key;
            const season = item.seasonNumber;
            const episode = item.episodeNumber;
            const v2Key =
              season != null && episode != null
                ? `${contentId}_${season}_${episode}`
                : contentId;

            const m = migrated[v2Key];
            expect(m).toBeDefined();
            expect(m.contentId).toBe(contentId);
            expect(m.position).toBe(Number(item.currentTime ?? 0));
            expect(m.duration).toBe(Number(item.duration ?? 0));
            expect(m.lastWatched).toBe(Number(item.lastWatched));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should preserve all legacy watchlist entries after migration', () => {
    fc.assert(
      fc.property(
        fc.array(legacyWatchlistEntryArb, { minLength: 1, maxLength: 20 }),
        (legacyWatchlist) => {
          localStorage.clear();

          // Seed legacy data
          localStorage.setItem('flyx_watchlist', JSON.stringify(legacyWatchlist));

          // Run migration
          migrateFromLegacy();

          // Read migrated data
          const migratedRaw = localStorage.getItem('flyx_v2_watchlist');
          expect(migratedRaw).not.toBeNull();
          const migrated = JSON.parse(migratedRaw!) as any[];

          // Deduplicate legacy by id (migration deduplicates)
          const uniqueIds = new Set(legacyWatchlist.map(e => String(e.id)));

          expect(migrated.length).toBe(uniqueIds.size);

          // Every unique legacy entry should be present
          for (const id of uniqueIds) {
            const found = migrated.find((m: any) => String(m.id) === id);
            expect(found).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Migration idempotence
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 15: Migration idempotence', () => {
  it('should produce the same result when migration runs twice', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 15 }).filter(s => !s.includes('_')),
          legacyWatchProgressEntryArb,
        ),
        fc.array(legacyWatchlistEntryArb, { maxLength: 15 }),
        (legacyProgress, legacyWatchlist) => {
          localStorage.clear();

          // Seed legacy data
          localStorage.setItem('flyx_watch_progress', JSON.stringify(legacyProgress));
          localStorage.setItem('flyx_watchlist', JSON.stringify(legacyWatchlist));

          // First migration
          migrateFromLegacy();

          const afterFirst = {
            watchProgress: localStorage.getItem('flyx_v2_watch_progress'),
            watchlist: localStorage.getItem('flyx_v2_watchlist'),
            settings: localStorage.getItem('flyx_v2_settings'),
            schemaVersion: localStorage.getItem('flyx_v2_schema_version'),
          };

          // Second migration — should be a no-op
          migrateFromLegacy();

          const afterSecond = {
            watchProgress: localStorage.getItem('flyx_v2_watch_progress'),
            watchlist: localStorage.getItem('flyx_v2_watchlist'),
            settings: localStorage.getItem('flyx_v2_settings'),
            schemaVersion: localStorage.getItem('flyx_v2_schema_version'),
          };

          expect(afterSecond.watchProgress).toBe(afterFirst.watchProgress);
          expect(afterSecond.watchlist).toBe(afterFirst.watchlist);
          expect(afterSecond.settings).toBe(afterFirst.settings);
          expect(afterSecond.schemaVersion).toBe(afterFirst.schemaVersion);
        },
      ),
      { numRuns: 100 },
    );
  });
});
