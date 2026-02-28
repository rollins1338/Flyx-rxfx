/**
 * Unit tests for Local_Tracker
 *
 * Tests watch lifecycle, offline queue drain, queue overflow,
 * and no sync requests when no Sync_Code exists.
 *
 * Requirements: 2.2, 2.3, 3.5
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { LocalTracker } from '../../app/lib/local-tracker/local-tracker';
import { LocalStore } from '../../app/lib/local-store/local-store';
import { SyncManager } from '../../app/lib/local-tracker/sync-manager';

let store: LocalStore;
let tracker: LocalTracker;

beforeEach(() => {
  localStorage.clear();
  LocalTracker.resetInstance();
  store = new LocalStore();
  tracker = LocalTracker.getInstance(store);
  tracker.init();
});

// ---------------------------------------------------------------------------
// Watch lifecycle: start → progress → pause → stop
// ---------------------------------------------------------------------------
describe('Local_Tracker watch lifecycle', () => {
  it('should record watch progress through start → update → pause → stop', () => {
    tracker.startWatch('movie-1', 'movie', 'Test Movie', undefined, undefined, 7200);

    tracker.updateProgress(300, 7200);
    let progress = store.getWatchProgress('movie-1');
    expect(progress).not.toBeNull();
    expect(progress!.position).toBe(300);
    expect(progress!.duration).toBe(7200);

    tracker.updateProgress(600);
    progress = store.getWatchProgress('movie-1');
    expect(progress!.position).toBe(600);

    tracker.pauseWatch();
    progress = store.getWatchProgress('movie-1');
    expect(progress!.position).toBe(600);

    tracker.stopWatch();
    progress = store.getWatchProgress('movie-1');
    expect(progress).not.toBeNull();
    expect(progress!.contentId).toBe('movie-1');
  });

  it('should record TV episode with season and episode numbers', () => {
    tracker.startWatch('show-1', 'tv', 'Test Show', 2, 5, 2400);
    tracker.updateProgress(1200);
    tracker.stopWatch();

    const progress = store.getWatchProgress('show-1', 2, 5);
    expect(progress).not.toBeNull();
    expect(progress!.seasonNumber).toBe(2);
    expect(progress!.episodeNumber).toBe(5);
    expect(progress!.position).toBe(1200);
  });

  it('should stop previous watch when starting a new one', () => {
    tracker.startWatch('movie-1', 'movie', 'First Movie', undefined, undefined, 7200);
    tracker.updateProgress(500);

    tracker.startWatch('movie-2', 'movie', 'Second Movie', undefined, undefined, 5400);
    tracker.updateProgress(100);

    // First movie should still have its last progress
    const first = store.getWatchProgress('movie-1');
    expect(first!.position).toBe(500);

    // Second movie should have current progress
    const second = store.getWatchProgress('movie-2');
    expect(second!.position).toBe(100);
  });

  it('should be a no-op when updating/pausing/stopping with no active watch', () => {
    expect(() => tracker.updateProgress(100)).not.toThrow();
    expect(() => tracker.pauseWatch()).not.toThrow();
    expect(() => tracker.stopWatch()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Offline queue drain on online event
// ---------------------------------------------------------------------------
describe('Local_Tracker offline queue', () => {
  it('should drain offline queue when drainOfflineQueue is called', async () => {
    // Enqueue some payloads
    tracker.enqueueOffline({ activityType: 'browsing', timestamp: Date.now() });
    tracker.enqueueOffline({ activityType: 'watching', contentCategory: 'movie', timestamp: Date.now() });

    expect(tracker.readOfflineQueue().length).toBe(2);

    // Drain — deliverHeartbeat will fail (no sync worker URL), items re-enqueued
    // But the queue is cleared first, then failures re-enqueue
    await tracker.drainOfflineQueue();

    // Since there's no sync worker URL configured, deliverHeartbeat returns immediately
    // without error, so the queue should be empty after drain
    const queueAfter = tracker.readOfflineQueue();
    expect(queueAfter.length).toBe(0);
  });

  it('should drop oldest entries when queue exceeds 100', () => {
    for (let i = 0; i < 110; i++) {
      tracker.enqueueOffline({
        activityType: 'browsing',
        timestamp: 1_000_000_000_000 + i,
      });
    }

    const queue = tracker.readOfflineQueue();
    expect(queue.length).toBe(100);

    // Oldest entries (0-9) should be dropped, first entry should be #10
    expect(queue[0].timestamp).toBe(1_000_000_000_010);
    expect(queue[99].timestamp).toBe(1_000_000_000_109);
  });
});

// ---------------------------------------------------------------------------
// No sync requests when no Sync_Code exists
// ---------------------------------------------------------------------------
describe('Local_Tracker sync without code', () => {
  it('should return error when pushing sync without a sync code', async () => {
    const syncManager = new SyncManager(store, 'https://example.com');
    const result = await syncManager.pushSync();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No sync code');
  });

  it('should return error when pulling sync without a sync code', async () => {
    const syncManager = new SyncManager(store, 'https://example.com');
    const result = await syncManager.pullSync();
    expect(result.success).toBe(false);
    expect(result.error).toContain('No sync code');
  });
});
