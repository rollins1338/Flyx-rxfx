'use client';

/**
 * Admin Live Page - OPTIMIZED
 * 
 * Uses unified stats context as primary data source
 * Only fetches activity history and detailed live activity separately
 */

import { useState, useEffect, useCallback } from 'react';
import LiveActivityTracker from '../components/LiveActivityTracker';
import ImprovedLiveDashboard from '../components/ImprovedLiveDashboard';
import { useStats } from '../context/StatsContext';
import { getAdminAnalyticsUrl } from '../hooks/useAnalyticsApi';
import { colors, getPercentage } from '../components/ui';

interface LiveActivity {
  id: string;
  user_id: string;
  activity_type: string;
  content_id?: string;
  content_title?: string;
  content_type?: string;
  device_type?: string;
  country?: string;
  last_heartbeat: number;
  current_position?: number;
}

interface LiveStats {
  totalActive: number;
  watching: number;
  browsing: number;
  livetv: number;
  byDevice: Record<string, number>;
  byCountry: Record<string, number>;
  topContent: Array<{ contentId: string; contentTitle: string; contentType: string; count: number }>;
}

type ViewMode = 'dashboard' | 'realtime' | 'summary' | 'map';

export default function AdminLivePage() {
  const { stats: unifiedStats, lastRefresh } = useStats();
  
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [refreshRate, setRefreshRate] = useState(10);

  const peak = unifiedStats.peakStats;

  // Fetch detailed live activity (for realtime/summary/map views)
  const fetchLiveActivity = useCallback(async () => {
    try {
      const response = await fetch(getAdminAnalyticsUrl('live-activity', { maxAge: refreshRate }));
      const data = await response.json();
      if (data.success) {
        setActivities(data.activities || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch live activity:', error);
    }
  }, [refreshRate]);

  // Only fetch detailed data when not in dashboard view
  useEffect(() => {
    if (viewMode !== 'dashboard') {
      fetchLiveActivity();
      const interval = setInterval(fetchLiveActivity, refreshRate * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchLiveActivity, refreshRate, viewMode]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'watching': return '▶️';
      case 'livetv': return '📺';
      case 'browsing': return '🔍';
      default: return '👤';
    }
  };

  const formatTimeAgo = (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  const getCountryName = (code: string): string => {
    if (!code || code.length !== 2) return code;
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
    } catch { return code; }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: `1px solid ${colors.border.default}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0, color: colors.text.primary, fontSize: '24px', fontWeight: '600' }}>Live Activity Monitor</h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '20px', fontSize: '12px', color: colors.success }}>
                <span style={{ width: '8px', height: '8px', background: colors.success, borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                LIVE
              </span>
            </div>
            <p style={{ margin: '8px 0 0 0', color: colors.text.secondary, fontSize: '16px' }}>
              Real-time user activity • Updated: {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Loading...'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {viewMode !== 'dashboard' && (
              <>
                <button onClick={fetchLiveActivity} style={{ padding: '8px 12px', background: 'rgba(120, 119, 198, 0.2)', border: '1px solid rgba(120, 119, 198, 0.3)', borderRadius: '8px', color: colors.primary, fontSize: '14px', cursor: 'pointer' }}>
                  🔄 Refresh
                </button>
                <select value={refreshRate} onChange={(e) => setRefreshRate(parseInt(e.target.value))} style={{ padding: '8px 12px', background: colors.bg.input, border: `1px solid ${colors.border.default}`, borderRadius: '8px', color: colors.text.primary, fontSize: '14px' }}>
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                </select>
              </>
            )}
            <TabButton active={viewMode === 'dashboard'} onClick={() => setViewMode('dashboard')}>📊 Dashboard</TabButton>
            <TabButton active={viewMode === 'realtime'} onClick={() => setViewMode('realtime')}>🔴 Sessions</TabButton>
            <TabButton active={viewMode === 'summary'} onClick={() => setViewMode('summary')}>📈 Content</TabButton>
            <TabButton active={viewMode === 'map'} onClick={() => setViewMode('map')}>🌍 Map</TabButton>
          </div>
        </div>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && <ImprovedLiveDashboard />}

      {/* Stats Cards for non-dashboard views */}
      {viewMode !== 'dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard title="Active Now" value={unifiedStats.liveUsers} icon="👥" color={colors.success} pulse />
          <StatCard title="Watching VOD" value={unifiedStats.liveWatching} icon="▶️" color={colors.primary} />
          <StatCard title="Live TV" value={unifiedStats.liveTVViewers} icon="📺" color={colors.warning} />
          <StatCard title="Browsing" value={unifiedStats.liveBrowsing} icon="🔍" color={colors.info} />
          <StatCard title="Peak Today" value={peak?.peakTotal || 0} icon="📈" color={colors.pink} subtitle={peak?.peakTotalTime ? `at ${new Date(peak.peakTotalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''} />
          <StatCard title="Countries" value={unifiedStats.topCountries.length} icon="🌍" color={colors.purple} />
        </div>
      )}

      {/* Realtime View */}
      {viewMode === 'realtime' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
          <LiveActivityTracker />
          <div style={{ background: colors.bg.card, border: `1px solid ${colors.border.default}`, borderRadius: '12px', padding: '16px', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 16px 0', color: colors.text.primary, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', background: colors.success, borderRadius: '50%', animation: 'pulse 2s infinite' }} />
              Live Feed
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {activities.length === 0 ? (
                <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No active users</div>
              ) : (
                activities.slice(0, 15).map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{getActivityIcon(a.activity_type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: colors.text.primary, fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.content_title || a.activity_type}
                      </div>
                      <div style={{ color: colors.text.muted, fontSize: '11px' }}>
                        {a.device_type} • {a.country || 'Unknown'}
                      </div>
                    </div>
                    <span style={{ color: colors.text.muted, fontSize: '11px' }}>{formatTimeAgo(a.last_heartbeat)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ background: colors.bg.card, border: `1px solid ${colors.border.default}`, borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: colors.text.primary, fontSize: '16px' }}>🔥 Currently Watching</h3>
            {stats.topContent?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.topContent.slice(0, 5).map((c, i) => (
                  <div key={c.contentId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: i < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][i] : 'rgba(255,255,255,0.1)', color: i < 3 ? '#000' : colors.text.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '11px' }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: colors.text.primary, fontSize: '14px', fontWeight: '500' }}>{c.contentTitle || c.contentId}</div>
                      <div style={{ color: colors.text.muted, fontSize: '12px' }}>{c.contentType}</div>
                    </div>
                    <span style={{ color: colors.success, fontWeight: '600' }}>{c.count} viewers</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No active content</div>}
          </div>

          <div style={{ background: colors.bg.card, border: `1px solid ${colors.border.default}`, borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: colors.text.primary, fontSize: '16px' }}>📱 By Device</h3>
            {stats.byDevice && Object.keys(stats.byDevice).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(stats.byDevice).sort((a, b) => b[1] - a[1]).map(([device, count]) => {
                  const total = Object.values(stats.byDevice).reduce((a, b) => a + b, 0);
                  const pct = getPercentage(count, total);
                  const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲' };
                  return (
                    <div key={device}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>{icons[device] || '🖥️'} {device}</span>
                        <span style={{ color: colors.text.secondary, fontSize: '13px' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors.primary, borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No device data</div>}
          </div>

          <div style={{ background: colors.bg.card, border: `1px solid ${colors.border.default}`, borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: colors.text.primary, fontSize: '16px' }}>📊 Activity Types</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ActivityBar label="Watching VOD" count={unifiedStats.liveWatching} total={unifiedStats.liveUsers} color={colors.primary} icon="▶️" />
              <ActivityBar label="Live TV" count={unifiedStats.liveTVViewers} total={unifiedStats.liveUsers} color={colors.warning} icon="📺" />
              <ActivityBar label="Browsing" count={unifiedStats.liveBrowsing} total={unifiedStats.liveUsers} color={colors.info} icon="🔍" />
            </div>
          </div>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && stats && (
        <div style={{ background: colors.bg.card, border: `1px solid ${colors.border.default}`, borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: colors.text.primary, fontSize: '18px' }}>🌍 Active Users by Location</h3>
          {stats.byCountry && Object.keys(stats.byCountry).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {Object.entries(stats.byCountry).filter(([c]) => c && c.length === 2).sort((a, b) => b[1] - a[1]).map(([country, count]) => (
                <div key={country} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '24px' }}>🌐</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: colors.text.primary, fontWeight: '500' }}>{getCountryName(country)}</div>
                    <div style={{ color: colors.text.muted, fontSize: '12px' }}>{count} user{count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.success, boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }} />
                </div>
              ))}
            </div>
          ) : <div style={{ color: colors.text.muted, textAlign: 'center', padding: '40px' }}>No location data</div>}
        </div>
      )}

      <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

function StatCard({ title, value, icon, color, pulse = false, subtitle }: { title: string; value: number; icon: string; color: string; pulse?: boolean; subtitle?: string }) {
  return (
    <div style={{ background: colors.bg.card, border: `1px solid ${colors.border.default}`, borderRadius: '12px', padding: '16px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px', position: 'relative' }}>
          {icon}
          {pulse && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: colors.success, borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
        </span>
        <span style={{ color: colors.text.secondary, fontSize: '13px' }}>{title}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text.primary }}>{value.toLocaleString()}</div>
      {subtitle && <div style={{ fontSize: '11px', color: colors.text.muted, marginTop: '4px' }}>{subtitle}</div>}
    </div>
  );
}

function ActivityBar({ label, count, total, color, icon }: { label: string; count: number; total: number; color: string; icon: string }) {
  const pct = getPercentage(count, total);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ color: colors.text.primary, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>{icon} {label}</span>
        <span style={{ color: colors.text.secondary, fontSize: '13px' }}>{count} ({pct}%)</span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', background: active ? colors.primary : colors.bg.input, border: `1px solid ${colors.border.default}`, borderRadius: '8px', color: active ? 'white' : colors.text.secondary, cursor: 'pointer', fontSize: '14px' }}>
      {children}
    </button>
  );
}
