'use client';

/**
 * Refactored Traffic & Geographic Page
 * Comprehensive traffic analysis with real-time presence
 */

import { useState, useEffect, useCallback } from 'react';
import { useStats } from '../context/StatsContext';
import { getAdminAnalyticsUrl } from '../hooks/useAnalyticsApi';
import {
  StatCard,
  Card,
  Grid,
  PageHeader,
  TabSelector,
  TimeRangeSelector,
  DataTable,
  ProgressBar,
  LoadingState,
  EmptyState,
  Badge,
  LiveIndicator,
  formatNumber,
  formatDate,
  colors,
  gradients,
  getPercentage,
} from '../components/ui';

interface TrafficData {
  totals: {
    total_hits: number;
    unique_visitors: number;
    bot_hits: number;
    human_hits: number;
  };
  sourceTypeStats: Array<{ source_type: string; source_name: string; hit_count: number; unique_visitors: number }>;
  mediumStats: Array<{ referrer_medium: string; hit_count: number; unique_visitors: number }>;
  topReferrers: Array<{ referrer_domain: string; referrer_medium: string; hit_count: number; last_hit: number }>;
  detailedReferrers: Array<{ referrer_url: string; referrer_domain: string; referrer_medium: string; hit_count: number; unique_visitors: number; last_hit: number }>;
  botStats: Array<{ source_name: string; hit_count: number }>;
  hourlyPattern: Array<{ hour: number; hit_count: number; bot_hits: number }>;
  geoStats: Array<{ country: string; hit_count: number; unique_visitors: number }>;
}

interface PresenceStats {
  totals: { total_active: number; truly_active: number; total_sessions: number };
  activityBreakdown: Array<{ activity_type: string; user_count: number; truly_active: number }>;
  validationScores: Array<{ trust_level: string; user_count: number; avg_score: number }>;
  activeContent: Array<{ content_title: string; content_type: string; activity_type: string; viewer_count: number }>;
  geoDistribution: Array<{ country: string; city: string; user_count: number }>;
  deviceDistribution: Array<{ device_type: string; user_count: number }>;
}

type TrafficTab = 'overview' | 'sources' | 'referrers' | 'bots' | 'presence' | 'geographic';

export default function TrafficV2Page() {
  const { stats: unifiedStats } = useStats();
  
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [presenceStats, setPresenceStats] = useState<PresenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TrafficTab>('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [referrerLimit, setReferrerLimit] = useState(100);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
      
      const [trafficRes, presenceRes] = await Promise.all([
        fetch(getAdminAnalyticsUrl('traffic-sources', { days, limit: referrerLimit })),
        fetch(getAdminAnalyticsUrl('presence-stats', { minutes: 30 })),
      ]);
      
      if (trafficRes.ok) {
        const data = await trafficRes.json();
        if (data.success) setTrafficData(data);
      }
      
      if (presenceRes.ok) {
        const data = await presenceRes.json();
        if (data.success) setPresenceStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch traffic data:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange, referrerLimit]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'sources', label: 'Sources', icon: '🌐', count: trafficData?.sourceTypeStats?.length },
    { id: 'referrers', label: 'Referrers', icon: '🔗', count: trafficData?.topReferrers?.length },
    { id: 'bots', label: 'Bots', icon: '🤖', count: trafficData?.botStats?.length },
    { id: 'presence', label: 'Live', icon: '🟢', count: unifiedStats.liveUsers },
    { id: 'geographic', label: 'Geographic', icon: '🌍', count: unifiedStats.topCountries?.length },
  ];

  if (loading && !trafficData) {
    return <LoadingState message="Loading traffic data..." />;
  }

  return (
    <div>
      <PageHeader
        title="Traffic & Presence"
        subtitle="Analyze traffic sources, detect bots, and monitor real-time presence"
        icon="🚦"
        actions={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <LiveIndicator active={unifiedStats.liveUsers > 0} />
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} options={[
              { value: '24h', label: '24 Hours' },
              { value: '7d', label: '7 Days' },
              { value: '30d', label: '30 Days' },
            ]} />
          </div>
        }
      />

      {/* Key Stats - Use unified stats as primary source */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="Total Hits" value={trafficData?.totals?.total_hits || unifiedStats.pageViews || 0} icon="📊" color={colors.primary} />
        <StatCard title="Unique Visitors" value={trafficData?.totals?.unique_visitors || unifiedStats.uniqueVisitors || 0} icon="👥" color={colors.success} />
        <StatCard title="Human Traffic" value={trafficData?.totals?.human_hits || unifiedStats.pageViews || 0} icon="🧑" color={colors.info} />
        <StatCard title="Bot Traffic" value={trafficData?.totals?.bot_hits || 0} icon="🤖" color={colors.warning} />
        <StatCard 
          title="Bot %" 
          value={`${trafficData?.totals?.total_hits ? Math.round((trafficData.totals.bot_hits / trafficData.totals.total_hits) * 100) : 0}%`} 
          icon="📈" 
          color={colors.pink} 
        />
        <StatCard title="Active Now" value={unifiedStats.liveUsers} icon="🟢" color={colors.success} pulse />
        <StatCard title="Countries" value={unifiedStats.topCountries?.length || 0} icon="🌍" color={colors.purple} />
        <StatCard title="Page Views (24h)" value={unifiedStats.pageViews} icon="👁️" color={colors.cyan} />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TrafficTab)} />
      </div>

      {activeTab === 'overview' && <OverviewTab trafficData={trafficData} presenceStats={presenceStats} unifiedStats={unifiedStats} />}
      {activeTab === 'sources' && <SourcesTab trafficData={trafficData} />}
      {activeTab === 'referrers' && <ReferrersTab trafficData={trafficData} referrerLimit={referrerLimit} setReferrerLimit={setReferrerLimit} />}
      {activeTab === 'bots' && <BotsTab trafficData={trafficData} />}
      {activeTab === 'presence' && <PresenceTab presenceStats={presenceStats} unifiedStats={unifiedStats} />}
      {activeTab === 'geographic' && <GeographicTab unifiedStats={unifiedStats} trafficData={trafficData} />}
    </div>
  );
}

function OverviewTab({ trafficData, presenceStats, unifiedStats }: { trafficData: TrafficData | null; presenceStats: PresenceStats | null; unifiedStats: any }) {
  // Build activity breakdown from unified stats (5 min window) for consistency
  const activityBreakdown = [
    { activity_type: 'browsing', user_count: unifiedStats.liveBrowsing, truly_active: unifiedStats.liveBrowsing },
    { activity_type: 'livetv', user_count: unifiedStats.liveTVViewers, truly_active: unifiedStats.liveTVViewers },
    { activity_type: 'watching', user_count: unifiedStats.liveWatching, truly_active: unifiedStats.liveWatching },
  ].filter(a => a.user_count > 0);
  
  return (
    <Grid cols={2} gap="24px">
      {/* Traffic by Medium */}
      <Card title="Traffic by Medium" icon="📊">
        {trafficData?.mediumStats?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trafficData.mediumStats.map((medium) => {
              const total = trafficData.mediumStats.reduce((sum, m) => sum + m.hit_count, 0);
              const mediumColors: Record<string, string> = { organic: colors.success, social: colors.pink, referral: colors.info, direct: colors.warning, email: colors.purple };
              const icons: Record<string, string> = { organic: '🔍', social: '📱', referral: '🔗', direct: '➡️', email: '📧' };
              return (
                <div key={medium.referrer_medium}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                      {icons[medium.referrer_medium] || '🔗'} {medium.referrer_medium || 'Direct'}
                    </span>
                    <span style={{ color: colors.text.muted }}>{formatNumber(medium.hit_count)} ({getPercentage(medium.hit_count, total)}%)</span>
                  </div>
                  <ProgressBar value={medium.hit_count} max={total} color={mediumColors[medium.referrer_medium] || colors.primary} height={8} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="📊" title="No Medium Data" message="Traffic medium data will appear as visitors arrive" />
        )}
      </Card>

      {/* Hourly Pattern */}
      <Card title="Hourly Traffic Pattern" icon="📈">
        {trafficData?.hourlyPattern?.length ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px', marginBottom: '16px' }}>
              {trafficData.hourlyPattern.map((hour) => {
                const maxHits = Math.max(...trafficData.hourlyPattern.map(h => h.hit_count), 1);
                const height = (hour.hit_count / maxHits) * 100;
                const botPct = hour.hit_count > 0 ? (hour.bot_hits / hour.hit_count) * 100 : 0;
                return (
                  <div key={hour.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div 
                      style={{ 
                        width: '100%', 
                        height: `${height}%`, 
                        minHeight: hour.hit_count > 0 ? '4px' : '0',
                        background: `linear-gradient(180deg, ${colors.primary} ${100 - botPct}%, ${colors.warning} ${100 - botPct}%)`, 
                        borderRadius: '4px 4px 0 0',
                      }} 
                      title={`${hour.hour}:00 - ${hour.hit_count} hits (${hour.bot_hits} bots)`}
                    />
                    {hour.hour % 4 === 0 && <span style={{ fontSize: '9px', color: colors.text.muted }}>{hour.hour}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: colors.primary }} />
                <span style={{ color: colors.text.muted, fontSize: '12px' }}>Human</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: colors.warning }} />
                <span style={{ color: colors.text.muted, fontSize: '12px' }}>Bot</span>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon="📈" title="No Hourly Data" message="Hourly patterns will appear as traffic accumulates" />
        )}
      </Card>

      {/* Current Activity - Using unified stats (5 min window) for consistency */}
      {activityBreakdown.length > 0 ? (
        <Card title="Current Activity" icon="🎬">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activityBreakdown.map((activity) => {
              const icons: Record<string, string> = { watching: '▶️', browsing: '🔍', livetv: '📺' };
              const actColors: Record<string, string> = { watching: colors.purple, browsing: colors.info, livetv: colors.warning };
              return (
                <div key={activity.activity_type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
                      {icons[activity.activity_type] || '❓'} {activity.activity_type}
                    </span>
                    <span style={{ color: colors.text.muted }}>{activity.user_count} users ({activity.truly_active} active)</span>
                  </div>
                  <ProgressBar value={activity.user_count} max={unifiedStats.liveUsers || 1} color={actColors[activity.activity_type] || colors.primary} height={8} />
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Trust Levels */}
      {presenceStats?.validationScores?.length ? (
        <Card title="User Trust Levels" icon="🛡️">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {presenceStats.validationScores.map((score) => {
              const trustColors: Record<string, string> = { high_trust: colors.success, medium_trust: colors.warning, low_trust: colors.info, suspicious: colors.danger };
              const icons: Record<string, string> = { high_trust: '✅', medium_trust: '⚠️', low_trust: '🔵', suspicious: '🚨' };
              return (
                <div key={score.trust_level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{icons[score.trust_level] || '❓'}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: colors.text.primary, textTransform: 'capitalize' }}>{score.trust_level.replace('_', ' ')}</span>
                    <div style={{ color: colors.text.muted, fontSize: '12px' }}>Avg score: {Math.round(score.avg_score)}</div>
                  </div>
                  <span style={{ fontSize: '20px', fontWeight: '700', color: trustColors[score.trust_level] || colors.text.muted }}>{score.user_count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </Grid>
  );
}

function SourcesTab({ trafficData }: { trafficData: TrafficData | null }) {
  const sourceIcons: Record<string, string> = { browser: '🌐', bot: '🤖', api: '⚡', social: '📱', rss: '📰', unknown: '❓' };

  return (
    <Grid cols={2} gap="24px">
      <Card title="Traffic by Source Type" icon="📊">
        {trafficData?.sourceTypeStats?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trafficData.sourceTypeStats.map((source) => {
              const total = trafficData.sourceTypeStats.reduce((sum, s) => sum + s.hit_count, 0);
              return (
                <div key={`${source.source_type}-${source.source_name}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {sourceIcons[source.source_type] || '❓'} {source.source_name}
                    </span>
                    <span style={{ color: colors.text.muted }}>{formatNumber(source.hit_count)} ({getPercentage(source.hit_count, total)}%)</span>
                  </div>
                  <ProgressBar value={source.hit_count} max={total} gradient={gradients.mixed} height={8} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="📊" title="No Source Data" message="Source data will appear as traffic arrives" />
        )}
      </Card>

      <Card title="Traffic Summary" icon="📈">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SummaryRow label="Total Hits" value={trafficData?.totals?.total_hits || 0} icon="📊" />
          <SummaryRow label="Unique Visitors" value={trafficData?.totals?.unique_visitors || 0} icon="👥" />
          <SummaryRow label="Human Traffic" value={trafficData?.totals?.human_hits || 0} icon="🧑" color={colors.success} />
          <SummaryRow label="Bot Traffic" value={trafficData?.totals?.bot_hits || 0} icon="🤖" color={colors.warning} />
        </div>
      </Card>
    </Grid>
  );
}

function ReferrersTab({ trafficData, referrerLimit, setReferrerLimit }: { trafficData: TrafficData | null; referrerLimit: number; setReferrerLimit: (limit: number) => void }) {
  const [showFullUrls, setShowFullUrls] = useState(false);
  
  const domainColumns = [
    { key: 'referrer_domain', header: 'Domain', render: (r: any) => <strong>{r.referrer_domain}</strong> },
    { key: 'referrer_medium', header: 'Medium', render: (r: any) => <Badge color={colors.primary}>{r.referrer_medium}</Badge> },
    { key: 'hit_count', header: 'Hits', render: (r: any) => formatNumber(r.hit_count) },
    { key: 'last_hit', header: 'Last Hit', render: (r: any) => formatDate(r.last_hit) },
  ];

  const urlColumns = [
    { 
      key: 'referrer_url', 
      header: 'Full URL', 
      render: (r: any) => (
        <div style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.referrer_url}>
          <a href={r.referrer_url} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'none' }}>
            {r.referrer_url}
          </a>
        </div>
      ) 
    },
    { key: 'referrer_medium', header: 'Medium', render: (r: any) => <Badge color={colors.primary}>{r.referrer_medium}</Badge> },
    { key: 'hit_count', header: 'Hits', render: (r: any) => formatNumber(r.hit_count) },
    { key: 'unique_visitors', header: 'Visitors', render: (r: any) => formatNumber(r.unique_visitors) },
    { key: 'last_hit', header: 'Last Hit', render: (r: any) => formatDate(r.last_hit) },
  ];

  const limitOptions = [50, 100, 250, 500, 1000, 10000];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Controls Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Limit Selector */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: colors.text.muted, fontSize: '14px' }}>Show:</span>
          {limitOptions.map((limit) => (
            <button
              key={limit}
              onClick={() => setReferrerLimit(limit)}
              style={{
                padding: '6px 12px',
                background: referrerLimit === limit ? colors.primary : 'rgba(255,255,255,0.05)',
                border: '1px solid',
                borderColor: referrerLimit === limit ? colors.primary : 'rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: referrerLimit === limit ? 'white' : colors.text.muted,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: limit === 10000 ? '600' : '400',
              }}
            >
              {limit === 10000 ? 'All' : limit}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <button
          onClick={() => setShowFullUrls(!showFullUrls)}
          style={{
            padding: '8px 16px',
            background: showFullUrls ? colors.primary : 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            color: colors.text.primary,
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {showFullUrls ? '🔗 Show Domains Only' : '📋 Show Full URLs'}
        </button>
      </div>
      
      {showFullUrls ? (
        <Card title={`Detailed Referrer URLs (${trafficData?.detailedReferrers?.length || 0} URLs)`} icon="📋">
          <DataTable 
            data={trafficData?.detailedReferrers || []} 
            columns={urlColumns} 
            emptyMessage="No referrer data yet"
            maxRows={referrerLimit}
          />
        </Card>
      ) : (
        <Card title={`Top Referring Domains (${trafficData?.topReferrers?.length || 0} domains)`} icon="🔗">
          <DataTable 
            data={trafficData?.topReferrers || []} 
            columns={domainColumns} 
            emptyMessage="No referrer data yet"
            maxRows={referrerLimit}
          />
        </Card>
      )}
    </div>
  );
}

function BotsTab({ trafficData }: { trafficData: TrafficData | null }) {
  return (
    <Grid cols={2} gap="24px">
      <Card title="Bot Breakdown" icon="🤖">
        {trafficData?.botStats?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trafficData.botStats.map((bot) => {
              const total = trafficData.botStats.reduce((sum, b) => sum + b.hit_count, 0);
              return (
                <div key={bot.source_name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🤖 {bot.source_name}
                    </span>
                    <span style={{ color: colors.text.muted }}>{formatNumber(bot.hit_count)} ({getPercentage(bot.hit_count, total)}%)</span>
                  </div>
                  <ProgressBar value={bot.hit_count} max={total} color={colors.warning} height={8} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="🤖" title="No Bot Traffic" message="Bot traffic will be detected and shown here" />
        )}
      </Card>

      <Card title="Bot vs Human" icon="📊">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: colors.text.secondary }}>Human Traffic</span>
              <span style={{ color: colors.success, fontWeight: '600' }}>{formatNumber(trafficData?.totals?.human_hits || 0)}</span>
            </div>
            <ProgressBar value={trafficData?.totals?.human_hits || 0} max={trafficData?.totals?.total_hits || 1} color={colors.success} height={12} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: colors.text.secondary }}>Bot Traffic</span>
              <span style={{ color: colors.warning, fontWeight: '600' }}>{formatNumber(trafficData?.totals?.bot_hits || 0)}</span>
            </div>
            <ProgressBar value={trafficData?.totals?.bot_hits || 0} max={trafficData?.totals?.total_hits || 1} color={colors.warning} height={12} />
          </div>
        </div>
      </Card>
    </Grid>
  );
}

function PresenceTab({ presenceStats, unifiedStats }: { presenceStats: PresenceStats | null; unifiedStats: any }) {
  return (
    <>
      <Grid cols="auto-fit" minWidth="180px" gap="16px">
        <StatCard title="Total Active" value={unifiedStats.liveUsers} icon="👥" color={colors.success} pulse size="lg" />
        <StatCard title="Truly Active" value={unifiedStats.trulyActiveUsers} icon="🎯" color={colors.primary} subtitle="Last 60 seconds" />
        <StatCard title="Watching VOD" value={unifiedStats.liveWatching} icon="▶️" color={colors.purple} />
        <StatCard title="Live TV" value={unifiedStats.liveTVViewers} icon="📺" color={colors.warning} />
        <StatCard title="Browsing" value={unifiedStats.liveBrowsing} icon="🔍" color={colors.info} />
      </Grid>

      {/* Active Content */}
      {presenceStats?.activeContent?.length ? (
        <div style={{ marginTop: '24px' }}>
          <Card title="Currently Being Watched" icon="🔴">
            <Grid cols="auto-fit" minWidth="250px" gap="12px">
              {presenceStats.activeContent.map((content, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.danger, animation: 'pulse 2s infinite' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: colors.text.primary, fontSize: '14px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {content.content_title}
                    </div>
                    <div style={{ color: colors.text.muted, fontSize: '12px' }}>
                      {content.activity_type === 'livetv' ? '📺 Live TV' : `🎬 ${content.content_type}`}
                    </div>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: colors.success }}>{content.viewer_count}</span>
                </div>
              ))}
            </Grid>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function GeographicTab({ unifiedStats, trafficData }: { unifiedStats: any; trafficData: TrafficData | null }) {
  return (
    <Grid cols={2} gap="24px">
      <Card title="Top Countries (Users)" icon="🌍">
        {unifiedStats.topCountries?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {unifiedStats.topCountries.slice(0, 10).map((country: any, i: number) => {
              const total = unifiedStats.topCountries.reduce((sum: number, c: any) => sum + c.count, 0);
              return (
                <div key={country.country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: colors.text.muted, fontSize: '12px', width: '20px' }}>#{i + 1}</span>
                      {country.countryName || country.country}
                    </span>
                    <span style={{ color: colors.text.muted }}>{country.count} ({getPercentage(country.count, total)}%)</span>
                  </div>
                  <ProgressBar value={country.count} max={total} gradient={gradients.mixed} height={6} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="🌍" title="No Geographic Data" message="Geographic data will appear as users visit" />
        )}
      </Card>

      <Card title="Traffic by Country" icon="🚦">
        {trafficData?.geoStats?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {trafficData.geoStats.slice(0, 10).map((geo, i) => {
              const total = trafficData.geoStats.reduce((sum, g) => sum + g.hit_count, 0);
              return (
                <div key={geo.country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: colors.text.muted, fontSize: '12px', width: '20px' }}>#{i + 1}</span>
                      {geo.country}
                    </span>
                    <span style={{ color: colors.text.muted }}>{formatNumber(geo.hit_count)} hits</span>
                  </div>
                  <ProgressBar value={geo.hit_count} max={total} color={colors.info} height={6} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="🚦" title="No Traffic Geo Data" message="Geographic traffic data will appear as hits accumulate" />
        )}
      </Card>
    </Grid>
  );
}

// Helper Components
function SummaryRow({ label, value, icon, color = colors.text.primary }: { label: string; value: number; icon: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: colors.text.secondary, fontSize: '13px' }}>{label}</div>
        <div style={{ color, fontSize: '24px', fontWeight: '700' }}>{formatNumber(value)}</div>
      </div>
    </div>
  );
}
