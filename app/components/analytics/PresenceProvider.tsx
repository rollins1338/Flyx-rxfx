/**
 * PresenceProvider — Local-first presence tracking.
 *
 * Provides a context for components that need activity type and
 * browsing context. Delegates all tracking to Local_Tracker.
 */

'use client';

import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { LocalTracker } from '@/lib/local-tracker/local-tracker';

interface ContentInfo {
  contentId?: string;
  contentTitle?: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
}

interface PresenceContextValue {
  userId: string;
  sessionId: string;
  isActive: boolean;
  setActivityType: (type: 'browsing' | 'watching' | 'livetv', content?: ContentInfo) => void;
  setBrowsingContext: (pageName: string, contentTitle?: string, contentId?: string, contentType?: 'movie' | 'tv') => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresenceContext() {
  return useContext(PresenceContext);
}

interface PresenceProviderProps {
  children: ReactNode;
}

export function PresenceProvider({ children }: PresenceProviderProps) {
  const pathname = usePathname();
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibility = () => {
      setIsActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Track page changes via Local_Tracker
  useEffect(() => {
    if (pathname) {
      const tracker = LocalTracker.getInstance();
      tracker.trackPageView(pathname);
    }
  }, [pathname]);

  const setActivityType = useCallback((type: 'browsing' | 'watching' | 'livetv', content?: ContentInfo) => {
    const tracker = LocalTracker.getInstance();
    if (type === 'watching' || type === 'livetv') {
      if (content?.contentId) {
        tracker.startWatch(
          content.contentId,
          type === 'livetv' ? 'livetv' : (content.contentType || 'movie'),
          content.contentTitle || '',
          content.seasonNumber,
          content.episodeNumber,
        );
      }
    }
  }, []);

  const setBrowsingContext = useCallback((_pageName: string) => {
    // Page view is already tracked by pathname change
  }, []);

  return (
    <PresenceContext.Provider value={{ userId: '', sessionId: '', isActive, setActivityType, setBrowsingContext }}>
      {children}
    </PresenceContext.Provider>
  );
}

export default PresenceProvider;
