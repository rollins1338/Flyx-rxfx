'use client';

import { createContext, useContext, ReactNode, useRef, useCallback } from 'react';

interface AnalyticsContextType {
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackPageView: (page: string) => void;
  trackWatchProgress: (contentId: string, contentType: 'movie' | 'tv', watchTime: number, duration: number) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | null>(null);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

interface AnalyticsProviderProps {
  children: ReactNode;
}

export default function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const eventQueue = useRef<any[]>([]);
  const flushTimeout = useRef<NodeJS.Timeout | null>(null);

  const flushEvents = useCallback(async () => {
    if (eventQueue.current.length === 0) return;

    const events = [...eventQueue.current];
    eventQueue.current = [];

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(events),
      });
    } catch (error) {
      console.error('Failed to track analytics:', error);
      // Re-queue events on failure
      eventQueue.current.unshift(...events);
    }
  }, []);

  const queueEvent = useCallback((eventType: string, properties: Record<string, any> = {}) => {
    eventQueue.current.push({
      event_type: eventType,
      ...properties,
      timestamp: Date.now(),
    });

    // Debounce flush
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current);
    }
    flushTimeout.current = setTimeout(flushEvents, 1000);
  }, [flushEvents]);

  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    queueEvent(event, properties);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event, properties);
    }
  }, [queueEvent]);

  const trackPageView = useCallback((page: string) => {
    queueEvent('page_view', { page });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Page View:', page);
    }
  }, [queueEvent]);

  const trackWatchProgress = useCallback((
    contentId: string,
    contentType: 'movie' | 'tv',
    watchTime: number,
    duration: number
  ) => {
    queueEvent('watch_progress', {
      content_id: contentId,
      content_type: contentType,
      watch_time: watchTime,
      duration: duration,
      completion_percentage: Math.round((watchTime / duration) * 100),
    });
  }, [queueEvent]);

  const value = {
    trackEvent,
    trackPageView,
    trackWatchProgress,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}