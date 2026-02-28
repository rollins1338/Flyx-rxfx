/**
 * useContinueWatching — Returns in-progress items from Local_Store.
 *
 * Items with 5% < completion < 95%, sorted by most recently watched.
 *
 * Requirements: 7.1
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { LocalStore } from '../local-store/local-store';
import type { WatchProgressEntry } from '../local-store/types';

const store = new LocalStore();

export function useContinueWatching() {
  const [items, setItems] = useState<WatchProgressEntry[]>([]);

  const refresh = useCallback(() => {
    setItems(store.getInProgress());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, refresh };
}

export default useContinueWatching;
