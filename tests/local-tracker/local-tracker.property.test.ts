/**
 * Property-based tests for Local_Tracker
 *
 * Uses fast-check to verify universal correctness properties.
 *
 * Property 5: Offline queue persistence (Validates: Requirements 2.2)
 * Property 9: Heartbeat beacon minimality (Validates: Requirements 4.3)
 * Property 10: Heartbeat rate limiting (Validates: Requirements 4.4)
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import fc from 'fast-check';
import { LocalTracker, buildHeartbeatPayload } from '../../app/lib/local-tracker/local-tracker';
import type { HeartbeatPayload } from '../../app/lib/local-tracker/local-tracker';
import { LocalStore } from '../../app/lib/local-store/local-store';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const activityTypeArb = fc.constantFrom(
  'browsing' as const,
  'watching' as const,
  'livetv' as const,
);

const contentCategoryArb = fc.option(
  fc.constantFrom('movie', 'tv', 'anime', 'livetv', 'sports'),
  { nil: undefined },
);

const heartbeatPayloadArb: fc.Arbitrary<HeartbeatPayload> = fc.record({
  activityType: activityTypeArb,
  contentCategory: contentCategoryArb,
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  LocalTracker.resetInstance();
});

// ---------------------------------------------------------------------------
// Property 5: Offline queue persistence
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 5: Offline queue persistence', () => {
  it('any payload enqueued while offline SHALL appear in the offline queue', () => {
    fc.assert(
      fc.property(
        fc.array(heartbeatPayloadArb, { minLength: 1, maxLength: 50 }),
        (payloads) => {
          localStorage.clear();
          const store = new LocalStore();
          const tracker = LocalTracker.getInstance(store);
          tracker.init();

          // Enqueue all payloads (simulating offline)
          for (const p of payloads) {
            tracker.enqueueOffline(p);
          }

          const queue = tracker.readOfflineQueue();

          // Every enqueued payload should be in the queue
          // (up to MAX_QUEUE_SIZE=100, oldest dropped)
          const expectedCount = Math.min(payloads.length, 100);
          expect(queue.length).toBe(expectedCount);

          // The last N payloads should be preserved (oldest dropped)
          const expectedPayloads = payloads.slice(-100);
          for (let i = 0; i < expectedCount; i++) {
            expect(queue[i].activityType).toBe(expectedPayloads[i].activityType);
            expect(queue[i].timestamp).toBe(expectedPayloads[i].timestamp);
          }

          LocalTracker.resetInstance();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Heartbeat beacon minimality
// Validates: Requirements 4.3
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 9: Heartbeat beacon minimality', () => {
  it('heartbeat payload SHALL contain only activityType, contentCategory, and timestamp', () => {
    fc.assert(
      fc.property(activityTypeArb, contentCategoryArb, (activityType, contentCategory) => {
        const payload = buildHeartbeatPayload(activityType, contentCategory);

        // Only allowed keys
        const allowedKeys = new Set(['activityType', 'contentCategory', 'timestamp']);
        const actualKeys = Object.keys(payload);

        for (const key of actualKeys) {
          expect(allowedKeys.has(key)).toBe(true);
        }

        // Must have activityType and timestamp
        expect(payload.activityType).toBe(activityType);
        expect(typeof payload.timestamp).toBe('number');

        // Must NOT have any identifying information
        expect((payload as any).userId).toBeUndefined();
        expect((payload as any).deviceId).toBeUndefined();
        expect((payload as any).sessionId).toBeUndefined();
        expect((payload as any).ipAddress).toBeUndefined();
        expect((payload as any).userAgent).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Heartbeat rate limiting
// Validates: Requirements 4.4
// ---------------------------------------------------------------------------
describe('Feature: local-first-analytics, Property 10: Heartbeat rate limiting', () => {
  it('calling sendHeartbeat multiple times within 5 minutes SHALL result in at most one send', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        activityTypeArb,
        (callCount, activityType) => {
          localStorage.clear();
          LocalTracker.resetInstance();

          const store = new LocalStore();
          const tracker = LocalTracker.getInstance(store);
          tracker.init();

          // Mock navigator.onLine = false so payloads go to offline queue
          // (avoids actual fetch calls)
          const origNavigator = (global as any).navigator;
          (global as any).navigator = { ...origNavigator, onLine: false };

          // Reset heartbeat timer so first call goes through
          tracker.resetHeartbeatTimer();

          // Call sendHeartbeat multiple times rapidly
          for (let i = 0; i < callCount; i++) {
            tracker.sendHeartbeat(activityType);
          }

          const queue = tracker.readOfflineQueue();

          // At most 1 heartbeat should have been enqueued
          // (rate limiting: 5-minute minimum interval)
          expect(queue.length).toBeLessThanOrEqual(1);
          expect(queue.length).toBe(1);

          // Restore
          (global as any).navigator = origNavigator;
          LocalTracker.resetInstance();
        },
      ),
      { numRuns: 100 },
    );
  });
});
