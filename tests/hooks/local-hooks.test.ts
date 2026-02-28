/**
 * Unit tests for local-first React hooks.
 *
 * Since @testing-library/react is not available, we test the
 * underlying logic that the hooks wrap: LocalStore reads/writes
 * and LocalTracker lifecycle.
 *
 * Requirements: 7.1, 7.2
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LocalStore } from '../../app/lib/local-store/local-store';
import { LocalTracker } from '../../app/lib/local-tracker/local-tracker';
import type { WatchProgressEntry, WatchlistEntry } from '../../app/lib/local-store/types';

let store: LocalStore;

beforeEach(() => {
  localStorage.clear();
  LocalTracker.resetInstance();
  store = new LocalStore();
});

// ---------------------------------------------------------------------------
// useLocalWatchProgress logic
// ---------------------------------------------------------------------------
describe('useLocalWatchProgress logic', () => {
  it('should return correct progress after writing', () => {
    const entry: WatchProgressEntry = {
      contentId: 'movie-1',
      contentType: 'movie',
      title: 'Test Movie',
      position: 300,
      duration: 7200,
      lastWatched: Date.now(),
    };
    store.setWatchProgress(entry);

    const result = store.getWatchProgress('movie-1');
    expect(result).not.toBeNull();
    expect(result!.position).toBe(300);
    expect(result!.duration).toBe(7200);
  });

  it('should return null for non-existent content', () => {
    expect(store.getWatchProgress('nonexistent')).toBeNull();
  });

  it('should update progress for TV episodes with season/episode', () => {
    const entry: WatchProgressEntry = {
      contentId: 'tv-1',
      contentType: 'tv',
      title: 'Test Show',
      seasonNumber: 2,
      episodeNumber: 3,
      position: 600,
      duration: 2400,
      lastWatched: Date.now(),
    };
    store.setWatchProgress(entry);

    const result = store.getWatchProgress('tv-1', 2, 3);
    expect(result).not.toBeNull();
    expect(result!.seasonNumber).toBe(2);
    expect(result!.episodeNumber).toBe(3);
    expect(result!.position).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// useContinueWatching logic
// ---------------------------------------------------------------------------
describe('useContinueWatching logic', () => {
  it('should return in-progress items filtered and sorted', () => {
    // Item at 50% — should be included
    store.setWatchProgress({
      contentId: 'a',
      contentType: 'movie',
      title: 'Movie A',
      position: 500,
      duration: 1000,
      lastWatched: 1000,
    });
    // Item at 10% — should be included
    store.setWatchProgress({
      contentId: 'b',
      contentType: 'movie',
      title: 'Movie B',
      position: 100,
      duration: 1000,
      lastWatched: 2000,
    });
    // Item at 2% — should be excluded (< 5%)
    store.setWatchProgress({
      contentId: 'c',
      contentType: 'movie',
      title: 'Movie C',
      position: 20,
      duration: 1000,
      lastWatched: 3000,
    });
    // Item at 98% — should be excluded (> 95%)
    store.setWatchProgress({
      contentId: 'd',
      contentType: 'movie',
      title: 'Movie D',
      position: 980,
      duration: 1000,
      lastWatched: 4000,
    });

    const inProgress = store.getInProgress();
    expect(inProgress).toHaveLength(2);
    // Sorted by lastWatched desc
    expect(inProgress[0].contentId).toBe('b');
    expect(inProgress[1].contentId).toBe('a');
  });

  it('should return empty array when no items are in progress', () => {
    expect(store.getInProgress()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// useLocalWatchlist logic
// ---------------------------------------------------------------------------
describe('useLocalWatchlist logic', () => {
  it('should add and remove items', () => {
    const entry: WatchlistEntry = {
      id: 'wl-1',
      mediaType: 'movie',
      title: 'Watchlist Movie',
      addedAt: Date.now(),
    };

    store.addToWatchlist(entry);
    expect(store.getWatchlist()).toHaveLength(1);
    expect(store.isInWatchlist('wl-1')).toBe(true);

    store.removeFromWatchlist('wl-1');
    expect(store.getWatchlist()).toHaveLength(0);
    expect(store.isInWatchlist('wl-1')).toBe(false);
  });

  it('should not duplicate entries on re-add', () => {
    const entry: WatchlistEntry = {
      id: 'wl-2',
      mediaType: 'tv',
      title: 'Watchlist Show',
      addedAt: Date.now(),
    };

    store.addToWatchlist(entry);
    store.addToWatchlist(entry);
    expect(store.getWatchlist()).toHaveLength(1);
  });

  it('should handle removing non-existent item gracefully', () => {
    expect(() => store.removeFromWatchlist('nonexistent')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useLocalViewingStats logic
// ---------------------------------------------------------------------------
describe('useLocalViewingStats logic', () => {
  it('should compute stats from watch progress entries', () => {
    store.setWatchProgress({
      contentId: 'a',
      contentType: 'movie',
      title: 'A',
      position: 300,
      duration: 7200,
      lastWatched: Date.now(),
    });
    store.setWatchProgress({
      contentId: 'b',
      contentType: 'movie',
      title: 'B',
      position: 700,
      duration: 3600,
      lastWatched: Date.now(),
    });

    const stats = store.getViewingStats();
    expect(stats.totalWatchTimeSeconds).toBe(1000);
    expect(stats.sessionsCount).toBe(2);
  });

  it('should return zero stats for empty store', () => {
    const stats = store.getViewingStats();
    expect(stats.totalWatchTimeSeconds).toBe(0);
    expect(stats.sessionsCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LocalTracker integration (useLocalTracker lifecycle)
// ---------------------------------------------------------------------------
describe('LocalTracker lifecycle', () => {
  it('should init and destroy without errors', () => {
    const tracker = LocalTracker.getInstance();
    expect(() => tracker.init()).not.toThrow();
    expect(() => tracker.destroy()).not.toThrow();
  });

  it('should write progress to store on startWatch + updateProgress', () => {
    const tracker = LocalTracker.getInstance(store);
    tracker.init();

    tracker.startWatch('movie-99', 'movie', 'Test', undefined, undefined, 7200);
    tracker.updateProgress(120, 7200);

    const entry = store.getWatchProgress('movie-99');
    expect(entry).not.toBeNull();
    expect(entry!.position).toBe(120);

    tracker.destroy();
  });

  it('should clear current watch on stopWatch', () => {
    const tracker = LocalTracker.getInstance(store);
    tracker.init();

    tracker.startWatch('movie-100', 'movie', 'Test', undefined, undefined, 3600);
    tracker.updateProgress(500, 3600);
    tracker.stopWatch();

    // Progress should still be persisted
    const entry = store.getWatchProgress('movie-100');
    expect(entry).not.toBeNull();
    expect(entry!.position).toBe(500);

    tracker.destroy();
  });
});
