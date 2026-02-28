/**
 * Property-based tests for navigation utility functions.
 *
 * Feature: navigation-pages-redesign
 * Property 6: Active route matching is correct
 * Validates: Requirements 2.3, 3.2, 6.5
 *
 * Property 5: Command palette filtering returns only matching items
 * Validates: Requirements 4.2
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { isActiveRoute, filterCommandItems, type CommandItem } from '../../app/components/navigation/nav-utils';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generates a non-empty path segment like "/movies" or "/anime/sub" */
const nonRootPathArb = fc
  .array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 1, maxLength: 3 })
  .map(segments => '/' + segments.join('/'));

/** Generates a CommandItem with an arbitrary label */
const commandItemArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  label: fc.string({ minLength: 1, maxLength: 30 }),
  path: nonRootPathArb,
  icon: fc.constant(null as unknown as React.ReactNode),
  section: fc.constantFrom('navigation' as const, 'recent' as const),
});

// ---------------------------------------------------------------------------
// Property 6: Active route matching is correct
// ---------------------------------------------------------------------------

describe('Feature: navigation-pages-redesign, Property 6: Active route matching is correct', () => {
  test('root path "/" is active only when currentPath is exactly "/"', () => {
    fc.assert(
      fc.property(nonRootPathArb, (randomPath) => {
        // Root should NOT match any non-root path
        expect(isActiveRoute('/', randomPath)).toBe(false);
      }),
      { numRuns: 100 },
    );
    // Root matches itself
    expect(isActiveRoute('/', '/')).toBe(true);
  });

  test('non-root item matches exact path', () => {
    fc.assert(
      fc.property(nonRootPathArb, (itemPath) => {
        expect(isActiveRoute(itemPath, itemPath)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('non-root item matches child paths (prefix + "/")', () => {
    fc.assert(
      fc.property(
        nonRootPathArb,
        fc.stringMatching(/^[a-z0-9-]+$/).filter(s => s.length > 0),
        (itemPath, child) => {
          const childPath = itemPath + '/' + child;
          expect(isActiveRoute(itemPath, childPath)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('non-root item does NOT match unrelated paths', () => {
    fc.assert(
      fc.property(
        nonRootPathArb,
        nonRootPathArb,
        (itemPath, otherPath) => {
          // Skip when otherPath happens to be a prefix match
          fc.pre(
            otherPath !== itemPath &&
            !otherPath.startsWith(itemPath + '/'),
          );
          expect(isActiveRoute(itemPath, otherPath)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Command palette filtering returns only matching items
// ---------------------------------------------------------------------------

describe('Feature: navigation-pages-redesign, Property 5: Command palette filtering returns only matching items', () => {
  test('empty query returns all items', () => {
    fc.assert(
      fc.property(
        fc.array(commandItemArb, { minLength: 0, maxLength: 20 }),
        fc.constantFrom('', '  ', '\t'),
        (items, emptyQuery) => {
          const result = filterCommandItems(items, emptyQuery);
          expect(result.length).toBe(items.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('every returned item contains the query as a case-insensitive substring', () => {
    fc.assert(
      fc.property(
        fc.array(commandItemArb, { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (items, query) => {
          const result = filterCommandItems(items, query);
          const normalizedQuery = query.toLowerCase().trim();
          if (!normalizedQuery) return; // skip whitespace-only queries
          for (const item of result) {
            expect(item.label.toLowerCase()).toContain(normalizedQuery);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  test('no matching item is excluded from results', () => {
    fc.assert(
      fc.property(
        fc.array(commandItemArb, { minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (items, query) => {
          const result = filterCommandItems(items, query);
          const normalizedQuery = query.toLowerCase().trim();
          if (!normalizedQuery) return;
          const expectedCount = items.filter(i =>
            i.label.toLowerCase().includes(normalizedQuery),
          ).length;
          expect(result.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
