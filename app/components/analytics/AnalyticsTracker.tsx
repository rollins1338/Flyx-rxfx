/**
 * AnalyticsTracker - Lightweight component that initializes unified tracking
 * 
 * Add this to your root layout to enable analytics:
 *   <AnalyticsTracker />
 * 
 * This replaces:
 * - PresenceProvider
 * - AnalyticsProvider
 * - Any other tracking providers
 */

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initTracker, trackPageView } from '@/lib/analytics/unified-tracker';

interface AnalyticsTrackerProps {
  /** Disable tracking entirely */
  disabled?: boolean;
  /** Paths to exclude from tracking (e.g., ['/admin']) */
  excludePaths?: string[];
}

export function AnalyticsTracker({ 
  disabled = false, 
  excludePaths = ['/admin'] 
}: AnalyticsTrackerProps) {
  const pathname = usePathname();

  // Initialize tracker once
  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    
    // Check if current path should be excluded
    const shouldExclude = excludePaths.some(path => pathname?.startsWith(path));
    if (shouldExclude) return;

    initTracker();
  }, [disabled]);

  // Track page views on route change
  useEffect(() => {
    if (disabled || typeof window === 'undefined' || !pathname) return;
    
    // Check if current path should be excluded
    const shouldExclude = excludePaths.some(path => pathname.startsWith(path));
    if (shouldExclude) return;

    trackPageView(pathname, document.title);
  }, [pathname, disabled, excludePaths]);

  // This component renders nothing
  return null;
}

export default AnalyticsTracker;
