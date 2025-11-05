'use client';

import { createContext, useContext, ReactNode } from 'react';

interface AnalyticsContextType {
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackPageView: (page: string) => void;
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
  const trackEvent = (event: string, properties?: Record<string, any>) => {
    // Analytics implementation would go here
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event, properties);
    }
  };

  const trackPageView = (page: string) => {
    // Page view tracking would go here
    if (process.env.NODE_ENV === 'development') {
      console.log('Page View:', page);
    }
  };

  const value = {
    trackEvent,
    trackPageView,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}