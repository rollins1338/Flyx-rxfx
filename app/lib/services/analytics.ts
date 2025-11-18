/**
 * Analytics Service
 * Enhanced analytics with anonymized user tracking
 */

import { userTrackingService, type UserSession } from './user-tracking';

export interface AnalyticsEvent {
  id: string;
  type: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  timestamp: number;
  data?: Record<string, any>;
  metadata: Record<string, any>;
}

export interface PageViewEvent {
  page: string;
  referrer?: string;
  loadTime?: number;
}

export interface WatchEvent {
  contentId: string;
  contentType: 'movie' | 'tv';
  contentTitle?: string;
  action: 'start' | 'pause' | 'resume' | 'complete' | 'progress';
  currentTime: number;
  duration: number;
  quality?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface SearchEvent {
  query: string;
  resultsCount: number;
  selectedResult?: string;
  filters?: Record<string, any>;
}

export interface InteractionEvent {
  element: string;
  action: 'click' | 'hover' | 'scroll' | 'focus';
  context?: Record<string, any>;
}

class AnalyticsService {
  private userSession: UserSession | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private liveActivityInterval: NodeJS.Timeout | null = null;
  private currentActivity: {
    type: string;
    contentId?: string;
    contentTitle?: string;
    contentType?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition?: number;
    duration?: number;
    quality?: string;
  } | null = null;

  /**
   * Initialize analytics service
   */
  initialize(): void {
    if (this.isInitialized) return;
    
    this.userSession = userTrackingService.initialize();
    this.isInitialized = true;
    
    // Track page load
    this.trackPageView(window.location.pathname);
    
    // Set up periodic flush
    this.scheduleFlush();
    
    // Start live activity heartbeat
    this.startLiveActivityHeartbeat();
    
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushEvents();
        this.stopLiveActivity();
      } else {
        this.startLiveActivityHeartbeat();
      }
    });
    
    // Track before page unload
    window.addEventListener('beforeunload', () => {
      this.flushEvents();
      this.stopLiveActivity();
    });
  }

  /**
   * Track a generic event
   */
  track(eventType: string, data?: Record<string, any>): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type: eventType,
      userId: this.userSession?.userId || 'anonymous',
      sessionId: this.userSession?.sessionId || 'unknown',
      deviceId: this.userSession?.deviceId || 'unknown',
      timestamp: Date.now(),
      data: data || {},
      metadata: userTrackingService.getAnalyticsMetadata(),
    };

    this.eventQueue.push(event);
    userTrackingService.updateLastActivity();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', event);
    }
    
    this.scheduleFlush();
  }

  /**
   * Track page view
   */
  trackPageView(path: string, data?: PageViewEvent): void {
    this.track('page_view', {
      page: path,
      referrer: document.referrer,
      loadTime: performance.now(),
      ...data,
    });
  }

  /**
   * Track watch events
   */
  trackWatchEvent(event: WatchEvent): void {
    this.track('watch_event', event);
    
    // Update watch progress in user tracking
    if (event.action === 'progress' || event.action === 'complete') {
      userTrackingService.updateWatchProgress({
        contentId: event.contentId,
        contentType: event.contentType,
        seasonNumber: event.seasonNumber,
        episodeNumber: event.episodeNumber,
        currentTime: event.currentTime,
        duration: event.duration,
        completionPercentage: Math.round((event.currentTime / event.duration) * 100),
        lastWatched: Date.now(),
        completed: event.action === 'complete',
      });
    }
    
    // Track detailed watch session
    this.updateWatchSession(event);
  }

  /**
   * Update watch session with detailed tracking
   */
  private updateWatchSession(event: WatchEvent): void {
    if (!this.userSession) return;

    const sessionKey = `watch_session_${event.contentId}_${event.seasonNumber || 0}_${event.episodeNumber || 0}`;
    
    // Get or create watch session data
    let sessionData = this.getSessionData(sessionKey);
    
    if (!sessionData) {
      sessionData = {
        id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startedAt: Date.now(),
        totalWatchTime: 0,
        pauseCount: 0,
        seekCount: 0,
        lastUpdateTime: Date.now(),
        lastPosition: 0,
      };
    }

    // Update session data based on action
    const now = Date.now();
    const timeSinceLastUpdate = (now - sessionData.lastUpdateTime) / 1000;
    
    switch (event.action) {
      case 'start':
        sessionData.startedAt = now;
        sessionData.lastPosition = event.currentTime;
        break;
        
      case 'pause':
        sessionData.pauseCount++;
        if (timeSinceLastUpdate < 5) { // Only count watch time if reasonable
          sessionData.totalWatchTime += timeSinceLastUpdate;
        }
        sessionData.lastPosition = event.currentTime;
        break;
        
      case 'resume':
        sessionData.lastPosition = event.currentTime;
        break;
        
      case 'progress':
        // Track seek events (position jumped significantly)
        if (Math.abs(event.currentTime - sessionData.lastPosition) > 5) {
          sessionData.seekCount++;
        } else if (timeSinceLastUpdate < 5) {
          sessionData.totalWatchTime += timeSinceLastUpdate;
        }
        sessionData.lastPosition = event.currentTime;
        break;
        
      case 'complete':
        if (timeSinceLastUpdate < 5) {
          sessionData.totalWatchTime += timeSinceLastUpdate;
        }
        sessionData.lastPosition = event.currentTime;
        sessionData.endedAt = now;
        break;
    }

    sessionData.lastUpdateTime = now;
    this.setSessionData(sessionKey, sessionData);

    // Send session update to server periodically or on complete
    if (event.action === 'complete' || sessionData.totalWatchTime % 30 < 1) {
      this.syncWatchSession(event, sessionData);
    }
  }

  /**
   * Sync watch session to server
   */
  private async syncWatchSession(event: WatchEvent, sessionData: any): Promise<void> {
    try {
      const completionPercentage = event.duration > 0 
        ? Math.round((event.currentTime / event.duration) * 100) 
        : 0;

      await fetch('/api/analytics/watch-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionData.id,
          sessionId: this.userSession?.sessionId,
          userId: this.userSession?.userId,
          contentId: event.contentId,
          contentType: event.contentType,
          contentTitle: event.contentTitle,
          seasonNumber: event.seasonNumber,
          episodeNumber: event.episodeNumber,
          startedAt: sessionData.startedAt,
          endedAt: sessionData.endedAt,
          totalWatchTime: Math.round(sessionData.totalWatchTime),
          lastPosition: Math.round(event.currentTime),
          duration: Math.round(event.duration),
          completionPercentage,
          quality: event.quality,
          isCompleted: event.action === 'complete' || completionPercentage >= 90,
          pauseCount: sessionData.pauseCount,
          seekCount: sessionData.seekCount,
        }),
      });
    } catch (error) {
      console.error('Failed to sync watch session:', error);
    }
  }

  /**
   * Get session storage data
   */
  private getSessionData(key: string): any {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set session storage data
   */
  private setSessionData(key: string, data: any): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  /**
   * Track search events
   */
  trackSearchEvent(event: SearchEvent): void {
    this.track('search_event', event);
  }

  /**
   * Track user interactions
   */
  trackInteraction(event: InteractionEvent): void {
    this.track('interaction', event);
  }

  /**
   * Track content engagement
   */
  trackContentEngagement(contentId: string, contentType: 'movie' | 'tv', action: string, data?: Record<string, any>): void {
    this.track('content_engagement', {
      contentId,
      contentType,
      action,
      ...data,
    });
  }

  /**
   * Track error events
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.track('error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric: string, value: number, context?: Record<string, any>): void {
    this.track('performance', {
      metric,
      value,
      context,
    });
  }

  /**
   * Schedule event flush
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    
    // Flush immediately if queue is large, otherwise wait
    const delay = this.eventQueue.length > 10 ? 0 : 5000;
    
    this.flushTimeout = setTimeout(() => {
      this.flushEvents();
    }, delay);
  }

  /**
   * Flush events to server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
      
      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      
      // Re-queue events on failure (with limit to prevent memory issues)
      if (this.eventQueue.length < 100) {
        this.eventQueue.unshift(...events.slice(0, 50));
      }
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current user session
   */
  getUserSession(): UserSession | null {
    return this.userSession;
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(preferences: Partial<any>): void {
    userTrackingService.updatePreferences(preferences);
    this.track('preferences_updated', preferences);
  }

  /**
   * Clear user data (for privacy)
   */
  clearUserData(): void {
    userTrackingService.clearUserData();
    this.track('user_data_cleared');
    this.flushEvents();
  }

  /**
   * Update current activity
   */
  updateActivity(activity: {
    type: 'browsing' | 'watching';
    contentId?: string;
    contentTitle?: string;
    contentType?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    currentPosition?: number;
    duration?: number;
    quality?: string;
  }): void {
    this.currentActivity = activity;
    this.sendLiveActivityHeartbeat();
  }

  /**
   * Start live activity heartbeat
   */
  private startLiveActivityHeartbeat(): void {
    if (this.liveActivityInterval) return;

    // Send initial heartbeat
    this.currentActivity = { type: 'browsing' };
    this.sendLiveActivityHeartbeat();

    // Send heartbeat every 30 seconds
    this.liveActivityInterval = setInterval(() => {
      this.sendLiveActivityHeartbeat();
    }, 30000);
  }

  /**
   * Stop live activity
   */
  private stopLiveActivity(): void {
    if (this.liveActivityInterval) {
      clearInterval(this.liveActivityInterval);
      this.liveActivityInterval = null;
    }

    // Deactivate current activity
    if (this.userSession) {
      const activityId = `live_${this.userSession.userId}_${this.userSession.sessionId}`;
      fetch(`/api/analytics/live-activity?id=${activityId}`, {
        method: 'DELETE',
        keepalive: true,
      }).catch(() => {
        // Ignore errors on page unload
      });
    }
  }

  /**
   * Send live activity heartbeat
   */
  private async sendLiveActivityHeartbeat(): Promise<void> {
    if (!this.userSession || !this.currentActivity) return;

    try {
      await fetch('/api/analytics/live-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userSession.userId,
          sessionId: this.userSession.sessionId,
          activityType: this.currentActivity.type,
          contentId: this.currentActivity.contentId,
          contentTitle: this.currentActivity.contentTitle,
          contentType: this.currentActivity.contentType,
          seasonNumber: this.currentActivity.seasonNumber,
          episodeNumber: this.currentActivity.episodeNumber,
          currentPosition: this.currentActivity.currentPosition,
          duration: this.currentActivity.duration,
          quality: this.currentActivity.quality,
        }),
      });
    } catch (error) {
      console.error('Failed to send live activity heartbeat:', error);
    }
  }
}

export const analyticsService = new AnalyticsService();

export class EventQueue {
  private queue: AnalyticsEvent[] = [];

  add(event: AnalyticsEvent): void {
    this.queue.push(event);
  }

  flush(): AnalyticsEvent[] {
    const events = [...this.queue];
    this.queue = [];
    return events;
  }

  size(): number {
    return this.queue.length;
  }
}

export const eventQueue = new EventQueue();