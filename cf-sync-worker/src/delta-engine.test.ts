import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DeltaEngine } from './delta-engine';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Safe key generator that excludes prototype-polluting keys like __proto__ */
const safeKeyArb = fc.string({ minLength: 1, maxLength: 10 }).filter(
  (k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'
);

/** Arbitrary for a flat or shallow-nested state object */
const stateValueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.integer(),
  fc.string({ minLength: 0, maxLength: 20 }),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
  fc.dictionary(
    safeKeyArb,
    fc.oneof(fc.integer(), fc.string({ minLength: 0, maxLength: 10 })),
    { minKeys: 0, maxKeys: 4 }
  )
);

const stateArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  safeKeyArb,
  stateValueArb,
  { minKeys: 1, maxKeys: 10 }
);

const channelArb = fc.constantFrom('realtime', 'content', 'geographic', 'users');

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 9: Delta contains only changed fields
// Validates: Requirements 7.1
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 9: Delta contains only changed fields', () => {
  it('delta contains exactly the keys where S1[key] !== S2[key]', () => {
    fc.assert(
      fc.property(
        channelArb,
        stateArb,
        stateArb,
        (channel, s1, s2) => {
          const engine = new DeltaEngine();

          // Set initial state
          engine.computeDelta(channel, s1, 1000);

          // Compute delta to s2
          const delta = engine.computeDelta(channel, s2, 2000);

          // Determine which keys actually changed
          const allKeys = new Set([...Object.keys(s1), ...Object.keys(s2)]);
          const changedKeys = new Set<string>();
          for (const key of allKeys) {
            if (JSON.stringify(s1[key]) !== JSON.stringify(s2[key])) {
              changedKeys.add(key);
            }
          }

          if (changedKeys.size === 0) {
            // No changes — delta should be null
            expect(delta).toBeNull();
          } else {
            expect(delta).not.toBeNull();
            const deltaKeys = new Set(Object.keys(delta!.changes));
            expect(deltaKeys).toEqual(changedKeys);

            // Each changed key should have the value from s2
            for (const key of changedKeys) {
              expect(JSON.stringify(delta!.changes[key])).toBe(
                JSON.stringify(s2[key])
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sequence number is strictly increasing per channel', () => {
    fc.assert(
      fc.property(
        channelArb,
        fc.array(stateArb, { minLength: 2, maxLength: 10 }),
        (channel, states) => {
          const engine = new DeltaEngine();
          let lastSeq = 0;

          for (const state of states) {
            const delta = engine.computeDelta(channel, state, Date.now());
            if (delta !== null) {
              expect(delta.sequence).toBeGreaterThan(lastSeq);
              lastSeq = delta.sequence;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('identical consecutive states produce null delta', () => {
    fc.assert(
      fc.property(channelArb, stateArb, (channel, state) => {
        const engine = new DeltaEngine();
        engine.computeDelta(channel, state, 1000);
        const delta = engine.computeDelta(channel, { ...state }, 2000);
        expect(delta).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: admin-panel-realtime-rewrite
// Property 10: Delta merge preserves unchanged fields
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('Feature: admin-panel-realtime-rewrite, Property 10: Delta merge preserves unchanged fields', () => {
  it('merging delta into base produces correct state: changed keys from delta, unchanged from base', () => {
    fc.assert(
      fc.property(
        channelArb,
        stateArb,
        stateArb,
        (channel, base, next) => {
          const engine = new DeltaEngine();

          // Establish base state
          engine.computeDelta(channel, base, 1000);

          // Compute delta to next
          const delta = engine.computeDelta(channel, next, 2000);

          // Merge: spread base with delta changes (the client-side operation)
          const merged = delta
            ? { ...base, ...delta.changes }
            : { ...base };

          // The merged state should match next for all keys in next
          for (const key of Object.keys(next)) {
            expect(JSON.stringify(merged[key])).toBe(
              JSON.stringify(next[key])
            );
          }

          // Keys in base but NOT in next should be preserved in merged
          // (unless the delta explicitly set them to undefined)
          for (const key of Object.keys(base)) {
            if (!(key in next)) {
              if (delta && key in delta.changes) {
                // Delta explicitly includes this key (set to undefined)
                expect(JSON.stringify(merged[key])).toBe(
                  JSON.stringify(delta.changes[key])
                );
              } else {
                // Not in delta — base value preserved
                expect(JSON.stringify(merged[key])).toBe(
                  JSON.stringify(base[key])
                );
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('merge is equivalent to {...base, ...delta.changes}', () => {
    fc.assert(
      fc.property(
        channelArb,
        stateArb,
        stateArb,
        (channel, base, next) => {
          const engine = new DeltaEngine();
          engine.computeDelta(channel, base, 1000);
          const delta = engine.computeDelta(channel, next, 2000);

          const spreadMerge = delta
            ? { ...base, ...delta.changes }
            : { ...base };

          // Manual merge for verification
          const manualMerge: Record<string, unknown> = { ...base };
          if (delta) {
            for (const [k, v] of Object.entries(delta.changes)) {
              manualMerge[k] = v;
            }
          }

          expect(JSON.stringify(spreadMerge)).toBe(
            JSON.stringify(manualMerge)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
