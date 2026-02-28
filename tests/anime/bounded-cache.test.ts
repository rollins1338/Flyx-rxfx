import { describe, test, expect } from 'bun:test';
import fc from 'fast-check';
import { BoundedCache } from '../../app/lib/anime/bounded-cache';

describe('Feature: anime-clean-architecture', () => {
  describe('Property 10: Cache bounded size invariant', () => {
    /**
     * For any sequence of set operations on a BoundedCache with maxSize M,
     * the cache's size SHALL never exceed M.
     *
     * **Validates: Requirements 7.4**
     */
    test('cache size never exceeds maxSize after arbitrary set operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.array(fc.tuple(fc.string(), fc.integer()), { minLength: 1, maxLength: 200 }),
          (maxSize, entries) => {
            const cache = new BoundedCache<string, number>(maxSize, 60_000);

            for (const [key, value] of entries) {
              cache.set(key, value);
              expect(cache.size).toBeLessThanOrEqual(maxSize);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 11: Cache get-after-set within TTL', () => {
    /**
     * For any key-value pair, after calling set(key, value),
     * calling get(key) within the TTL SHALL return the same value.
     *
     * **Validates: Requirements 7.1**
     */
    test('get returns the set value within TTL', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.anything(),
          (key, value) => {
            const cache = new BoundedCache<string, unknown>(100, 60_000);
            cache.set(key, value);
            const retrieved = cache.get(key);
            expect(retrieved).toEqual(value);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
