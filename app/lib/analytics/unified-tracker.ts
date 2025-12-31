/**
 * UNIFIED ANALYTICS TRACKER - Single source of truth for all client-side analytics
 * 
 * ARCHITECTURE:
 * - Single batch sync every 60 seconds to CF Worker
 * - All data collected in memory, sent in one request
 * - Minimal network overhead, maximum accuracy
 * 
 * REPLACES:
 * - usePresence hook heartbeats
 * - LiveActivityManager
 * - AnalyticsService event queue
 * - UnifiedAnalyticsClient
 * 
 * COST SAVINGS:
 * - 1 request/min per user instead of 3-5
 * - Single D1 batch write instead of multiple
 */

'use client';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_ANALYTICS_WORKER_URL || 'https://flyx-analytics.vynx.workers.dev';
const SYNC_INTERVAL = 60000; // 60 seconds - optimal for presence accuracy vs cost

// ============================================================================
// TYPES
// ============================================================================

interface WatchState {
  contentId: string;
  contentType: 'movie' | 'tv' | 'livetv';
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  position: number;
  duration: number;
  startedAt: number;
  lastUpdate: number;
  pauseCount: number;
  seekCount: number;
  lastPosition: number;
  quality?: string;
}

interface PageViewState {
  path: string;
  title?: string;
  referrer?: string;
  entryTime: number;
  timestamp: number;
}

interface SyncPayload {
  userId: string;
  sessionId: string;
  timestamp: number;
  activityType: 'browsing' | 'watching' | 'livetv';
  isActive: boolean;
  isVisible: boolean;
  isLeaving?: boolean;
  // Current watch state (if watching)
  currentContent?: {
    contentId: string;
    contentType: string;
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
  };
  // Watch progress updates
  watchProgress?: Array<{
    contentId: string;
    contentType: string;
    contentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    position: number;
    duration: number;
    startedAt: number;
    pauseCount: number;
    seekCount: number;
  }>;
  // Page views since last sync
  pageViews?: Array<{
    path: string;
    title?: string;
    referrer?: string;
    timestamp: number;
  }>;
  // Bot detection (sent once per session)
  validation?: {
    botConfidence: number;
    botReasons: string[];
    fingerprint?: string;
    hasInteracted: boolean;
    interactionCount: number;
  };
  // Device info (sent once per session)
  device?: {
    type: string;
    screen: string;
    timezone: string;
    language: string;
  };
}

// ============================================================================
// SINGLETON TRACKER
// ============================================================================

class UnifiedTracker {
  private static instance: UnifiedTracker | null = null;
  
  // Identity
  private userId: string = '';
  private sessionId: string = '';
  
  // State
  private activityType: 'browsing' | 'watching' | 'livetv' = 'browsing';
  private isVisible: boolean = true;
  private isActive: boolean = true;
  private hasInteracted: boolean = false;
  private interactionCount: number = 0;
  
  // Watch tracking
  private currentWatch: WatchState | null = null;
  private watchHistory: Map<string, WatchState> = new Map();
  
  // Page tracking
  private currentPage: PageViewState | null = null;
  private pageViews: PageViewState[] = [];
  
  // Bot detection (computed once)
  private botConfidence: number = 0;
  private botReasons: string[] = [];
  private fingerprint: string = '';
  private deviceSent: boolean = false;
  
  // Sync state
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private lastSyncTime: number = 0;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): UnifiedTracker {
    if (!UnifiedTracker.instance) {
      UnifiedTracker.instance = new UnifiedTracker();
    }
    return UnifiedTracker.instance;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  init(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Generate/retrieve IDs
    this.userId = this.getOrCreateId('flyx_user_id', 'u_');
    this.sessionId = this.getOrCreateId('flyx_session_id', 's_', true);

    // Run bot detection once
    this.detectBot();

    // Setup event listeners
    this.setupListeners();

    // Track initial page
    this.trackPageView(window.location.pathname, document.title);

    // Start sync interval
    this.startSync();

    // Initial sync after 2 seconds (let page settle)
    setTimeout(() => this.sync(), 2000);
  }

  private getOrCreateId(key: string, prefix: string, isSession = false): string {
    const storage = isSession ? sessionStorage : localStorage;
    let id = storage.getItem(key);
    if (!id) {
      id = `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      storage.setItem(key, id);
    }
    return id;
  }

  private detectBot(): void {
    const ua = navigator.userAgent.toLowerCase();
    const reasons: string[] = [];
    let confidence = 0;

    // Check user agent patterns
    const botPatterns = ['bot', 'crawler', 'spider', 'headless', 'phantom', 'selenium', 'puppeteer'];
    for (const pattern of botPatterns) {
      if (ua.includes(pattern)) {
        reasons.push(`ua:${pattern}`);
        confidence += 30;
      }
    }

    // Check webdriver
    if (navigator.webdriver) {
      reasons.push('webdriver');
      confidence += 40;
    }

    // Check plugins (real browsers usually have some)
    if (navigator.plugins.length === 0 && !ua.includes('mobile')) {
      reasons.push('no-plugins');
      confidence += 15;
    }

    // Generate fingerprint
    const components = [
      navigator.userAgent,
      navigator.language,
      `${screen.width}x${screen.height}`,
      new Date().getTimezoneOffset().toString(),
    ];
    let hash = 0;
    const str = components.join('|');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    this.fingerprint = Math.abs(hash).toString(36);

    this.botConfidence = Math.min(confidence, 100);
    this.botReasons = reasons;
  }

  private setupListeners(): void {
    // Visibility change
    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible';
      if (!this.isVisible) {
        // Sync immediately when tab becomes hidden
        this.sync();
      }
    });

    // User interaction tracking
    const interactionHandler = () => {
      this.hasInteracted = true;
      this.interactionCount++;
      this.isActive = true;
    };
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, interactionHandler, { passive: true });
    });

    // Page unload - send final sync
    window.addEventListener('beforeunload', () => this.sync(true));
    window.addEventListener('pagehide', () => this.sync(true));
  }

  private startSync(): void {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      if (this.isVisible) {
        this.sync();
      }
    }, SYNC_INTERVAL);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Track page view
   */
  trackPageView(path: string, title?: string): void {
    // Save previous page if exists
    if (this.currentPage && this.currentPage.path !== path) {
      this.pageViews.push(this.currentPage);
    }

    this.currentPage = {
      path,
      title,
      referrer: document.referrer,
      entryTime: Date.now(),
      timestamp: Date.now(),
    };

    // Update activity type if not watching
    if (this.activityType !== 'watching' && this.activityType !== 'livetv') {
      this.activityType = 'browsing';
    }
  }

  /**
   * Start watching content
   */
  startWatch(
    contentId: string,
    contentType: 'movie' | 'tv' | 'livetv',
    contentTitle?: string,
    seasonNumber?: number,
    episodeNumber?: number,
    duration?: number
  ): void {
    const key = this.getWatchKey(contentId, seasonNumber, episodeNumber);
    
    // Check if resuming existing watch
    const existing = this.watchHistory.get(key);
    
    this.currentWatch = {
      contentId,
      contentType,
      contentTitle,
      seasonNumber,
      episodeNumber,
      position: existing?.position || 0,
      duration: duration || existing?.duration || 0,
      startedAt: existing?.startedAt || Date.now(),
      lastUpdate: Date.now(),
      pauseCount: existing?.pauseCount || 0,
      seekCount: existing?.seekCount || 0,
      lastPosition: existing?.position || 0,
    };

    this.activityType = contentType === 'livetv' ? 'livetv' : 'watching';
    this.watchHistory.set(key, this.currentWatch);
  }

  /**
   * Update watch progress (call every 5 seconds during playback)
   */
  updateProgress(position: number, duration?: number): void {
    if (!this.currentWatch) return;

    const prevPosition = this.currentWatch.lastPosition;
    
    // Detect seek (position jump > 10 seconds)
    if (Math.abs(position - prevPosition) > 10) {
      this.currentWatch.seekCount++;
    }

    this.currentWatch.position = position;
    this.currentWatch.lastPosition = position;
    this.currentWatch.lastUpdate = Date.now();
    if (duration) this.currentWatch.duration = duration;

    // Update in history
    const key = this.getWatchKey(
      this.currentWatch.contentId,
      this.currentWatch.seasonNumber,
      this.currentWatch.episodeNumber
    );
    this.watchHistory.set(key, this.currentWatch);
  }

  /**
   * Pause watching
   */
  pauseWatch(): void {
    if (!this.currentWatch) return;
    this.currentWatch.pauseCount++;
    this.currentWatch.lastUpdate = Date.now();
  }

  /**
   * Stop watching (navigating away or completing)
   */
  stopWatch(): void {
    if (this.currentWatch) {
      // Save final state to history
      const key = this.getWatchKey(
        this.currentWatch.contentId,
        this.currentWatch.seasonNumber,
        this.currentWatch.episodeNumber
      );
      this.watchHistory.set(key, this.currentWatch);
      this.currentWatch = null;
    }
    this.activityType = 'browsing';
    
    // Sync immediately when stopping watch
    this.sync();
  }

  /**
   * Set video quality
   */
  setQuality(quality: string): void {
    if (this.currentWatch) {
      this.currentWatch.quality = quality;
    }
  }

  // ============================================================================
  // SYNC
  // ============================================================================

  private async sync(isLeaving = false): Promise<void> {
    if (!this.isInitialized || !this.userId) return;

    const now = Date.now();
    
    // Build payload
    const payload: SyncPayload = {
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: now,
      activityType: this.activityType,
      isActive: this.isActive,
      isVisible: this.isVisible,
      isLeaving,
    };

    // Add current content if watching
    if (this.currentWatch) {
      payload.currentContent = {
        contentId: this.currentWatch.contentId,
        contentType: this.currentWatch.contentType,
        contentTitle: this.currentWatch.contentTitle,
        seasonNumber: this.currentWatch.seasonNumber,
        episodeNumber: this.currentWatch.episodeNumber,
      };
    }

    // Add watch progress (all sessions since last sync)
    const watchProgress = Array.from(this.watchHistory.values())
      .filter(w => w.lastUpdate > this.lastSyncTime)
      .map(w => ({
        contentId: w.contentId,
        contentType: w.contentType,
        contentTitle: w.contentTitle,
        seasonNumber: w.seasonNumber,
        episodeNumber: w.episodeNumber,
        position: Math.round(w.position),
        duration: Math.round(w.duration),
        startedAt: w.startedAt,
        pauseCount: w.pauseCount,
        seekCount: w.seekCount,
      }));
    
    if (watchProgress.length > 0) {
      payload.watchProgress = watchProgress;
    }

    // Add page views
    if (this.pageViews.length > 0) {
      payload.pageViews = this.pageViews;
      this.pageViews = [];
    }

    // Add validation data (bot detection + interaction)
    if (this.botConfidence > 0 || this.hasInteracted) {
      payload.validation = {
        botConfidence: this.botConfidence,
        botReasons: this.botReasons,
        fingerprint: this.fingerprint,
        hasInteracted: this.hasInteracted,
        interactionCount: this.interactionCount,
      };
    }

    // Add device info (only once per session)
    if (!this.deviceSent) {
      payload.device = {
        type: this.getDeviceType(),
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      };
      this.deviceSent = true;
    }

    // Send to worker
    try {
      if (isLeaving && navigator.sendBeacon) {
        navigator.sendBeacon(`${CF_WORKER_URL}/sync`, JSON.stringify(payload));
      } else {
        await fetch(`${CF_WORKER_URL}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: isLeaving,
        });
      }
      this.lastSyncTime = now;
      this.interactionCount = 0; // Reset after successful sync
    } catch (e) {
      console.warn('[Analytics] Sync failed:', e);
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getWatchKey(contentId: string, season?: number, episode?: number): string {
    return `${contentId}_${season || 0}_${episode || 0}`;
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    if (ua.includes('smart-tv') || ua.includes('tv')) return 'tv';
    return 'desktop';
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.sync(true);
    this.isInitialized = false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const tracker = UnifiedTracker.getInstance();

// Convenience functions
export const initTracker = () => tracker.init();
export const trackPageView = (path: string, title?: string) => tracker.trackPageView(path, title);
export const startWatch = (
  contentId: string,
  contentType: 'movie' | 'tv' | 'livetv',
  contentTitle?: string,
  seasonNumber?: number,
  episodeNumber?: number,
  duration?: number
) => tracker.startWatch(contentId, contentType, contentTitle, seasonNumber, episodeNumber, duration);
export const updateProgress = (position: number, duration?: number) => tracker.updateProgress(position, duration);
export const pauseWatch = () => tracker.pauseWatch();
export const stopWatch = () => tracker.stopWatch();
export const setQuality = (quality: string) => tracker.setQuality(quality);
