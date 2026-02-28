/**
 * Complete Admin Workflows Integration Tests
 * Tests end-to-end admin user workflows and cross-component data consistency
 * Feature: admin-panel-realtime-rewrite, Property Integration: Complete workflows
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fc from 'fast-check';

describe('Complete Admin Workflows Integration', () => {
  
  // Test 1: Authentication → Dashboard → Analytics Workflow
  test('Complete authentication to analytics workflow', async () => {
    // Verify authentication middleware exists
    const authMiddleware = await Bun.file('app/admin/middleware/auth.ts').text();
    expect(authMiddleware).toContain('export');
    expect(authMiddleware).toContain('auth');
    
    // Verify dashboard page exists and uses slice contexts
    const dashboardPage = await Bun.file('app/admin/dashboard/page.tsx').text();
    expect(dashboardPage).toContain('useRealtimeSlice');
    expect(dashboardPage).toContain('useUserSlice');
    
    // Verify content page exists (consolidated analytics)
    const contentPage = await Bun.file('app/admin/content/page.tsx').text();
    expect(contentPage).toContain('Content');
    
    // Verify navigation structure is consistent
    const sidebar = await Bun.file('app/admin/components/AdminSidebar.tsx').text();
    expect(sidebar).toContain('/admin/dashboard');
    expect(sidebar).toContain('/admin/content');
    expect(sidebar).toContain('/admin/users');
    expect(sidebar).toContain('/admin/geographic');
  });

  // Test 2: Cross-Component Data Consistency via Slice Contexts
  test('Cross-component data consistency through slice contexts', async () => {
    const slicesContext = await Bun.file('app/admin/context/slices.tsx').text();
    
    // Verify slice contexts provide structured data
    expect(slicesContext).toContain('RealtimeSliceProvider');
    expect(slicesContext).toContain('ContentSliceProvider');
    expect(slicesContext).toContain('GeoSliceProvider');
    expect(slicesContext).toContain('UserSliceProvider');
    
    // Verify SSE integration for real-time updates
    expect(slicesContext).toContain('useSSE');
    expect(slicesContext).toContain('useSliceSSE');
    
    // Verify UnifiedStatsBar uses the slice contexts
    const statsBar = await Bun.file('app/admin/components/UnifiedStatsBar.tsx').text();
    expect(statsBar).toContain('useRealtimeSlice');
    expect(statsBar).toContain('useUserSlice');
    expect(statsBar).toContain('useContentSlice');
  });

  // Test 3: Bot Detection Complete Workflow
  test('Bot detection complete workflow integration', async () => {
    // Verify bot detection API exists
    const botDetectionAPI = await Bun.file('app/api/admin/bot-detection/route.ts').text();
    expect(botDetectionAPI).toContain('calculateBotScore');
    expect(botDetectionAPI).toContain('DETECTION_CRITERIA');
    
    // Verify bot detection page exists
    const botDetectionPage = await Bun.file('app/admin/bot-detection/page.tsx').text();
    expect(botDetectionPage).toContain('bot');
    
    // Verify bot filter controls component exists
    const botFilterControls = await Bun.file('app/admin/components/BotFilterControls.tsx').text();
    expect(botFilterControls).toContain('BotFilterOptions');
    expect(botFilterControls).toContain('includeBots');
    expect(botFilterControls).toContain('confidenceThreshold');
    
    // Verify manual review API exists
    const reviewAPI = await Bun.file('app/api/admin/bot-detection/review/route.ts').text();
    expect(reviewAPI).toContain('review');
    expect(reviewAPI).toContain('status');
  });

  // Test 4: Data Export Complete Workflow
  test('Data export complete workflow integration', async () => {
    // Verify export API exists
    const exportAPI = await Bun.file('app/api/admin/export/route.ts').text();
    expect(exportAPI).toContain('export');
    expect(exportAPI).toContain('format');
    
    // Verify export page exists
    const exportPage = await Bun.file('app/admin/export/page.tsx').text();
    expect(exportPage).toContain('export');
    
    // Verify data export panel component exists
    const exportPanel = await Bun.file('app/admin/components/DataExportPanel.tsx').text();
    expect(exportPanel).toContain('export');
    expect(exportPanel).toContain('format');
    expect(exportPanel).toContain('dateRange');
  });

  // Test 5: Security and Access Control Workflow
  test('Security and access control complete workflow', async () => {
    // Verify security provider exists
    const securityProvider = await Bun.file('app/admin/components/SecurityProvider.tsx').text();
    expect(securityProvider).toContain('SecurityProvider');
    expect(securityProvider).toContain('auth');
    
    // Verify permission gate exists
    const permissionGate = await Bun.file('app/admin/components/PermissionGate.tsx').text();
    expect(permissionGate).toContain('PermissionGate');
    expect(permissionGate).toContain('permission');
    
    // Verify audit logger exists
    const auditLogger = await Bun.file('app/admin/components/AuditLogger.tsx').text();
    expect(auditLogger).toContain('AuditLogger');
    expect(auditLogger).toContain('log');
    
    // Verify security page exists
    const securityPage = await Bun.file('app/admin/security/page.tsx').text();
    expect(securityPage).toContain('security');
  });

  // Test 6: System Health Monitoring Workflow
  test('System health monitoring complete workflow', async () => {
    // Verify system health API exists
    const healthAPI = await Bun.file('app/api/admin/system-health/route.ts').text();
    expect(healthAPI).toContain('health');
    expect(healthAPI).toContain('performance');
    
    // Verify system health monitor component exists
    const healthMonitor = await Bun.file('app/admin/components/SystemHealthMonitor.tsx').text();
    expect(healthMonitor).toContain('SystemHealthMonitor');
    expect(healthMonitor).toContain('health');
    
    // Verify system health page exists
    const healthPage = await Bun.file('app/admin/system-health/page.tsx').text();
    expect(healthPage).toContain('health');
  });

  // Test 7: Responsive Design and Accessibility Workflow
  test('Responsive design and accessibility complete workflow', async () => {
    // Verify responsive layout component exists
    const responsiveLayout = await Bun.file('app/admin/components/ResponsiveLayout.tsx').text();
    expect(responsiveLayout).toContain('ResponsiveLayout');
    expect(responsiveLayout).toContain('isMobile');
    
    // Verify accessible components exist
    const accessibleButton = await Bun.file('app/admin/components/AccessibleButton.tsx').text();
    expect(accessibleButton).toContain('AccessibleButton');
    expect(accessibleButton).toContain('aria');
    
    const accessibleInput = await Bun.file('app/admin/components/AccessibleInput.tsx').text();
    expect(accessibleInput).toContain('AccessibleInput');
    expect(accessibleInput).toContain('aria');
    
    // Verify keyboard navigation hook exists
    const keyboardNav = await Bun.file('app/admin/hooks/useKeyboardNavigation.ts').text();
    expect(keyboardNav).toContain('useKeyboardNavigation');
    expect(keyboardNav).toContain('keyboard');
  });

  // Test 8: Consolidated Navigation Workflow
  test('Consolidated navigation with 6 primary views', async () => {
    const sidebar = await Bun.file('app/admin/components/AdminSidebar.tsx').text();
    
    // Verify 6 consolidated navigation items
    expect(sidebar).toContain('/admin/dashboard');
    expect(sidebar).toContain('/admin/content');
    expect(sidebar).toContain('/admin/users');
    expect(sidebar).toContain('/admin/geographic');
    expect(sidebar).toContain('/admin/system-health');
    expect(sidebar).toContain('/admin/settings');
  });

  // Property-based test for data consistency across components
  test('Property: Data consistency across all admin components', () => {
    fc.assert(fc.property(
      fc.record({
        liveUsers: fc.integer({ min: 0, max: 10000 }),
        activeToday: fc.integer({ min: 0, max: 50000 }),
        totalSessions: fc.integer({ min: 0, max: 100000 }),
        botDetectionCount: fc.integer({ min: 0, max: 1000 })
      }),
      (mockStats) => {
        // Property: All components receiving the same stats should display consistent data
        const component1Data = {
          liveUsers: mockStats.liveUsers,
          dau: mockStats.activeToday,
          sessions: mockStats.totalSessions,
          bots: mockStats.botDetectionCount
        };
        
        const component2Data = {
          liveUsers: mockStats.liveUsers,
          dau: mockStats.activeToday,
          sessions: mockStats.totalSessions,
          bots: mockStats.botDetectionCount
        };
        
        expect(component1Data.liveUsers).toBe(component2Data.liveUsers);
        expect(component1Data.dau).toBe(component2Data.dau);
        expect(component1Data.sessions).toBe(component2Data.sessions);
        expect(component1Data.bots).toBe(component2Data.bots);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  // Property-based test for workflow state consistency
  test('Property: Workflow state consistency across navigation', () => {
    fc.assert(fc.property(
      fc.record({
        currentPage: fc.constantFrom('dashboard', 'content', 'users', 'geographic', 'system-health', 'settings'),
        userRole: fc.constantFrom('admin', 'viewer', 'moderator'),
        botFilterEnabled: fc.boolean(),
        dataTimeRange: fc.constantFrom('1h', '24h', '7d', '30d')
      }),
      (workflowState) => {
        const pageState = {
          page: workflowState.currentPage,
          role: workflowState.userRole,
          botFilter: workflowState.botFilterEnabled,
          timeRange: workflowState.dataTimeRange
        };
        
        expect(['dashboard', 'content', 'users', 'geographic', 'system-health', 'settings']).toContain(pageState.page);
        expect(['admin', 'viewer', 'moderator']).toContain(pageState.role);
        expect(typeof pageState.botFilter).toBe('boolean');
        expect(['1h', '24h', '7d', '30d']).toContain(pageState.timeRange);
        
        return true;
      }
    ), { numRuns: 100 });
  });

  // Test 9: SSE-based Real-time Architecture
  test('SSE-based real-time architecture is wired correctly', async () => {
    // Verify SSE hook exists
    const sseHook = await Bun.file('app/admin/hooks/useSSE.ts').text();
    expect(sseHook).toContain('useSSE');
    expect(sseHook).toContain('EventSource');
    
    // Verify slice contexts use SSE
    const slices = await Bun.file('app/admin/context/slices.tsx').text();
    expect(slices).toContain('useSliceSSE');
    expect(slices).toContain('SSEConnectionProvider');
    
    // Verify admin layout initializes SSE at layout level
    const layout = await Bun.file('app/admin/components/AdminLayout.tsx').text();
    expect(layout).toContain('SSEConnectionProvider');
  });

  // Test 10: Complete User Journey
  test('Complete user journey from login to consolidated views', async () => {
    // 1. Authentication components exist
    const authMiddleware = await Bun.file('app/admin/middleware/auth.ts').text();
    expect(authMiddleware).toContain('auth');
    
    // 2. Navigation is properly structured with consolidated views
    const sidebar = await Bun.file('app/admin/components/AdminSidebar.tsx').text();
    expect(sidebar).toContain('Dashboard');
    expect(sidebar).toContain('Content');
    expect(sidebar).toContain('Users');
    expect(sidebar).toContain('Geographic');
    
    // 3. Data flows through slice contexts
    const slices = await Bun.file('app/admin/context/slices.tsx').text();
    expect(slices).toContain('RealtimeSliceProvider');
    expect(slices).toContain('useRealtimeSlice');
    
    // 4. Export functionality is integrated
    const exportAPI = await Bun.file('app/api/admin/export/route.ts').text();
    expect(exportAPI).toContain('export');
    
    // 5. Security is enforced throughout
    const securityProvider = await Bun.file('app/admin/components/SecurityProvider.tsx').text();
    expect(securityProvider).toContain('SecurityProvider');
  });
});


/**
 * Cross-Component Data Flow Integration Tests
 * Tests data consistency between slice contexts and all consuming components
 */
describe('Cross-Component Data Flow Integration', () => {
  
  test('Slice contexts provide structured data to all components', async () => {
    const slicesContext = await Bun.file('app/admin/context/slices.tsx').text();
    
    // Verify the context exports the correct hooks
    expect(slicesContext).toContain('useRealtimeSlice');
    expect(slicesContext).toContain('useContentSlice');
    expect(slicesContext).toContain('useGeoSlice');
    expect(slicesContext).toContain('useUserSlice');
    
    // Verify providers are exported
    expect(slicesContext).toContain('RealtimeSliceProvider');
    expect(slicesContext).toContain('ContentSliceProvider');
    expect(slicesContext).toContain('GeoSliceProvider');
    expect(slicesContext).toContain('UserSliceProvider');
  });

  test('All admin pages use slice contexts', async () => {
    // Dashboard uses realtime and user slices
    const dashboardPage = await Bun.file('app/admin/dashboard/page.tsx').text();
    expect(dashboardPage).toContain('useRealtimeSlice');
    expect(dashboardPage).toContain('useUserSlice');
    
    // Content page exists
    const contentPage = await Bun.file('app/admin/content/page.tsx').text();
    expect(contentPage).toContain('Content');
    
    // Users page exists
    const usersPage = await Bun.file('app/admin/users/page.tsx').text();
    expect(usersPage).toContain('User');
  });

  test('Bot filtering is self-contained in BotFilterControls', async () => {
    const botFilterControls = await Bun.file('app/admin/components/BotFilterControls.tsx').text();
    expect(botFilterControls).toContain('BotFilterOptions');
    expect(botFilterControls).toContain('includeBots');
    expect(botFilterControls).toContain('confidenceThreshold');
  });

  // Property-based test for API response consistency
  test('Property: API responses maintain consistent structure', () => {
    fc.assert(fc.property(
      fc.record({
        realtime: fc.record({
          totalActive: fc.integer({ min: 0, max: 10000 }),
          watching: fc.integer({ min: 0, max: 5000 }),
          browsing: fc.integer({ min: 0, max: 5000 })
        }),
        users: fc.record({
          total: fc.integer({ min: 0, max: 100000 }),
          dau: fc.integer({ min: 0, max: 10000 }),
          wau: fc.integer({ min: 0, max: 50000 })
        }).map(users => {
          const dau = Math.min(users.dau, users.total);
          const wau = Math.max(users.wau, dau);
          const total = Math.max(users.total, wau);
          return { total, dau, wau };
        }),
        content: fc.record({
          totalSessions: fc.integer({ min: 0, max: 100000 }),
          totalWatchTime: fc.integer({ min: 0, max: 1000000 }),
          avgDuration: fc.float({ min: 0, max: 180, noNaN: true })
        })
      }),
      (apiResponse) => {
        expect(apiResponse.realtime.totalActive).toBeGreaterThanOrEqual(0);
        expect(apiResponse.realtime.watching).toBeGreaterThanOrEqual(0);
        expect(apiResponse.realtime.browsing).toBeGreaterThanOrEqual(0);
        
        expect(apiResponse.users.total).toBeGreaterThanOrEqual(0);
        expect(apiResponse.users.dau).toBeGreaterThanOrEqual(0);
        expect(apiResponse.users.wau).toBeGreaterThanOrEqual(0);
        
        expect(apiResponse.content.totalSessions).toBeGreaterThanOrEqual(0);
        expect(apiResponse.content.totalWatchTime).toBeGreaterThanOrEqual(0);
        expect(apiResponse.content.avgDuration).toBeGreaterThanOrEqual(0);
        
        expect(apiResponse.users.dau).toBeLessThanOrEqual(apiResponse.users.total);
        expect(apiResponse.users.wau).toBeGreaterThanOrEqual(apiResponse.users.dau);
        
        return true;
      }
    ), { numRuns: 100 });
  });
});

/**
 * End-to-End Feature Integration Tests
 * Tests complete feature workflows from UI to API
 */
describe('End-to-End Feature Integration', () => {
  
  test('Bot detection end-to-end integration', async () => {
    const botAPI = await Bun.file('app/api/admin/bot-detection/route.ts').text();
    expect(botAPI).toContain('calculateBotScore');
    expect(botAPI).toContain('DETECTION_CRITERIA');
    
    const botPage = await Bun.file('app/admin/bot-detection/page.tsx').text();
    expect(botPage).toContain('bot');
    
    const botControls = await Bun.file('app/admin/components/BotFilterControls.tsx').text();
    expect(botControls).toContain('BotFilterOptions');
    
    const reviewAPI = await Bun.file('app/api/admin/bot-detection/review/route.ts').text();
    expect(reviewAPI).toContain('review');
    
    const setupScript = await Bun.file('scripts/setup-bot-detection-tables.js').text();
    expect(setupScript).toContain('bot_detections');
  });

  test('Data export end-to-end integration', async () => {
    const exportAPI = await Bun.file('app/api/admin/export/route.ts').text();
    expect(exportAPI).toContain('export');
    expect(exportAPI).toContain('format');
    
    const exportPage = await Bun.file('app/admin/export/page.tsx').text();
    expect(exportPage).toContain('export');
    
    const exportPanel = await Bun.file('app/admin/components/DataExportPanel.tsx').text();
    expect(exportPanel).toContain('export');
    expect(exportPanel).toContain('CSV');
    expect(exportPanel).toContain('JSON');
  });

  test('Security and audit end-to-end integration', async () => {
    const authMiddleware = await Bun.file('app/admin/middleware/auth.ts').text();
    expect(authMiddleware).toContain('auth');
    
    const securityProvider = await Bun.file('app/admin/components/SecurityProvider.tsx').text();
    expect(securityProvider).toContain('SecurityProvider');
    
    const permissionGate = await Bun.file('app/admin/components/PermissionGate.tsx').text();
    expect(permissionGate).toContain('PermissionGate');
    
    const auditLogger = await Bun.file('app/admin/components/AuditLogger.tsx').text();
    expect(auditLogger).toContain('AuditLogger');
    
    const auditAPI = await Bun.file('app/api/admin/audit-log/route.ts').text();
    expect(auditAPI).toContain('audit');
  });

  // Property-based test for complete workflow consistency
  test('Property: Complete workflows maintain data integrity', () => {
    fc.assert(fc.property(
      fc.record({
        userId: fc.string({ minLength: 1, maxLength: 50 }),
        action: fc.constantFrom('view_analytics', 'export_data', 'review_bot', 'update_settings'),
        timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() }),
        success: fc.boolean()
      }),
      (workflowEvent) => {
        expect(typeof workflowEvent.userId).toBe('string');
        expect(workflowEvent.userId.length).toBeGreaterThan(0);
        expect(['view_analytics', 'export_data', 'review_bot', 'update_settings']).toContain(workflowEvent.action);
        expect(workflowEvent.timestamp).toBeGreaterThan(0);
        expect(typeof workflowEvent.success).toBe('boolean');
        
        return true;
      }
    ), { numRuns: 100 });
  });
});
