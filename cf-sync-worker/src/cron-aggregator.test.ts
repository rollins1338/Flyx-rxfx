import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeAggregationFromHeartbeats, HourlyAggregation } from './cron-aggregator';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const activityTypeArb = fc.constantFrom('browsing', 'watching', 'livetv');

const heartbeatArb = fc.record({
  ipHash: fc.hexaString({ minLength: 8, maxLength: 64 }),
  activityType: activityTypeArb,
  contentCategory: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 5: Aggregation computation correctness
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 5: Aggregation computation correctness', () => {
  it('totalUniqueSessions equals the count of distinct ipHash values', () => {
    fc.assert(
      fc.property(
        fc.array(heartbeatArb, { minLength: 0, maxLength: 200 }),
        (heartbeats) => {
          const result = computeAggregationFromHeartbeats(heartbeats);
          const uniqueIps = new Set(heartbeats.map(h => h.ipHash));
          expect(result.totalUniqueSessions).toBe(uniqueIps.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('activity type session counts sum correctly: each ip counted once per activity type', () => {
    fc.assert(
      fc.property(
        fc.array(heartbeatArb, { minLength: 0, maxLength: 200 }),
        (heartbeats) => {
          const result = computeAggregationFromHeartbeats(heartbeats);

          // Each session count should equal distinct ips for that activity type
          const watchingIps = new Set(heartbeats.filter(h => h.activityType === 'watching').map(h => h.ipHash));
          const browsingIps = new Set(heartbeats.filter(h => h.activityType === 'browsing').map(h => h.ipHash));
          const livetvIps = new Set(heartbeats.filter(h => h.activityType === 'livetv').map(h => h.ipHash));

          expect(result.watchingSessions).toBe(watchingIps.size);
          expect(result.browsingSessions).toBe(browsingIps.size);
          expect(result.livetvSessions).toBe(livetvIps.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('peakActive is >= any individual activity type count', () => {
    fc.assert(
      fc.property(
        fc.array(heartbeatArb, { minLength: 0, maxLength: 200 }),
        (heartbeats) => {
          const result = computeAggregationFromHeartbeats(heartbeats);
          expect(result.peakActive).toBeGreaterThanOrEqual(result.watchingSessions);
          expect(result.peakActive).toBeGreaterThanOrEqual(result.browsingSessions);
          expect(result.peakActive).toBeGreaterThanOrEqual(result.livetvSessions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty heartbeat set produces all-zero aggregation', () => {
    const result = computeAggregationFromHeartbeats([]);
    expect(result.totalUniqueSessions).toBe(0);
    expect(result.watchingSessions).toBe(0);
    expect(result.browsingSessions).toBe(0);
    expect(result.livetvSessions).toBe(0);
    expect(result.peakActive).toBe(0);
    expect(result.topCategories).toEqual([]);
  });

  it('topCategories contains at most 10 entries', () => {
    fc.assert(
      fc.property(
        fc.array(heartbeatArb, { minLength: 0, maxLength: 200 }),
        (heartbeats) => {
          const result = computeAggregationFromHeartbeats(heartbeats);
          expect(result.topCategories.length).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('topCategories are sorted by count descending', () => {
    fc.assert(
      fc.property(
        fc.array(heartbeatArb, { minLength: 1, maxLength: 200 }),
        (heartbeats) => {
          const result = computeAggregationFromHeartbeats(heartbeats);
          for (let i = 1; i < result.topCategories.length; i++) {
            expect(result.topCategories[i - 1].count).toBeGreaterThanOrEqual(
              result.topCategories[i].count
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
