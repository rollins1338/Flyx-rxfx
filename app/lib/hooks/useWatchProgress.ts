/**
 * Watch Progress Hook
 * Manages watch progress tracking and persistence
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

interface WatchProgressOptions {
  contentId?: string;
  contentType?: 'movie' | 'episode';
  onProgress?: (time: number, duration: number) => void;
}

const STORAGE_KEY_PREFIX = 'watch_progress_';
const SAVE_INTERVAL = 5000; // Save every 5 seconds
const MIN_WATCH_THRESHOLD = 10; // Minimum 10 seconds watched to save

export function useWatchProgress(options: WatchProgressOptions) {
  const { contentId, contentType, onProgress } = options;
  const { trackWatchProgress, trackEvent } = useAnalytics();
  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyticsTimeRef = useRef<number>(0);

  // Load saved progress
  const loadProgress = useCallback((): number => {
    if (!contentId) return 0;

    try {
      const key = `${STORAGE_KEY_PREFIX}${contentId}`;
      const saved = localStorage.getItem(key);
      
      if (saved) {
        const data = JSON.parse(saved);
        // Only restore if watched within last 7 days
        const daysSince = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          return data.currentTime;
        }
      }
    } catch (error) {
      console.error('Failed to load watch progress:', error);
    }

    return 0;
  }, [contentId]);

  // Save progress
  const saveProgress = useCallback((currentTime: number, duration: number) => {
    if (!contentId || currentTime < MIN_WATCH_THRESHOLD) return;

    // Don't save if we're at the very end (last 30 seconds)
    if (duration - currentTime < 30) {
      // Clear progress if completed
      try {
        const key = `${STORAGE_KEY_PREFIX}${contentId}`;
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Failed to clear watch progress:', error);
      }
      return;
    }

    try {
      const key = `${STORAGE_KEY_PREFIX}${contentId}`;
      const data = {
        currentTime,
        duration,
        contentType,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));
      lastSaveTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to save watch progress:', error);
    }
  }, [contentId, contentType]);

  // Debounced save
  const debouncedSave = useCallback((currentTime: number, duration: number) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(currentTime, duration);
    }, SAVE_INTERVAL);
  }, [saveProgress]);

  // Handle progress updates
  const handleProgress = useCallback((currentTime: number, duration: number) => {
    onProgress?.(currentTime, duration);
    
    // Save periodically
    const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
    if (timeSinceLastSave >= SAVE_INTERVAL) {
      debouncedSave(currentTime, duration);
    }

    // Track analytics every 30 seconds
    const timeSinceLastAnalytics = Date.now() - lastAnalyticsTimeRef.current;
    if (contentId && timeSinceLastAnalytics >= 30000) {
      const mappedContentType = contentType === 'episode' ? 'tv' : 'movie';
      trackWatchProgress(contentId, mappedContentType, currentTime, duration);
      lastAnalyticsTimeRef.current = Date.now();
    }
  }, [onProgress, debouncedSave, contentId, contentType, trackWatchProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadProgress,
    saveProgress,
    handleProgress,
  };
}
