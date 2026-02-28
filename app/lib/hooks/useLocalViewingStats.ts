/**
 * useLocalViewingStats — Returns computed viewing stats from Local_Store.
 *
 * Requirements: 7.3
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { LocalStore } from '../local-store/local-store';
import type { ViewingStats } from '../local-store/types';

const store = new LocalStore();

export function useLocalViewingStats() {
  const [stats, setStats] = useState<ViewingStats>(() => store.getViewingStats());

  const refresh = useCallback(() => {
    setStats(store.getViewingStats());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, refresh };
}

export default useLocalViewingStats;
