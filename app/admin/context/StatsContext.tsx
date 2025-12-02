'use client';

/**
 * Unified Stats Context
 * Single source of truth for all admin analytics data
 * All admin pages should use this context instead of making their own API calls
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Unified stats interface
interface UnifiedStats {
  // Real-time (live_activity table)
  liveUsers: number;
  liveWatching: number;
  liveBrowsing: number;
  liveTVViewers: number;
  
  // User metrics (user_activity table)
  totalUsers: number;
  activeToday: number;      // DAU
  activeThisWeek: number;   // WAU
  activeThisMonth: number;  // MAU
  newUsersToday: number;
  returningUsers: number;
  
  // Content metrics (watch_sessions table)
  totalSessions: number;
  totalWatchTime: number;   // in minutes
  avgSessionDuration: number;
  completionRate: number;
  
  // Geographic
  topCountries: Array<{ country: string; countryName: string; count: number }>;
  
  // Devices
  deviceBreakdown: Array<{ device: string; count: number }>;
  
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
  avgSessionDuration: 0,
  completionRate: 0,
  topCountries: [],
  deviceBreakdown: [],
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

  const fetchAllStats = useCallback(async () => {
    setLoading(true);
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
          // Real-time
          liveUsers: data.realtime?.totalActive || 0,
          liveWatching: data.realtime?.watching || 0,
          liveBrowsing: data.realtime?.browsing || 0,
          liveTVViewers: data.realtime?.livetv || 0,
          
          // User metrics
          totalUsers: data.users?.total || 0,
          activeToday: data.users?.dau || 0,
          activeThisWeek: data.users?.wau || 0,
          activeThisMonth: data.users?.mau || 0,
          newUsersToday: data.users?.newToday || 0,
          returningUsers: data.users?.returning || 0,
          
          // Content metrics
          totalSessions: data.content?.totalSessions || 0,
          totalWatchTime: data.content?.totalWatchTime || 0,
          avgSessionDuration: data.content?.avgDuration || 0,
          completionRate: data.content?.completionRate || 0,
          
          // Geographic
          topCountries: data.geographic || [],
          
          // Devices
          deviceBreakdown: data.devices || [],
          
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
    fetchAllStats();
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
