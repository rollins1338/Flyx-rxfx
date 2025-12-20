/**
 * Analytics Types
 * Type definitions for analytics, metrics, and content statistics
 */

export interface AnalyticsEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  eventType: string;
  metadata: Record<string, any>;
}

export interface MetricsData {
  date: string;
  totalViews: number;
  totalWatchTime: number;
  uniqueSessions: number;
  avgSessionDuration: number;
  topContent: string; // JSON string
  updatedAt?: number;
}

export interface ContentStats {
  contentId: string;
  contentType: 'movie' | 'tv';
  viewCount: number;
  totalWatchTime: number;
  completionRate: number;
  avgWatchTime: number;
  lastViewed: number;
  updatedAt?: number;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
  last_login?: number;
}

// Enhanced analytics types for user tracking
export interface UserAnalytics {
  userId: string;
  deviceId: string;
  sessionCount: number;
  totalWatchTime: number;
  favoriteGenres: string[];
  preferredQuality: string;
  avgSessionDuration: number;
  completionRate: number;
  lastActive: number;
  createdAt: number;
}

export interface WatchSession {
  sessionId: string;
  userId: string;
  contentId: string;
  contentType: 'movie' | 'tv';
  startTime: number;
  endTime?: number;
  watchTime: number;
  completed: boolean;
  quality: string;
  device: string;
}

export interface SearchAnalytics {
  query: string;
  normalizedQuery: string;
  userId: string;
  sessionId: string;
  resultsCount: number;
  clickedResult?: string;
  timestamp: number;
}

export interface InteractionAnalytics {
  userId: string;
  sessionId: string;
  element: string;
  action: string;
  context: Record<string, any>;
  timestamp: number;
}

export interface PerformanceMetrics {
  userId: string;
  sessionId: string;
  metric: string;
  value: number;
  context: Record<string, any>;
  timestamp: number;
}


// Server hit tracking types
export interface ServerHit {
  id: string;
  pagePath: string;
  ipHash: string;
  userAgent: string;
  sourceType: 'browser' | 'bot' | 'api' | 'social' | 'rss' | 'unknown';
  sourceName: string;
  isBot: boolean;
  referrerFull: string | null;
  referrerDomain: string | null;
  referrerPath: string | null;
  referrerSource: string;
  referrerMedium: string;
  country: string | null;
  city: string | null;
  region: string | null;
  timestamp: number;
  createdAt: number;
}

export interface ReferrerStats {
  referrerDomain: string;
  hitCount: number;
  lastHit: number;
  referrerMedium: string;
  createdAt: number;
  updatedAt: number;
}

// Presence tracking types
export interface PresenceHeartbeat {
  userId: string;
  sessionId: string;
  activityType: 'browsing' | 'watching' | 'livetv';
  contentId?: string;
  contentTitle?: string;
  contentType?: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  isActive: boolean;
  isVisible: boolean;
  isLeaving?: boolean;
  referrer?: string;
  entryPage?: string;
  validation?: PresenceValidation;
  timestamp: number;
}

export interface PresenceValidation {
  isBot: boolean;
  botConfidence: number;
  botReasons: string[];
  fingerprint?: string;
  hasInteracted: boolean;
  interactionCount: number;
  timeSinceLastInteraction: number | null;
  behaviorIsBot: boolean;
  behaviorConfidence: number;
  behaviorReasons: string[];
  mouseEntropy: number;
  mouseSamples: number;
  scrollSamples: number;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  shouldTrack: boolean;
  reason?: string;
  mergedSessionId?: string;
}

// Traffic source analytics types
export interface TrafficSourceStats {
  sourceType: string;
  sourceName: string;
  hitCount: number;
  uniqueVisitors: number;
}

export interface ReferrerAnalytics {
  referrerDomain: string;
  referrerMedium: string;
  hitCount: number;
  lastHit: number;
}

export interface BotAnalytics {
  sourceName: string;
  hitCount: number;
}

export interface HourlyTrafficPattern {
  hour: number;
  hitCount: number;
  botHits: number;
}
