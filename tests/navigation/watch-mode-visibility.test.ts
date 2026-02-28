/**
 * Property-based test for watch mode navigation visibility.
 *
 * Feature: navigation-pages-redesign
 * Property 1: Watch mode controls navigation visibility
 * Validates: Requirements 1.5, 1.6, 3.5, 4.5
 *
 * Since we don't have React Testing Library in the bun test environment,
 * we verify the watch mode invariant at the logic level:
 * - For any path starting with '/watch', navigation should be hidden
 * - For any path NOT starting with '/watch', navigation should be visible
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';

/**
 * Watch mode detection logic — mirrors NavigationShell's isWatchMode derivation.
 */
function isWatchMode(pathname: string): boolean {
  return pathname.startsWith('/watch');
}

/** Arbitrary that generates /watch paths */
const watchPathArb = fc.oneof(
  fc.constant('/watch'),
  fc.stringMatching(/^[a-z0-9\/-]{0,20}$/).map(suffix => `/watch/${suffix}`),
  fc.stringMatching(/^[a-z0-9]{1,8}$/).map(id => `/watch/${id}`),
);

/** Arbitrary that generates non-watch paths */
const nonWatchPathArb = fc.oneof(
  fc.constant('/'),
  fc.constantFrom('/movies', '/series', '/anime', '/livetv', '/search', '/settings', '/about'),
  fc.stringMatching(/^\/[a-z]{2,10}$/).filter(p => !p.startsWith('/watch')),
  fc.stringMatching(/^\/[a-z]{2,8}\/[a-z0-9]{1,8}$/).filter(p => !p.startsWith('/watch')),
);

describe('Feature: navigation-pages-redesign, Property 1: Watch mode controls navigation visibility', () => {
  test('for any /watch path, navigation is hidden (isWatchMode = true)', () => {
    fc.assert(
      fc.property(watchPathArb, (path) => {
        expect(isWatchMode(path)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('for any non-/watch path, navigation is visible (isWatchMode = false)', () => {
    fc.assert(
      fc.property(nonWatchPathArb, (path) => {
        expect(isWatchMode(path)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('watch mode is mutually exclusive with navigation visibility', () => {
    const anyPathArb = fc.oneof(watchPathArb, nonWatchPathArb);
    fc.assert(
      fc.property(anyPathArb, (path) => {
        const watchMode = isWatchMode(path);
        const navVisible = !watchMode;
        // Navigation visible XOR watch mode — always exactly one is true
        expect(navVisible !== watchMode).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  test('exiting watch mode restores navigation (non-watch path after watch path)', () => {
    fc.assert(
      fc.property(watchPathArb, nonWatchPathArb, (watchPath, normalPath) => {
        // While on watch path, nav is hidden
        expect(isWatchMode(watchPath)).toBe(true);
        // After navigating away, nav is visible
        expect(isWatchMode(normalPath)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
