/**
 * PresenceProvider - SIMPLIFIED
 * 
 * Now uses the unified analytics client which batches all data
 * and syncs every 60 seconds. This component just provides context
 * for other components that need user/session IDs.
 */

'use client';

import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { 
  getAnalyticsClient, 
  getUserId, 
  getSessionId, 
  setActivity,
  updateWatchProgress,
  trackPageView,
} from '@/lib/analytics/unified-analytics-client';

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
  const [userId, setUserId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Initialize analytics client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Initialize the unified client
    getAnalyticsClient();
    
    // Get IDs
    setUserId(getUserId());
    setSessionId(getSessionId());
    
    // Track visibility
    const handleVisibility = () => {
      setIsActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Track page changes
  useEffect(() => {
    if (pathname && userId) {
      trackPageView(pathname, document.title);
    }
  }, [pathname, userId]);

  // Set activity type (called by video player, etc.)
  const setActivityType = useCallback((type: 'browsing' | 'watching' | 'livetv', content?: ContentInfo) => {
    setActivity(type);
    
    if (content && content.contentId) {
      updateWatchProgress({
        contentId: content.contentId,
        contentType: type === 'livetv' ? 'livetv' : (content.contentType || 'movie'),
        contentTitle: content.contentTitle,
        seasonNumber: content.seasonNumber,
        episodeNumber: content.episodeNumber,
        position: 0,
        duration: 0,
      });
    }
  }, []);

  // Set browsing context
  const setBrowsingContext = useCallback((_pageName: string, _contentTitle?: string, _contentId?: string, _contentType?: 'movie' | 'tv') => {
    setActivity('browsing');
    // Page view is already tracked by pathname change
  }, []);

  return (
    <PresenceContext.Provider value={{ userId, sessionId, isActive, setActivityType, setBrowsingContext }}>
      {children}
    </PresenceContext.Provider>
  );
}

export default PresenceProvider;
