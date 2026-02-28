/**
 * Property-based test for sidebar navigation routing.
 *
 * Feature: navigation-pages-redesign
 * Property 2: Sidebar navigation routes correctly on click
 * Validates: Requirements 2.3
 *
 * Since we don't have React Testing Library in the bun test environment,
 * we verify the routing property at the data/logic level:
 * - Every NAV_ITEM has a valid path starting with "/"
 * - After "navigating" to any item's path, isActiveRoute correctly identifies it as active
 * - No other primary/secondary item is falsely marked active for that path
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { NAV_ITEMS } from '../../app/components/navigation/nav-config';
import { isActiveRoute } from '../../app/components/navigation/nav-utils';

/** Arbitrary that picks any NAV_ITEM by index */
const navItemIndexArb = fc.integer({ min: 0, max: NAV_ITEMS.length - 1 });

describe('Feature: navigation-pages-redesign, Property 2: Sidebar navigation routes correctly on click', () => {
  test('clicking any nav item navigates to its path and marks it active', () => {
    fc.assert(
      fc.property(navItemIndexArb, (index) => {
        const item = NAV_ITEMS[index];

        // The item's path must start with "/"
        expect(item.path.startsWith('/')).toBe(true);

        // After navigating to item.path, isActiveRoute should return true for that item
        expect(isActiveRoute(item.path, item.path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('clicking a nav item does not falsely activate unrelated items', () => {
    fc.assert(
      fc.property(navItemIndexArb, (index) => {
        const clickedItem = NAV_ITEMS[index];
        const currentPath = clickedItem.path;

        for (const otherItem of NAV_ITEMS) {
          if (otherItem.id === clickedItem.id) continue;

          // Skip items whose path is a prefix of the clicked path (legitimate nested match)
          if (currentPath.startsWith(otherItem.path + '/')) continue;
          if (otherItem.path === '/' && currentPath === '/') continue;

          // Other items should NOT be active when we're on the clicked item's exact path
          // (unless the clicked path is a child of the other item's path)
          if (otherItem.path !== '/' && currentPath !== otherItem.path && !currentPath.startsWith(otherItem.path + '/')) {
            expect(isActiveRoute(otherItem.path, currentPath)).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
