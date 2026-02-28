/**
 * useLocalWatchProgress — Read/write watch progress from Local_Store.
 *
 * Provides the current progress for a given content item and
 * an updater function that writes back to the store.
 *
 * Requirements: 7.1, 7.2, 7.3
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { LocalStore } from '../local-store/local-store';
import type { WatchProgressEntry } from '../local-store/types';

const store = new LocalStore();

export function useLocalWatchProgress(
  contentId: string,
  season?: number,
  episode?: number,
) {
  const [progress, setProgress] = useState<WatchProgressEntry | null>(() =>
    store.getWatchProgress(contentId, season, episode),
  );

  // Re-read when the key changes
  useEffect(() => {
    setProgress(store.getWatchProgress(contentId, season, episode));
  }, [contentId, season, episode]);

  const updateProgress = useCallback(
    (position: number, duration: number) => {
      const existing = store.getWatchProgress(contentId, season, episode);
      const entry: WatchProgressEntry = {
        contentId,
        contentType: existing?.contentType ?? 'movie',
        title: existing?.title ?? '',
        seasonNumber: season,
        episodeNumber: episode,
        position,
        duration,
        lastWatched: Date.now(),
        posterPath: existing?.posterPath,
      };
      store.setWatchProgress(entry);
      setProgress(entry);
    },
    [contentId, season, episode],
  );

  return { progress, updateProgress };
}

export default useLocalWatchProgress;
