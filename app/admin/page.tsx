'use client';

/**
 * Admin Dashboard - CONSOLIDATED
 * 
 * Single page with tabs for:
 * - Overview (stats, metrics)
 * - Real-time (live users, activity)
 * - Analytics (charts, trends)
 * - Geographic (maps, countries)
 * - Content (watch stats)
 * 
 * All data from unified StatsContext - single source of truth
 */

import { useState } from 'react';
import { useStats } from './context/StatsContext';
import { useAdmin } from './context/AdminContext';
import OverviewStats from './components/OverviewStats';
import LiveActivitySummary from './components/LiveActivitySummary';
import ImprovedLiveDashboard from './components/ImprovedLiveDashboard';
import DetailedRealtimeAnalytics from './components/DetailedRealtimeAnalytics';
import DetailedContentAnalytics from './components/DetailedContentAnalytics';
import ContentPerformanceBreakdown from './components/ContentPerformanceBreakdown';
import { colors, formatTimeAgo, Card, ProgressBar, gradients } from './components/ui';

type TabId = 'overview' | 'realtime' | 'content' | 'geographic';

export default function AdminDashboardPage() {
  useAdmin();
  const { stats, lastRefresh, loading, refresh, timeRange, setTimeRange } = useStats();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs = [
    { id: 'overview' as TabId, label: '📊 Overview', description: 'Key metrics and stats' },
    { id: 'realtime' as TabId, label: '🟢 Real-time', description: 'Live user activity' },
    { id: 'content' as TabId, label: '🎬 Content', description: 'Watch statistics' },
    { id: 'geographic' as TabId, label: '🌍 Geographic', description: 'User locations' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, color: colors.text.primary, fontSize: '24px', fontWeight: '600' }}>
            Dashboard
          </h1>
          <p style={{ margin: '4px 0 0 0', color: colors.text.muted, fontSize: '14px' }}>
            {lastRefresh ? `Updated ${formatTimeAgo(lastRefresh.getTime())}` : 'Loading...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: colors.text.primary,
              fontSize: '13px',
            }}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => refresh()}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: loading ? 'rgba(120,119,198,0.1)' : 'rgba(120,119,198,0.2)',
              border: '1px solid rgba(120,119,198,0.3)',
              borderRadius: '8px',
              color: colors.primary,
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <QuickStat label="On Site" value={stats.liveUsers} icon="🟢" color={colors.success} pulse />
        <QuickStat label="Today (DAU)" value={stats.activeToday} icon="📊" color={colors.primary} />
        <QuickStat label="This Week" value={stats.activeThisWeek} icon="📈" color={colors.warning} />
        <QuickStat label="Sessions (24h)" value={stats.totalSessions} icon="▶️" color={colors.info} />
        <QuickStat label="Watch Time (24h)" value={`${Math.round(stats.totalWatchTime / 60)}h`} icon="⏱️" color={colors.pink} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? colors.primary : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === tab.id ? 'white' : colors.text.secondary,
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'realtime' && <RealtimeTab />}
      {activeTab === 'content' && <ContentTab />}
      {activeTab === 'geographic' && <GeographicTab />}
    </div>
  );
}

function QuickStat({ label, value, icon, color, pulse }: { label: string; value: number | string; icon: string; color: string; pulse?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      minWidth: '140px',
    }}>
      <span style={{ fontSize: '20px', opacity: pulse ? 1 : 0.8 }}>{icon}</span>
      <div>
        <div style={{ color, fontSize: '20px', fontWeight: '700', lineHeight: 1 }}>{value}</div>
        <div style={{ color: colors.text.muted, fontSize: '11px', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  );
}

function OverviewTab() {
  // Stats used by child components via useStats()
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <LiveActivitySummary />
      <OverviewStats />
    </div>
  );
}

function RealtimeTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ImprovedLiveDashboard />
      <DetailedRealtimeAnalytics />
    </div>
  );
}

function ContentTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <DetailedContentAnalytics />
      <ContentPerformanceBreakdown />
    </div>
  );
}

function GeographicTab() {
  const { stats } = useStats();
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Countries */}
      <Card title="🌍 Top Countries" icon="">
        {stats.topCountries?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.topCountries.slice(0, 10).map((country) => {
              const total = stats.topCountries.reduce((sum, c) => sum + c.count, 0);
              const pct = total > 0 ? Math.round((country.count / total) * 100) : 0;
              return (
                <div key={country.country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary }}>{country.countryName || country.country}</span>
                    <span style={{ color: colors.text.muted }}>{country.count} ({pct}%)</span>
                  </div>
                  <ProgressBar value={country.count} max={total} gradient={gradients.primary} height={6} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: colors.text.muted, textAlign: 'center', padding: '40px' }}>No geographic data</div>
        )}
      </Card>

      {/* Cities */}
      <Card title="🏙️ Top Cities" icon="">
        {stats.topCities?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.topCities.slice(0, 10).map((city) => {
              const total = stats.topCities.reduce((sum, c) => sum + c.count, 0);
              const pct = total > 0 ? Math.round((city.count / total) * 100) : 0;
              return (
                <div key={`${city.city}-${city.country}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary }}>{city.city} <span style={{ color: colors.text.muted, fontSize: '12px' }}>({city.countryName})</span></span>
                    <span style={{ color: colors.text.muted }}>{city.count} ({pct}%)</span>
                  </div>
                  <ProgressBar value={city.count} max={total} gradient={gradients.success} height={6} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: colors.text.muted, textAlign: 'center', padding: '40px' }}>No city data</div>
        )}
      </Card>

      {/* Real-time Geographic */}
      <Card title="🟢 Currently Active By Location" icon="">
        {stats.realtimeGeographic?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats.realtimeGeographic.slice(0, 8).map((loc) => (
              <div key={loc.country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: colors.text.primary }}>{loc.countryName || loc.country}</span>
                <span style={{ color: colors.success, fontWeight: '600' }}>{loc.count} online</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No active users</div>
        )}
      </Card>

      {/* Devices */}
      <Card title="📱 Devices" icon="">
        {stats.deviceBreakdown?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.deviceBreakdown.map((device) => {
              const total = stats.deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
              const pct = total > 0 ? Math.round((device.count / total) * 100) : 0;
              const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲', unknown: '🖥️' };
              return (
                <div key={device.device}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary }}>{icons[device.device] || '🖥️'} {device.device}</span>
                    <span style={{ color: colors.text.muted }}>{device.count} ({pct}%)</span>
                  </div>
                  <ProgressBar value={device.count} max={total} gradient={gradients.purple} height={6} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: colors.text.muted, textAlign: 'center', padding: '40px' }}>No device data</div>
        )}
      </Card>
    </div>
  );
}
