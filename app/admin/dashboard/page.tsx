'use client';

/**
 * Admin Dashboard - Simplified
 * 
 * The UnifiedStatsBar already shows key metrics (Live Users, DAU, Sessions, Watch Time)
 * This page shows additional details:
 * 1. Live Activity breakdown with progress bars
 * 2. Daily peaks chart
 * 3. Geographic distribution
 * 4. Currently watching content
 */

import { useStats } from '../context/StatsContext';
import { useAdmin } from '../context/AdminContext';

export default function DashboardPage() {
  useAdmin();
  const { stats, loading, lastRefresh, refresh } = useStats();

  const formatNumber = (n: number) => n?.toLocaleString() || '0';
  
  const getCountryFlag = (code: string) => {
    if (!code || code.length !== 2) return '🌍';
    try {
      return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
    } catch { return '🌍'; }
  };

  if (loading && !stats.liveUsers) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        Loading dashboard...
      </div>
    );
  }

  const total = stats.liveUsers || 1;
  const watchingPct = Math.round((stats.liveWatching / total) * 100);
  const liveTVPct = Math.round((stats.liveTVViewers / total) * 100);
  const browsingPct = Math.round((stats.liveBrowsing / total) * 100);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#f8fafc', fontSize: '24px' }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: 'rgba(120, 119, 198, 0.2)',
            border: '1px solid rgba(120, 119, 198, 0.3)',
            borderRadius: '8px',
            color: '#7877c6',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Live Activity Card */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.15), rgba(120, 119, 198, 0.05))',
        border: '1px solid rgba(120, 119, 198, 0.3)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>Live Activity</h2>
            <span style={{ 
              background: '#10b981', 
              color: 'white', 
              padding: '2px 8px', 
              borderRadius: '10px', 
              fontSize: '11px',
              fontWeight: '600',
              animation: 'pulse 2s infinite',
            }}>
              • LIVE
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: '11px' }}>Peak today</div>
            <div style={{ color: '#10b981', fontSize: '18px', fontWeight: '700' }}>
              {stats.peakStats?.peakTotal || 0}
            </div>
          </div>
        </div>

        {/* Big number */}
        <div style={{ 
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', fontWeight: '700', color: '#f8fafc' }}>
            {formatNumber(stats.liveUsers)}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>users on site</div>
        </div>

        {/* Activity breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ActivityBar icon="▶️" label="Watching content" value={stats.liveWatching} pct={watchingPct} color="#8b5cf6" />
          <ActivityBar icon="📺" label="Live TV" value={stats.liveTVViewers} pct={liveTVPct} color="#f59e0b" />
          <ActivityBar icon="🔍" label="Browsing" value={stats.liveBrowsing} pct={browsingPct} color="#3b82f6" />
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon="📊" label="Total Sessions" value={stats.totalSessions} color="#7877c6" />
        <StatCard icon="⏱️" label="Watch Time" value={`${stats.totalWatchTime}m`} color="#06b6d4" />
        <StatCard icon="📈" label="Avg Session" value={`${stats.avgSessionDuration}m`} color="#f59e0b" />
        <StatCard icon="✅" label="Completion" value={`${stats.completionRate}%`} color="#10b981" />
      </div>

      {/* Secondary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon="🟢" label="Live Users" value={stats.liveUsers} color="#10b981" size="sm" />
        <StatCard icon="📺" label="Live TV" value={stats.liveTVViewers} color="#f59e0b" size="sm" />
        <StatCard icon="📊" label="DAU" value={stats.activeToday} color="#7877c6" size="sm" />
        <StatCard icon="📈" label="WAU" value={stats.activeThisWeek} color="#3b82f6" size="sm" />
        <StatCard icon="📅" label="MAU" value={stats.activeThisMonth} color="#ec4899" size="sm" />
      </div>

      {/* Third row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon="🆕" label="New Today" value={stats.newUsersToday} color="#10b981" size="sm" />
        <StatCard icon="🔄" label="Returning" value={stats.returningUsers} color="#8b5cf6" size="sm" />
        <StatCard icon="💪" label="Retention" value={stats.activeToday > 0 ? `${Math.round((stats.returningUsers / stats.activeToday) * 100)}%` : '0%'} color="#f59e0b" size="sm" />
        <StatCard icon="👁️" label="Page Views" value={stats.pageViews} color="#3b82f6" size="sm" />
        <StatCard icon="👥" label="Visitors" value={stats.uniqueVisitors} color="#ec4899" size="sm" />
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Device Distribution */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: '16px' }}>📱 Device Distribution</h3>
          {stats.deviceBreakdown && stats.deviceBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.deviceBreakdown.map((device) => {
                const totalDevices = stats.deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
                const pct = totalDevices > 0 ? Math.round((device.count / totalDevices) * 100) : 0;
                return (
                  <div key={device.device} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px' }}>
                      {device.device === 'mobile' ? '📱' : device.device === 'tablet' ? '📲' : '💻'}
                    </span>
                    <span style={{ flex: 1, color: '#f8fafc', textTransform: 'capitalize' }}>{device.device}</span>
                    <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#7877c6', borderRadius: '3px' }} />
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '13px', minWidth: '40px', textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No device data</p>
          )}
        </div>

        {/* Top Countries */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', color: '#f8fafc', fontSize: '16px' }}>🌍 Top Countries</h3>
          {stats.topCountries && stats.topCountries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.topCountries.slice(0, 8).map((country) => (
                <div key={country.country} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{getCountryFlag(country.country)}</span>
                  <span style={{ flex: 1, color: '#f8fafc' }}>{country.countryName || country.country}</span>
                  <span style={{ color: '#94a3b8', fontWeight: '400' }}>{formatNumber(country.count)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No geographic data</p>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function ActivityBar({ icon, label, value, pct, color }: { icon: string; label: string; value: number; pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <span style={{ color: '#f8fafc', fontSize: '14px', minWidth: '140px' }}>{label}</span>
      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ color: '#f8fafc', fontWeight: '600', minWidth: '80px', textAlign: 'right' }}>
        {value.toLocaleString()} <span style={{ color: '#64748b', fontWeight: '400' }}>({pct}%)</span>
      </span>
    </div>
  );
}

function StatCard({ icon, label, value, color, size = 'md' }: { icon: string; label: string; value: number | string; color: string; size?: 'sm' | 'md' }) {
  const isSmall = size === 'sm';
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '12px',
      padding: isSmall ? '14px' : '18px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: isSmall ? '14px' : '18px' }}>{icon}</span>
        <span style={{ color: '#94a3b8', fontSize: isSmall ? '11px' : '12px' }}>{label}</span>
      </div>
      <div style={{ fontSize: isSmall ? '20px' : '28px', fontWeight: '700', color: '#f8fafc' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
