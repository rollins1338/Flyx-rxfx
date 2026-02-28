'use client';

/**
 * Consolidated User Analytics View
 *
 * Replaces users, sessions, and traffic pages.
 * Wires UserSlice context for SSE-based real-time data.
 * Tabs: Active Users (DAU/WAU/MAU), Sessions, Devices
 *
 * Requirements: 6.1, 6.2
 */

import { useState } from 'react';
import { useUserSlice } from '../context/slices';
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
  EmptyState,
  getPercentage,
} from '../components/ui';

type TabId = 'active-users' | 'sessions' | 'devices';

export default function UserAnalyticsPage() {
  const users = useUserSlice();
  const [activeTab, setActiveTab] = useState<TabId>('active-users');
  const ud = users.data;

  const tabs = [
    { id: 'active-users', label: 'Active Users', icon: '📊' },
    { id: 'sessions', label: 'Sessions', icon: '🔄' },
    { id: 'devices', label: 'Devices', icon: '📱' },
  ];

  return (
    <div>
      <PageHeader title="User Analytics" icon="👥" subtitle="Active users, sessions, and device breakdown"
        actions={<ConnectionBadge connected={users.connected} />} />

      <Grid cols="auto-fit" minWidth="150px" gap="16px">
        <StatCard title="Total Users" value={ud.totalUsers} icon="👥" color={colors.primary} />
        <StatCard title="DAU" value={ud.dau} icon="📊" color={colors.success} />
        <StatCard title="WAU" value={ud.wau} icon="📈" color={colors.warning} />
        <StatCard title="MAU" value={ud.mau} icon="📅" color={colors.purple} />
        <StatCard title="New Today" value={ud.newToday} icon="🆕" color={colors.info} />
        <StatCard title="Returning" value={ud.returningUsers} icon="🔄" color={colors.pink} />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      </div>

      {users.loading ? (
        <LoadingState message="Loading user data..." />
      ) : activeTab === 'active-users' ? (
        <ActiveUsersTab ud={ud} />
      ) : activeTab === 'sessions' ? (
        <SessionsTab ud={ud} />
      ) : (
        <DevicesTab ud={ud} />
      )}
    </div>
  );
}

function ActiveUsersTab({ ud }: { ud: ReturnType<typeof useUserSlice>['data'] }) {
  const retentionRate = ud.dau > 0 ? Math.round((ud.returningUsers / ud.dau) * 100) : 0;
  const engagementRate = ud.totalUsers > 0 ? Math.round((ud.wau / ud.totalUsers) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card title="User Funnel" icon="📊">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FunnelRow label="Total Users" value={ud.totalUsers} percentage={100} color={colors.primary} />
          <FunnelRow label="Monthly Active (MAU)" value={ud.mau} percentage={getPercentage(ud.mau, ud.totalUsers)} color={colors.purple} />
          <FunnelRow label="Weekly Active (WAU)" value={ud.wau} percentage={getPercentage(ud.wau, ud.totalUsers)} color={colors.warning} />
          <FunnelRow label="Daily Active (DAU)" value={ud.dau} percentage={getPercentage(ud.dau, ud.totalUsers)} color={colors.success} />
        </div>
      </Card>

      <Grid cols={2} gap="20px">
        <Card title="Retention" icon="💪">
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '48px', fontWeight: '700', color: colors.success, lineHeight: 1 }}>{retentionRate}%</div>
            <div style={{ color: colors.text.secondary, fontSize: '13px', marginTop: '8px' }}>of daily active users are returning</div>
            <div style={{ marginTop: '12px', maxWidth: '300px', margin: '12px auto 0' }}>
              <ProgressBar value={retentionRate} max={100} gradient={gradients.success} height={10} />
            </div>
          </div>
        </Card>
        <Card title="Engagement" icon="📈">
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: '48px', fontWeight: '700', color: colors.info, lineHeight: 1 }}>{engagementRate}%</div>
            <div style={{ color: colors.text.secondary, fontSize: '13px', marginTop: '8px' }}>weekly engagement (WAU / Total)</div>
            <div style={{ marginTop: '12px', maxWidth: '300px', margin: '12px auto 0' }}>
              <ProgressBar value={engagementRate} max={100} gradient={gradients.primary} height={10} />
            </div>
          </div>
        </Card>
      </Grid>

      <Grid cols={2} gap="20px">
        <Card title="New vs Returning" icon="🆕">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ProgressBar label="🆕 New Today" value={ud.newToday} max={ud.dau || 1} gradient={gradients.success} showLabel />
            <ProgressBar label="🔄 Returning" value={ud.returningUsers} max={ud.dau || 1} gradient={gradients.primary} showLabel />
          </div>
        </Card>
        <Card title="Key Metrics" icon="📋">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <MetricRow label="Total Users" value={formatNumber(ud.totalUsers)} />
            <MetricRow label="DAU" value={formatNumber(ud.dau)} />
            <MetricRow label="WAU" value={formatNumber(ud.wau)} />
            <MetricRow label="MAU" value={formatNumber(ud.mau)} />
          </div>
        </Card>
      </Grid>
    </div>
  );
}

function SessionsTab({ ud }: { ud: ReturnType<typeof useUserSlice>['data'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Grid cols={3} gap="16px">
        <StatCard title="DAU" value={ud.dau} icon="📊" color={colors.success} size="lg" />
        <StatCard title="WAU" value={ud.wau} icon="📈" color={colors.warning} size="lg" />
        <StatCard title="MAU" value={ud.mau} icon="📅" color={colors.purple} size="lg" />
      </Grid>
      <Card title="User Activity Summary" icon="📋">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <MetricRow label="New users today" value={formatNumber(ud.newToday)} />
          <MetricRow label="Returning users" value={formatNumber(ud.returningUsers)} />
          <MetricRow label="Retention rate" value={`${ud.dau > 0 ? Math.round((ud.returningUsers / ud.dau) * 100) : 0}%`} />
        </div>
      </Card>
    </div>
  );
}

function DevicesTab({ ud }: { ud: ReturnType<typeof useUserSlice>['data'] }) {
  if (ud.deviceBreakdown.length === 0) {
    return <EmptyState icon="📱" title="No Device Data" message="Device breakdown will appear as users visit the site" />;
  }
  const total = ud.deviceBreakdown.reduce((s, d) => s + d.count, 0);
  const deviceIcons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲', unknown: '🖥️' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card title="Device Distribution" icon="📱">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {ud.deviceBreakdown.map((d) => {
            const pct = getPercentage(d.count, total);
            return (
              <div key={d.device}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {deviceIcons[d.device] || '🖥️'} {d.device || 'Unknown'}
                  </span>
                  <span style={{ color: colors.text.secondary }}>{formatNumber(d.count)} ({pct}%)</span>
                </div>
                <ProgressBar value={d.count} max={total} gradient={gradients.mixed} height={10} />
              </div>
            );
          })}
        </div>
      </Card>
      <Grid cols="auto-fit" minWidth="180px" gap="16px">
        {ud.deviceBreakdown.map((d) => (
          <StatCard key={d.device} title={d.device || 'Unknown'} value={d.count}
            icon={deviceIcons[d.device] || '🖥️'} color={colors.primary}
            subtitle={`${getPercentage(d.count, total)}% of users`} />
        ))}
      </Grid>
    </div>
  );
}

function FunnelRow({ label, value, percentage, color }: { label: string; value: number; percentage: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: colors.text.primary, fontSize: '14px' }}>{label}</span>
        <span style={{ color: colors.text.primary, fontWeight: '600' }}>
          {formatNumber(value)} <span style={{ color: colors.text.muted, fontWeight: '400', fontSize: '12px' }}>({percentage}%)</span>
        </span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percentage}%`, background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px',
      background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
      border: `1px solid ${connected ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
      fontSize: '11px', color: connected ? colors.success : colors.warning,
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? colors.success : colors.warning }} />
      {connected ? 'Live' : 'Polling'}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: colors.text.secondary, fontSize: '14px' }}>{label}</span>
      <span style={{ color: colors.text.primary, fontWeight: '600', fontSize: '14px' }}>{value}</span>
    </div>
  );
}
