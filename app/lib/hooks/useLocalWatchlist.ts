/**
 * useLocalWatchlist — Wraps Local_Store watchlist methods with React state.
 *
 * Requirements: 7.1, 7.2
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { LocalStore } from '../local-store/local-store';
import type { WatchlistEntry } from '../local-store/types';

const store = new LocalStore();

export function useLocalWatchlist() {
  const [items, setItems] = useState<WatchlistEntry[]>([]);

  // Load on mount
  useEffect(() => {
    setItems(store.getWatchlist());
  }, []);

  const add = useCallback((entry: WatchlistEntry) => {
    store.addToWatchlist(entry);
    setItems(store.getWatchlist());
  }, []);

  const remove = useCallback((id: string | number) => {
    store.removeFromWatchlist(id);
    setItems(store.getWatchlist());
  }, []);

  const isInList = useCallback(
    (id: string | number) => store.isInWatchlist(id),
    [],
  );

  return { items, add, remove, isInList };
}

export default useLocalWatchlist;
