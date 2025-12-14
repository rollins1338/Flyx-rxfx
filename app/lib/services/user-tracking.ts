/**
 * Anonymous User Tracking Service
 * Manages anonymized user identification and tracking across sessions
 */

// Simple UUID v4 generator to avoid dependency issues
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface UserSession {
  userId: string;
  sessionId: string;
  deviceId: string;
  createdAt: number;
  lastActivity: number;
  preferences: UserPreferences;
}

export interface UserPreferences {
  watchProgress: Record<string, WatchProgress>;
  favoriteGenres: string[];
  preferredLanguage: string;
  autoplay: boolean;
  quality: 'auto' | '720p' | '1080p' | '4k';
  volume: number;
  subtitles: boolean;
  theme: 'light' | 'dark' | 'auto';
  dataCollectionEnabled: boolean;
}

export interface WatchProgress {
  contentId: string;
  contentType: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  currentTime: number;
  duration: number;
  completionPercentage: number;
  lastWatched: number;
  completed: boolean;
}

export interface ViewingHistory {
  contentId: string;
  contentType: 'movie' | 'tv';
  title: string;
  watchedAt: number;
  watchTime: number;
  completed: boolean;
}

class UserTrackingService {
  private static readonly USER_ID_KEY = 'flyx_user_id';
  private static readonly SESSION_ID_KEY = 'flyx_session_id';
  private static readonly DEVICE_ID_KEY = 'flyx_device_id';
  private static readonly PREFERENCES_KEY = 'flyx_preferences';
  private static readonly WATCH_PROGRESS_KEY = 'flyx_watch_progress';
  private static readonly VIEWING_HISTORY_KEY = 'flyx_viewing_history';

  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private static readonly MAX_HISTORY_ITEMS = 100;

  private userId: string | null = null;
  private sessionId: string | null = null;
  private deviceId: string | null = null;
  private preferences: UserPreferences | null = null;

  /**
   * Initialize user tracking
   */
  initialize(): UserSession {
    this.userId = this.getOrCreateUserId();
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.getOrCreateSessionId();
    this.preferences = this.loadPreferences();

    const session: UserSession = {
      userId: this.userId,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      preferences: this.preferences,
    };

    this.updateLastActivity();
    return session;
  }

  /**
   * Get or create anonymous user ID
   */
  private getOrCreateUserId(): string {
    try {
      let userId = localStorage.getItem(UserTrackingService.USER_ID_KEY);

      if (!userId) {
        userId = `user_${generateUUID()}`;
        localStorage.setItem(UserTrackingService.USER_ID_KEY, userId);
      }

      return userId;
    } catch (error) {
      // Fallback for when localStorage is not available
      return `user_${generateUUID()}`;
    }
  }

  /**
   * Get or create device ID
   */
  private getOrCreateDeviceId(): string {
    try {
      let deviceId = localStorage.getItem(UserTrackingService.DEVICE_ID_KEY);

      if (!deviceId) {
        // Create device fingerprint based on available info
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx?.fillText('device-fingerprint', 10, 10);

        const fingerprint = [
          navigator.userAgent,
          navigator.language,
          screen.width + 'x' + screen.height,
          new Date().getTimezoneOffset(),
          canvas.toDataURL(),
        ].join('|');

        deviceId = `device_${this.hashString(fingerprint)}`;
        localStorage.setItem(UserTrackingService.DEVICE_ID_KEY, deviceId);
      }

      return deviceId;
    } catch (error) {
      return `device_${generateUUID()}`;
    }
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    try {
      const stored = sessionStorage.getItem(UserTrackingService.SESSION_ID_KEY);

      if (stored) {
        const { sessionId, timestamp } = JSON.parse(stored);

        // Check if session is still valid
        if (Date.now() - timestamp < UserTrackingService.SESSION_TIMEOUT) {
          return sessionId;
        }
      }

      // Create new session
      const sessionId = `session_${generateUUID()}`;
      const sessionData = {
        sessionId,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(UserTrackingService.SESSION_ID_KEY, JSON.stringify(sessionData));
      return sessionId;
    } catch (error) {
      return `session_${generateUUID()}`;
    }
  }

  /**
   * Load user preferences
   */
  private loadPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(UserTrackingService.PREFERENCES_KEY);

      if (stored) {
        const preferences = JSON.parse(stored);
        return {
          ...this.getDefaultPreferences(),
          ...preferences,
        };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }

    return this.getDefaultPreferences();
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      watchProgress: {},
      favoriteGenres: [],
      preferredLanguage: 'en',
      autoplay: true,
      quality: 'auto',
      volume: 0.8,
      subtitles: false,
      theme: 'auto',
      dataCollectionEnabled: true,
    };
  }

  /**
   * Update user preferences
   */
  updatePreferences(updates: Partial<UserPreferences>): void {
    this.preferences = {
      ...this.preferences!,
      ...updates,
    };

    try {
      localStorage.setItem(
        UserTrackingService.PREFERENCES_KEY,
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  /**
   * Generate storage key for watch progress
   */
  private getStorageKey(contentId: string, season?: number, episode?: number): string {
    if (season !== undefined && episode !== undefined) {
      return `${contentId}_s${season}_e${episode}`;
    }
    return contentId;
  }

  /**
   * Update watch progress
   */
  updateWatchProgress(progress: WatchProgress): void {
    if (!this.preferences) return;

    const key = this.getStorageKey(progress.contentId, progress.seasonNumber, progress.episodeNumber);
    this.preferences.watchProgress[key] = progress;

    try {
      localStorage.setItem(
        UserTrackingService.WATCH_PROGRESS_KEY,
        JSON.stringify(this.preferences.watchProgress)
      );

      // Also update in preferences
      this.updatePreferences({ watchProgress: this.preferences.watchProgress });
    } catch (error) {
      console.error('Failed to save watch progress:', error);
    }
  }

  /**
   * Get watch progress for content
   */
  getWatchProgress(contentId: string, season?: number, episode?: number): WatchProgress | null {
    const key = this.getStorageKey(contentId, season, episode);
    return this.preferences?.watchProgress[key] || null;
  }

  /**
   * Get all watch progress items for Continue Watching
   * Returns items sorted by lastWatched (most recent first)
   * Filters out completed items and items with very low progress
   */
  getAllWatchProgress(): WatchProgress[] {
    if (!this.preferences?.watchProgress) return [];

    const items = Object.values(this.preferences.watchProgress)
      .filter(item => {
        // Filter out completed items
        if (item.completed) return false;
        // Filter out items with less than 2% progress (accidental clicks)
        if (item.completionPercentage < 2) return false;
        // Filter out items with 85%+ progress (likely finished or auto-next kicked in)
        if (item.completionPercentage >= 85) return false;
        return true;
      })
      .sort((a, b) => b.lastWatched - a.lastWatched);

    return items;
  }

  /**
   * Remove watch progress for a specific content item
   */
  removeWatchProgress(contentId: string, season?: number, episode?: number): boolean {
    if (!this.preferences?.watchProgress) return false;

    const key = this.getStorageKey(contentId, season, episode);
    
    if (!(key in this.preferences.watchProgress)) {
      return false;
    }

    delete this.preferences.watchProgress[key];

    try {
      localStorage.setItem(
        UserTrackingService.WATCH_PROGRESS_KEY,
        JSON.stringify(this.preferences.watchProgress)
      );
      this.updatePreferences({ watchProgress: this.preferences.watchProgress });
      return true;
    } catch (error) {
      console.error('Failed to remove watch progress:', error);
      return false;
    }
  }

  /**
   * Add to viewing history
   */
  addToViewingHistory(item: ViewingHistory): void {
    try {
      const stored = localStorage.getItem(UserTrackingService.VIEWING_HISTORY_KEY);
      let history: ViewingHistory[] = stored ? JSON.parse(stored) : [];

      // Remove existing entry for same content
      history = history.filter(h => h.contentId !== item.contentId);

      // Add new entry at the beginning
      history.unshift(item);

      // Limit history size
      if (history.length > UserTrackingService.MAX_HISTORY_ITEMS) {
        history = history.slice(0, UserTrackingService.MAX_HISTORY_ITEMS);
      }

      localStorage.setItem(UserTrackingService.VIEWING_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save viewing history:', error);
    }
  }

  /**
   * Get viewing history
   */
  getViewingHistory(): ViewingHistory[] {
    try {
      const stored = localStorage.getItem(UserTrackingService.VIEWING_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load viewing history:', error);
      return [];
    }
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity(): void {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        timestamp: Date.now(),
      };

      sessionStorage.setItem(UserTrackingService.SESSION_ID_KEY, JSON.stringify(sessionData));
    } catch (error) {
      // Ignore errors for session storage
    }
  }

  /**
   * Get current user session
   */
  getCurrentSession(): UserSession | null {
    if (!this.userId || !this.sessionId || !this.deviceId || !this.preferences) {
      return null;
    }

    return {
      userId: this.userId,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      preferences: this.preferences,
    };
  }

  /**
   * Clear all user data (for privacy/reset)
   */
  clearUserData(): void {
    try {
      localStorage.removeItem(UserTrackingService.USER_ID_KEY);
      localStorage.removeItem(UserTrackingService.DEVICE_ID_KEY);
      localStorage.removeItem(UserTrackingService.PREFERENCES_KEY);
      localStorage.removeItem(UserTrackingService.WATCH_PROGRESS_KEY);
      localStorage.removeItem(UserTrackingService.VIEWING_HISTORY_KEY);
      sessionStorage.removeItem(UserTrackingService.SESSION_ID_KEY);

      // Reset internal state
      this.userId = null;
      this.sessionId = null;
      this.deviceId = null;
      this.preferences = null;
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  }

  /**
   * Simple hash function for device fingerprinting
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get analytics metadata for events
   */
  getAnalyticsMetadata(): Record<string, any> {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

export const userTrackingService = new UserTrackingService();