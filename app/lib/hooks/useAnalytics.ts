/**
 * useAnalytics Hook — Local-first implementation.
 *
 * Replaces the old unified-tracker based hook with Local_Tracker.
 * Provides the same public API so existing consumers don't break.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { LocalTracker } from '../local-tracker/local-tracker';

interface UseAnalyticsOptions {
  disabled?: boolean;
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { disabled = false } = options;

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    const tracker = LocalTracker.getInstance();
    tracker.init();
    return () => {
      tracker.destroy();
    };
  }, [disabled]);

  const trackPageView = useCallback(
    (path: string, _title?: string) => {
      if (disabled) return;
      LocalTracker.getInstance().trackPageView(path);
    },
    [disabled],
  );

  const trackWatch = useCallback(
    (
      contentId: string,
      contentType: 'movie' | 'tv' | 'livetv',
      contentTitle?: string,
      seasonNumber?: number,
      episodeNumber?: number,
      duration?: number,
    ) => {
      if (disabled) return;
      LocalTracker.getInstance().startWatch(
        contentId,
        contentType,
        contentTitle ?? '',
        seasonNumber,
        episodeNumber,
        duration,
      );
    },
    [disabled],
  );

  const updateProgress = useCallback(
    (position: number, duration?: number) => {
      if (disabled) return;
      LocalTracker.getInstance().updateProgress(position, duration);
    },
    [disabled],
  );

  const pauseWatch = useCallback(() => {
    if (disabled) return;
    LocalTracker.getInstance().pauseWatch();
  }, [disabled]);

  const stopWatch = useCallback(() => {
    if (disabled) return;
    LocalTracker.getInstance().stopWatch();
  }, [disabled]);

  const setQuality = useCallback((_quality: string) => {
    // No-op in local-first — quality is not tracked locally
  }, []);

  return {
    trackPageView,
    trackWatch,
    updateProgress,
    pauseWatch,
    stopWatch,
    setQuality,
    tracker: LocalTracker.getInstance(),
  };
}

export default useAnalytics;
