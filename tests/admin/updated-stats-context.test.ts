/**
 * Basic Tests for Slice Contexts (replacement for StatsContext tests)
 * Verifies that the new slice-based contexts exist and provide the expected interfaces
 * Feature: admin-panel-realtime-rewrite
 */

import { describe, test, expect } from 'bun:test';

describe('Slice Contexts (replaces StatsContext)', () => {
  test('Slice contexts file exists and exports all slice hooks', async () => {
    const slicesContent = await Bun.file('app/admin/context/slices.tsx').text();

    // Verify all four slice hooks are exported
    expect(slicesContent).toContain('useRealtimeSlice');
    expect(slicesContent).toContain('useContentSlice');
    expect(slicesContent).toContain('useGeoSlice');
    expect(slicesContent).toContain('useUserSlice');
  });

  test('Slice contexts file exports all slice providers', async () => {
    const slicesContent = await Bun.file('app/admin/context/slices.tsx').text();

    expect(slicesContent).toContain('RealtimeSliceProvider');
    expect(slicesContent).toContain('ContentSliceProvider');
    expect(slicesContent).toContain('GeoSliceProvider');
    expect(slicesContent).toContain('UserSliceProvider');
  });

  test('SSE connection provider and hook are exported', async () => {
    const slicesContent = await Bun.file('app/admin/context/slices.tsx').text();

    expect(slicesContent).toContain('SSEConnectionProvider');
    expect(slicesContent).toContain('useSSEConnection');
  });

  test('Slice contexts use SSE for real-time data', async () => {
    const slicesContent = await Bun.file('app/admin/context/slices.tsx').text();

    // Verify SSE integration
    expect(slicesContent).toContain('useSSE');
    expect(slicesContent).toContain('useSliceSSE');
  });

  test('Admin layout wraps children with slice providers', async () => {
    const layoutContent = await Bun.file('app/admin/components/AdminLayout.tsx').text();

    // Verify slice providers are used in layout
    expect(layoutContent).toContain('RealtimeSliceProvider');
    expect(layoutContent).toContain('ContentSliceProvider');
    expect(layoutContent).toContain('GeoSliceProvider');
    expect(layoutContent).toContain('UserSliceProvider');
    expect(layoutContent).toContain('SSEConnectionProvider');
  });

  test('Dashboard page uses slice contexts instead of StatsContext', async () => {
    const dashboardPage = await Bun.file('app/admin/dashboard/page.tsx').text();

    // Should use new slice hooks
    expect(dashboardPage).toContain('useRealtimeSlice');
    expect(dashboardPage).toContain('useUserSlice');

    // Should NOT use old StatsContext
    expect(dashboardPage).not.toContain('useStats');
  });

  test('UnifiedStatsBar uses slice contexts', async () => {
    const statsBar = await Bun.file('app/admin/components/UnifiedStatsBar.tsx').text();

    expect(statsBar).toContain('useRealtimeSlice');
    expect(statsBar).toContain('useUserSlice');
    expect(statsBar).toContain('useContentSlice');
    expect(statsBar).not.toContain('useStats');
  });

  test('Old StatsContext file has been removed', async () => {
    let exists = true;
    try {
      await Bun.file('app/admin/context/StatsContext.tsx').text();
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });
});
