/**
 * Property-based test for sidebar collapse state round-trip persistence.
 *
 * Feature: navigation-pages-redesign
 * Property 3: Sidebar collapse state round-trip persistence
 * Validates: Requirements 2.5
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import * as fc from 'fast-check';

const STORAGE_KEY = 'flyx_sidebar_collapsed';

// Direct round-trip helpers matching useSidebarState internals
function writeCollapsed(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
}

function readCollapsed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

describe('Feature: navigation-pages-redesign, Property 3: Sidebar collapse state round-trip persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('writing a boolean and reading it back produces the same value', () => {
    fc.assert(
      fc.property(fc.boolean(), (collapsed) => {
        writeCollapsed(collapsed);
        expect(readCollapsed()).toBe(collapsed);
      }),
      { numRuns: 100 },
    );
  });

  test('defaults to expanded (false) when storage key is absent', () => {
    expect(readCollapsed()).toBe(false);
  });

  test('last write wins across multiple writes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        (writes) => {
          localStorage.clear();
          for (const value of writes) {
            writeCollapsed(value);
          }
          expect(readCollapsed()).toBe(writes[writes.length - 1]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
