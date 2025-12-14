'use client';

/**
 * Unified Stats Context
 * Single source of truth for all admin analytics data
 * All admin pages should use this context instead of making their own API calls
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Unified stats interface - SINGLE SOURCE OF TRUTH
// All counts use DISTINCT user_id to avoid duplicates
interface UnifiedStats {
  // Real-time (from session_details - ACTIVE USER SESSIONS)
  liveUsers: number;          // Users with active browser sessions (last 5 min)
  trulyActiveUsers: number;   // Users with sessions updated in last 2 min (stricter)
  liveWatching: number;       // Users watching VOD content
  liveBrowsing: number;       // Users on site but not watching
  liveTVViewers: number;      // Users watching Live TV
  
  // User metrics (user_activity table) - all counts are UNIQUE users
  totalUsers: number;
  activeToday: number;      // DAU - unique users active in last 24h
  activeThisWeek: number;   // WAU - unique users active in last 7 days
  activeThisMonth: number;  // MAU - unique users active in last 30 days
  newUsersToday: number;    // unique users first seen in last 24h
  returningUsers: number;   // unique users who returned today
  
  // Content metrics (watch_sessions table) - last 24h
  totalSessions: number;
  totalWatchTime: number;   // in minutes (last 24h)
  allTimeWatchTime: number; // in minutes (all time)
  avgSessionDuration: number;
  completionRate: number;
  
  // Page views (analytics_events table) - last 24h
  pageViews: number;
  uniqueVisitors: number;
  
  // Geographic - unique users per country (last 7 days)
  topCountries: Array<{ country: string; countryName: string; count: number }>;
  
  // Devices - unique users per device (last 7 days)
  deviceBreakdown: Array<{ device: string; count: number }>;
  
  // Time ranges for transparency
  timeRanges: {
    realtime: string;
    dau: string;
    wau: string;
    mau: string;
    content: string;
    geographic: string;
    devices: string;
    pageViews: string;
  };
  
  // Timestamps
  lastUpdated: number;
  dataSource: string;
}

interface StatsContextType {
  stats: UnifiedStats;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastRefresh: Date | null;
}

const defaultStats: UnifiedStats = {
  liveUsers: 0,
  trulyActiveUsers: 0,
  liveWatching: 0,
  liveBrowsing: 0,
  liveTVViewers: 0,
  totalUsers: 0,
  activeToday: 0,
  activeThisWeek: 0,
  activeThisMonth: 0,
  newUsersToday: 0,
  returningUsers: 0,
  totalSessions: 0,
  totalWatchTime: 0,
  allTimeWatchTime: 0,
  avgSessionDuration: 0,
  completionRate: 0,
  pageViews: 0,
  uniqueVisitors: 0,
  topCountries: [],
  deviceBreakdown: [],
  timeRanges: {
    realtime: '5 minutes',
    dau: '24 hours',
    wau: '7 days',
    mau: '30 days',
    content: '24 hours',
    geographic: '7 days',
    devices: '7 days',
    pageViews: '24 hours',
  },
  lastUpdated: 0,
  dataSource: 'none',
};

const StatsContext = createContext<StatsContextType>({
  stats: defaultStats,
  loading: true,
  error: null,
  refresh: async () => {},
  lastRefresh: null,
});

export function useStats() {
  return useContext(StatsContext);
}

export function StatsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<UnifiedStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAllStats = useCallback(async (isInitial = false) => {
    // Only show loading on initial fetch, not on refreshes
    if (isInitial) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Fetch all data in parallel from a single unified endpoint
      const response = await fetch('/api/admin/unified-stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStats({
          // Real-time (from session_details - ACTIVE USER SESSIONS)
          // Uses active browser sessions (updated in last 5 min) for accurate counts
          // trulyActive uses stricter 2-min window
          liveUsers: data.realtime?.totalActive || 0,
          trulyActiveUsers: data.realtime?.trulyActive || 0,
          liveWatching: data.realtime?.watching || 0,
          liveBrowsing: data.realtime?.browsing || 0,
          liveTVViewers: data.realtime?.livetv || 0,
          
          // User metrics (all unique user counts)
          totalUsers: data.users?.total || 0,
          activeToday: data.users?.dau || 0,
          activeThisWeek: data.users?.wau || 0,
          activeThisMonth: data.users?.mau || 0,
          newUsersToday: data.users?.newToday || 0,
          returningUsers: data.users?.returning || 0,
          
          // Content metrics (last 24h)
          totalSessions: data.content?.totalSessions || 0,
          totalWatchTime: data.content?.totalWatchTime || 0,
          allTimeWatchTime: data.content?.allTimeWatchTime || 0,
          avgSessionDuration: data.content?.avgDuration || 0,
          completionRate: data.content?.completionRate || 0,
          
          // Page views (last 24h)
          pageViews: data.pageViews?.total || 0,
          uniqueVisitors: data.pageViews?.uniqueVisitors || 0,
          
          // Geographic (unique users per country, last 7 days)
          topCountries: data.geographic || [],
          
          // Devices (unique users per device, last 7 days)
          deviceBreakdown: data.devices || [],
          
          // Time ranges for transparency
          timeRanges: data.timeRanges || defaultStats.timeRanges,
          
          // Meta
          lastUpdated: Date.now(),
          dataSource: 'unified-api',
        });
        
        setLastRefresh(new Date());
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to fetch unified stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllStats(true);
  }, [fetchAllStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchAllStats, 30000);
    return () => clearInterval(interval);
  }, [fetchAllStats]);

  return (
    <StatsContext.Provider value={{ stats, loading, error, refresh: fetchAllStats, lastRefresh }}>
      {children}
    </StatsContext.Provider>
  );
}
