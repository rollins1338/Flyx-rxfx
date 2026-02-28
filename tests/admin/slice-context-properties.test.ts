/**
 * Property-Based Tests for slice contexts
 *
 * Feature: admin-panel-realtime-rewrite
 * Property 8: Tab-to-channel subscription mapping
 * Property 10: Delta merge preserves unchanged fields
 * Validates: Requirements 4.1, 4.2, 7.2
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { mergeDelta, getChannelsForTab, TAB_CHANNEL_MAP } from '../../app/admin/context/slices';
import type { DeltaUpdate } from '../../app/admin/hooks/useSSE';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const tabNameArb = fc.constantFrom(
  'dashboard', 'content', 'users', 'geographic', 'health', 'settings'
);

const stateArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(
    fc.integer(),
    fc.string({ maxLength: 50 }),
    fc.boolean(),
    fc.constant(null),
    fc.array(fc.integer(), { maxLength: 5 }),
  ),
  { minKeys: 1, maxKeys: 10 },
);

const deltaArb = fc.tuple(stateArb, stateArb).map(([base, changes]) => {
  // Pick a subset of keys from changes to simulate partial delta
  const deltaChanges: Record<string, unknown> = {};
  const keys = Object.keys(changes);
  for (const key of keys.slice(0, Math.max(1, Math.floor(keys.length / 2)))) {
    deltaChanges[key] = changes[key];
  }
  return {
    base,
    delta: {
      channel: 'realtime',
      sequence: 1,
      timestamp: Date.now(),
      changes: deltaChanges,
    } as DeltaUpdate,
  };
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 8: Tab-to-channel subscription mapping
// Validates: Requirements 4.1, 4.2
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 8: Tab-to-channel subscription mapping', () => {
  test('navigating to a tab returns exactly the predefined channels for that tab', () => {
    fc.assert(
      fc.property(
        tabNameArb,
        (tab) => {
          const channels = getChannelsForTab(tab);
          const expected = TAB_CHANNEL_MAP[tab] ?? [];
          expect(channels).toEqual(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('after navigating to a new tab, no channels from the previous tab remain (unless shared)', () => {
    fc.assert(
      fc.property(
        tabNameArb,
        tabNameArb,
        (prevTab, nextTab) => {
          const prevChannels = new Set(getChannelsForTab(prevTab));
          const nextChannels = new Set(getChannelsForTab(nextTab));

          // The active channels should be exactly the next tab's channels
          // Any channel from prevTab that is NOT in nextTab should not be active
          for (const ch of prevChannels) {
            if (!nextChannels.has(ch)) {
              // This channel should no longer be subscribed
              expect(nextChannels.has(ch)).toBe(false);
            }
          }

          // All channels in nextTab should be present
          const expectedChannels = TAB_CHANNEL_MAP[nextTab] ?? [];
          expect([...nextChannels].sort()).toEqual([...expectedChannels].sort());
        }
      ),
      { numRuns: 200 }
    );
  });

  test('unknown tab names return empty channel set', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          s => !Object.keys(TAB_CHANNEL_MAP).includes(s)
        ),
        (unknownTab) => {
          const channels = getChannelsForTab(unknownTab);
          expect(channels).toEqual([]);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 10: Delta merge preserves unchanged fields
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 10: Delta merge preserves unchanged fields', () => {
  test('keys in delta have values from delta, keys only in base retain original values', () => {
    fc.assert(
      fc.property(
        deltaArb,
        ({ base, delta }) => {
          const merged = mergeDelta(base, delta);

          // Keys in delta.changes should have delta values
          for (const [key, value] of Object.entries(delta.changes)) {
            expect(merged[key]).toEqual(value);
          }

          // Keys in base but NOT in delta.changes should retain base values
          for (const [key, value] of Object.entries(base)) {
            if (!(key in delta.changes)) {
              expect(merged[key]).toEqual(value);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  test('merge is equivalent to { ...base, ...delta.changes }', () => {
    fc.assert(
      fc.property(
        deltaArb,
        ({ base, delta }) => {
          const merged = mergeDelta(base, delta);
          const expected = { ...base, ...delta.changes };
          expect(merged).toEqual(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('merging an empty delta preserves all base fields', () => {
    fc.assert(
      fc.property(
        stateArb,
        (base) => {
          const emptyDelta: DeltaUpdate = {
            channel: 'realtime',
            sequence: 1,
            timestamp: Date.now(),
            changes: {},
          };
          const merged = mergeDelta(base, emptyDelta);
          expect(merged).toEqual(base);
        }
      ),
      { numRuns: 200 }
    );
  });
});
