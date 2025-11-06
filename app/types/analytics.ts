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