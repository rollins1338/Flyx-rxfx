'use client';

import { createContext, useContext, ReactNode, useEffect, useCallback } from 'react';
import { analyticsService, type WatchEvent, type SearchEvent, type InteractionEvent, type PageViewEvent } from '@/lib/services/analytics';
import { userTrackingService, type UserSession, type UserPreferences } from '@/lib/services/user-tracking';

interface AnalyticsContextType {
  // Basic tracking
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackPageView: (page: string, data?: PageViewEvent) => void;

  // Watch tracking
  trackWatchProgress: (contentId: string, contentType: 'movie' | 'tv', watchTime: number, duration: number) => void;
  trackWatchEvent: (event: WatchEvent) => void;

  // Search tracking
  trackSearch: (event: SearchEvent) => void;

  // Interaction tracking
  trackInteraction: (event: InteractionEvent) => void;

  // Content engagement
  trackContentEngagement: (contentId: string, contentType: 'movie' | 'tv', action: string, data?: Record<string, any>) => void;

  // Error tracking
  trackError: (error: Error, context?: Record<string, any>) => void;

  // Performance tracking
  trackPerformance: (metric: string, value: number, context?: Record<string, any>) => void;

  // User session management
  getUserSession: () => UserSession | null;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
  clearUserData: () => void;

  // Watch progress management
  getWatchProgress: (contentId: string, season?: number, episode?: number) => any;
  getViewingHistory: () => any[];

  // Live activity
  updateActivity: (activity: {
    type: 'browsing' | 'watching' | 'livetv';
    contentId?: string;
    contentTitle?: string;
    contentType?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition?: number;
    duration?: number;
    quality?: string;
    channelId?: string;
    channelName?: string;
    category?: string;
  }) => void;

  // Live TV tracking
  trackLiveTVEvent: (event: {
    action: 'channel_select' | 'play_start' | 'play_stop' | 'error' | 'buffer' | 'quality_change';
    channelId: string;
    channelName: string;
    category?: string;
    country?: string;
    watchDuration?: number;
    errorMessage?: string;
    quality?: string;
  }) => void;

  // Enhanced watch time tracking
  updateWatchTime: (data: {
    contentId: string;
    contentType: 'movie' | 'tv';
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition: number;
    duration: number;
    quality?: string;
    isPlaying: boolean;
  }) => void;
  recordPause: (contentId: string, seasonNumber?: number, episodeNumber?: number) => void;
  clearWatchTime: (contentId: string, seasonNumber?: number, episodeNumber?: number) => void;

  // Live TV session management
  startLiveTVSession: (data: {
    channelId: string;
    channelName: string;
    category?: string;
    country?: string;
    quality?: string;
  }) => void;
  endLiveTVSession: () => void;
  recordLiveTVBuffer: () => void;
  updateLiveTVQuality: (quality: string) => void;
  
  // Page engagement tracking
  trackScrollDepth: (depth: number) => void;
  trackInteractionEvent: (element: string, action: string) => void;
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
  // Initialize analytics service on mount
  useEffect(() => {
    analyticsService.initialize();
  }, []);

  // Basic event tracking
  const trackEvent = useCallback((event: string, properties?: Record<string, any>) => {
    analyticsService.track(event, properties);
  }, []);

  const trackPageView = useCallback((page: string, data?: PageViewEvent) => {
    analyticsService.trackPageView(page, data);
  }, []);

  // Watch tracking
  const trackWatchProgress = useCallback((
    contentId: string,
    contentType: 'movie' | 'tv',
    watchTime: number,
    duration: number
  ) => {
    analyticsService.trackWatchEvent({
      contentId,
      contentType,
      action: 'progress',
      currentTime: watchTime,
      duration,
    });
  }, []);

  const trackWatchEvent = useCallback((event: WatchEvent) => {
    analyticsService.trackWatchEvent(event);
  }, []);

  // Search tracking
  const trackSearch = useCallback((event: SearchEvent) => {
    analyticsService.trackSearchEvent(event);
  }, []);

  // Interaction tracking
  const trackInteraction = useCallback((event: InteractionEvent) => {
    analyticsService.trackInteraction(event);
  }, []);

  // Content engagement tracking
  const trackContentEngagement = useCallback((
    contentId: string,
    contentType: 'movie' | 'tv',
    action: string,
    data?: Record<string, any>
  ) => {
    analyticsService.trackContentEngagement(contentId, contentType, action, data);
  }, []);

  // Error tracking
  const trackError = useCallback((error: Error, context?: Record<string, any>) => {
    analyticsService.trackError(error, context);
  }, []);

  // Performance tracking
  const trackPerformance = useCallback((metric: string, value: number, context?: Record<string, any>) => {
    analyticsService.trackPerformance(metric, value, context);
  }, []);

  // User session management
  const getUserSession = useCallback(() => {
    return analyticsService.getUserSession();
  }, []);

  const updateUserPreferences = useCallback((preferences: Partial<UserPreferences>) => {
    analyticsService.updateUserPreferences(preferences);
  }, []);

  const clearUserData = useCallback(() => {
    analyticsService.clearUserData();
  }, []);

  // Watch progress management
  const getWatchProgress = useCallback((contentId: string, season?: number, episode?: number) => {
    return userTrackingService.getWatchProgress(contentId, season, episode);
  }, []);

  const getViewingHistory = useCallback(() => {
    return userTrackingService.getViewingHistory();
  }, []);

  const updateActivity = useCallback((activity: {
    type: 'browsing' | 'watching' | 'livetv';
    contentId?: string;
    contentTitle?: string;
    contentType?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition?: number;
    duration?: number;
    quality?: string;
    channelId?: string;
    channelName?: string;
    category?: string;
  }) => {
    analyticsService.updateActivity(activity);
  }, []);

  // Live TV tracking
  const trackLiveTVEvent = useCallback((event: {
    action: 'channel_select' | 'play_start' | 'play_stop' | 'error' | 'buffer' | 'quality_change';
    channelId: string;
    channelName: string;
    category?: string;
    country?: string;
    watchDuration?: number;
    errorMessage?: string;
    quality?: string;
  }) => {
    analyticsService.track('livetv_event', {
      ...event,
      timestamp: Date.now(),
    });
    
    // Also update live activity for real-time tracking
    if (event.action === 'play_start') {
      analyticsService.updateActivity({
        type: 'livetv',
        contentId: event.channelId,
        contentTitle: event.channelName,
        contentType: 'livetv',
        quality: event.quality,
      });
    }
  }, []);

  // Enhanced watch time tracking
  const updateWatchTime = useCallback((data: {
    contentId: string;
    contentType: 'movie' | 'tv';
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition: number;
    duration: number;
    quality?: string;
    isPlaying: boolean;
  }) => {
    analyticsService.updateWatchTime(data);
  }, []);

  const recordPause = useCallback((contentId: string, seasonNumber?: number, episodeNumber?: number) => {
    analyticsService.recordPause(contentId, seasonNumber, episodeNumber);
  }, []);

  const clearWatchTime = useCallback((contentId: string, seasonNumber?: number, episodeNumber?: number) => {
    analyticsService.clearWatchTime(contentId, seasonNumber, episodeNumber);
  }, []);

  // Live TV session management
  const startLiveTVSession = useCallback((data: {
    channelId: string;
    channelName: string;
    category?: string;
    country?: string;
    quality?: string;
  }) => {
    analyticsService.startLiveTVSession(data);
  }, []);

  const endLiveTVSession = useCallback(() => {
    analyticsService.endLiveTVSession();
  }, []);

  const recordLiveTVBuffer = useCallback(() => {
    analyticsService.recordLiveTVBuffer();
  }, []);

  const updateLiveTVQuality = useCallback((quality: string) => {
    analyticsService.updateLiveTVQuality(quality);
  }, []);

  // Page engagement tracking
  const trackScrollDepth = useCallback((depth: number) => {
    analyticsService.track('scroll_depth', { depth, page: window.location.pathname });
  }, []);

  const trackInteractionEvent = useCallback((element: string, action: string) => {
    analyticsService.trackInteraction({ element, action: action as any });
  }, []);

  const value = {
    trackEvent,
    trackPageView,
    trackWatchProgress,
    trackWatchEvent,
    trackSearch,
    trackInteraction,
    trackContentEngagement,
    trackError,
    trackPerformance,
    getUserSession,
    updateUserPreferences,
    clearUserData,
    getWatchProgress,
    getViewingHistory,
    updateActivity,
    trackLiveTVEvent,
    updateWatchTime,
    recordPause,
    clearWatchTime,
    startLiveTVSession,
    endLiveTVSession,
    recordLiveTVBuffer,
    updateLiveTVQuality,
    trackScrollDepth,
    trackInteractionEvent,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}