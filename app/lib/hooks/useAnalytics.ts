/**
 * useAnalytics Hook - Simple interface to the unified tracker
 * 
 * Usage:
 *   const { trackWatch, updateProgress, stopWatch } = useAnalytics();
 *   
 *   // When user starts watching
 *   trackWatch('movie-123', 'movie', 'Movie Title');
 *   
 *   // During playback (every 5 seconds)
 *   updateProgress(currentTime, duration);
 *   
 *   // When user stops/navigates away
 *   stopWatch();
 */

'use client';

import { useEffect, useCallback } from 'react';
import { 
  tracker, 
  initTracker, 
  trackPageView as _trackPageView,
  startWatch as _startWatch,
  updateProgress as _updateProgress,
  pauseWatch as _pauseWatch,
  stopWatch as _stopWatch,
  setQuality as _setQuality,
} from '@/lib/analytics/unified-tracker';

interface UseAnalyticsOptions {
  /** Disable tracking (e.g., for admin pages) */
  disabled?: boolean;
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { disabled = false } = options;

  // Initialize tracker on mount
  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    initTracker();
  }, [disabled]);

  // Track page view on route change
  const trackPageView = useCallback((path: string, title?: string) => {
    if (disabled) return;
    _trackPageView(path, title);
  }, [disabled]);

  // Start watching content
  const trackWatch = useCallback((
    contentId: string,
    contentType: 'movie' | 'tv' | 'livetv',
    contentTitle?: string,
    seasonNumber?: number,
    episodeNumber?: number,
    duration?: number
  ) => {
    if (disabled) return;
    _startWatch(contentId, contentType, contentTitle, seasonNumber, episodeNumber, duration);
  }, [disabled]);

  // Update watch progress
  const updateProgress = useCallback((position: number, duration?: number) => {
    if (disabled) return;
    _updateProgress(position, duration);
  }, [disabled]);

  // Pause watching
  const pauseWatch = useCallback(() => {
    if (disabled) return;
    _pauseWatch();
  }, [disabled]);

  // Stop watching
  const stopWatch = useCallback(() => {
    if (disabled) return;
    _stopWatch();
  }, [disabled]);

  // Set video quality
  const setQuality = useCallback((quality: string) => {
    if (disabled) return;
    _setQuality(quality);
  }, [disabled]);

  return {
    trackPageView,
    trackWatch,
    updateProgress,
    pauseWatch,
    stopWatch,
    setQuality,
    tracker,
  };
}

export default useAnalytics;
