/**
 * Unit tests for Local_Store
 *
 * Tests CRUD with known fixtures, IndexedDB fallback,
 * corrupt JSON handling, and empty store edge cases.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { LocalStore } from '../../app/lib/local-store/local-store';
import type { WatchProgressEntry, WatchlistEntry } from '../../app/lib/local-store/types';
import { SCHEMA_VERSION } from '../../app/lib/local-store/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const movieEntry: WatchProgressEntry = {
  contentId: '12345',
  contentType: 'movie',
  title: 'Test Movie',
  position: 600,
  duration: 7200,
  lastWatched: 1_700_000_000_000,
};

const tvEntry: WatchProgressEntry = {
  contentId: '67890',
  contentType: 'tv',
  title: 'Test Show',
  seasonNumber: 2,
  episodeNumber: 5,
  position: 1200,
  duration: 2400,
  lastWatched: 1_700_000_100_000,
};

const watchlistItem: WatchlistEntry = {
  id: 'wl-1',
  mediaType: 'movie',
  title: 'Watchlist Movie',
  addedAt: 1_700_000_000_000,
};

let store: LocalStore;

beforeEach(() => {
  localStorage.clear();
  store = new LocalStore();
});

// ---------------------------------------------------------------------------
// CRUD with known fixture data
// ---------------------------------------------------------------------------
describe('Local_Store CRUD', () => {
  it('should store and retrieve a movie watch progress entry', () => {
    store.setWatchProgress(movieEntry);
    const result = store.getWatchProgress('12345');
    expect(result).not.toBeNull();
    expect(result!.contentId).toBe('12345');
    expect(result!.position).toBe(600);
    expect(result!.duration).toBe(7200);
  });

  it('should store and retrieve a TV episode watch progress entry', () => {
    store.setWatchProgress(tvEntry);
    const result = store.getWatchProgress('67890', 2, 5);
    expect(result).not.toBeNull();
    expect(result!.seasonNumber).toBe(2);
    expect(result!.episodeNumber).toBe(5);
  });

  it('should return null for non-existent watch progress', () => {
    expect(store.getWatchProgress('nonexistent')).toBeNull();
  });

  it('should add and remove watchlist entries', () => {
    store.addToWatchlist(watchlistItem);
    expect(store.isInWatchlist('wl-1')).toBe(true);
    expect(store.getWatchlist()).toHaveLength(1);

    store.removeFromWatchlist('wl-1');
    expect(store.isInWatchlist('wl-1')).toBe(false);
    expect(store.getWatchlist()).toHaveLength(0);
  });

  it('should not duplicate watchlist entries on re-add', () => {
    store.addToWatchlist(watchlistItem);
    store.addToWatchlist(watchlistItem);
    expect(store.getWatchlist()).toHaveLength(1);
  });

  it('should export and import all data', () => {
    store.setWatchProgress(movieEntry);
    store.addToWatchlist(watchlistItem);
    const exported = store.exportAll();

    localStorage.clear();
    const store2 = new LocalStore();
    store2.importAll(exported);

    expect(store2.getWatchProgress('12345')).not.toBeNull();
    expect(store2.isInWatchlist('wl-1')).toBe(true);
    expect(store2.exportAll().schemaVersion).toBe(SCHEMA_VERSION);
  });
});

// ---------------------------------------------------------------------------
// IndexedDB fallback on quota exceeded
// ---------------------------------------------------------------------------
describe('Local_Store IndexedDB fallback', () => {
  it('should not throw when localStorage.setItem throws QuotaExceededError', () => {
    // Simulate quota exceeded by overriding setItem
    const originalSetItem = localStorage.setItem.bind(localStorage);
    (localStorage as any).setItem = (_key: string, _value: string) => {
      const err = new DOMException('quota exceeded', 'QuotaExceededError');
      (err as any).code = 22;
      throw err;
    };

    expect(() => store.setWatchProgress(movieEntry)).not.toThrow();

    // Restore
    (localStorage as any).setItem = originalSetItem;
  });
});

// ---------------------------------------------------------------------------
// Corrupt JSON handling
// ---------------------------------------------------------------------------
describe('Local_Store corrupt JSON handling', () => {
  it('should return empty defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem('flyx_v2_watch_progress', '{broken json!!!');
    localStorage.setItem('flyx_v2_watchlist', 'not-an-array');

    const s = new LocalStore();
    expect(s.getAllWatchProgress()).toEqual([]);
    expect(s.getWatchlist()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Empty store edge cases
// ---------------------------------------------------------------------------
describe('Local_Store empty store', () => {
  it('should return empty arrays and zero stats on a fresh store', () => {
    expect(store.getAllWatchProgress()).toEqual([]);
    expect(store.getWatchlist()).toEqual([]);
    expect(store.getInProgress()).toEqual([]);
    expect(store.getWatchHistory(1, 10).items).toEqual([]);
    expect(store.getWatchHistory(1, 10).total).toBe(0);

    const stats = store.getViewingStats();
    expect(stats.totalWatchTimeSeconds).toBe(0);
    expect(stats.sessionsCount).toBe(0);
  });

  it('should handle removing from empty watchlist without error', () => {
    expect(() => store.removeFromWatchlist('nonexistent')).not.toThrow();
  });

  it('should serialize an empty store to valid JSON', () => {
    const json = store.serialize();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = store.deserialize(json);
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
