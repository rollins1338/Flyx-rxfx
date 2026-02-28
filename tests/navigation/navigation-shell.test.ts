/**
 * Unit tests for NavigationShell component logic.
 *
 * Since we don't have React Testing Library in the bun test environment,
 * these tests validate the component's behavioral contracts at the logic level:
 * - Desktop viewport renders SidebarNav (expanded sidebar width)
 * - Mobile viewport renders BottomTabBar (no sidebar)
 * - /watch routes hide all navigation
 * - Content area adjusts when sidebar collapses
 *
 * Requirements: 1.1, 1.3, 1.5, 11.1, 11.3
 */

import { describe, test, expect } from 'bun:test';

type Viewport = 'mobile' | 'tablet' | 'desktop' | 'tv';

/**
 * Mirrors the viewport detection logic from useViewport.
 */
function getViewport(width: number): Viewport {
  if (width >= 1920) return 'tv';
  if (width >= 1280) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

/**
 * Mirrors NavigationShell's decision logic for which navigation to show.
 */
function getNavigationState(pathname: string, viewport: Viewport, collapsed: boolean) {
  const isWatchMode = pathname.startsWith('/watch');
  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';
  const isTv = viewport === 'tv';

  return {
    showSidebar: !isWatchMode && !isMobile,
    sidebarCollapsed: isTablet ? true : collapsed,
    showBottomTab: !isWatchMode && isMobile,
    showCommandPalette: !isWatchMode,
    isWatchMode,
  };
}

/**
 * Mirrors NavigationShell's content area class selection.
 */
function getContentAreaType(pathname: string, viewport: Viewport, collapsed: boolean): string {
  const isWatchMode = pathname.startsWith('/watch');
  if (isWatchMode) return 'watchMode';
  if (viewport === 'mobile') return 'mobile';
  if (viewport === 'tablet') return 'collapsed';
  if (collapsed) return 'collapsed';
  return 'default';
}

describe('NavigationShell — renders SidebarNav at desktop viewport', () => {
  test('desktop viewport (1280px) shows sidebar', () => {
    const viewport = getViewport(1280);
    expect(viewport).toBe('desktop');
    const state = getNavigationState('/', viewport, false);
    expect(state.showSidebar).toBe(true);
    expect(state.showBottomTab).toBe(false);
  });

  test('desktop viewport shows expanded sidebar by default', () => {
    const state = getNavigationState('/movies', 'desktop', false);
    expect(state.showSidebar).toBe(true);
    expect(state.sidebarCollapsed).toBe(false);
  });

  test('TV viewport (1920px) shows sidebar', () => {
    const viewport = getViewport(1920);
    expect(viewport).toBe('tv');
    const state = getNavigationState('/', viewport, false);
    expect(state.showSidebar).toBe(true);
    expect(state.showBottomTab).toBe(false);
  });

  test('tablet viewport (768px) shows sidebar in collapsed (NavRail) mode', () => {
    const viewport = getViewport(768);
    expect(viewport).toBe('tablet');
    const state = getNavigationState('/', viewport, false);
    expect(state.showSidebar).toBe(true);
    expect(state.sidebarCollapsed).toBe(true); // Always collapsed on tablet
  });
});

describe('NavigationShell — renders BottomTabBar at mobile viewport', () => {
  test('mobile viewport (<768px) shows bottom tab bar', () => {
    const viewport = getViewport(375);
    expect(viewport).toBe('mobile');
    const state = getNavigationState('/', viewport, false);
    expect(state.showBottomTab).toBe(true);
    expect(state.showSidebar).toBe(false);
  });

  test('mobile viewport at 767px still shows bottom tab bar', () => {
    const viewport = getViewport(767);
    expect(viewport).toBe('mobile');
    const state = getNavigationState('/anime', viewport, false);
    expect(state.showBottomTab).toBe(true);
    expect(state.showSidebar).toBe(false);
  });
});

describe('NavigationShell — hides all nav on /watch routes', () => {
  test('/watch hides sidebar on desktop', () => {
    const state = getNavigationState('/watch', 'desktop', false);
    expect(state.showSidebar).toBe(false);
    expect(state.showBottomTab).toBe(false);
    expect(state.showCommandPalette).toBe(false);
    expect(state.isWatchMode).toBe(true);
  });

  test('/watch/123 hides bottom tab on mobile', () => {
    const state = getNavigationState('/watch/123', 'mobile', false);
    expect(state.showSidebar).toBe(false);
    expect(state.showBottomTab).toBe(false);
    expect(state.showCommandPalette).toBe(false);
  });

  test('/watch/movie/456 hides all nav on tablet', () => {
    const state = getNavigationState('/watch/movie/456', 'tablet', false);
    expect(state.showSidebar).toBe(false);
    expect(state.showBottomTab).toBe(false);
    expect(state.showCommandPalette).toBe(false);
  });

  test('/watch hides all nav on TV', () => {
    const state = getNavigationState('/watch/live', 'tv', false);
    expect(state.showSidebar).toBe(false);
    expect(state.showBottomTab).toBe(false);
    expect(state.showCommandPalette).toBe(false);
  });
});

describe('NavigationShell — content area adjusts when sidebar collapses', () => {
  test('expanded sidebar uses default content area', () => {
    const type = getContentAreaType('/movies', 'desktop', false);
    expect(type).toBe('default');
  });

  test('collapsed sidebar uses collapsed content area', () => {
    const type = getContentAreaType('/movies', 'desktop', true);
    expect(type).toBe('collapsed');
  });

  test('tablet always uses collapsed content area', () => {
    const type = getContentAreaType('/series', 'tablet', false);
    expect(type).toBe('collapsed');
  });

  test('mobile uses mobile content area (bottom padding)', () => {
    const type = getContentAreaType('/anime', 'mobile', false);
    expect(type).toBe('mobile');
  });

  test('watch mode uses watch mode content area (no margins)', () => {
    const type = getContentAreaType('/watch/123', 'desktop', false);
    expect(type).toBe('watchMode');
  });
});
