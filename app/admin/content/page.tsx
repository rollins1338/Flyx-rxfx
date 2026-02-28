'use client';

/**
 * Consolidated Content Analytics View
 *
 * Replaces content, engagement, and analytics pages.
 * Wires ContentSlice context for SSE-based real-time data.
 * Tabs: Watch Sessions, Top Content, Completion Rates
 *
 * Requirements: 6.1, 6.2
 */

import { useState } from 'react';
import { useContentSlice } from '../context/slices';
import {
  colors,
  gradients,
  formatNumber,
  formatDurationMinutes,
  StatCard,
  Card,
  Grid,
  ProgressBar,
  TabSelector,
  PageHeader,
  LoadingState,
  EmptyState,
  getCompletionColor,
} from '../components/ui';

type TabId = 'sessions' | 'top-content' | 'completion';

export default function ContentAnalyticsPage() {
  const content = useContentSlice();
  const [activeTab, setActiveTab] = useState<TabId>('sessions');

  const cd = content.data;

  const tabs = [
    { id: 'sessions', label: 'Watch Sessions', icon: '▶️' },
    { id: 'top-content', label: 'Top Content', icon: '🏆' },
    { id: 'completion', label: 'Completion Rates', icon: '✅' },
  ];

  return (
    <div>
      <PageHeader
        title="Content Analytics"
        icon="🎬"
        subtitle="Watch sessions, top content, and completion rates"
        actions={
          <ConnectionBadge connected={content.connected} lastUpdate={content.lastUpdate} />
        }
      />

      {/* Summary metrics */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="Total Sessions" value={cd.totalSessions} icon="📊" color={colors.primary} />
        <StatCard title="Watch Time" value={formatDurationMinutes(cd.totalWatchTime)} icon="⏱️" color={colors.success} gradient={gradients.success} />
        <StatCard title="Avg Session" value={`${cd.avgSessionDuration}m`} icon="📈" color={colors.pink} />
        <StatCard title="Completion" value={`${cd.completionRate}%`} icon="✅" color={colors.warning} />
        <StatCard title="Movies" value={cd.movieSessions} icon="🎬" color={colors.info} />
        <StatCard title="TV Shows" value={cd.tvSessions} icon="📺" color={colors.purple} />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      </div>

      {content.loading ? (
        <LoadingState message="Loading content data..." />
      ) : activeTab === 'sessions' ? (
        <SessionsTab cd={cd} />
      ) : activeTab === 'top-content' ? (
        <TopContentTab cd={cd} />
      ) : (
        <CompletionTab cd={cd} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Watch Sessions Tab                                                 */
/* ------------------------------------------------------------------ */

function SessionsTab({ cd }: { cd: ReturnType<typeof useContentSlice>['data'] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Grid cols={2} gap="20px">
        <Card title="Session Breakdown" icon="📊">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ProgressBar
              label="🎬 Movies"
              value={cd.movieSessions}
              max={cd.totalSessions || 1}
              gradient={gradients.primary}
              showLabel
            />
            <ProgressBar
              label="📺 TV Shows"
              value={cd.tvSessions}
              max={cd.totalSessions || 1}
              gradient={gradients.purple}
              showLabel
            />
          </div>
        </Card>

        <Card title="Watch Time Summary" icon="⏱️">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.text.secondary }}>Total Watch Time</span>
              <span style={{ color: colors.text.primary, fontWeight: '600' }}>{formatDurationMinutes(cd.totalWatchTime)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.text.secondary }}>Avg Session Duration</span>
              <span style={{ color: colors.text.primary, fontWeight: '600' }}>{cd.avgSessionDuration}m</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: colors.text.secondary }}>Completion Rate</span>
              <span style={{ color: getCompletionColor(cd.completionRate), fontWeight: '600' }}>{cd.completionRate}%</span>
            </div>
          </div>
        </Card>
      </Grid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top Content Tab                                                    */
/* ------------------------------------------------------------------ */

function TopContentTab({ cd }: { cd: ReturnType<typeof useContentSlice>['data'] }) {
  if (cd.topContent.length === 0) {
    return <EmptyState icon="🎬" title="No Content Data" message="Content performance data will appear as users watch content" />;
  }

  const maxViews = Math.max(...cd.topContent.map((c) => c.views), 1);

  return (
    <Card title="Top Content by Views" icon="🏆">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {cd.topContent.slice(0, 15).map((item, i) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: i < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][i] : 'rgba(255,255,255,0.1)',
                color: i < 3 ? '#000' : colors.text.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '12px',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div style={{ width: '200px', flexShrink: 0 }}>
              <div style={{ color: colors.text.primary, fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title}
              </div>
              <div style={{ color: colors.text.muted, fontSize: '11px' }}>{item.type}</div>
            </div>
            <div style={{ flex: 1, height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(item.views / maxViews) * 100}%`,
                  background: gradients.mixed,
                  borderRadius: '12px',
                }}
              />
            </div>
            <span style={{ color: colors.text.primary, fontWeight: '600', fontSize: '14px', width: '80px', textAlign: 'right' }}>
              {formatNumber(item.views)}
            </span>
            <span style={{ color: colors.text.muted, fontSize: '12px', width: '60px', textAlign: 'right' }}>
              {formatDurationMinutes(item.watchTime)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Completion Rates Tab                                               */
/* ------------------------------------------------------------------ */

function CompletionTab({ cd }: { cd: ReturnType<typeof useContentSlice>['data'] }) {
  if (cd.topContent.length === 0) {
    return <EmptyState icon="✅" title="No Completion Data" message="Completion rates will appear as users finish watching content" />;
  }

  // Sort by completion (we don't have per-item completion in the slice, so show overall)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card title="Overall Completion Rate" icon="✅">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div
            style={{
              fontSize: '64px',
              fontWeight: '700',
              color: getCompletionColor(cd.completionRate),
              lineHeight: 1,
            }}
          >
            {cd.completionRate}%
          </div>
          <div style={{ color: colors.text.secondary, fontSize: '14px', marginTop: '8px' }}>
            of sessions reach completion
          </div>
          <div style={{ marginTop: '16px', maxWidth: '400px', margin: '16px auto 0' }}>
            <ProgressBar value={cd.completionRate} max={100} gradient={gradients.success} height={12} />
          </div>
        </div>
      </Card>

      <Grid cols={2} gap="20px">
        <Card title="Session Type Breakdown" icon="📊">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: colors.text.primary }}>🎬 Movie Sessions</span>
                <span style={{ color: colors.text.secondary }}>{formatNumber(cd.movieSessions)}</span>
              </div>
              <ProgressBar value={cd.movieSessions} max={cd.totalSessions || 1} gradient={gradients.primary} height={8} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: colors.text.primary }}>📺 TV Sessions</span>
                <span style={{ color: colors.text.secondary }}>{formatNumber(cd.tvSessions)}</span>
              </div>
              <ProgressBar value={cd.tvSessions} max={cd.totalSessions || 1} gradient={gradients.purple} height={8} />
            </div>
          </div>
        </Card>

        <Card title="Engagement Metrics" icon="📈">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MetricRow label="Total Sessions" value={formatNumber(cd.totalSessions)} />
            <MetricRow label="Total Watch Time" value={formatDurationMinutes(cd.totalWatchTime)} />
            <MetricRow label="Avg Duration" value={`${cd.avgSessionDuration}m`} />
            <MetricRow label="Completion Rate" value={`${cd.completionRate}%`} color={getCompletionColor(cd.completionRate)} />
          </div>
        </Card>
      </Grid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                             */
/* ------------------------------------------------------------------ */

function ConnectionBadge({ connected }: { connected: boolean; lastUpdate?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '12px',
        background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
        border: `1px solid ${connected ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
        fontSize: '11px',
        color: connected ? colors.success : colors.warning,
      }}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: connected ? colors.success : colors.warning,
        }}
      />
      {connected ? 'Live' : 'Polling'}
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: colors.text.secondary, fontSize: '14px' }}>{label}</span>
      <span style={{ color: color || colors.text.primary, fontWeight: '600', fontSize: '14px' }}>{value}</span>
    </div>
  );
}
