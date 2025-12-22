'use client';

/**
 * Refactored Analytics Page
 * Comprehensive watch session analytics with efficient data handling
 */

import { useState, useEffect, useMemo } from 'react';
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
  SearchInput,
  Select,
  Badge,
  formatDuration,
  formatDate,
  colors,
  gradients,
  getCompletionColor,
  getPercentage,
} from '../components/ui';

interface WatchSession {
  id: string;
  user_id: string;
  content_id: string;
  content_type: string;
  content_title: string;
  season_number?: number;
  episode_number?: number;
  started_at: number;
  ended_at?: number;
  total_watch_time: number;
  last_position: number;
  duration: number;
  completion_percentage: number;
  quality?: string;
  device_type?: string;
  is_completed: boolean;
  pause_count: number;
  seek_count: number;
}

interface Analytics {
  totalSessions: number;
  totalWatchTime: number;
  averageWatchTime: number;
  averageCompletionRate: number;
  totalPauses: number;
  totalSeeks: number;
  completedSessions: number;
  completionRate: number;
  deviceBreakdown: Record<string, number>;
  qualityBreakdown: Record<string, number>;
}

type AnalyticsTab = 'sessions' | 'breakdown' | 'trends' | 'engagement';
type SortField = 'started_at' | 'total_watch_time' | 'completion_percentage';

export default function AnalyticsV2Page() {
  const { stats: unifiedStats } = useStats();
  
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('sessions');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortField, setSortField] = useState<SortField>('started_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        'all': 0,
      };

      const startDate = ranges[timeRange] ? now - ranges[timeRange] : 0;

      const response = await fetch(getAdminAnalyticsUrl('watch-session', { limit: '200', ...(startDate && { startDate: startDate.toString() }) }));
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions || []);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.content_title?.toLowerCase().includes(query) ||
        s.content_id?.toLowerCase().includes(query)
      );
    }
    
    if (filterDevice !== 'all') {
      result = result.filter(s => s.device_type === filterDevice);
    }
    
    if (filterType !== 'all') {
      result = result.filter(s => s.content_type === filterType);
    }
    
    result.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return result;
  }, [sessions, searchQuery, filterDevice, filterType, sortField, sortOrder]);

  // Engagement metrics
  const engagementMetrics = useMemo(() => {
    if (!analytics || sessions.length === 0) return null;
    
    const avgPauses = analytics.totalPauses / Math.max(analytics.totalSessions, 1);
    const avgSeeks = analytics.totalSeeks / Math.max(analytics.totalSessions, 1);
    
    const completionDist = {
      '0-25%': sessions.filter(s => s.completion_percentage < 25).length,
      '25-50%': sessions.filter(s => s.completion_percentage >= 25 && s.completion_percentage < 50).length,
      '50-75%': sessions.filter(s => s.completion_percentage >= 50 && s.completion_percentage < 75).length,
      '75-100%': sessions.filter(s => s.completion_percentage >= 75).length,
    };
    
    const hourCounts: Record<number, number> = {};
    sessions.forEach(s => {
      const hour = new Date(s.started_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    
    return {
      avgPauses: Math.round(avgPauses * 10) / 10,
      avgSeeks: Math.round(avgSeeks * 10) / 10,
      completionDist,
      peakHour: peakHour ? parseInt(peakHour[0]) : 0,
      peakHourCount: peakHour ? peakHour[1] : 0,
      hourCounts,
    };
  }, [analytics, sessions]);

  const tabs = [
    { id: 'sessions', label: 'Sessions', icon: '📊', count: filteredSessions.length },
    { id: 'breakdown', label: 'Breakdown', icon: '📈' },
    { id: 'trends', label: 'Trends', icon: '📉' },
    { id: 'engagement', label: 'Engagement', icon: '💡' },
  ];

  if (loading && !analytics) {
    return <LoadingState message="Loading analytics..." />;
  }

  return (
    <div>
      <PageHeader
        title="Watch Analytics"
        subtitle="Deep dive into viewing patterns and engagement"
        icon="📊"
        actions={<TimeRangeSelector value={timeRange} onChange={setTimeRange} />}
      />

      {/* Key Stats from Unified Source */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="Sessions" value={unifiedStats.totalSessions} icon="📊" color={colors.primary} />
        <StatCard title="Watch Time" value={`${unifiedStats.totalWatchTime}m`} icon="⏱️" color={colors.success} />
        <StatCard title="Avg Duration" value={`${unifiedStats.avgSessionDuration}m`} icon="📈" color={colors.warning} />
        <StatCard title="Completion" value={`${unifiedStats.completionRate}%`} icon="✅" color={colors.pink} />
        <StatCard title="Completed" value={unifiedStats.completedSessions} icon="🏆" color={colors.success} />
        <StatCard title="Pauses" value={unifiedStats.totalPauses} icon="⏸️" color={colors.info} />
        <StatCard title="Seeks" value={unifiedStats.totalSeeks} icon="⏩" color={colors.cyan} />
        <StatCard title="Unique Content" value={unifiedStats.uniqueContentWatched} icon="🎬" color={colors.purple} />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as AnalyticsTab)} />
      </div>

      {activeTab === 'sessions' && (
        <SessionsTab 
          sessions={filteredSessions}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterDevice={filterDevice}
          setFilterDevice={setFilterDevice}
          filterType={filterType}
          setFilterType={setFilterType}
          sortField={sortField}
          setSortField={setSortField}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          analytics={analytics}
        />
      )}

      {activeTab === 'breakdown' && analytics && (
        <BreakdownTab analytics={analytics} />
      )}

      {activeTab === 'trends' && (
        <TrendsTab sessions={sessions} />
      )}

      {activeTab === 'engagement' && engagementMetrics && (
        <EngagementTab metrics={engagementMetrics} />
      )}
    </div>
  );
}

function SessionsTab({ 
  sessions, 
  searchQuery, 
  setSearchQuery,
  filterDevice,
  setFilterDevice,
  filterType,
  setFilterType,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  analytics
}: any) {
  const deviceOptions = [
    { value: 'all', label: 'All Devices' },
    ...Object.keys(analytics?.deviceBreakdown || {}).map(d => ({ value: d, label: d }))
  ];

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'movie', label: 'Movies' },
    { value: 'tv', label: 'TV Shows' },
  ];

  const sortOptions = [
    { value: 'started_at-desc', label: 'Newest First' },
    { value: 'started_at-asc', label: 'Oldest First' },
    { value: 'total_watch_time-desc', label: 'Longest Watch' },
    { value: 'completion_percentage-desc', label: 'Highest Completion' },
  ];

  const columns = [
    {
      key: 'content_title',
      header: 'Content',
      render: (s: WatchSession) => (
        <div>
          <div style={{ color: colors.text.primary, fontWeight: '500' }}>{s.content_title || s.content_id}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <Badge color={s.content_type === 'movie' ? colors.success : colors.warning}>{s.content_type}</Badge>
            {s.season_number && s.episode_number && (
              <span style={{ color: colors.text.muted, fontSize: '12px' }}>S{s.season_number}E{s.episode_number}</span>
            )}
          </div>
        </div>
      ),
    },
    { key: 'started_at', header: 'Started', render: (s: WatchSession) => formatDate(s.started_at) },
    { key: 'duration', header: 'Duration', render: (s: WatchSession) => formatDuration(s.duration) },
    { key: 'total_watch_time', header: 'Watched', render: (s: WatchSession) => formatDuration(s.total_watch_time) },
    {
      key: 'completion_percentage',
      header: 'Completion',
      render: (s: WatchSession) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(s.completion_percentage, 100)}%`, background: getCompletionColor(s.completion_percentage), borderRadius: '3px' }} />
          </div>
          <span style={{ color: getCompletionColor(s.completion_percentage), fontWeight: '600', fontSize: '13px' }}>
            {Math.round(s.completion_percentage)}%
          </span>
        </div>
      ),
    },
    { key: 'device_type', header: 'Device', render: (s: WatchSession) => s.device_type || 'Unknown' },
    { key: 'pause_count', header: 'Pauses' },
    { key: 'seek_count', header: 'Seeks' },
  ];

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search content..." />
        <Select value={filterDevice} onChange={setFilterDevice} options={deviceOptions} />
        <Select value={filterType} onChange={setFilterType} options={typeOptions} />
        <Select 
          value={`${sortField}-${sortOrder}`} 
          onChange={(v) => {
            const [field, order] = v.split('-');
            setSortField(field);
            setSortOrder(order);
          }} 
          options={sortOptions} 
        />
      </div>

      <DataTable data={sessions} columns={columns} maxRows={50} emptyMessage="No sessions found" />
    </>
  );
}

function BreakdownTab({ analytics }: { analytics: Analytics }) {
  return (
    <Grid cols={2} gap="24px">
      <Card title="Device Distribution" icon="📱">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(analytics.deviceBreakdown).map(([device, count]) => {
            const total = Object.values(analytics.deviceBreakdown).reduce((a, b) => a + b, 0);
            const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲' };
            return (
              <div key={device}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {icons[device] || '🖥️'} {device}
                  </span>
                  <span style={{ color: colors.text.muted }}>{count} ({getPercentage(count, total)}%)</span>
                </div>
                <ProgressBar value={count} max={total} gradient={gradients.mixed} height={8} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Quality Distribution" icon="🎬">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(analytics.qualityBreakdown).map(([quality, count]) => {
            const total = Object.values(analytics.qualityBreakdown).reduce((a, b) => a + b, 0);
            return (
              <div key={quality}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <Badge color={colors.primary}>{quality}</Badge>
                  <span style={{ color: colors.text.muted }}>{count} ({getPercentage(count, total)}%)</span>
                </div>
                <ProgressBar value={count} max={total} color={colors.primary} height={8} />
              </div>
            );
          })}
        </div>
      </Card>
    </Grid>
  );
}

function TrendsTab({ sessions }: { sessions: WatchSession[] }) {
  // Group sessions by day
  const dailyData = useMemo(() => {
    const grouped: Record<string, { sessions: number; watchTime: number }> = {};
    sessions.forEach(s => {
      const date = new Date(s.started_at).toLocaleDateString();
      if (!grouped[date]) grouped[date] = { sessions: 0, watchTime: 0 };
      grouped[date].sessions++;
      grouped[date].watchTime += s.total_watch_time;
    });
    return Object.entries(grouped).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  }, [sessions]);

  if (dailyData.length === 0) {
    return <EmptyState icon="📈" title="No Trend Data" message="Not enough data to show trends" />;
  }

  const maxSessions = Math.max(...dailyData.map(d => d[1].sessions), 1);

  return (
    <Card title="Daily Activity" icon="📈">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px', marginBottom: '16px' }}>
        {dailyData.slice(-14).map(([date, data]) => {
          const height = (data.sessions / maxSessions) * 100;
          return (
            <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div 
                style={{ 
                  width: '100%', 
                  height: `${height}%`, 
                  minHeight: data.sessions > 0 ? '4px' : '0',
                  background: gradients.mixed, 
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s',
                }} 
                title={`${date}: ${data.sessions} sessions`}
              />
              <span style={{ fontSize: '10px', color: colors.text.muted, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function EngagementTab({ metrics }: { metrics: any }) {
  const distColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const total = Object.values(metrics.completionDist).reduce((a: number, b: any) => a + b, 0) as number;

  return (
    <>
      <Grid cols="auto-fit" minWidth="180px" gap="16px">
        <StatCard title="Avg Pauses/Session" value={metrics.avgPauses} icon="⏸️" color={colors.warning} />
        <StatCard title="Avg Seeks/Session" value={metrics.avgSeeks} icon="⏩" color={colors.info} />
        <StatCard title="Peak Hour" value={`${metrics.peakHour}:00`} icon="🕐" color={colors.pink} />
        <StatCard title="Peak Hour Views" value={metrics.peakHourCount} icon="📈" color={colors.success} />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <Grid cols={2} gap="24px">
          <Card title="Completion Distribution" icon="📊">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(metrics.completionDist).map(([range, count], i) => (
                <div key={range}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary }}>{range}</span>
                    <span style={{ color: colors.text.muted }}>{count as number} ({getPercentage(count as number, total)}%)</span>
                  </div>
                  <ProgressBar value={count as number} max={total} color={distColors[i]} height={10} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Hourly Activity" icon="🕐">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = metrics.hourCounts[hour] || 0;
                const maxCount = Math.max(...Object.values(metrics.hourCounts) as number[], 1);
                const heightPx = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 4 : 0) : 0;
                return (
                  <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div 
                      style={{ 
                        width: '100%', 
                        height: `${heightPx}px`,
                        background: hour === metrics.peakHour ? colors.pink : gradients.mixed, 
                        borderRadius: '2px 2px 0 0',
                      }} 
                      title={`${hour}:00 - ${count} sessions`}
                    />
                    {hour % 4 === 0 && <span style={{ fontSize: '9px', color: colors.text.muted, marginTop: '4px' }}>{hour}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </Grid>
      </div>
    </>
  );
}
