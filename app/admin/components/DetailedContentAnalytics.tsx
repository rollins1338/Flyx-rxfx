'use client';

/**
 * DetailedContentAnalytics - GRANULAR CONTENT PERFORMANCE DATA
 * 
 * Provides detailed content analytics including:
 * - Content performance with completion rates and engagement
 * - Daily metrics and trends
 * - Advanced session analytics
 * - Peak viewing hours
 * - Content type breakdown
 * - User engagement patterns
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, Card, Grid, StatCard, ProgressBar, gradients } from './ui';

interface ContentAnalytics {
  overview: {
    totalViews: number;
    totalWatchTime: number;
    uniqueSessions: number;
    uniqueUsers: number;
    avgSessionDuration: number;
  };
  dailyMetrics: Array<{
    date: string;
    views: number;
    watchTime: number;
    sessions: number;
  }>;
  contentPerformance: Array<{
    contentId: string;
    contentTitle: string;
    contentType: string;
    views: number;
    totalWatchTime: number;
    avgCompletion: number;
    uniqueViewers: number;
  }>;
  deviceBreakdown: Array<{
    deviceType: string;
    count: number;
  }>;
  peakHours: Array<{
    hour: number;
    count: number;
  }>;
  advancedMetrics: {
    uniqueViewers: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
}

export default function DetailedContentAnalytics() {
  const [data, setData] = useState<ContentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('week');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchContentAnalytics = useCallback(async () => {
    try {
      setError(null);
      
      const cfWorkerUrl = process.env.NEXT_PUBLIC_CF_SYNC_URL || 'https://flyx-sync.vynx.workers.dev';
      const response = await fetch(`${cfWorkerUrl}/admin/stats?slices=content&range=${period}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch content analytics');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to fetch content analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchContentAnalytics();
  }, [fetchContentAnalytics]);

  if (loading && !data) {
    return (
      <Card title="📊 Detailed Content Analytics" icon="">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.text.muted }}>
          Loading content analytics...
        </div>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card title="📊 Detailed Content Analytics" icon="">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.danger }}>
          Error: {error}
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Period Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, color: colors.text.primary, fontSize: '18px', fontWeight: '600' }}>
            📊 Detailed Content Analytics
          </h3>
          <p style={{ margin: '4px 0 0 0', color: colors.text.muted, fontSize: '13px' }}>
            Comprehensive content performance and user engagement metrics
            {lastRefresh && ` • Updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: colors.text.primary,
              fontSize: '12px',
            }}
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={fetchContentAnalytics}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: 'rgba(120, 119, 198, 0.2)',
              border: '1px solid rgba(120, 119, 198, 0.3)',
              borderRadius: '6px',
              color: colors.primary,
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard 
          title="Total Views" 
          value={data.overview.totalViews.toLocaleString()} 
          icon="👁️" 
          color={colors.primary}
        />
        <StatCard 
          title="Watch Time" 
          value={formatDuration(data.overview.totalWatchTime)} 
          icon="⏱️" 
          color={colors.success}
        />
        <StatCard 
          title="Unique Sessions" 
          value={data.overview.uniqueSessions.toLocaleString()} 
          icon="🎯" 
          color={colors.info}
        />
        <StatCard 
          title="Unique Users" 
          value={data.overview.uniqueUsers.toLocaleString()} 
          icon="👤" 
          color={colors.warning}
        />
        <StatCard 
          title="Avg Session" 
          value={formatDuration(data.overview.avgSessionDuration)} 
          icon="📈" 
          color={colors.pink}
        />
        <StatCard 
          title="Bounce Rate" 
          value={`${data.advancedMetrics.bounceRate}%`} 
          icon="🚪" 
          color={data.advancedMetrics.bounceRate > 70 ? colors.danger : colors.success}
        />
      </Grid>

      {/* Daily Trends */}
      {data.dailyMetrics.length > 0 && (
        <Card title="📈 Daily Performance Trends" icon="">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Chart Area */}
            <div style={{ height: '120px', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Views Line */}
                {(() => {
                  const maxViews = Math.max(...data.dailyMetrics.map(d => d.views), 1);
                  const viewsPoints = data.dailyMetrics.map((d, i) => 
                    `${(i / (data.dailyMetrics.length - 1)) * 100},${100 - ((d.views / maxViews) * 90)}`
                  ).join(' ');
                  return (
                    <polyline
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      points={viewsPoints}
                    />
                  );
                })()}
                
                {/* Watch Time Line */}
                {(() => {
                  const maxWatchTime = Math.max(...data.dailyMetrics.map(d => d.watchTime), 1);
                  const watchTimePoints = data.dailyMetrics.map((d, i) => 
                    `${(i / (data.dailyMetrics.length - 1)) * 100},${100 - ((d.watchTime / maxWatchTime) * 90)}`
                  ).join(' ');
                  return (
                    <polyline
                      fill="none"
                      stroke={colors.success}
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                      vectorEffect="non-scaling-stroke"
                      points={watchTimePoints}
                    />
                  );
                })()}
              </svg>
              
              {/* Legend */}
              <div style={{ 
                position: 'absolute', 
                top: '8px', 
                right: '8px', 
                display: 'flex', 
                gap: '12px', 
                fontSize: '11px' 
              }}>
                <span style={{ color: colors.primary }}>● Views</span>
                <span style={{ color: colors.success }}>● Watch Time</span>
              </div>
            </div>
            
            {/* Date Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.text.muted }}>
              <span>{formatDate(data.dailyMetrics[0]?.date)}</span>
              <span>{formatDate(data.dailyMetrics[data.dailyMetrics.length - 1]?.date)}</span>
            </div>
            
            {/* Daily Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '8px' }}>
              {data.dailyMetrics.slice(-7).map((day) => (
                <div key={day.date} style={{
                  padding: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{ color: colors.text.muted, fontSize: '10px' }}>
                    {formatDate(day.date)}
                  </div>
                  <div style={{ color: colors.primary, fontSize: '14px', fontWeight: '600' }}>
                    {day.views}
                  </div>
                  <div style={{ color: colors.text.muted, fontSize: '10px' }}>
                    {formatDuration(day.watchTime)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Peak Hours & Device Breakdown */}
      <Grid cols={2} gap="20px">
        <Card title="🕐 Peak Viewing Hours" icon="">
          {data.peakHours.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.peakHours
                .sort((a, b) => b.count - a.count)
                .slice(0, 12)
                .map((hour) => {
                  const maxCount = Math.max(...data.peakHours.map(h => h.count));
                  const formatHour = (h: number) => {
                    const period = h >= 12 ? 'PM' : 'AM';
                    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${displayHour}:00 ${period}`;
                  };
                  
                  return (
                    <div key={hour.hour}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, fontSize: '13px' }}>
                          {formatHour(hour.hour)}
                        </span>
                        <span style={{ color: colors.text.primary, fontWeight: '600', fontSize: '13px' }}>
                          {hour.count} views
                        </span>
                      </div>
                      <ProgressBar 
                        value={hour.count} 
                        max={maxCount} 
                        gradient={gradients.mixed} 
                        height={4} 
                      />
                    </div>
                  );
                })}
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>
              No hourly data available
            </div>
          )}
        </Card>

        <Card title="📱 Device Type Breakdown" icon="">
          {data.deviceBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.deviceBreakdown.map((device) => {
                const total = data.deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
                const deviceIcons: Record<string, string> = {
                  'desktop': '💻',
                  'mobile': '📱',
                  'tablet': '📲',
                  'tv': '📺',
                  'unknown': '🖥️'
                };
                
                return (
                  <div key={device.deviceType}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: colors.text.primary, fontSize: '13px' }}>
                        {deviceIcons[device.deviceType] || '🖥️'} {device.deviceType || 'Unknown'}
                      </span>
                      <span style={{ color: colors.text.primary, fontWeight: '600' }}>
                        {device.count} ({Math.round((device.count / total) * 100)}%)
                      </span>
                    </div>
                    <ProgressBar 
                      value={device.count} 
                      max={total} 
                      gradient={gradients.mixed} 
                      height={6} 
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>
              No device data available
            </div>
          )}
        </Card>
      </Grid>
    </div>
  );
}