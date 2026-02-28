/**
 * useLocalTracker — React hook to initialize the Local_Tracker singleton.
 *
 * Initializes on mount, cleans up on unmount.
 * Returns the tracker instance for direct method access.
 *
 * Requirements: 1.2, 7.1, 7.2, 7.3
 */

'use client';

import { useEffect, useRef } from 'react';
import { LocalTracker, type ILocalTracker } from '../local-tracker/local-tracker';

export function useLocalTracker(): ILocalTracker {
  const trackerRef = useRef<LocalTracker>(LocalTracker.getInstance());

  useEffect(() => {
    const tracker = trackerRef.current;
    tracker.init();

    return () => {
      tracker.destroy();
    };
  }, []);

  return trackerRef.current;
}

export default useLocalTracker;
