/**
 * Property-based test for bottom tab aria-current.
 *
 * Feature: navigation-pages-redesign
 * Property 7: Exactly one tab has aria-current="page"
 * Validates: Requirements 6.5
 *
 * Since we don't have React Testing Library in the bun test environment,
 * we verify the aria-current invariant at the data/logic level:
 * - For any path matching a bottom tab item, exactly one item should be active
 * - For paths not matching any tab, no item should be active
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { BOTTOM_TAB_ITEMS } from '../../app/components/navigation/nav-config';
import { isActiveRoute } from '../../app/components/navigation/nav-utils';

/** Arbitrary that picks a path from one of the bottom tab items */
const tabPathArb = fc.constantFrom(...BOTTOM_TAB_ITEMS.map(item => item.path));

/** Arbitrary that generates a random non-matching path */
const nonMatchingPathArb = fc
  .stringMatching(/^\/[a-z]{2,8}$/)
  .filter(path => {
    // Exclude paths that would match any bottom tab item
    return !BOTTOM_TAB_ITEMS.some(item => isActiveRoute(item.path, path));
  });

describe('Feature: navigation-pages-redesign, Property 7: Exactly one tab has aria-current="page"', () => {
  test('for any path matching a tab item, exactly one tab is active', () => {
    fc.assert(
      fc.property(tabPathArb, (currentPath) => {
        const activeCount = BOTTOM_TAB_ITEMS.filter(item =>
          isActiveRoute(item.path, currentPath)
        ).length;
        expect(activeCount).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  test('for any path matching a tab item, the active tab is the correct one', () => {
    fc.assert(
      fc.property(tabPathArb, (currentPath) => {
        const activeItems = BOTTOM_TAB_ITEMS.filter(item =>
          isActiveRoute(item.path, currentPath)
        );
        expect(activeItems.length).toBe(1);
        expect(activeItems[0].path).toBe(currentPath);
      }),
      { numRuns: 100 },
    );
  });

  test('for child paths of a tab item, exactly one tab is active', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BOTTOM_TAB_ITEMS.filter(i => i.path !== '/').map(i => i.path)),
        fc.stringMatching(/^[a-z0-9-]+$/).filter(s => s.length > 0),
        (tabPath, child) => {
          const childPath = tabPath + '/' + child;
          const activeCount = BOTTOM_TAB_ITEMS.filter(item =>
            isActiveRoute(item.path, childPath)
          ).length;
          expect(activeCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  test('for paths not matching any tab, no tab has aria-current', () => {
    fc.assert(
      fc.property(nonMatchingPathArb, (currentPath) => {
        const activeCount = BOTTOM_TAB_ITEMS.filter(item =>
          isActiveRoute(item.path, currentPath)
        ).length;
        expect(activeCount).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
