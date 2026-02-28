/**
 * AnalyticsTracker — Lightweight component that initializes local-first tracking.
 *
 * Add this to your root layout to enable analytics:
 *   <AnalyticsTracker />
 */

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LocalTracker } from '@/lib/local-tracker/local-tracker';

interface AnalyticsTrackerProps {
  disabled?: boolean;
  excludePaths?: string[];
}

export function AnalyticsTracker({
  disabled = false,
  excludePaths = ['/admin'],
}: AnalyticsTrackerProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    const shouldExclude = excludePaths.some(path => pathname?.startsWith(path));
    if (shouldExclude) return;

    const tracker = LocalTracker.getInstance();
    tracker.init();
  }, [disabled]);

  useEffect(() => {
    if (disabled || typeof window === 'undefined' || !pathname) return;
    const shouldExclude = excludePaths.some(path => pathname.startsWith(path));
    if (shouldExclude) return;

    const tracker = LocalTracker.getInstance();
    tracker.trackPageView(pathname);
  }, [pathname, disabled, excludePaths]);

  return null;
}

export default AnalyticsTracker;
