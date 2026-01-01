'use client';

/**
 * Traffic Page - Production Ready
 * Complete traffic analysis with Overview, Sources, Referrers, Bots, and Presence tabs.
 * Integrates with StatsContext for bot detection metrics and unified data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useStats } from '../context/StatsContext';
import { getAdminAnalyticsUrl } from '../hooks/useAnalyticsApi';

interface SourceStats {
  source_type: string;
  source_name: string;
  hit_count: number;
  unique_visitors: number;
}

interface ReferrerStats {
  referrer_domain: string;
  referrer_medium: string;
  hit_count: number;
  last_hit: number;
}

interface DetailedReferrerStats {
  referrer_url: string;
  referrer_domain: string;
  referrer_medium: string;
  hit_count: number;
  unique_visitors: number;
  last_hit: number;
}

interface BotStats {
  source_name: string;
  hit_count: number;
}

interface HourlyPattern {
  hour: number;
  hit_count: number;
  bot_hits: number;
}

interface GeoStats {
  country: string;
  hit_count: number;
  unique_visitors: number;
}


interface TrafficData {
  totals: {
    total_hits: number;
    unique_visitors: number;
    bot_hits: number;
    human_hits: number;
  };
  sourceTypeStats: SourceStats[];
  mediumStats: Array<{ referrer_medium: string; hit_count: number; unique_visitors: number }>;
  topReferrers: ReferrerStats[];
  detailedReferrers: DetailedReferrerStats[];
  botStats: BotStats[];
  hourlyPattern: HourlyPattern[];
  geoStats: GeoStats[];
}

interface PresenceStats {
  totals: {
    total_active: number;
    truly_active: number;
    total_sessions: number;
  };
  activityBreakdown: Array<{ activity_type: string; user_count: number; truly_active: number }>;
  validationScores: Array<{ trust_level: string; user_count: number; avg_score: number }>;
  entropyStats: Array<{ entropy_level: string; user_count: number; avg_samples: number }>;
  geoDistribution: Array<{ country: string; city: string; user_count: number }>;
  deviceDistribution: Array<{ device_type: string; user_count: number }>;
  activeContent: Array<{ content_title: string; content_type: string; activity_type: string; viewer_count: number }>;
}

export default function TrafficSourcesPage() {
  const { dateRange } = useAdmin();
  const { stats, botFilterOptions } = useStats();
  
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [presenceStats, setPresenceStats] = useState<PresenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'referrers' | 'bots' | 'presence'>('overview');
  const [referrerLimit, setReferrerLimit] = useState(100);

  // Convert AdminContext dateRange to days
  const getDaysFromPeriod = (period: string) => {
    switch (period) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 7;
    }
  };
  
  const timeRange = dateRange.period === 'day' ? '24h' : dateRange.period === 'week' ? '7d' : dateRange.period === 'month' ? '30d' : '365d';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = getDaysFromPeriod(dateRange.period);
      
      // Build query parameters for bot filtering
      const params = new URLSearchParams();
      params.set('days', days.toString());
      params.set('limit', referrerLimit.toString());
      
      if (!botFilterOptions.includeBots) {
        params.set('excludeBots', 'true');
        params.set('botThreshold', botFilterOptions.confidenceThreshold.toString());
      }
      
      const [trafficRes, presenceRes] = await Promise.all([
        fetch(`${getAdminAnalyticsUrl('traffic-sources')}?${params.toString()}`),
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
  }, [dateRange.period, referrerLimit, botFilterOptions]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatNumber = (num: number) => num?.toLocaleString() || '0';
  
  const getSourceIcon = (type: string) => {
    const icons: Record<string, string> = {
      browser: '🌐', bot: '🤖', api: '⚡', social: '📱', rss: '📰', unknown: '❓'
    };
    return icons[type] || '❓';
  };

  const getMediumIcon = (medium: string) => {
    const icons: Record<string, string> = {
      organic: '🔍', social: '📱', referral: '🔗', direct: '➡️', email: '📧', none: '❌'
    };
    return icons[medium] || '🔗';
  };

  if (loading && !trafficData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(120, 119, 198, 0.3)', borderTopColor: '#7877c6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        Loading traffic analytics...
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Calculate bot percentage and trends from StatsContext
  const botPercentage = trafficData?.totals?.total_hits 
    ? Math.round((trafficData.totals.bot_hits / trafficData.totals.total_hits) * 100) 
    : 0;

  return (
    <div>
      {/* Header - simplified, time range is in AdminHeader */}
      <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '28px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>🚦</span>
          Traffic Sources & Presence
        </h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>
          Analyze where your traffic comes from, detect bots, and monitor real-time presence
        </p>
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: '📊 Overview', count: null },
          { id: 'sources', label: '🌐 Traffic Sources', count: trafficData?.sourceTypeStats?.length || 0 },
          { id: 'referrers', label: '🔗 Top Referrers', count: trafficData?.topReferrers?.length || 0 },
          { id: 'bots', label: '🤖 Bot Analysis', count: trafficData?.botStats?.length || 0 },
          { id: 'presence', label: '🟢 Live Presence', count: presenceStats?.totals?.total_active || stats.liveUsers || 0 },
        ].map((tab) => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as typeof activeTab)} 
            style={{ 
              padding: '10px 20px', 
              background: activeTab === tab.id ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid', 
              borderColor: activeTab === tab.id ? '#7877c6' : 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '8px', 
              color: activeTab === tab.id ? 'white' : '#94a3b8', 
              cursor: 'pointer', 
              fontWeight: '500', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab - NEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Real-time Stats from Unified Context */}
          <div style={{
            background: 'rgba(15, 15, 35, 0.8)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#f8fafc' }}>
              🔴 Real-Time Activity
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <StatCard title="Live Users" value={formatNumber(stats.liveUsers)} icon="👥" color="#22c55e" pulse />
              <StatCard title="Truly Active" value={formatNumber(stats.trulyActiveUsers)} icon="⚡" color="#10b981" pulse />
              <StatCard title="Watching Content" value={formatNumber(stats.liveWatching)} icon="▶️" color="#7877c6" />
              <StatCard title="Browsing" value={formatNumber(stats.liveBrowsing)} icon="🔍" color="#3b82f6" />
              <StatCard title="Live TV" value={formatNumber(stats.liveTVViewers)} icon="📺" color="#f59e0b" />
            </div>
          </div>

          {/* Traffic Overview Stats */}
          {trafficData?.totals && (
            <div style={{
              background: 'rgba(15, 15, 35, 0.8)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#f8fafc' }}>
                📊 Traffic Overview ({timeRange})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <StatCard title="Total Hits" value={formatNumber(trafficData.totals.total_hits)} icon="📊" color="#7877c6" />
                <StatCard title="Unique Visitors" value={formatNumber(trafficData.totals.unique_visitors)} icon="👥" color="#10b981" />
                <StatCard title="Human Traffic" value={formatNumber(trafficData.totals.human_hits)} icon="🧑" color="#3b82f6" />
                <StatCard title="Bot Traffic" value={formatNumber(trafficData.totals.bot_hits)} icon="🤖" color="#f59e0b" />
                <StatCard title="Bot Percentage" value={`${botPercentage}%`} icon="📈" color="#ec4899" />
              </div>
            </div>
          )}

          {/* Bot Detection Metrics from StatsContext */}
          {stats.botDetection && (
            <div style={{
              background: 'rgba(15, 15, 35, 0.8)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#f8fafc' }}>
                🤖 Bot Detection Metrics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <StatCard title="Total Detections" value={formatNumber(stats.botDetection.totalDetections)} icon="🔍" color="#f59e0b" />
                <StatCard title="Suspected Bots" value={formatNumber(stats.botDetection.suspectedBots)} icon="⚠️" color="#ef4444" />
                <StatCard title="Confirmed Bots" value={formatNumber(stats.botDetection.confirmedBots)} icon="🚨" color="#dc2626" />
                <StatCard title="Pending Review" value={formatNumber(stats.botDetection.pendingReview)} icon="⏳" color="#8b5cf6" />
                <StatCard title="Avg Confidence" value={`${Math.round(stats.botDetection.avgConfidenceScore)}%`} icon="📊" color="#06b6d4" />
              </div>
            </div>
          )}

          {/* Geographic Distribution from Unified Context */}
          {stats.topCountries && stats.topCountries.length > 0 && (
            <div style={{
              background: 'rgba(15, 15, 35, 0.8)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#f8fafc' }}>
                🌍 Geographic Distribution
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {stats.topCountries.slice(0, 8).map((country) => {
                  const total = stats.topCountries.reduce((sum, c) => sum + c.count, 0);
                  const pct = total > 0 ? Math.round((country.count / total) * 100) : 0;
                  return (
                    <div key={country.country} style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500', color: '#f8fafc' }}>{country.countryName}</span>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{pct}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{country.country}</span>
                        <span style={{ fontWeight: '600', color: '#7877c6' }}>{formatNumber(country.count)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources Tab */}
      {activeTab === 'sources' && trafficData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* By Source Type */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>Traffic by Source Type</h3>
            {trafficData.sourceTypeStats?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trafficData.sourceTypeStats.map((source) => {
                  const total = trafficData.sourceTypeStats.reduce((sum, s) => sum + s.hit_count, 0);
                  const pct = total > 0 ? Math.round((source.hit_count / total) * 100) : 0;
                  return (
                    <div key={`${source.source_type}-${source.source_name}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>{getSourceIcon(source.source_type)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#f8fafc', fontSize: '14px' }}>{source.source_name}</span>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{formatNumber(source.hit_count)} ({pct}%)</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#7877c6', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No source data yet</div>}
          </div>

          {/* By Medium */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>Traffic by Medium</h3>
            {trafficData.mediumStats?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trafficData.mediumStats.map((medium) => {
                  const total = trafficData.mediumStats.reduce((sum, m) => sum + m.hit_count, 0);
                  const pct = total > 0 ? Math.round((medium.hit_count / total) * 100) : 0;
                  const colors: Record<string, string> = { organic: '#10b981', social: '#ec4899', referral: '#3b82f6', direct: '#f59e0b', email: '#8b5cf6', none: '#64748b' };
                  return (
                    <div key={medium.referrer_medium} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>{getMediumIcon(medium.referrer_medium)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#f8fafc', fontSize: '14px', textTransform: 'capitalize' }}>{medium.referrer_medium || 'Direct'}</span>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{formatNumber(medium.hit_count)} ({pct}%)</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: colors[medium.referrer_medium] || '#7877c6', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No medium data yet</div>}
          </div>
        </div>
      )}

      {/* Referrers Tab */}
      {activeTab === 'referrers' && trafficData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Limit Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Show:</span>
            {[10, 25, 50, 100].map((limit) => (
              <button 
                key={limit} 
                onClick={() => setReferrerLimit(limit)} 
                style={{ 
                  padding: '6px 12px', 
                  background: referrerLimit === limit ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', 
                  border: '1px solid', 
                  borderColor: referrerLimit === limit ? '#7877c6' : 'rgba(255, 255, 255, 0.1)', 
                  borderRadius: '6px', 
                  color: referrerLimit === limit ? 'white' : '#94a3b8', 
                  cursor: 'pointer', 
                  fontSize: '13px' 
                }}
              >
                {limit}
              </button>
            ))}
            <button 
              onClick={() => setReferrerLimit(10000)} 
              style={{ 
                padding: '6px 12px', 
                background: referrerLimit === 10000 ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', 
                border: '1px solid', 
                borderColor: referrerLimit === 10000 ? '#7877c6' : 'rgba(255, 255, 255, 0.1)', 
                borderRadius: '6px', 
                color: referrerLimit === 10000 ? 'white' : '#94a3b8', 
                cursor: 'pointer', 
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              All
            </button>
          </div>

          {/* Top Referring Domains */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>Top Referring Domains ({trafficData.topReferrers?.length || 0} domains)</h3>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1e1e2e', zIndex: 1 }}>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Domain</th>
                    <th style={thStyle}>Medium</th>
                    <th style={thStyle}>Hits</th>
                    <th style={thStyle}>Last Hit</th>
                  </tr>
                </thead>
                <tbody>
                  {trafficData.topReferrers?.length > 0 ? trafficData.topReferrers.map((ref, idx) => (
                    <tr key={ref.referrer_domain} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ ...tdStyle, color: '#64748b', width: '50px' }}>{idx + 1}</td>
                      <td style={tdStyle}><strong>{ref.referrer_domain}</strong></td>
                      <td style={tdStyle}><span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: 'rgba(120, 119, 198, 0.2)', color: '#a5b4fc', textTransform: 'capitalize' }}>{ref.referrer_medium}</span></td>
                      <td style={tdStyle}>{formatNumber(ref.hit_count)}</td>
                      <td style={tdStyle}>{new Date(ref.last_hit).toLocaleString()}</td>
                    </tr>
                  )) : <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No referrer data yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Referrer URLs */}
          {trafficData.detailedReferrers?.length > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>All Referrer URLs ({trafficData.detailedReferrers?.length || 0} URLs)</h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1e1e2e', zIndex: 1 }}>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Full URL</th>
                      <th style={thStyle}>Domain</th>
                      <th style={thStyle}>Medium</th>
                      <th style={thStyle}>Hits</th>
                      <th style={thStyle}>Unique</th>
                      <th style={thStyle}>Last Hit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficData.detailedReferrers.map((ref, idx) => (
                      <tr key={`${ref.referrer_url}-${idx}`} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ ...tdStyle, color: '#64748b', width: '50px' }}>{idx + 1}</td>
                        <td style={{ ...tdStyle, maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ref.referrer_url}>
                          <a href={ref.referrer_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                            {ref.referrer_url}
                          </a>
                        </td>
                        <td style={tdStyle}>{ref.referrer_domain}</td>
                        <td style={tdStyle}><span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: 'rgba(120, 119, 198, 0.2)', color: '#a5b4fc', textTransform: 'capitalize' }}>{ref.referrer_medium}</span></td>
                        <td style={tdStyle}>{formatNumber(ref.hit_count)}</td>
                        <td style={tdStyle}>{formatNumber(ref.unique_visitors)}</td>
                        <td style={tdStyle}>{new Date(ref.last_hit).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bots Tab */}
      {activeTab === 'bots' && trafficData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Bot Detection Summary from StatsContext */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>🛡️ Bot Detection Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Total Detections</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>{formatNumber(stats.botDetection.totalDetections)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Suspected Bots</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>{formatNumber(stats.botDetection.suspectedBots)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Confirmed Bots</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>{formatNumber(stats.botDetection.confirmedBots)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Avg Confidence Score</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#06b6d4' }}>{Math.round(stats.botDetection.avgConfidenceScore)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <span style={{ color: '#94a3b8' }}>Bot Traffic %</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#ec4899' }}>{botPercentage}%</span>
              </div>
            </div>
          </div>

          {/* Bot Breakdown */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>🤖 Bot Breakdown</h3>
            {trafficData.botStats?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {trafficData.botStats.map((bot) => {
                  const total = trafficData.botStats.reduce((sum, b) => sum + b.hit_count, 0);
                  const pct = total > 0 ? Math.round((bot.hit_count / total) * 100) : 0;
                  return (
                    <div key={bot.source_name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>🤖</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#f8fafc', fontSize: '14px' }}>{bot.source_name}</span>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{formatNumber(bot.hit_count)} ({pct}%)</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#f59e0b', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No bot traffic detected</div>}
          </div>

          {/* Hourly Pattern */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', gridColumn: 'span 2' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>📊 Hourly Traffic Pattern</h3>
            {trafficData.hourlyPattern?.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px' }}>
                {trafficData.hourlyPattern.map((hour) => {
                  const maxHits = Math.max(...trafficData.hourlyPattern.map(h => h.hit_count), 1);
                  const height = (hour.hit_count / maxHits) * 100;
                  const botPct = hour.hit_count > 0 ? (hour.bot_hits / hour.hit_count) * 100 : 0;
                  return (
                    <div key={hour.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '100%', height: `${height}%`, minHeight: hour.hit_count > 0 ? '4px' : '0', background: `linear-gradient(180deg, #7877c6 ${100 - botPct}%, #f59e0b ${100 - botPct}%)`, borderRadius: '4px 4px 0 0' }} title={`${hour.hour}:00 - ${hour.hit_count} hits (${hour.bot_hits} bots)`} />
                      <span style={{ fontSize: '9px', color: '#64748b' }}>{hour.hour}</span>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No hourly data yet</div>}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#7877c6' }} /><span style={{ color: '#94a3b8', fontSize: '12px' }}>Human</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#f59e0b' }} /><span style={{ color: '#94a3b8', fontSize: '12px' }}>Bot</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Presence Tab */}
      {activeTab === 'presence' && presenceStats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Activity Breakdown */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>🎬 Activity Breakdown</h3>
            {presenceStats.activityBreakdown?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {presenceStats.activityBreakdown.map((activity) => {
                  const icons: Record<string, string> = { watching: '▶️', browsing: '🔍', livetv: '📺' };
                  const colors: Record<string, string> = { watching: '#7877c6', browsing: '#3b82f6', livetv: '#f59e0b' };
                  return (
                    <div key={activity.activity_type} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>{icons[activity.activity_type] || '❓'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#f8fafc', fontSize: '14px', textTransform: 'capitalize' }}>{activity.activity_type}</span>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{activity.user_count} users ({activity.truly_active} active)</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(activity.user_count / Math.max(presenceStats.totals.total_active, 1)) * 100}%`, background: colors[activity.activity_type] || '#7877c6', borderRadius: '4px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No active users</div>}
          </div>

          {/* Trust Levels */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>🛡️ User Trust Levels</h3>
            {presenceStats.validationScores?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {presenceStats.validationScores.map((score) => {
                  const colors: Record<string, string> = { high_trust: '#10b981', medium_trust: '#f59e0b', low_trust: '#3b82f6', suspicious: '#ef4444' };
                  const icons: Record<string, string> = { high_trust: '✅', medium_trust: '⚠️', low_trust: '🔵', suspicious: '🚨' };
                  return (
                    <div key={score.trust_level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{icons[score.trust_level] || '❓'}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#f8fafc', fontSize: '14px', textTransform: 'capitalize' }}>{score.trust_level.replace('_', ' ')}</span>
                        <div style={{ color: '#64748b', fontSize: '12px' }}>Avg score: {Math.round(score.avg_score)}</div>
                      </div>
                      <span style={{ fontSize: '20px', fontWeight: '700', color: colors[score.trust_level] || '#94a3b8' }}>{score.user_count}</span>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No trust data yet</div>}
          </div>

          {/* Active Content */}
          {presenceStats.activeContent?.length > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', gridColumn: 'span 2' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>🔴 Currently Being Watched</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                {presenceStats.activeContent.map((content, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.content_title}</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>{content.activity_type === 'livetv' ? '📺 Live TV' : `🎬 ${content.content_type}`}</div>
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{content.viewer_count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Geographic Distribution */}
          {presenceStats.geoDistribution?.length > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', gridColumn: 'span 2' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>🌍 Active Users by Location</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {presenceStats.geoDistribution.slice(0, 12).map((geo, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f8fafc', fontSize: '14px' }}>{geo.city || 'Unknown'}</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>{geo.country}</div>
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#7877c6' }}>{geo.user_count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}


const thStyle: React.CSSProperties = {
  padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px'
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px', color: '#e2e8f0', fontSize: '14px'
};

function StatCard({ title, value, icon, color, pulse }: { title: string; value: string | number; icon: string; color: string; pulse?: boolean }) {
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px', ...(pulse ? { animation: 'pulse 2s infinite' } : {}) }}>{icon}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{title}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}
