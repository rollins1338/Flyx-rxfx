/**
 * Property-based tests for Local_Store
 *
 * Uses fast-check to verify universal correctness properties
 * across randomly generated inputs.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import fc from 'fast-check';
import { LocalStore, progressKey } from '../../app/lib/local-store/local-store';
import type {
  WatchProgressEntry,
  WatchlistEntry,
  LocalStoreData,
} from '../../app/lib/local-store/types';
import { SCHEMA_VERSION } from '../../app/lib/local-store/types';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const contentTypeArb = fc.constantFrom('movie' as const, 'tv' as const, 'livetv' as const);

const watchProgressArb: fc.Arbitrary<WatchProgressEntry> = fc.record({
  contentId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('_')),
  contentType: contentTypeArb,
  title: fc.string({ minLength: 1, maxLength: 50 }),
  seasonNumber: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
  episodeNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  position: fc.integer({ min: 0, max: 36000 }),
  duration: fc.integer({ min: 1, max: 36000 }),
  lastWatched: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  posterPath: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

const mediaTypeArb = fc.constantFrom('movie' as const, 'tv' as const);

const watchlistEntryArb: fc.Arbitrary<WatchlistEntry> = fc.record({
  id: fc.oneof(
    fc.string({ minLength: 1, maxLength: 10 }),
    fc.integer({ min: 1, max: 999999 }),
  ),
  mediaType: mediaTypeArb,
  title: fc.string({ minLength: 1, maxLength: 50 }),
  posterPath: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  addedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
});

const localStoreDataArb: fc.Arbitrary<LocalStoreData> = fc.record({
  watchProgress: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 15 }),
    watchProgressArb,
  ),
  watchlist: fc.array(watchlistEntryArb, { maxLength: 20 }),
  viewingStats: fc.record({
    totalWatchTimeSeconds: fc.integer({ min: 0, max: 1_000_000 }),
    sessionsCount: fc.integer({ min: 0, max: 10_000 }),
    lastUpdated: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  }),
  settings: fc.record({
    provider: fc.record({
      preferredProvider: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
      preferredServer: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
      autoSelectProvider: fc.option(fc.boolean(), { nil: undefined }),
    }),
    subtitle: fc.record({
      enabled: fc.option(fc.boolean(), { nil: undefined }),
      language: fc.option(fc.string({ minLength: 2, maxLength: 5 }), { nil: undefined }),
      fontSize: fc.option(fc.integer({ min: 8, max: 48 }), { nil: undefined }),
      color: fc.option(fc.string({ minLength: 3, maxLength: 7 }), { nil: undefined }),
      backgroundColor: fc.option(fc.string({ minLength: 3, maxLength: 7 }), { nil: undefined }),
    }),
    player: fc.record({
      autoplay: fc.option(fc.boolean(), { nil: undefined }),
      defaultQuality: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
      volume: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
      muted: fc.option(fc.boolean(), { nil: undefined }),
      playbackSpeed: fc.option(fc.constantFrom(0.5, 1, 1.5, 2), { nil: undefined }),
    }),
  }),
  schemaVersion: fc.constant(SCHEMA_VERSION),
  lastModified: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let store: LocalStore;

beforeEach(() => {
  localStorage.clear();
  store = new LocalStore();
});

// ---------------------------------------------------------------------------
// Property 1: Watch event recording completeness
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 1: Watch event recording completeness', () => {
  it('should record all fields of a watch progress entry', () => {
    fc.assert(
      fc.property(watchProgressArb, (entry) => {
        localStorage.clear();
        const s = new LocalStore();
        s.setWatchProgress(entry);
        const result = s.getWatchProgress(entry.contentId, entry.seasonNumber, entry.episodeNumber);
        expect(result).not.toBeNull();
        expect(result!.contentId).toBe(entry.contentId);
        expect(result!.contentType).toBe(entry.contentType);
        expect(result!.title).toBe(entry.title);
        expect(result!.position).toBe(entry.position);
        expect(result!.duration).toBe(entry.duration);
        expect(result!.seasonNumber).toBe(entry.seasonNumber);
        expect(result!.episodeNumber).toBe(entry.episodeNumber);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Watchlist add/remove round-trip
// Validates: Requirements 1.3
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 2: Watchlist add/remove round-trip', () => {
  it('should contain an entry after adding and not contain it after removing', () => {
    fc.assert(
      fc.property(watchlistEntryArb, (entry) => {
        localStorage.clear();
        const s = new LocalStore();

        s.addToWatchlist(entry);
        expect(s.isInWatchlist(entry.id)).toBe(true);
        const list = s.getWatchlist();
        expect(list.some((e) => String(e.id) === String(entry.id))).toBe(true);

        s.removeFromWatchlist(entry.id);
        expect(s.isInWatchlist(entry.id)).toBe(false);
        const listAfter = s.getWatchlist();
        expect(listAfter.some((e) => String(e.id) === String(entry.id))).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Last-write-wins merge
// Validates: Requirements 1.4, 3.4
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 3: Last-write-wins merge', () => {
  it('should keep the entry with the more recent timestamp after merge', () => {
    fc.assert(
      fc.property(
        watchProgressArb,
        fc.integer({ min: 1_000_000_000_000, max: 1_500_000_000_000 }),
        fc.integer({ min: 1_500_000_000_001, max: 2_000_000_000_000 }),
        (baseEntry, olderTs, newerTs) => {
          localStorage.clear();
          const s = new LocalStore();

          const key = progressKey(baseEntry.contentId, baseEntry.seasonNumber, baseEntry.episodeNumber);

          const localEntry: WatchProgressEntry = { ...baseEntry, lastWatched: olderTs, title: 'local' };
          const remoteEntry: WatchProgressEntry = { ...baseEntry, lastWatched: newerTs, title: 'remote' };

          s.setWatchProgress(localEntry);

          const remoteData: LocalStoreData = {
            watchProgress: { [key]: remoteEntry },
            watchlist: [],
            viewingStats: { totalWatchTimeSeconds: 0, sessionsCount: 0, lastUpdated: 0 },
            settings: { provider: {}, subtitle: {}, player: {} },
            schemaVersion: SCHEMA_VERSION,
            lastModified: newerTs,
          };

          s.mergeRemote(remoteData);

          const result = s.getWatchProgress(baseEntry.contentId, baseEntry.seasonNumber, baseEntry.episodeNumber);
          expect(result!.title).toBe('remote');
          expect(result!.lastWatched).toBe(newerTs);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Data serialization round-trip
// Validates: Requirements 1.6, 8.3
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 4: Data serialization round-trip', () => {
  it('should produce equivalent data after serialize then deserialize', () => {
    fc.assert(
      fc.property(localStoreDataArb, (data) => {
        localStorage.clear();
        const s = new LocalStore();
        s.importAll(data);
        const json = s.serialize();
        const restored = s.deserialize(json);

        // Compare watch progress keys and values
        expect(Object.keys(restored.watchProgress).sort()).toEqual(
          Object.keys(data.watchProgress).sort(),
        );
        for (const key of Object.keys(data.watchProgress)) {
          expect(restored.watchProgress[key].contentId).toBe(data.watchProgress[key].contentId);
          expect(restored.watchProgress[key].position).toBe(data.watchProgress[key].position);
        }

        // Compare watchlist ids
        const restoredIds = restored.watchlist.map((e) => String(e.id)).sort();
        const originalIds = data.watchlist.map((e) => String(e.id)).sort();
        expect(restoredIds).toEqual(originalIds);

        expect(restored.schemaVersion).toBe(data.schemaVersion);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16: Continue watching sort order and filter
// Validates: Requirements 7.1
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 16: Continue watching sort order and filter', () => {
  it('should return only 5% < completion < 95%, sorted by lastWatched desc', () => {
    fc.assert(
      fc.property(
        fc.array(watchProgressArb, { minLength: 1, maxLength: 30 }),
        (entries) => {
          localStorage.clear();
          const s = new LocalStore();

          // Deduplicate by key so we know exactly what's in the store
          const byKey = new Map<string, WatchProgressEntry>();
          for (const e of entries) {
            byKey.set(progressKey(e.contentId, e.seasonNumber, e.episodeNumber), e);
          }
          for (const e of byKey.values()) s.setWatchProgress(e);

          const result = s.getInProgress();

          // Every returned entry must satisfy the filter
          for (const r of result) {
            const pct = r.position / r.duration;
            expect(pct).toBeGreaterThan(0.05);
            expect(pct).toBeLessThan(0.95);
            expect(r.duration).toBeGreaterThan(0);
          }

          // Must be sorted by lastWatched descending
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].lastWatched).toBeGreaterThanOrEqual(result[i].lastWatched);
          }

          // No qualifying entry should be missing
          const expectedCount = Array.from(byKey.values()).filter((e) => {
            if (e.duration <= 0) return false;
            const pct = e.position / e.duration;
            return pct > 0.05 && pct < 0.95;
          }).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 17: Watch history pagination
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 17: Watch history pagination', () => {
  it('should return the correct page slice and total count', () => {
    fc.assert(
      fc.property(
        fc.array(watchProgressArb, { minLength: 0, maxLength: 30 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        (entries, page, pageSize) => {
          localStorage.clear();
          const s = new LocalStore();

          const byKey = new Map<string, WatchProgressEntry>();
          for (const e of entries) {
            byKey.set(progressKey(e.contentId, e.seasonNumber, e.episodeNumber), e);
          }
          for (const e of byKey.values()) s.setWatchProgress(e);

          const { items, total } = s.getWatchHistory(page, pageSize);

          expect(total).toBe(byKey.size);
          const start = (page - 1) * pageSize;
          const expectedLen = Math.max(0, Math.min(pageSize, total - start));
          expect(items.length).toBe(expectedLen);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: Viewing stats consistency
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 18: Viewing stats consistency', () => {
  it('should have totalWatchTimeSeconds equal to sum of all positions', () => {
    fc.assert(
      fc.property(
        fc.array(watchProgressArb, { minLength: 0, maxLength: 30 }),
        (entries) => {
          localStorage.clear();
          const s = new LocalStore();

          const byKey = new Map<string, WatchProgressEntry>();
          for (const e of entries) {
            byKey.set(progressKey(e.contentId, e.seasonNumber, e.episodeNumber), e);
          }
          for (const e of byKey.values()) s.setWatchProgress(e);

          const stats = s.getViewingStats();
          const expectedTotal = Array.from(byKey.values()).reduce(
            (sum, e) => sum + e.position,
            0,
          );

          expect(stats.totalWatchTimeSeconds).toBe(expectedTotal);
          expect(stats.sessionsCount).toBe(byKey.size);
        },
      ),
      { numRuns: 100 },
    );
  });
});
