'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStats } from '../context/StatsContext';

interface HourlyData {
  hour: number;
  users: number;
  sessions: number;
  pageViews: number;
}

interface DailyData {
  date: string;
  users: number;
  newUsers: number;
  sessions: number;
}

interface ReferrerData {
  referrer: string;
  count: number;
}

export default function InsightsPage() {
  const { stats: unifiedStats, lastRefresh } = useStats();
  
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [referrers, setReferrers] = useState<ReferrerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  const fetchInsightsData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/insights?range=${selectedTimeRange}`);
      if (response.ok) {
        const data = await response.json();
        setHourlyData(data.hourlyActivity || []);
        setDailyData(data.dailyTrend || []);
        setReferrers(data.referrers || []);
      }
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    fetchInsightsData();
  }, [fetchInsightsData]);

  // Calculate key proof metrics
  const proofMetrics = {
    totalUniqueUsers: unifiedStats.totalUsers,
    activeUsers24h: unifiedStats.activeToday,
    activeUsers7d: unifiedStats.activeThisWeek,
    activeUsers30d: unifiedStats.activeThisMonth,
    liveNow: unifiedStats.liveUsers,
    countries: unifiedStats.topCountries.length,
    totalPageViews: unifiedStats.pageViews,
    totalSessions: unifiedStats.totalSessions,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '28px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>📊</span>
              User Insights & Proof
            </h2>
            <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>
              Verified user activity, traffic sources, and viewing patterns
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select 
              value={selectedTimeRange} 
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              style={{ padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', color: '#f8fafc', fontSize: '14px', cursor: 'pointer' }}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            {lastRefresh && (
              <span style={{ color: '#64748b', fontSize: '12px' }}>
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* PROOF SECTION - Big Numbers */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(120, 119, 198, 0.15), rgba(147, 51, 234, 0.1))', 
        border: '1px solid rgba(120, 119, 198, 0.3)', 
        borderRadius: '20px', 
        padding: '28px', 
        marginBottom: '28px' 
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>✅</span> Verified User Metrics
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '400', marginLeft: 'auto' }}>
            All counts are unique users (no duplicates)
          </span>
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
          <ProofCard 
            label="Total Unique Users" 
            value={proofMetrics.totalUniqueUsers} 
            sublabel="All time"
            icon="👥"
            color="#7877c6"
          />
          <ProofCard 
            label="Active Today" 
            value={proofMetrics.activeUsers24h} 
            sublabel="Last 24 hours"
            icon="📊"
            color="#10b981"
            highlight
          />
          <ProofCard 
            label="Active This Week" 
            value={proofMetrics.activeUsers7d} 
            sublabel="Last 7 days"
            icon="📈"
            color="#f59e0b"
          />
          <ProofCard 
            label="Active This Month" 
            value={proofMetrics.activeUsers30d} 
            sublabel="Last 30 days"
            icon="📅"
            color="#3b82f6"
          />
          <ProofCard 
            label="Online Right Now" 
            value={proofMetrics.liveNow} 
            sublabel="Real-time"
            icon="🟢"
            color="#22c55e"
            pulse
          />
          <ProofCard 
            label="Countries" 
            value={proofMetrics.countries} 
            sublabel="Unique locations"
            icon="🌍"
            color="#8b5cf6"
          />
        </div>
      </div>

      {/* GEOGRAPHIC BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* World Map Visualization */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🌍</span> Where Users Are Viewing From
          </h3>
          
          {unifiedStats.topCountries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {unifiedStats.topCountries.slice(0, 8).map((country, index) => {
                const total = unifiedStats.topCountries.reduce((sum, c) => sum + c.count, 0);
                const percentage = total > 0 ? (country.count / total) * 100 : 0;
                const colors = ['#7877c6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
                
                return (
                  <div key={country.country} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px', width: '28px' }}>{getCountryFlag(country.country)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>{country.countryName}</span>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{country.count.toLocaleString()} users</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${percentage}%`, 
                          background: colors[index % colors.length],
                          borderRadius: '3px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                    <span style={{ 
                      color: colors[index % colors.length], 
                      fontSize: '13px', 
                      fontWeight: '600',
                      minWidth: '45px',
                      textAlign: 'right'
                    }}>
                      {Math.round(percentage)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
              No geographic data yet
            </div>
          )}
        </div>

        {/* Device Breakdown */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📱</span> Device Distribution
          </h3>
          
          {unifiedStats.deviceBreakdown.length > 0 ? (
            <div>
              {/* Pie Chart Visualization */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <DevicePieChart devices={unifiedStats.deviceBreakdown} />
              </div>
              
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {unifiedStats.deviceBreakdown.map((device, index) => {
                  const total = unifiedStats.deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
                  const percentage = total > 0 ? (device.count / total) * 100 : 0;
                  const colors = ['#7877c6', '#10b981', '#f59e0b', '#ec4899'];
                  const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲', unknown: '🖥️' };
                  
                  return (
                    <div key={device.device} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: colors[index % colors.length] }} />
                      <span style={{ fontSize: '18px' }}>{icons[device.device] || '🖥️'}</span>
                      <span style={{ color: '#f8fafc', fontSize: '14px', textTransform: 'capitalize', flex: 1 }}>{device.device}</span>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{device.count.toLocaleString()}</span>
                      <span style={{ color: colors[index % colors.length], fontSize: '13px', fontWeight: '600' }}>{Math.round(percentage)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
              No device data yet
            </div>
          )}
        </div>
      </div>

      {/* ACTIVITY PATTERNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Hourly Activity Heatmap */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🕐</span> Peak Activity Hours
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400', marginLeft: 'auto' }}>Last 7 days</span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Hour labels */}
            <div style={{ display: 'flex', gap: '2px', paddingLeft: '40px' }}>
              {[0, 6, 12, 18, 23].map(h => (
                <span key={h} style={{ flex: h === 23 ? 'none' : 1, color: '#64748b', fontSize: '10px', textAlign: h === 0 ? 'left' : h === 23 ? 'right' : 'center' }}>
                  {h === 0 ? '12am' : h === 6 ? '6am' : h === 12 ? '12pm' : h === 18 ? '6pm' : '11pm'}
                </span>
              ))}
            </div>
            
            {/* Heatmap bars */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '32px', color: '#94a3b8', fontSize: '11px' }}>{day}</span>
                <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const data = hourlyData.find(h => h.hour === hour);
                    const intensity = data ? Math.min(data.users / Math.max(...hourlyData.map(h => h.users), 1), 1) : 0;
                    return (
                      <div 
                        key={hour}
                        style={{ 
                          flex: 1, 
                          height: '16px', 
                          borderRadius: '2px',
                          background: intensity > 0 
                            ? `rgba(120, 119, 198, ${0.2 + intensity * 0.8})` 
                            : 'rgba(255, 255, 255, 0.05)',
                          transition: 'background 0.3s'
                        }}
                        title={`${day} ${hour}:00 - ${data?.users || 0} users`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <span style={{ color: '#64748b', fontSize: '11px' }}>Less</span>
              {[0.2, 0.4, 0.6, 0.8, 1].map((intensity, i) => (
                <div key={i} style={{ width: '16px', height: '16px', borderRadius: '2px', background: `rgba(120, 119, 198, ${intensity})` }} />
              ))}
              <span style={{ color: '#64748b', fontSize: '11px' }}>More</span>
            </div>
          </div>
        </div>

        {/* User Activity Types */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🎬</span> What Users Are Doing
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400', marginLeft: 'auto' }}>Right now</span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ActivityBar 
              label="Watching VOD" 
              count={unifiedStats.liveWatching} 
              total={unifiedStats.liveUsers} 
              icon="▶️" 
              color="#7877c6" 
            />
            <ActivityBar 
              label="Watching Live TV" 
              count={unifiedStats.liveTVViewers} 
              total={unifiedStats.liveUsers} 
              icon="📺" 
              color="#f59e0b" 
            />
            <ActivityBar 
              label="Browsing" 
              count={unifiedStats.liveBrowsing} 
              total={unifiedStats.liveUsers} 
              icon="🔍" 
              color="#3b82f6" 
            />
          </div>
          
          {/* Session Stats */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '13px', fontWeight: '500' }}>Today's Sessions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <MiniStat label="Total Sessions" value={unifiedStats.totalSessions} icon="📊" />
              <MiniStat label="Avg Duration" value={`${unifiedStats.avgSessionDuration}m`} icon="⏱️" />
              <MiniStat label="Watch Time" value={`${Math.round(unifiedStats.totalWatchTime / 60)}h`} icon="🎬" />
              <MiniStat label="Completion" value={`${unifiedStats.completionRate}%`} icon="✅" />
            </div>
          </div>
        </div>
      </div>

      {/* TRAFFIC SOURCES & TRENDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Daily Trend Chart */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📈</span> User Growth Trend
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400', marginLeft: 'auto' }}>{selectedTimeRange}</span>
          </h3>
          
          {dailyData.length > 0 ? (
            <div>
              {/* Simple line chart */}
              <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '4px', paddingBottom: '24px', position: 'relative' }}>
                {dailyData.map((day, index) => {
                  const maxUsers = Math.max(...dailyData.map(d => d.users), 1);
                  const height = (day.users / maxUsers) * 100;
                  const isToday = index === dailyData.length - 1;
                  
                  return (
                    <div 
                      key={day.date} 
                      style={{ 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ color: '#f8fafc', fontSize: '11px', fontWeight: '600' }}>
                        {day.users}
                      </span>
                      <div 
                        style={{ 
                          width: '100%', 
                          height: `${Math.max(height, 4)}%`,
                          background: isToday 
                            ? 'linear-gradient(180deg, #10b981, #059669)' 
                            : 'linear-gradient(180deg, #7877c6, #6366f1)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.5s ease',
                          position: 'relative'
                        }}
                      >
                        {day.newUsers > 0 && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${(day.newUsers / day.users) * 100}%`,
                            background: 'rgba(16, 185, 129, 0.5)',
                            borderRadius: '0 0 4px 4px'
                          }} />
                        )}
                      </div>
                      <span style={{ color: '#64748b', fontSize: '10px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#7877c6' }} />
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Total Users</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#10b981' }} />
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>New Users</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              {loading ? 'Loading trend data...' : 'No trend data available'}
            </div>
          )}
        </div>

        {/* Traffic Sources */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔗</span> Traffic Sources
          </h3>
          
          {referrers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {referrers.slice(0, 6).map((ref) => {
                const total = referrers.reduce((sum, r) => sum + r.count, 0);
                const percentage = total > 0 ? (ref.count / total) * 100 : 0;
                const icons: Record<string, string> = {
                  'direct': '🔗',
                  'google': '🔍',
                  'reddit': '🤖',
                  'twitter': '🐦',
                  'facebook': '📘',
                  'discord': '💬',
                  'unknown': '🌐'
                };
                const icon = icons[ref.referrer.toLowerCase()] || '🌐';
                
                return (
                  <div key={ref.referrer} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#f8fafc', fontSize: '13px', textTransform: 'capitalize' }}>{ref.referrer}</span>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{Math.round(percentage)}%</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percentage}%`, background: '#7877c6', borderRadius: '2px' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '40px', fontSize: '14px' }}>
              {loading ? 'Loading...' : 'No referrer data yet'}
            </div>
          )}
        </div>
      </div>

      {/* EXPORT & PROOF SECTION */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.05))', 
        border: '1px solid rgba(16, 185, 129, 0.2)', 
        borderRadius: '16px', 
        padding: '24px',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600' }}>
              📋 Export Proof of Usage
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
              Download verified analytics data for reporting or proof of concept
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => exportData('csv')}
              style={{ 
                padding: '10px 20px', 
                background: 'rgba(16, 185, 129, 0.2)', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                borderRadius: '10px', 
                color: '#10b981', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📥 Export CSV
            </button>
            <button 
              onClick={() => exportData('json')}
              style={{ 
                padding: '10px 20px', 
                background: 'rgba(120, 119, 198, 0.2)', 
                border: '1px solid rgba(120, 119, 198, 0.3)', 
                borderRadius: '10px', 
                color: '#a5b4fc', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📄 Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Data Freshness Indicator */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: '12px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          background: '#10b981',
          animation: 'pulse 2s infinite'
        }} />
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
          Data refreshes automatically every 30 seconds • Last update: {lastRefresh?.toLocaleTimeString() || 'Loading...'}
        </span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );

  function exportData(format: 'csv' | 'json') {
    const data = {
      exportDate: new Date().toISOString(),
      metrics: {
        totalUniqueUsers: unifiedStats.totalUsers,
        dailyActiveUsers: unifiedStats.activeToday,
        weeklyActiveUsers: unifiedStats.activeThisWeek,
        monthlyActiveUsers: unifiedStats.activeThisMonth,
        currentlyOnline: unifiedStats.liveUsers,
        totalSessions24h: unifiedStats.totalSessions,
        totalWatchTimeMinutes: unifiedStats.totalWatchTime,
        avgSessionDurationMinutes: unifiedStats.avgSessionDuration,
        completionRate: unifiedStats.completionRate,
        pageViews24h: unifiedStats.pageViews,
        uniqueVisitors24h: unifiedStats.uniqueVisitors,
      },
      geographic: unifiedStats.topCountries,
      devices: unifiedStats.deviceBreakdown,
      timeRanges: unifiedStats.timeRanges,
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `analytics-export-${new Date().toISOString().split('T')[0]}.json`);
    } else {
      const csvRows = [
        ['Metric', 'Value', 'Time Range'],
        ['Total Unique Users', data.metrics.totalUniqueUsers, 'All time'],
        ['Daily Active Users', data.metrics.dailyActiveUsers, 'Last 24h'],
        ['Weekly Active Users', data.metrics.weeklyActiveUsers, 'Last 7 days'],
        ['Monthly Active Users', data.metrics.monthlyActiveUsers, 'Last 30 days'],
        ['Currently Online', data.metrics.currentlyOnline, 'Real-time'],
        ['Total Sessions', data.metrics.totalSessions24h, 'Last 24h'],
        ['Total Watch Time (min)', data.metrics.totalWatchTimeMinutes, 'Last 24h'],
        ['Avg Session Duration (min)', data.metrics.avgSessionDurationMinutes, 'Last 24h'],
        ['Completion Rate (%)', data.metrics.completionRate, 'Last 24h'],
        ['Page Views', data.metrics.pageViews24h, 'Last 24h'],
        ['Unique Visitors', data.metrics.uniqueVisitors24h, 'Last 24h'],
        [''],
        ['Country', 'Users', ''],
        ...data.geographic.map(g => [g.countryName, g.count, '']),
        [''],
        ['Device', 'Users', ''],
        ...data.devices.map(d => [d.device, d.count, '']),
      ];
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      downloadBlob(blob, `analytics-export-${new Date().toISOString().split('T')[0]}.csv`);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}


// Helper Components

function ProofCard({ label, value, sublabel, icon, color, highlight, pulse }: { 
  label: string; 
  value: number; 
  sublabel: string; 
  icon: string; 
  color: string;
  highlight?: boolean;
  pulse?: boolean;
}) {
  return (
    <div style={{ 
      background: highlight ? `linear-gradient(135deg, ${color}20, ${color}10)` : 'rgba(255, 255, 255, 0.03)',
      border: `1px solid ${highlight ? `${color}40` : 'rgba(255, 255, 255, 0.1)'}`,
      borderRadius: '14px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontSize: '24px', position: 'relative' }}>
          {icon}
          {pulse && (
            <span style={{ 
              position: 'absolute', 
              top: '-2px', 
              right: '-2px', 
              width: '10px', 
              height: '10px', 
              background: '#10b981', 
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }} />
          )}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{label}</span>
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ color: '#64748b', fontSize: '12px' }}>{sublabel}</div>
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        right: 0, 
        width: '80px', 
        height: '80px', 
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        borderRadius: '50%',
        transform: 'translate(20px, -20px)'
      }} />
    </div>
  );
}

function ActivityBar({ label, count, total, icon, color }: { 
  label: string; 
  count: number; 
  total: number; 
  icon: string; 
  color: string; 
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: '#f8fafc', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {label}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
          {count} users ({Math.round(percentage)}%)
        </span>
      </div>
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
        <div style={{ 
          height: '100%', 
          width: `${percentage}%`, 
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: '5px',
          transition: 'width 0.5s ease'
        }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{ 
      background: 'rgba(255, 255, 255, 0.03)', 
      borderRadius: '10px', 
      padding: '14px', 
      textAlign: 'center' 
    }}>
      <div style={{ fontSize: '18px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function DevicePieChart({ devices }: { devices: Array<{ device: string; count: number }> }) {
  const total = devices.reduce((sum, d) => sum + d.count, 0);
  const colors = ['#7877c6', '#10b981', '#f59e0b', '#ec4899'];
  
  // Calculate segments
  let currentAngle = 0;
  const segments = devices.map((device, index) => {
    const percentage = total > 0 ? (device.count / total) : 0;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...device, startAngle, angle, color: colors[index % colors.length] };
  });

  // Create SVG pie chart
  const size = 140;
  const center = size / 2;
  const radius = 55;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((segment, index) => {
        if (segment.angle === 0) return null;
        
        const startRad = (segment.startAngle - 90) * (Math.PI / 180);
        const endRad = (segment.startAngle + segment.angle - 90) * (Math.PI / 180);
        
        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);
        
        const largeArc = segment.angle > 180 ? 1 : 0;
        
        const pathData = segment.angle >= 360 
          ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
          : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        
        return (
          <path
            key={index}
            d={pathData}
            fill={segment.color}
            stroke="rgba(15, 23, 42, 0.8)"
            strokeWidth="2"
          />
        );
      })}
      {/* Center circle for donut effect */}
      <circle cx={center} cy={center} r={35} fill="rgba(15, 23, 42, 0.95)" />
      <text x={center} y={center - 5} textAnchor="middle" fill="#f8fafc" fontSize="18" fontWeight="700">
        {total}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" fill="#64748b" fontSize="10">
        users
      </text>
    </svg>
  );
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'Unknown' || countryCode.length !== 2) return '🌍';
  try {
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌍';
  }
}
