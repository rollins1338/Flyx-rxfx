'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useStats } from '../context/StatsContext';

interface PageMetric {
  page_path: string;
  total_views: number;
  unique_visitors: number;
  avg_time_on_page: number;
  bounce_rate: number;
  avg_scroll_depth: number;
  entry_count: number;
  exit_count: number;
}

interface UserEngagement {
  user_id: string;
  first_visit: number;
  last_visit: number;
  total_visits: number;
  total_page_views: number;
  total_time_on_site: number;
  total_watch_time: number;
  avg_session_duration: number;
  avg_pages_per_session: number;
  engagement_score: number;
  device_types: string;
  countries: string;
  bounce_count: number;
}

interface EngagementStats {
  total_users: number;
  avg_visits_per_user: number;
  avg_pages_per_user: number;
  avg_time_per_user: number;
  avg_engagement_score: number;
  return_rate: number;
  overall_bounce_rate: number;
}

export default function EngagementPage() {
  useAdmin();
  // Use unified stats for key metrics - SINGLE SOURCE OF TRUTH
  const { stats: unifiedStats } = useStats();
  
  const [activeTab, setActiveTab] = useState<'pages' | 'users' | 'sessions'>('pages');
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  
  // Page metrics state
  const [pageMetrics, setPageMetrics] = useState<PageMetric[]>([]);
  const [pageStats, setPageStats] = useState<any>(null);
  
  // User engagement state
  const [users, setUsers] = useState<UserEngagement[]>([]);
  const [engagementStats, setEngagementStats] = useState<EngagementStats | null>(null);
  const [engagementDistribution, setEngagementDistribution] = useState<any[]>([]);
  const [visitFrequency, setVisitFrequency] = useState<any[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('last_visit');

  useEffect(() => {
    fetchData();
  }, [timeRange, sortBy]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
      
      // Fetch page metrics
      const pageRes = await fetch(`/api/analytics/page-view?days=${days}`);
      const pageData = await pageRes.json();
      if (pageData.success) {
        setPageMetrics(pageData.pageMetrics || []);
        setPageStats(pageData.overallStats);
      }
      
      // Fetch user engagement
      const userRes = await fetch(`/api/analytics/user-engagement?days=${days}&sortBy=${sortBy}`);
      const userData = await userRes.json();
      if (userData.success) {
        setUsers(userData.users || []);
        setEngagementStats(userData.aggregateStats);
        setEngagementDistribution(userData.engagementDistribution || []);
        setVisitFrequency(userData.visitFrequency || []);
      }
    } catch (error) {
      console.error('Failed to fetch engagement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u => u.user_id.toLowerCase().includes(query));
  }, [users, searchQuery]);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds < 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getEngagementColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 50) return '#f59e0b';
    if (score >= 20) return '#3b82f6';
    return '#64748b';
  };

  const getEngagementLabel = (score: number) => {
    if (score >= 80) return 'Highly Engaged';
    if (score >= 50) return 'Engaged';
    if (score >= 20) return 'Casual';
    return 'New';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid rgba(120, 119, 198, 0.3)',
          borderTopColor: '#7877c6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        Loading engagement data...
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>
          📊 User Engagement & Page Analytics
        </h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>
          Detailed insights into user behavior, page performance, and engagement metrics
        </p>
      </div>

      {/* Time Range & Tab Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['pages', 'users', 'sessions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab ? '#7877c6' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid',
                borderColor: activeTab === tab ? '#7877c6' : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: activeTab === tab ? 'white' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'pages' ? '📄 Pages' : tab === 'users' ? '👥 Users' : '🔄 Sessions'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['24h', '7d', '30d', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '8px 16px',
                background: timeRange === range ? 'rgba(120, 119, 198, 0.2)' : 'transparent',
                border: '1px solid',
                borderColor: timeRange === range ? '#7877c6' : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: timeRange === range ? '#7877c6' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Pages Tab */}
      {activeTab === 'pages' && (
        <>
          {/* Page Stats Overview */}
          {pageStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard title="Total Page Views" value={pageStats.total_page_views || 0} icon="👁️" color="#7877c6" />
              <StatCard title="Unique Users" value={pageStats.unique_users || 0} icon="👤" color="#10b981" />
              <StatCard title="Total Sessions" value={pageStats.total_sessions || 0} icon="🔄" color="#f59e0b" />
              <StatCard title="Avg Time on Page" value={formatDuration(pageStats.avg_time_on_page || 0)} icon="⏱️" color="#ec4899" />
              <StatCard title="Avg Scroll Depth" value={`${Math.round(pageStats.avg_scroll_depth || 0)}%`} icon="📜" color="#3b82f6" />
              <StatCard title="Bounce Rate" value={`${Math.round(pageStats.bounce_rate || 0)}%`} icon="↩️" color="#ef4444" />
            </div>
          )}

          {/* Page Metrics Table */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>Page Performance ({pageMetrics.length} pages)</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={thStyle}>Page</th>
                    <th style={thStyle}>Views</th>
                    <th style={thStyle}>Unique Visitors</th>
                    <th style={thStyle}>Avg Time</th>
                    <th style={thStyle}>Scroll Depth</th>
                    <th style={thStyle}>Bounce Rate</th>
                    <th style={thStyle}>Entries</th>
                    <th style={thStyle}>Exits</th>
                  </tr>
                </thead>
                <tbody>
                  {pageMetrics.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No page data yet</td></tr>
                  ) : (
                    pageMetrics.map((page) => (
                      <tr key={page.page_path} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={tdStyle}>
                          <div style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {page.page_path}
                          </div>
                        </td>
                        <td style={tdStyle}><strong>{page.total_views}</strong></td>
                        <td style={tdStyle}>{page.unique_visitors}</td>
                        <td style={tdStyle}>{formatDuration(page.avg_time_on_page)}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${page.avg_scroll_depth}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                            </div>
                            <span>{Math.round(page.avg_scroll_depth)}%</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: page.bounce_rate > 70 ? '#ef4444' : page.bounce_rate > 40 ? '#f59e0b' : '#10b981' }}>
                            {Math.round(page.bounce_rate)}%
                          </span>
                        </td>
                        <td style={tdStyle}>{page.entry_count}</td>
                        <td style={tdStyle}>{page.exit_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          {/* Engagement Stats Overview */}
          {/* Key metrics from unified stats - SINGLE SOURCE OF TRUTH */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard title="Total Users" value={unifiedStats.totalUsers} icon="👥" color="#7877c6" />
            <StatCard title="Active Today (DAU)" value={unifiedStats.activeToday} icon="🟢" color="#10b981" />
            <StatCard title="Active This Week" value={unifiedStats.activeThisWeek} icon="📊" color="#f59e0b" />
            <StatCard title="Avg Time/User" value={formatDuration(engagementStats?.avg_time_per_user || 0)} icon="⏱️" color="#ec4899" />
            <StatCard title="Avg Engagement" value={Math.round(engagementStats?.avg_engagement_score || 0)} icon="📊" color="#3b82f6" />
            <StatCard title="Return Rate" value={`${Math.round(engagementStats?.return_rate || 0)}%`} icon="↩️" color="#22c55e" />
          </div>

          {/* Engagement Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '14px' }}>Engagement Segments</h3>
              {engagementDistribution.map((seg) => {
                const total = engagementDistribution.reduce((sum, s) => sum + s.count, 0);
                const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
                const colors: Record<string, string> = {
                  highly_engaged: '#10b981',
                  engaged: '#f59e0b',
                  casual: '#3b82f6',
                  new: '#64748b'
                };
                return (
                  <div key={seg.segment} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{seg.segment.replace('_', ' ')}</span>
                      <span style={{ color: '#94a3b8' }}>{seg.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: colors[seg.segment] || '#64748b', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '14px' }}>Visit Frequency</h3>
              {visitFrequency.map((freq) => {
                const total = visitFrequency.reduce((sum, f) => sum + f.count, 0);
                const pct = total > 0 ? Math.round((freq.count / total) * 100) : 0;
                return (
                  <div key={freq.visits_range} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#e2e8f0' }}>{freq.visits_range} visits</span>
                      <span style={{ color: '#94a3b8' }}>{freq.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#7877c6', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search & Sort */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="last_visit">Last Active</option>
              <option value="engagement">Engagement Score</option>
              <option value="visits">Total Visits</option>
              <option value="watch_time">Watch Time</option>
            </select>
          </div>

          {/* Users Table */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>User Engagement ({filteredUsers.length} users)</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th style={thStyle}>User ID</th>
                    <th style={thStyle}>Visits</th>
                    <th style={thStyle}>Page Views</th>
                    <th style={thStyle}>Time on Site</th>
                    <th style={thStyle}>Avg Session</th>
                    <th style={thStyle}>Engagement</th>
                    <th style={thStyle}>Last Active</th>
                    <th style={thStyle}>First Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No user data yet</td></tr>
                  ) : (
                    filteredUsers.slice(0, 50).map((user) => (
                      <tr key={user.user_id} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={tdStyle}>
                          <code style={{ fontSize: '12px', color: '#94a3b8' }}>{user.user_id.substring(0, 12)}...</code>
                        </td>
                        <td style={tdStyle}><strong>{user.total_visits}</strong></td>
                        <td style={tdStyle}>{user.total_page_views}</td>
                        <td style={tdStyle}>{formatDuration(user.total_time_on_site)}</td>
                        <td style={tdStyle}>{formatDuration(user.avg_session_duration)}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '40px', 
                              height: '40px', 
                              borderRadius: '50%', 
                              background: `conic-gradient(${getEngagementColor(user.engagement_score)} ${user.engagement_score}%, rgba(255,255,255,0.1) 0)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <div style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '50%', 
                                background: '#1e293b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '600',
                                color: getEngagementColor(user.engagement_score)
                              }}>
                                {user.engagement_score}
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', color: getEngagementColor(user.engagement_score) }}>
                              {getEngagementLabel(user.engagement_score)}
                            </span>
                          </div>
                        </td>
                        <td style={tdStyle}>{formatTimeAgo(user.last_visit)}</td>
                        <td style={tdStyle}>{new Date(user.first_visit).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
          <h3 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>Session Analytics</h3>
          <p>Detailed session tracking data will appear here as users browse the site.</p>
          <p style={{ fontSize: '14px', marginTop: '16px' }}>
            Sessions are tracked automatically and include: duration, page views, entry/exit pages, and more.
          </p>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '600',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  color: '#e2e8f0',
  fontSize: '14px'
};

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '16px',
      borderTop: `3px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{title}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
