'use client';

/**
 * DetailedRealtimeAnalytics - GRANULAR REAL-TIME DATA
 * 
 * Provides detailed, granular real-time analytics including:
 * - User session details with validation scores
 * - Geographic breakdown with cities
 * - Device and browser details
 * - Content being watched with viewer counts
 * - User behavior patterns and trust levels
 * - Bot detection metrics
 */

import { useState, useEffect, useCallback } from 'react';
import { colors, Card, Grid, StatCard, ProgressBar, gradients } from './ui';

interface PresenceStats {
  totals: {
    total_active: number;
    truly_active: number;
    total_sessions: number;
  };
  activityBreakdown: Array<{
    activity_type: string;
    user_count: number;
    truly_active: number;
  }>;
  validationScores: Array<{
    trust_level: string;
    user_count: number;
    avg_score: number;
  }>;
  entropyStats: Array<{
    entropy_level: string;
    user_count: number;
    avg_samples: number;
  }>;
  geoDistribution: Array<{
    country: string;
    city: string;
    user_count: number;
  }>;
  deviceDistribution: Array<{
    device_type: string;
    user_count: number;
  }>;
  activeContent: Array<{
    content_title: string;
    content_type: string;
    activity_type: string;
    viewer_count: number;
  }>;
}

interface TrafficStats {
  totals: {
    total_hits: number;
    unique_visitors: number;
    bot_hits: number;
    human_hits: number;
  };
  sourceTypeStats: Array<{
    source_type: string;
    hit_count: number;
    unique_visitors: number;
  }>;
  topReferrers: Array<{
    referrer_domain: string;
    referrer_medium: string;
    hit_count: number;
    last_hit: number;
  }>;
  botStats: Array<{
    source_name: string;
    hit_count: number;
  }>;
  hourlyPattern: Array<{
    hour: number;
    hit_count: number;
    bot_hits: number;
  }>;
  geoStats: Array<{
    country: string;
    hit_count: number;
    unique_visitors: number;
  }>;
}

export default function DetailedRealtimeAnalytics() {
  const [presenceData, setPresenceData] = useState<PresenceStats | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchDetailedData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch presence stats and traffic sources in parallel
      const [presenceRes, trafficRes] = await Promise.all([
        fetch('/api/admin/analytics/presence-stats?minutes=30'),
        fetch('/api/admin/analytics/traffic-sources?days=1&limit=50')
      ]);

      if (!presenceRes.ok || !trafficRes.ok) {
        throw new Error('Failed to fetch detailed analytics');
      }

      const [presenceData, trafficData] = await Promise.all([
        presenceRes.json(),
        trafficRes.json()
      ]);

      if (presenceData.success) {
        setPresenceData(presenceData);
      }
      if (trafficData.success) {
        setTrafficData(trafficData);
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch detailed analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetailedData();
    // Auto-refresh every 30 seconds for real-time data
    const interval = setInterval(fetchDetailedData, 30000);
    return () => clearInterval(interval);
  }, [fetchDetailedData]);

  if (loading && !presenceData && !trafficData) {
    return (
      <Card title="🔍 Detailed Real-time Analytics" icon="">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.text.muted }}>
          Loading detailed analytics...
        </div>
      </Card>
    );
  }

  if (error && !presenceData && !trafficData) {
    return (
      <Card title="🔍 Detailed Real-time Analytics" icon="">
        <div style={{ textAlign: 'center', padding: '40px', color: colors.danger }}>
          Error: {error}
        </div>
      </Card>
    );
  }

  const trustLevelColors: Record<string, string> = {
    'high_trust': colors.success,
    'medium_trust': colors.warning,
    'low_trust': colors.danger,
    'suspicious': colors.pink
  };

  const entropyColors: Record<string, string> = {
    'high_entropy': colors.success,
    'medium_entropy': colors.info,
    'low_entropy': colors.warning,
    'minimal_entropy': colors.danger
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: colors.text.primary, fontSize: '18px', fontWeight: '600' }}>
            🔍 Detailed Real-time Analytics
          </h3>
          <p style={{ margin: '4px 0 0 0', color: colors.text.muted, fontSize: '13px' }}>
            Granular user activity, validation, and behavior analysis
            {lastRefresh && ` • Updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={fetchDetailedData}
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

      {/* Session Quality & Trust Levels */}
      {presenceData && (
        <Grid cols={2} gap="20px">
          <Card title="🛡️ User Trust Levels" icon="">
            {presenceData.validationScores.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {presenceData.validationScores.map((level) => {
                  const total = presenceData.validationScores.reduce((sum, l) => sum + l.user_count, 0);
                  return (
                    <div key={level.trust_level}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, fontSize: '13px', textTransform: 'capitalize' }}>
                          {level.trust_level.replace('_', ' ')} ({Math.round(level.avg_score)}% score)
                        </span>
                        <span style={{ color: trustLevelColors[level.trust_level] || colors.text.muted, fontWeight: '600' }}>
                          {level.user_count} users
                        </span>
                      </div>
                      <ProgressBar 
                        value={level.user_count} 
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
                No trust data available
              </div>
            )}
          </Card>

          <Card title="🖱️ Mouse Behavior Analysis" icon="">
            {presenceData.entropyStats.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {presenceData.entropyStats.map((entropy) => {
                  const total = presenceData.entropyStats.reduce((sum, e) => sum + e.user_count, 0);
                  return (
                    <div key={entropy.entropy_level}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, fontSize: '13px', textTransform: 'capitalize' }}>
                          {entropy.entropy_level.replace('_', ' ')} ({Math.round(entropy.avg_samples)} samples)
                        </span>
                        <span style={{ color: entropyColors[entropy.entropy_level] || colors.text.muted, fontWeight: '600' }}>
                          {entropy.user_count} users
                        </span>
                      </div>
                      <ProgressBar 
                        value={entropy.user_count} 
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
                No mouse behavior data
              </div>
            )}
          </Card>
        </Grid>
      )}

      {/* Activity Breakdown & Device Distribution */}
      {presenceData && (
        <Grid cols={2} gap="20px">
          <Card title="⚡ Activity Type Breakdown" icon="">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {presenceData.activityBreakdown.map((activity) => (
                <div key={activity.activity_type} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <div style={{ color: colors.text.primary, fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {activity.activity_type}
                    </div>
                    <div style={{ color: colors.text.muted, fontSize: '12px' }}>
                      {activity.truly_active} highly active
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: colors.success, fontSize: '16px', fontWeight: '700' }}>
                      {activity.user_count}
                    </div>
                    <div style={{ color: colors.text.muted, fontSize: '11px' }}>users</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="📱 Device Distribution" icon="">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {presenceData.deviceDistribution.map((device) => {
                const total = presenceData.deviceDistribution.reduce((sum, d) => sum + d.user_count, 0);
                const deviceIcons: Record<string, string> = {
                  'desktop': '💻',
                  'mobile': '📱',
                  'tablet': '📲',
                  'unknown': '🖥️'
                };
                return (
                  <div key={device.device_type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: colors.text.primary, fontSize: '13px' }}>
                        {deviceIcons[device.device_type] || '🖥️'} {device.device_type || 'Unknown'}
                      </span>
                      <span style={{ color: colors.text.primary, fontWeight: '600' }}>
                        {device.user_count} ({Math.round((device.user_count / total) * 100)}%)
                      </span>
                    </div>
                    <ProgressBar 
                      value={device.user_count} 
                      max={total} 
                      gradient={gradients.mixed} 
                      height={6} 
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </Grid>
      )}

      {/* Geographic Distribution */}
      {presenceData && presenceData.geoDistribution.length > 0 && (
        <Card title="🌍 Active Users by Location" icon="">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {presenceData.geoDistribution.slice(0, 12).map((location, i) => (
              <div key={`${location.country}-${location.city}`} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: i < 3 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                borderRadius: '6px',
                border: i < 3 ? '1px solid rgba(255,215,0,0.2)' : 'none'
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: colors.text.primary, fontSize: '13px', fontWeight: '500' }}>
                    {location.city}
                  </div>
                  <div style={{ color: colors.text.muted, fontSize: '11px' }}>
                    {location.country}
                  </div>
                </div>
                <div style={{ color: colors.success, fontWeight: '700', fontSize: '14px' }}>
                  {location.user_count}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Currently Watched Content */}
      {presenceData && presenceData.activeContent.length > 0 && (
        <Card title="🎬 Currently Being Watched" icon="">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {presenceData.activeContent.map((content, i) => (
              <div key={`${content.content_title}-${content.activity_type}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                background: i === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: i === 0 ? '1px solid rgba(255,215,0,0.2)' : 'none'
              }}>
                <span style={{
                  fontSize: '20px'
                }}>{content.activity_type === 'livetv' ? '📺' : '▶️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: colors.text.primary, fontSize: '14px', fontWeight: '500' }}>
                    {content.content_title}
                  </div>
                  <div style={{ color: colors.text.muted, fontSize: '12px' }}>
                    {content.content_type} • {content.activity_type}
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px',
                  background: 'rgba(16,185,129,0.2)',
                  borderRadius: '12px',
                  color: colors.success,
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {content.viewer_count} watching
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Traffic Sources & Bot Detection */}
      {trafficData && (
        <Grid cols={2} gap="20px">
          <Card title="🚦 Traffic Sources (24h)" icon="">
            <div style={{ marginBottom: '16px' }}>
              <Grid cols="auto-fit" minWidth="120px" gap="12px">
                <StatCard 
                  title="Total Hits" 
                  value={trafficData.totals.total_hits} 
                  icon="👁️" 
                  color={colors.primary}
                  size="sm"
                />
                <StatCard 
                  title="Human" 
                  value={trafficData.totals.human_hits} 
                  icon="👤" 
                  color={colors.success}
                  size="sm"
                />
                <StatCard 
                  title="Bots" 
                  value={trafficData.totals.bot_hits} 
                  icon="🤖" 
                  color={colors.warning}
                  size="sm"
                />
                <StatCard 
                  title="Unique" 
                  value={trafficData.totals.unique_visitors} 
                  icon="🆔" 
                  color={colors.info}
                  size="sm"
                />
              </Grid>
            </div>
            
            {trafficData.sourceTypeStats.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: colors.text.secondary, fontSize: '12px', marginBottom: '4px' }}>
                  Traffic by Source Type
                </div>
                {trafficData.sourceTypeStats.map((source) => {
                  const total = trafficData.sourceTypeStats.reduce((sum, s) => sum + s.hit_count, 0);
                  return (
                    <div key={source.source_type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, fontSize: '13px', textTransform: 'capitalize' }}>
                          {source.source_type}
                        </span>
                        <span style={{ color: colors.text.muted, fontSize: '12px' }}>
                          {source.hit_count} hits ({source.unique_visitors} unique)
                        </span>
                      </div>
                      <ProgressBar 
                        value={source.hit_count} 
                        max={total} 
                        gradient={gradients.mixed} 
                        height={4} 
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="🤖 Bot Activity Detection" icon="">
            {trafficData.botStats.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ color: colors.text.secondary, fontSize: '12px', marginBottom: '4px' }}>
                  Top Bot Sources (24h)
                </div>
                {trafficData.botStats.slice(0, 8).map((bot) => (
                  <div key={bot.source_name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '4px'
                  }}>
                    <span style={{ color: colors.text.primary, fontSize: '12px' }}>
                      {bot.source_name}
                    </span>
                    <span style={{ color: colors.warning, fontSize: '12px', fontWeight: '600' }}>
                      {bot.hit_count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>
                No bot activity detected
              </div>
            )}
          </Card>
        </Grid>
      )}
    </div>
  );
}
