/**
 * Watch Progress Hook — Local-first implementation.
 *
 * Replaces the old cloud-first useWatchProgress that depended on
 * the AnalyticsProvider context and userTrackingService.
 * Now writes all progress directly to Local_Store via Local_Tracker.
 *
 * Requirements: 1.2
 */

import { useEffect, useCallback, useRef } from 'react';
import { LocalTracker } from '../local-tracker/local-tracker';
import { LocalStore } from '../local-store/local-store';

interface WatchProgressOptions {
  contentId?: string;
  contentType?: 'movie' | 'episode';
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  onProgress?: (time: number, duration: number) => void;
  onComplete?: () => void;
}

const SAVE_INTERVAL = 5000;
const MIN_WATCH_THRESHOLD = 10;
const COMPLETION_THRESHOLD = 0.9;

const store = new LocalStore();

export function useWatchProgress(options: WatchProgressOptions) {
  const {
    contentId,
    contentType,
    contentTitle,
    seasonNumber,
    episodeNumber,
    onProgress,
    onComplete,
  } = options;

  const lastSaveTimeRef = useRef<number>(0);
  const hasStartedRef = useRef<boolean>(false);
  const wasCompletedRef = useRef<boolean>(false);

  const mappedType = contentType === 'episode' ? 'tv' : 'movie';

  // Load saved progress from Local_Store
  const loadProgress = useCallback((): number => {
    if (!contentId) return 0;
    try {
      const entry = store.getWatchProgress(contentId, seasonNumber, episodeNumber);
      if (entry) {
        const daysSince = (Date.now() - entry.lastWatched) / (1000 * 60 * 60 * 24);
        const completion = entry.duration > 0 ? entry.position / entry.duration : 0;
        if (daysSince < 7 && completion < COMPLETION_THRESHOLD) {
          return entry.position;
        }
      }
    } catch {
      // ignore
    }
    return 0;
  }, [contentId, seasonNumber, episodeNumber]);

  // Start watch via Local_Tracker
  const handleWatchStart = useCallback(
    (_currentTime: number, duration: number) => {
      if (!contentId || hasStartedRef.current) return;
      hasStartedRef.current = true;

      const tracker = LocalTracker.getInstance();
      tracker.startWatch(
        contentId,
        mappedType as 'movie' | 'tv' | 'livetv',
        contentTitle ?? '',
        seasonNumber,
        episodeNumber,
        duration,
      );
    },
    [contentId, mappedType, contentTitle, seasonNumber, episodeNumber],
  );

  // Pause
  const handleWatchPause = useCallback(
    (_currentTime: number, _duration: number) => {
      if (!contentId) return;
      LocalTracker.getInstance().pauseWatch();
    },
    [contentId],
  );

  // Resume — just re-send a progress update
  const handleWatchResume = useCallback(
    (currentTime: number, duration: number) => {
      if (!contentId) return;
      const tracker = LocalTracker.getInstance();
      if (!hasStartedRef.current) {
        handleWatchStart(currentTime, duration);
      }
      tracker.updateProgress(currentTime, duration);
    },
    [contentId, handleWatchStart],
  );

  // Progress updates — writes to Local_Store periodically
  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!contentId || duration <= 0) return;

      onProgress?.(currentTime, duration);

      if (!hasStartedRef.current) {
        handleWatchStart(currentTime, duration);
      }

      const completionPct = currentTime / duration;

      // Completion detection
      if (completionPct >= COMPLETION_THRESHOLD && !wasCompletedRef.current) {
        wasCompletedRef.current = true;
        LocalTracker.getInstance().updateProgress(currentTime, duration);
        onComplete?.();
      }

      // Periodic save to Local_Store
      const elapsed = Date.now() - lastSaveTimeRef.current;
      if (elapsed >= SAVE_INTERVAL && currentTime >= MIN_WATCH_THRESHOLD) {
        LocalTracker.getInstance().updateProgress(currentTime, duration);
        lastSaveTimeRef.current = Date.now();
      }
    },
    [contentId, onProgress, onComplete, handleWatchStart],
  );

  // Get current progress from Local_Store
  const getCurrentProgress = useCallback(() => {
    if (!contentId) return null;
    return store.getWatchProgress(contentId, seasonNumber, episodeNumber);
  }, [contentId, seasonNumber, episodeNumber]);

  // Mark as completed
  const markAsCompleted = useCallback(
    (currentTime: number, duration: number) => {
      if (!contentId || wasCompletedRef.current) return;
      wasCompletedRef.current = true;
      LocalTracker.getInstance().updateProgress(currentTime, duration);
      onComplete?.();
    },
    [contentId, onComplete],
  );

  // Stop watch on unmount
  useEffect(() => {
    return () => {
      if (hasStartedRef.current) {
        LocalTracker.getInstance().stopWatch();
      }
    };
  }, []);

  return {
    loadProgress,
    handleProgress,
    handleWatchStart,
    handleWatchPause,
    handleWatchResume,
    getCurrentProgress,
    markAsCompleted,
  };
}
