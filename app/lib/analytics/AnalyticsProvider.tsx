'use client';

/**
 * Analytics Provider — Local-first analytics initialization.
 *
 * Replaces the old unified-analytics-client with Local_Tracker.
 * Runs legacy migration on first mount, then tracks page views
 * through the Local_Tracker singleton.
 *
 * Requirements: 1.2, 6.1
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LocalTracker } from '../local-tracker/local-tracker';
import { migrateFromLegacy } from '../local-store/migration';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Initialize Local_Tracker and run legacy migration on mount
  useEffect(() => {
    migrateFromLegacy();
    const tracker = LocalTracker.getInstance();
    tracker.init();

    return () => {
      tracker.destroy();
    };
  }, []);

  // Track page views on route change via Local_Tracker
  useEffect(() => {
    if (pathname) {
      const tracker = LocalTracker.getInstance();
      tracker.trackPageView(pathname);
    }
  }, [pathname]);

  return <>{children}</>;
}

export default AnalyticsProvider;
