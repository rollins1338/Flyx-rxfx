/**
 * Property-based test for bottom tab navigation routing.
 *
 * Feature: navigation-pages-redesign
 * Property 4: Bottom tab navigation routes correctly on tap
 * Validates: Requirements 3.2
 *
 * Since we don't have React Testing Library in the bun test environment,
 * we verify the routing property at the data/logic level:
 * - Every BOTTOM_TAB_ITEM has a valid path starting with "/"
 * - After "tapping" any tab item's path, isActiveRoute correctly identifies it as active
 * - No other tab item is falsely marked active for that path
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { BOTTOM_TAB_ITEMS } from '../../app/components/navigation/nav-config';
import { isActiveRoute } from '../../app/components/navigation/nav-utils';

/** Arbitrary that picks any BOTTOM_TAB_ITEM by index */
const tabItemIndexArb = fc.integer({ min: 0, max: BOTTOM_TAB_ITEMS.length - 1 });

describe('Feature: navigation-pages-redesign, Property 4: Bottom tab navigation routes correctly on tap', () => {
  test('tapping any tab item navigates to its path and marks it active', () => {
    fc.assert(
      fc.property(tabItemIndexArb, (index) => {
        const item = BOTTOM_TAB_ITEMS[index];

        // The item's path must start with "/"
        expect(item.path.startsWith('/')).toBe(true);

        // After navigating to item.path, isActiveRoute should return true
        expect(isActiveRoute(item.path, item.path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('tapping a tab item does not falsely activate other tab items', () => {
    fc.assert(
      fc.property(tabItemIndexArb, (index) => {
        const tappedItem = BOTTOM_TAB_ITEMS[index];
        const currentPath = tappedItem.path;

        for (const otherItem of BOTTOM_TAB_ITEMS) {
          if (otherItem.id === tappedItem.id) continue;

          // Other tab items should NOT be active when on the tapped item's exact path
          if (otherItem.path !== '/' && currentPath !== otherItem.path && !currentPath.startsWith(otherItem.path + '/')) {
            expect(isActiveRoute(otherItem.path, currentPath)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  test('all bottom tab items have showInBottomTab set to true', () => {
    fc.assert(
      fc.property(tabItemIndexArb, (index) => {
        expect(BOTTOM_TAB_ITEMS[index].showInBottomTab).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('bottom tab items include exactly 5 items', () => {
    expect(BOTTOM_TAB_ITEMS.length).toBe(5);
  });
});
