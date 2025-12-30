/**
 * Unified Analytics Client - BATCHED SYNC EVERY 60 SECONDS
 * 
 * All analytics data is collected locally and sent in a single batch request
 * every 60 seconds. This drastically reduces API calls while maintaining accuracy.
 * 
 * Data collected:
 * - Presence/heartbeat (activity type, content being viewed)
 * - Watch progress (position, duration, completion)
 * - Page views
 * - Bot detection signals
 * 
 * Benefits:
 * - 1 request per minute per user (instead of multiple)
 * - Reduced D1 reads/writes
 * - Better battery life on mobile
 * - Cross-device sync every 60s is accurate enough for watch history
 */

'use client';

import { detectBotClient, type BotDetectionResult } from '@/lib/utils/bot-detection';

// Config
const SYNC_INTERVAL = 60000; // 60 seconds
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL || 'https://flyx-analytics.vynx.workers.dev';

// Types
interface WatchProgress {
  contentId: string;
  contentType: 'movie' | 'tv' | 'livetv';
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  position: number;
  duration: number;
  startedAt: number;
  lastUpdate: number;
}

interface PageView {
  path: string;
  title?: string;
  referrer?: string;
  timestamp: number;
}

interface AnalyticsBatch {
  userId: string;
  sessionId: string;
  timestamp: number;
  // Presence
  activityType: 'browsing' | 'watching' | 'livetv';
  isActive: boolean;
  isVisible: boolean;
  // Current content (if watching)
  currentContent?: WatchProgress;
  // All watch progress since last sync
  watchProgress: WatchProgress[];
  // Page views since last sync
  pageViews: PageView[];
  // Bot detection
  botDetection?: {
    isBot: boolean;
    confidence: number;
    reasons: string[];
    fingerprint?: string;
  };
  // Device info
  device: {
    type: string;
    screen: string;
    timezone: string;
    language: string;
  };
}

// Singleton state
let instance: UnifiedAnalyticsClient | null = null;

class UnifiedAnalyticsClient {
  private userId: string = '';
  private sessionId: string = '';
  private activityType: 'browsing' | 'watching' | 'livetv' = 'browsing';
  private currentContent: WatchProgress | null = null;
  private watchProgress: Map<string, WatchProgress> = new Map();
  private pageViews: PageView[] = [];
  private botDetection: BotDetectionResult | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private isVisible: boolean = true;

  constructor() {
    if (typeof window === 'undefined') return;
    
    // Generate or retrieve user/session IDs
    this.userId = this.getOrCreateUserId();
    this.sessionId = this.getOrCreateSessionId();
    
    // Run bot detection once
    this.botDetection = detectBotClient();
    
    // Skip tracking for high-confidence bots
    if (this.botDetection?.isBot && this.botDetection.confidence >= 70) {
      console.log('[Analytics] Bot detected, tracking disabled');
      return;
    }
    
    // Setup visibility tracking
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Setup unload handler
    window.addEventListener('beforeunload', this.handleUnload);
    window.addEventListener('pagehide', this.handleUnload);
    
    // Start sync interval
    this.startSyncInterval();
    
    // Initial sync after 5 seconds (let page settle)
    setTimeout(() => this.sync(), 5000);
    
    console.log('[Analytics] Initialized - syncing every 60s');
  }

  private getOrCreateUserId(): string {
    let userId = localStorage.getItem('flyx_user_id');
    if (!userId) {
      const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        Math.random().toString(36).substring(2, 8),
      ];
      let hash = 0;
      const str = components.join('|');
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      userId = `u_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
      localStorage.setItem('flyx_user_id', userId);
    }
    return userId;
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('flyx_session_id');
    if (!sessionId) {
      sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('flyx_session_id', sessionId);
    }
    return sessionId;
  }

  private handleVisibilityChange = () => {
    this.isVisible = document.visibilityState === 'visible';
    // Sync immediately when becoming hidden (user leaving)
    if (!this.isVisible) {
      this.sync(true);
    }
  };

  private handleUnload = () => {
    this.sync(true);
  };

  private startSyncInterval() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.isVisible) {
        this.sync();
      }
    }, SYNC_INTERVAL);
  }

  private getDeviceInfo() {
    return {
      type: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };
  }

  /**
   * Main sync function - sends all batched data to CF Worker
   */
  async sync(isLeaving = false): Promise<void> {
    if (!this.userId || !this.sessionId) return;
    
    const now = Date.now();
    
    // Build batch payload
    const batch: AnalyticsBatch = {
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: now,
      activityType: this.activityType,
      isActive: this.isVisible,
      isVisible: this.isVisible,
      currentContent: this.currentContent || undefined,
      watchProgress: Array.from(this.watchProgress.values()),
      pageViews: [...this.pageViews],
      botDetection: this.botDetection ? {
        isBot: this.botDetection.isBot,
        confidence: this.botDetection.confidence,
        reasons: this.botDetection.reasons,
        fingerprint: this.botDetection.fingerprint,
      } : undefined,
      device: this.getDeviceInfo(),
    };

    // Clear queued data after building batch
    this.pageViews = [];
    // Keep watch progress for continuity

    try {
      if (isLeaving && navigator.sendBeacon) {
        // Use sendBeacon for reliability when leaving
        navigator.sendBeacon(`${CF_WORKER_URL}/sync`, JSON.stringify(batch));
      } else {
        await fetch(`${CF_WORKER_URL}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
          keepalive: isLeaving,
        });
      }
    } catch (e) {
      console.error('[Analytics] Sync failed:', e);
    }
  }

  // Public API

  /**
   * Set current activity type
   */
  setActivity(type: 'browsing' | 'watching' | 'livetv') {
    this.activityType = type;
  }

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string) {
    this.pageViews.push({
      path,
      title,
      referrer: document.referrer,
      timestamp: Date.now(),
    });
    this.activityType = 'browsing';
    this.currentContent = null;
  }

  /**
   * Update watch progress - call this from video player
   */
  updateWatchProgress(data: {
    contentId: string;
    contentType: 'movie' | 'tv' | 'livetv';
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    position: number;
    duration: number;
  }) {
    const key = `${data.contentId}_${data.seasonNumber || 0}_${data.episodeNumber || 0}`;
    const existing = this.watchProgress.get(key);
    const now = Date.now();

    const progress: WatchProgress = {
      contentId: data.contentId,
      contentType: data.contentType,
      contentTitle: data.contentTitle,
      seasonNumber: data.seasonNumber,
      episodeNumber: data.episodeNumber,
      position: data.position,
      duration: data.duration,
      startedAt: existing?.startedAt || now,
      lastUpdate: now,
    };

    this.watchProgress.set(key, progress);
    this.currentContent = progress;
    this.activityType = data.contentType === 'livetv' ? 'livetv' : 'watching';
  }

  /**
   * Clear watch progress (when stopping playback)
   */
  clearWatchProgress(contentId: string, seasonNumber?: number, episodeNumber?: number) {
    const key = `${contentId}_${seasonNumber || 0}_${episodeNumber || 0}`;
    this.watchProgress.delete(key);
    if (this.currentContent?.contentId === contentId) {
      this.currentContent = null;
      this.activityType = 'browsing';
    }
  }

  /**
   * Get user ID (for other components that need it)
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Force immediate sync
   */
  forceSync(): Promise<void> {
    return this.sync();
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleUnload);
    window.removeEventListener('pagehide', this.handleUnload);
    this.sync(true);
  }
}

// Singleton getter
export function getAnalyticsClient(): UnifiedAnalyticsClient | null {
  if (typeof window === 'undefined') return null;
  if (!instance) {
    instance = new UnifiedAnalyticsClient();
  }
  return instance;
}

// Convenience exports
export function trackPageView(path: string, title?: string) {
  getAnalyticsClient()?.trackPageView(path, title);
}

export function updateWatchProgress(data: Parameters<UnifiedAnalyticsClient['updateWatchProgress']>[0]) {
  getAnalyticsClient()?.updateWatchProgress(data);
}

export function clearWatchProgress(contentId: string, seasonNumber?: number, episodeNumber?: number) {
  getAnalyticsClient()?.clearWatchProgress(contentId, seasonNumber, episodeNumber);
}

export function setActivity(type: 'browsing' | 'watching' | 'livetv') {
  getAnalyticsClient()?.setActivity(type);
}

export function getUserId(): string {
  return getAnalyticsClient()?.getUserId() || '';
}

export function getSessionId(): string {
  return getAnalyticsClient()?.getSessionId() || '';
}

export function forceAnalyticsSync(): Promise<void> {
  return getAnalyticsClient()?.forceSync() || Promise.resolve();
}
