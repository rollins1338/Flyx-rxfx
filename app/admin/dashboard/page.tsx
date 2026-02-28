'use client';

/**
 * Consolidated Dashboard View — Overview + Real-time tabs
 *
 * Wires RealtimeSlice and UserSlice contexts for live SSE data.
 * Includes connection status indicator and quick stats bar.
 *
 * Requirements: 6.1, 6.4, 10.3
 */

import { useState } from 'react';
import { useRealtimeSlice, useUserSlice } from '../context/slices';
import {
  colors,
  gradients,
  formatNumber,
  StatCard,
  Card,
  Grid,
  ProgressBar,
  TabSelector,
  PageHeader,
  LoadingState,
  getPercentage,
} from '../components/ui';

type TabId = 'overview' | 'realtime';

export default function DashboardPage() {
  const realtime = useRealtimeSlice();
  const users = useUserSlice();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'realtime', label: 'Real-time', icon: '🟢' },
  ];

  const rd = realtime.data;
  const ud = users.data;
  const connected = realtime.connected || users.connected;
  const loading = realtime.loading && users.loading;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        icon="📊"
        subtitle={
          realtime.lastUpdate
            ? `Updated ${new Date(realtime.lastUpdate).toLocaleTimeString()}`
            : 'Loading...'
        }
        actions={<ConnectionIndicator connected={connected} error={realtime.error || users.error} />}
      />

      {/* Quick Stats Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <QuickStat label="On Site" value={rd.liveUsers} icon="🟢" color={colors.success} pulse />
        <QuickStat label="Today (DAU)" value={ud.dau} icon="📊" color={colors.primary} />
        <QuickStat label="This Week" value={ud.wau} icon="📈" color={colors.warning} />
        <QuickStat label="New Today" value={ud.newToday} icon="🆕" color={colors.info} />
        <QuickStat label="Returning" value={ud.returningUsers} icon="🔄" color={colors.pink} />
      </div>

      <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {loading ? (
        <LoadingState message="Loading dashboard data..." />
      ) : activeTab === 'overview' ? (
        <OverviewContent rd={rd} ud={ud} />
      ) : (
        <RealtimeContent rd={rd} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connection Status Indicator (Requirement 10.3)                     */
/* ------------------------------------------------------------------ */

function ConnectionIndicator({ connected, error }: { connected: boolean; error: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '20px',
        background: connected
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
      }}
      role="status"
      aria-label={connected ? 'Real-time updates active' : 'Using polling fallback'}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: connected ? colors.success : colors.warning,
          animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ color: connected ? colors.success : colors.warning, fontSize: '12px', fontWeight: '500' }}>
        {connected ? 'SSE Connected' : error ? 'Polling Fallback' : 'Connecting...'}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick Stat                                                         */
/* ------------------------------------------------------------------ */

function QuickStat({
  label,
  value,
  icon,
  color,
  pulse,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        minWidth: '140px',
      }}
    >
      <span style={{ fontSize: '20px', opacity: pulse ? 1 : 0.8 }}>{icon}</span>
      <div>
        <div style={{ color, fontSize: '20px', fontWeight: '700', lineHeight: 1 }}>
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
        <div style={{ color: colors.text.muted, fontSize: '11px', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview Tab                                                       */
/* ------------------------------------------------------------------ */

function OverviewContent({
  rd,
  ud,
}: {
  rd: ReturnType<typeof useRealtimeSlice>['data'];
  ud: ReturnType<typeof useUserSlice>['data'];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Primary metrics */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="Live Users" value={rd.liveUsers} icon="🟢" color={colors.success} pulse={rd.liveUsers > 0} />
        <StatCard title="DAU" value={ud.dau} icon="📊" color={colors.primary} />
        <StatCard title="WAU" value={ud.wau} icon="📈" color={colors.info} />
        <StatCard title="MAU" value={ud.mau} icon="📅" color={colors.purple} />
        <StatCard title="Total Users" value={ud.totalUsers} icon="👥" color={colors.cyan} />
      </Grid>

      {/* User metrics */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="New Today" value={ud.newToday} icon="🆕" color={colors.success} />
        <StatCard title="Returning" value={ud.returningUsers} icon="🔄" color={colors.info} />
        <StatCard
          title="Retention"
          value={`${ud.dau > 0 ? Math.round((ud.returningUsers / ud.dau) * 100) : 0}%`}
          icon="💪"
          color={colors.purple}
        />
      </Grid>

      {/* Activity + Devices */}
      <Grid cols={2} gap="20px">
        <Card title="Live Activity" icon="🟢">
          {rd.liveUsers > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ActivityRow icon="▶️" label="Watching" value={rd.watching} total={rd.liveUsers} color={colors.primary} />
              <ActivityRow icon="📺" label="Live TV" value={rd.livetv} total={rd.liveUsers} color={colors.warning} />
              <ActivityRow icon="🔍" label="Browsing" value={rd.browsing} total={rd.liveUsers} color={colors.info} />
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No active users</div>
          )}
        </Card>

        <Card title="Devices" icon="📱">
          {ud.deviceBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ud.deviceBreakdown.slice(0, 4).map((d) => {
                const total = ud.deviceBreakdown.reduce((s, x) => s + x.count, 0);
                const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲', unknown: '🖥️' };
                return (
                  <ProgressBar
                    key={d.device}
                    label={`${icons[d.device] || '🖥️'} ${d.device}`}
                    value={d.count}
                    max={total}
                    gradient={gradients.mixed}
                    showLabel
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No device data</div>
          )}
        </Card>
      </Grid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Real-time Tab                                                      */
/* ------------------------------------------------------------------ */

function RealtimeContent({ rd }: { rd: ReturnType<typeof useRealtimeSlice>['data'] }) {
  const total = rd.liveUsers || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Big live count */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(120,119,198,0.15), rgba(120,119,198,0.05))',
          border: '1px solid rgba(120,119,198,0.3)',
          borderRadius: '16px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, color: colors.text.primary, fontSize: '18px' }}>Live Activity</h3>
            <span
              style={{
                background: colors.success,
                color: 'white',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              • LIVE
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.text.muted, fontSize: '11px' }}>Peak today</div>
            <div style={{ color: colors.success, fontSize: '18px', fontWeight: '700' }}>{rd.peakToday}</div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(16,185,129,0.1)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: '700', color: colors.text.primary }}>
            {formatNumber(rd.liveUsers)}
          </div>
          <div style={{ color: colors.text.secondary, fontSize: '14px' }}>users on site</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ActivityBar icon="▶️" label="Watching content" value={rd.watching} pct={getPercentage(rd.watching, total)} color={colors.purple} />
          <ActivityBar icon="📺" label="Live TV" value={rd.livetv} pct={getPercentage(rd.livetv, total)} color={colors.warning} />
          <ActivityBar icon="🔍" label="Browsing" value={rd.browsing} pct={getPercentage(rd.browsing, total)} color={colors.info} />
        </div>
      </div>

      {/* Top active content */}
      <Card title="Currently Active Content" icon="🎬">
        {rd.topActiveContent.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rd.topActiveContent.slice(0, 10).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: colors.text.primary, fontSize: '14px' }}>{item.title}</span>
                <span style={{ color: colors.success, fontWeight: '600', fontSize: '14px' }}>{item.viewers} viewers</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No active content</div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function ActivityRow({
  icon,
  label,
  value,
  total,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = getPercentage(value, total);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '16px', width: '24px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: colors.text.primary, fontSize: '13px' }}>{label}</span>
          <span style={{ color: colors.text.primary, fontSize: '13px', fontWeight: '600' }}>
            {value} <span style={{ color: colors.text.muted, fontWeight: '400' }}>({pct}%)</span>
          </span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      </div>
    </div>
  );
}

function ActivityBar({
  icon,
  label,
  value,
  pct,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      <span style={{ color: colors.text.primary, fontSize: '14px', minWidth: '140px' }}>{label}</span>
      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ color: colors.text.primary, fontWeight: '600', minWidth: '80px', textAlign: 'right' }}>
        {value.toLocaleString()} <span style={{ color: colors.text.muted, fontWeight: '400' }}>({pct}%)</span>
      </span>
    </div>
  );
}
