'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useStats } from '../context/StatsContext';
import { Eye, Clock, Users, Activity } from 'lucide-react';

interface Stats {
  totalViews: number;
  totalWatchTime: number;
  uniqueSessions: number;
  avgSessionDuration: number;
}

interface AdvancedMetrics {
  uniqueViewers: number;
  avgSessionDuration: number;
  bounceRate: number;
  totalPageViews?: number;
  uniqueVisitors?: number;
  avgTimeOnSite?: number;
}

interface TrafficMetrics {
  totalPageViews: number;
  uniqueVisitors: number;
  avgTimeOnSite: number;
  landingPages: Array<{ page: string; count: number }>;
}

interface LiveTVStats {
  currentViewers: number;
  totalWatchTime: number;
  avgSessionDuration: number;
  recentSessions: number;
}

interface FullAnalytics {
  overview: Stats;
  advancedMetrics: AdvancedMetrics;
  deviceBreakdown: Array<{ deviceType: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  trafficMetrics?: TrafficMetrics;
}

export default function OverviewStats() {
  const { dateRange, setIsLoading } = useAdmin();
  const { stats: unifiedStats, loading: unifiedLoading } = useStats();
  
  const [fullAnalytics, setFullAnalytics] = useState<FullAnalytics | null>(null);
  const [liveTVStats, setLiveTVStats] = useState<LiveTVStats | null>(null);
  const [error, setError] = useState('');


  // ALL key metrics come from unified stats - SINGLE SOURCE OF TRUTH
  // These are all UNIQUE user counts (no duplicates)
  const liveUserCount = unifiedStats.liveUsers;
  const userMetrics = {
    dau: unifiedStats.activeToday,      // Unique users active in last 24h
    wau: unifiedStats.activeThisWeek,   // Unique users active in last 7 days
    mau: unifiedStats.activeThisMonth,  // Unique users active in last 30 days
    newUsers: unifiedStats.newUsersToday,
    returningUsers: unifiedStats.returningUsers,
    retentionRate: unifiedStats.activeToday > 0 
      ? Math.round((unifiedStats.returningUsers / unifiedStats.activeToday) * 100) 
      : 0,
  };

  const stats: Stats = {
    totalViews: unifiedStats.totalSessions,
    totalWatchTime: unifiedStats.totalWatchTime,
    uniqueSessions: unifiedStats.totalSessions,
    avgSessionDuration: unifiedStats.avgSessionDuration,
  };

  useEffect(() => {
    // Only fetch detailed analytics for charts/peak hours - not for key metrics
    fetchDetailedAnalytics();
    fetchLiveTVStats();
    const interval = setInterval(fetchLiveTVStats, 30000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchDetailedAnalytics = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (dateRange.startDate && dateRange.endDate) {
        params.append('startDate', dateRange.startDate.toISOString());
        params.append('endDate', dateRange.endDate.toISOString());
      } else {
        params.append('period', dateRange.period);
      }
      const response = await fetch(`/api/admin/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFullAnalytics(data.data);
      } else {
        setError('Failed to fetch detailed analytics');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLiveTVStats = async () => {
    try {
      const response = await fetch('/api/analytics/livetv-session');
      if (response.ok) {
        const data = await response.json();
        setLiveTVStats({
          currentViewers: data.currentViewers || 0,
          totalWatchTime: data.stats?.totalCurrentWatchTime || 0,
          avgSessionDuration: data.stats?.avgSessionDuration || 0,
          recentSessions: data.stats?.recentSessions || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch Live TV stats:', err);
    }
  };

  if (unifiedLoading && !fullAnalytics) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '140px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', animation: 'pulse 2s infinite' }}></div>
        ))}
      </div>
    );
  }

  if (error && !fullAnalytics) {
    return (
      <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '32px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        {error} <button onClick={fetchDetailedAnalytics} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <StatCard title="Total Sessions" value={stats.totalViews.toLocaleString()} icon={<Eye size={22} />} color="#7877c6" gradient="linear-gradient(135deg, #7877c6 0%, #9333ea 100%)" />
        <StatCard title="Watch Time" value={`${Math.floor(stats.totalWatchTime / 60)}h ${stats.totalWatchTime % 60}m`} icon={<Clock size={22} />} color="#10b981" gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)" />
        <StatCard title="Avg Session" value={`${Math.round(stats.avgSessionDuration)}m`} icon={<Activity size={22} />} color="#ff77c6" gradient="linear-gradient(135deg, #ff77c6 0%, #ec4899 100%)" />
        <StatCard title="Completion Rate" value={`${unifiedStats.completionRate}%`} icon={<Users size={22} />} color="#f59e0b" gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <LiveStatCard title="Live Users Now" value={liveUserCount} icon="👥" pulse={liveUserCount > 0} />
        <LiveStatCard title="Live TV Viewers" value={liveTVStats?.currentViewers || unifiedStats.liveTVViewers} icon="📺" pulse={(liveTVStats?.currentViewers || unifiedStats.liveTVViewers) > 0} />
        <LiveStatCard title="Daily Active Users" value={userMetrics.dau} icon="📊" />
        <LiveStatCard title="Weekly Active Users" value={userMetrics.wau} icon="📈" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <LiveStatCard title="Monthly Active Users" value={userMetrics.mau} icon="📅" />
        <LiveStatCard title="New Users Today" value={userMetrics.newUsers} icon="🆕" />
        <LiveStatCard title="Returning Users" value={userMetrics.returningUsers} icon="🔄" />
        <LiveStatCard title="Retention Rate" value={`${userMetrics.retentionRate}%`} icon="💪" />
      </div>

      {/* Page view metrics from unified stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <LiveStatCard title="Page Views (24h)" value={unifiedStats.pageViews || fullAnalytics?.advancedMetrics?.totalPageViews || 0} icon="👁️" />
        <LiveStatCard title="Unique Visitors (24h)" value={unifiedStats.uniqueVisitors || fullAnalytics?.advancedMetrics?.uniqueVisitors || 0} icon="🧑‍💻" />
        <LiveStatCard title="Bounce Rate" value={`${fullAnalytics?.advancedMetrics?.bounceRate || 0}%`} icon="↩️" />
        <LiveStatCard title="Avg Time on Site" value={`${fullAnalytics?.advancedMetrics?.avgTimeOnSite || fullAnalytics?.advancedMetrics?.avgSessionDuration || 0}m`} icon="⏱️" />
      </div>


      {fullAnalytics?.trafficMetrics?.landingPages && fullAnalytics.trafficMetrics.landingPages.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>Top Landing Pages</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {fullAnalytics.trafficMetrics.landingPages.slice(0, 5).map((page, index) => {
              const total = fullAnalytics.trafficMetrics!.landingPages.reduce((sum, p) => sum + p.count, 0);
              const percentage = total > 0 ? (page.count / total) * 100 : 0;
              return (
                <div key={page.page} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#64748b', fontSize: '12px', width: '20px' }}>#{index + 1}</span>
                  <span style={{ color: '#f8fafc', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.page}</span>
                  <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', maxWidth: '150px' }}>
                    <div style={{ height: '100%', width: `${percentage}%`, background: 'linear-gradient(90deg, #7877c6, #ff77c6)', borderRadius: '4px' }} />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '12px', width: '60px', textAlign: 'right' }}>{page.count} ({Math.round(percentage)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fullAnalytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>Device Distribution</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(unifiedStats.deviceBreakdown.length > 0 ? unifiedStats.deviceBreakdown : fullAnalytics.deviceBreakdown?.map(d => ({ device: d.deviceType, count: d.count })) || []).slice(0, 4).map((device) => {
                const deviceList = unifiedStats.deviceBreakdown.length > 0 ? unifiedStats.deviceBreakdown : fullAnalytics.deviceBreakdown?.map(d => ({ device: d.deviceType, count: d.count })) || [];
                const total = deviceList.reduce((sum, d) => sum + d.count, 0);
                const percentage = total > 0 ? (device.count / total) * 100 : 0;
                return (
                  <div key={device.device} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px', width: '70px', textTransform: 'capitalize' }}>{device.device || 'Unknown'}</span>
                    <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percentage}%`, background: 'linear-gradient(90deg, #7877c6, #ff77c6)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '600', width: '50px', textAlign: 'right' }}>{Math.round(percentage)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>Peak Activity Hours</h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
              {Array.from({ length: 24 }, (_, hour) => {
                const hourData = fullAnalytics.peakHours?.find(h => h.hour === hour);
                const count = hourData?.count || 0;
                const maxCount = Math.max(...(fullAnalytics.peakHours?.map(h => h.count) || [1]));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={hour} style={{ flex: 1, height: `${Math.max(height, 5)}%`, background: count > 0 ? 'linear-gradient(180deg, #7877c6, #ff77c6)' : 'rgba(255,255,255,0.1)', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} title={`${hour}:00 - ${count} views`} />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '11px' }}>12am</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>6am</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>12pm</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>6pm</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>11pm</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, gradient }: { title: string; value: string; icon: React.ReactNode; color: string; gradient: string }) {
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)', position: 'relative', overflow: 'hidden', backdropFilter: 'blur(20px)', transition: 'all 0.3s ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: gradient }}></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', background: gradient, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 4px 12px ${color}30` }}>{icon}</div>
        <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>{title}</h3>
      </div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: '#f8fafc', lineHeight: '1' }}>{value}</div>
    </div>
  );
}

function LiveStatCard({ title, value, icon, pulse = false }: { title: string; value: string | number; icon: string; pulse?: boolean }) {
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ fontSize: '24px', position: 'relative' }}>
        {icon}
        {pulse && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>{title}</div>
      </div>
      <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }`}</style>
    </div>
  );
}
