import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HeartbeatBuffer, HeartbeatEntry } from './heartbeat-buffer';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const activityTypeArb = fc.constantFrom('browsing', 'watching', 'livetv') as fc.Arbitrary<HeartbeatEntry['activityType']>;

const heartbeatEntryArb: fc.Arbitrary<HeartbeatEntry> = fc.record({
  ipHash: fc.hexaString({ minLength: 8, maxLength: 64 }),
  activityType: activityTypeArb,
  contentCategory: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
});

// Generate arrays of heartbeat entries with unique ipHash values
const uniqueHeartbeatsArb = (opts?: { minLength?: number; maxLength?: number }) =>
  fc.uniqueArray(heartbeatEntryArb, {
    comparator: (a, b) => a.ipHash === b.ipHash,
    minLength: opts?.minLength ?? 0,
    maxLength: opts?.maxLength ?? 200,
  });

// ---------------------------------------------------------------------------
// D1 mock helpers
// ---------------------------------------------------------------------------

function createMockD1(shouldFail = false): D1Database {
  return {
    prepare: () => ({
      bind: () => ({ }),
    }),
    batch: shouldFail
      ? () => Promise.reject(new Error('D1 batch failure'))
      : () => Promise.resolve([]),
  } as unknown as D1Database;
}

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 3: Heartbeat buffer flush conditions
// Validates: Requirements 2.1, 2.2, 2.3
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 3: Heartbeat buffer flush conditions', () => {
  it('shouldFlush() returns false when buffer is empty regardless of elapsed time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        (elapsed) => {
          const startTime = 1_000_000;
          const buffer = new HeartbeatBuffer(startTime);
          expect(buffer.shouldFlush(startTime + elapsed)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shouldFlush() returns true when size >= 50 (regardless of elapsed time)', () => {
    fc.assert(
      fc.property(
        uniqueHeartbeatsArb({ minLength: 50, maxLength: 200 }),
        fc.integer({ min: 0, max: 100_000 }),
        (entries, elapsed) => {
          const startTime = 1_000_000;
          const buffer = new HeartbeatBuffer(startTime);
          for (const e of entries) buffer.add(e);
          expect(buffer.shouldFlush(startTime + elapsed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shouldFlush() returns true when elapsed >= 10s and buffer is non-empty', () => {
    fc.assert(
      fc.property(
        uniqueHeartbeatsArb({ minLength: 1, maxLength: 49 }),
        fc.integer({ min: 10_000, max: 100_000 }),
        (entries, elapsed) => {
          const startTime = 1_000_000;
          const buffer = new HeartbeatBuffer(startTime);
          for (const e of entries) buffer.add(e);
          expect(buffer.shouldFlush(startTime + elapsed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shouldFlush() returns false when size < 50 and elapsed < 10s', () => {
    fc.assert(
      fc.property(
        uniqueHeartbeatsArb({ minLength: 1, maxLength: 49 }),
        fc.integer({ min: 0, max: 9_999 }),
        (entries, elapsed) => {
          const startTime = 1_000_000;
          const buffer = new HeartbeatBuffer(startTime);
          for (const e of entries) buffer.add(e);
          expect(buffer.shouldFlush(startTime + elapsed)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adding a heartbeat increases size by 1 (or 0 for duplicate ipHash)', () => {
    fc.assert(
      fc.property(
        uniqueHeartbeatsArb({ minLength: 0, maxLength: 100 }),
        heartbeatEntryArb,
        (existing, newEntry) => {
          const buffer = new HeartbeatBuffer();
          for (const e of existing) buffer.add(e);
          const sizeBefore = buffer.size;
          const hadKey = existing.some((e) => e.ipHash === newEntry.ipHash);
          buffer.add(newEntry);
          if (hadKey) {
            expect(buffer.size).toBe(sizeBefore);
          } else {
            expect(buffer.size).toBe(sizeBefore + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 4: Buffer retention on flush failure
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 4: Buffer retention on flush failure', () => {
  it('all entries are retained after a failed flush', () => {
    fc.assert(
      fc.asyncProperty(
        uniqueHeartbeatsArb({ minLength: 1, maxLength: 100 }),
        async (entries) => {
          const buffer = new HeartbeatBuffer();
          for (const e of entries) buffer.add(e);
          const sizeBefore = buffer.size;
          const snapshotBefore = buffer.getSnapshot().map((e) => e.ipHash).sort();

          const failingDb = createMockD1(true);
          await buffer.flush(failingDb);

          expect(buffer.size).toBe(sizeBefore);
          const snapshotAfter = buffer.getSnapshot().map((e) => e.ipHash).sort();
          expect(snapshotAfter).toEqual(snapshotBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('consecutive failure counter increments on each failed flush', () => {
    fc.assert(
      fc.asyncProperty(
        uniqueHeartbeatsArb({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        async (entries, failCount) => {
          const buffer = new HeartbeatBuffer();
          for (const e of entries) buffer.add(e);
          const failingDb = createMockD1(true);

          for (let i = 0; i < failCount; i++) {
            await buffer.flush(failingDb);
          }
          expect(buffer.getConsecutiveFailures()).toBe(failCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('successful flush clears buffer and resets failure counter', () => {
    fc.assert(
      fc.asyncProperty(
        uniqueHeartbeatsArb({ minLength: 1, maxLength: 50 }),
        async (entries) => {
          const buffer = new HeartbeatBuffer();
          for (const e of entries) buffer.add(e);

          // Fail once
          await buffer.flush(createMockD1(true));
          expect(buffer.getConsecutiveFailures()).toBe(1);

          // Succeed
          await buffer.flush(createMockD1(false));
          expect(buffer.size).toBe(0);
          expect(buffer.getConsecutiveFailures()).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 14: Buffer overflow cap after repeated failures
// Validates: Requirements 10.4
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 14: Buffer overflow cap after repeated failures', () => {
  it('buffer never exceeds 500 entries after 3+ consecutive failures', () => {
    fc.assert(
      fc.asyncProperty(
        uniqueHeartbeatsArb({ minLength: 501, maxLength: 700 }),
        async (entries) => {
          const buffer = new HeartbeatBuffer();
          for (const e of entries) buffer.add(e);
          const failingDb = createMockD1(true);

          // Fail 3 times to trigger overflow cap
          await buffer.flush(failingDb);
          await buffer.flush(failingDb);
          await buffer.flush(failingDb);

          expect(buffer.size).toBeLessThanOrEqual(500);
          expect(buffer.getConsecutiveFailures()).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('oldest entries (by timestamp) are discarded first when overflow cap is enforced', () => {
    fc.assert(
      fc.asyncProperty(
        uniqueHeartbeatsArb({ minLength: 501, maxLength: 700 }),
        async (entries) => {
          const buffer = new HeartbeatBuffer();
          for (const e of entries) buffer.add(e);

          // Sort all entries by timestamp to know which are "oldest"
          const allSorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
          const expectedDiscardCount = entries.length - 500;
          const expectedDiscardedHashes = new Set(
            allSorted.slice(0, expectedDiscardCount).map((e) => e.ipHash)
          );

          const failingDb = createMockD1(true);
          await buffer.flush(failingDb);
          await buffer.flush(failingDb);
          await buffer.flush(failingDb);

          const remaining = buffer.getSnapshot();
          const remainingHashes = new Set(remaining.map((e) => e.ipHash));

          // None of the discarded entries should remain
          for (const hash of expectedDiscardedHashes) {
            expect(remainingHashes.has(hash)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('buffer below 500 is not trimmed even after 3+ failures', () => {
    fc.assert(
      fc.asyncProperty(
        uniqueHeartbeatsArb({ minLength: 1, maxLength: 499 }),
        async (entries) => {
          const buffer = new HeartbeatBuffer();
          for (const e of entries) buffer.add(e);
          const sizeBefore = buffer.size;
          const failingDb = createMockD1(true);

          await buffer.flush(failingDb);
          await buffer.flush(failingDb);
          await buffer.flush(failingDb);

          // Size should remain unchanged since it's under the cap
          expect(buffer.size).toBe(sizeBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
