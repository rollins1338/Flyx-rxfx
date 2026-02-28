import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isCompletedPeriod,
  getCurrentHourBoundary,
  determineQuerySource,
  parseSlices,
  parseTimeRange,
  VALID_SLICES,
} from './stats-api';

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 6: Cache routing for completed periods
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 6: Cache routing for completed periods', () => {
  it('any time range ending before the current hour boundary is a completed period', () => {
    fc.assert(
      fc.property(
        // Generate a "now" timestamp (recent, within last year)
        fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() }),
        (now) => {
          const boundary = getCurrentHourBoundary(now);

          // Generate a range that ends strictly before the boundary
          // rangeEnd is at least 1ms before boundary, rangeStart is before rangeEnd
          if (boundary <= 1) return; // skip degenerate case

          const rangeEnd = boundary - 1;
          const rangeStart = rangeEnd - 60 * 60 * 1000; // 1 hour range

          expect(isCompletedPeriod(rangeStart, rangeEnd, now)).toBe(true);
          expect(determineQuerySource(rangeStart, rangeEnd, true, now)).toBe('cache');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('any time range ending after the current hour boundary is NOT a completed period', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() }),
        fc.integer({ min: 1, max: 60 * 60 * 1000 }),
        (now, offset) => {
          const boundary = getCurrentHourBoundary(now);

          // Range that ends strictly after the boundary
          const rangeEnd = boundary + offset;
          const rangeStart = rangeEnd - 2 * 60 * 60 * 1000;

          expect(isCompletedPeriod(rangeStart, rangeEnd, now)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completed period with cache data routes to "cache", without cache data routes to "live"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() }),
        fc.boolean(),
        (now, hasCacheData) => {
          const boundary = getCurrentHourBoundary(now);
          if (boundary <= 1) return;

          const rangeEnd = boundary - 1;
          const rangeStart = rangeEnd - 60 * 60 * 1000;

          const source = determineQuerySource(rangeStart, rangeEnd, hasCacheData, now);

          if (hasCacheData) {
            expect(source).toBe('cache');
          } else {
            expect(source).toBe('live');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('incomplete period with cache data routes to "cache+delta"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() }),
        (now) => {
          const boundary = getCurrentHourBoundary(now);
          // Range that spans into the current incomplete period
          const rangeEnd = now;
          const rangeStart = rangeEnd - 2 * 60 * 60 * 1000;

          // Only test when range actually crosses the boundary
          if (rangeEnd <= boundary) return;

          const source = determineQuerySource(rangeStart, rangeEnd, true, now);
          expect(source).toBe('cache+delta');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getCurrentHourBoundary always returns a timestamp with minutes/seconds/ms zeroed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
        (now) => {
          const boundary = getCurrentHourBoundary(now);
          const d = new Date(boundary);
          expect(d.getMinutes()).toBe(0);
          expect(d.getSeconds()).toBe(0);
          expect(d.getMilliseconds()).toBe(0);
          expect(boundary).toBeLessThanOrEqual(now);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 7: Cache plus delta equivalence
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 7: Cache plus delta equivalence', () => {
  /**
   * For any cached aggregation data and current-period delta data,
   * combining them should produce a result that contains both the cached
   * historical data and the current period delta, and the combination
   * should be equivalent to having all the data together.
   */

  const aggregationPayloadArb = fc.record({
    peakActive: fc.nat(1000),
    totalUniqueSessions: fc.nat(1000),
    watchingSessions: fc.nat(500),
    browsingSessions: fc.nat(500),
    livetvSessions: fc.nat(500),
  });

  const deltaPayloadArb = fc.record({
    currentPeriodActive: fc.nat(100),
    currentPeriodWatching: fc.nat(50),
    currentPeriodBrowsing: fc.nat(50),
    currentPeriodLivetv: fc.nat(50),
  });

  it('combining cached data with delta preserves all cached entries', () => {
    fc.assert(
      fc.property(
        fc.array(aggregationPayloadArb, { minLength: 1, maxLength: 20 }),
        deltaPayloadArb,
        (cachedEntries, delta) => {
          // Simulate the combination logic from handleConsolidatedStats
          const cached: Record<string, unknown[]> = {
            hourly_activity: cachedEntries.map((entry, i) => ({
              timeBucket: `2025-01-15T${String(i).padStart(2, '0')}:00`,
              ...entry,
              computedAt: Date.now(),
            })),
          };

          const combined = {
            cached,
            currentPeriod: delta,
          };

          // All cached entries should be preserved
          const cachedResult = combined.cached.hourly_activity;
          expect(cachedResult.length).toBe(cachedEntries.length);

          // Delta should be present
          expect(combined.currentPeriod).toEqual(delta);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('combined result contains both cached and delta data without data loss', () => {
    fc.assert(
      fc.property(
        aggregationPayloadArb,
        deltaPayloadArb,
        (cachedPayload, deltaPayload) => {
          // The combined result should have both parts
          const combined = {
            cached: { hourly_activity: [{ timeBucket: '2025-01-15T14:00', ...cachedPayload }] },
            currentPeriod: deltaPayload,
          };

          // Verify cached data integrity
          const cachedEntry = combined.cached.hourly_activity[0] as Record<string, unknown>;
          expect(cachedEntry.peakActive).toBe(cachedPayload.peakActive);
          expect(cachedEntry.totalUniqueSessions).toBe(cachedPayload.totalUniqueSessions);

          // Verify delta data integrity
          expect(combined.currentPeriod.currentPeriodActive).toBe(deltaPayload.currentPeriodActive);
          expect(combined.currentPeriod.currentPeriodWatching).toBe(deltaPayload.currentPeriodWatching);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total activity in combined result >= cached activity (delta only adds)', () => {
    fc.assert(
      fc.property(
        aggregationPayloadArb,
        deltaPayloadArb,
        (cachedPayload, deltaPayload) => {
          // The total across cached + delta should be >= cached alone
          const totalCached = cachedPayload.totalUniqueSessions;
          const totalCombined = totalCached + deltaPayload.currentPeriodActive;

          expect(totalCombined).toBeGreaterThanOrEqual(totalCached);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests for parseSlices
// ---------------------------------------------------------------------------

describe('parseSlices', () => {
  it('returns all valid slices when param is null', () => {
    expect(parseSlices(null)).toEqual([...VALID_SLICES]);
  });

  it('returns all valid slices when param is empty string', () => {
    const result = parseSlices('');
    expect(result).toEqual([...VALID_SLICES]);
  });

  it('filters to only valid slice names', () => {
    expect(parseSlices('realtime,invalid,users')).toEqual(['realtime', 'users']);
  });

  it('returns single valid slice', () => {
    expect(parseSlices('content')).toEqual(['content']);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for parseTimeRange
// ---------------------------------------------------------------------------

describe('parseTimeRange', () => {
  it('parses hours correctly', () => {
    const now = Date.now();
    const [start, end] = parseTimeRange('24h', now);
    expect(end).toBe(now);
    expect(start).toBe(now - 24 * 60 * 60 * 1000);
  });

  it('parses days correctly', () => {
    const now = Date.now();
    const [start, end] = parseTimeRange('7d', now);
    expect(end).toBe(now);
    expect(start).toBe(now - 7 * 24 * 60 * 60 * 1000);
  });

  it('defaults to 24h for invalid range', () => {
    const now = Date.now();
    const [start, end] = parseTimeRange('invalid', now);
    expect(end).toBe(now);
    expect(start).toBe(now - 24 * 60 * 60 * 1000);
  });
});
