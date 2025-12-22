'use client';

/**
 * Refactored Users Page
 * Comprehensive user analytics with efficient data handling
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  formatTimeAgo,
  formatNumber,
  colors,
  gradients,
  getEngagementColor,
  getPercentage,
} from '../components/ui';

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

type UsersTab = 'overview' | 'list' | 'segments' | 'activity';

export default function UsersV2Page() {
  const router = useRouter();
  const { stats: unifiedStats, loading: statsLoading } = useStats();
  
  const [users, setUsers] = useState<UserEngagement[]>([]);
  const [engagementStats, setEngagementStats] = useState<EngagementStats | null>(null);
  const [engagementDistribution, setEngagementDistribution] = useState<any[]>([]);
  const [visitFrequency, setVisitFrequency] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState<UsersTab>('overview');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('last_visit');

  useEffect(() => {
    fetchUsers();
  }, [timeRange, sortBy]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
      const response = await fetch(getAdminAnalyticsUrl('user-engagement', { days, sortBy }));
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUsers(data.users || []);
          setEngagementStats(data.aggregateStats);
          setEngagementDistribution(data.engagementDistribution || []);
          setVisitFrequency(data.visitFrequency || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u => u.user_id.toLowerCase().includes(query));
  }, [users, searchQuery]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'list', label: 'User List', icon: '👥', count: filteredUsers.length },
    { id: 'segments', label: 'Segments', icon: '🎯' },
    { id: 'activity', label: 'Activity', icon: '📈' },
  ];

  // Show loading state when either stats or user data is loading
  if ((loading || statsLoading) && !engagementStats) {
    return <LoadingState message="Loading user data..." />;
  }

  return (
    <div>
      <PageHeader
        title="User Analytics"
        subtitle="Understand your audience and engagement patterns"
        icon="👥"
        actions={<TimeRangeSelector value={timeRange} onChange={setTimeRange} />}
      />

      {/* Key Stats from Unified Source */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="Total Users" value={unifiedStats.totalUsers} icon="👥" color={colors.primary} size="lg" />
        <StatCard title="DAU" value={unifiedStats.activeToday} icon="📊" color={colors.success} subtitle="Active today" />
        <StatCard title="WAU" value={unifiedStats.activeThisWeek} icon="📈" color={colors.warning} subtitle="This week" />
        <StatCard title="MAU" value={unifiedStats.activeThisMonth} icon="📅" color={colors.info} subtitle="This month" />
        <StatCard title="New Today" value={unifiedStats.newUsersToday} icon="🆕" color={colors.success} />
        <StatCard title="Returning" value={unifiedStats.returningUsers} icon="🔄" color={colors.purple} />
        <StatCard title="Online Now" value={unifiedStats.liveUsers} icon="🟢" color={colors.success} pulse={unifiedStats.liveUsers > 0} />
        <StatCard 
          title="Retention" 
          value={`${unifiedStats.activeToday > 0 ? Math.round((unifiedStats.returningUsers / unifiedStats.activeToday) * 100) : 0}%`} 
          icon="💪" 
          color={colors.pink} 
        />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as UsersTab)} />
      </div>

      {activeTab === 'overview' && (
        <OverviewTab 
          stats={unifiedStats} 
          engagementStats={engagementStats}
          engagementDistribution={engagementDistribution}
          visitFrequency={visitFrequency}
        />
      )}

      {activeTab === 'list' && (
        <UserListTab 
          users={filteredUsers}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onUserClick={(user: UserEngagement) => router.push(`/admin/users?userId=${encodeURIComponent(user.user_id)}`)}
        />
      )}

      {activeTab === 'segments' && (
        <SegmentsTab 
          engagementDistribution={engagementDistribution}
          visitFrequency={visitFrequency}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityTab stats={unifiedStats} users={users} />
      )}
    </div>
  );
}

function OverviewTab({ stats, engagementStats, engagementDistribution, visitFrequency }: any) {
  return (
    <>
      <Grid cols={2} gap="24px">
        {/* User Funnel */}
        <Card title="User Funnel" icon="📊">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FunnelRow label="Total Users" value={stats.totalUsers} percentage={100} color={colors.primary} />
            <FunnelRow label="Active This Month" value={stats.activeThisMonth} percentage={getPercentage(stats.activeThisMonth, stats.totalUsers)} color={colors.info} />
            <FunnelRow label="Active This Week" value={stats.activeThisWeek} percentage={getPercentage(stats.activeThisWeek, stats.totalUsers)} color={colors.warning} />
            <FunnelRow label="Active Today" value={stats.activeToday} percentage={getPercentage(stats.activeToday, stats.totalUsers)} color={colors.success} />
            <FunnelRow label="Online Now" value={stats.liveUsers} percentage={getPercentage(stats.liveUsers, stats.totalUsers)} color={colors.pink} />
          </div>
        </Card>

        {/* Engagement Stats */}
        <Card title="Engagement Metrics" icon="💡">
          {engagementStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <MetricRow label="Avg Visits/User" value={Math.round(engagementStats.avg_visits_per_user * 10) / 10} />
              <MetricRow label="Avg Pages/User" value={Math.round(engagementStats.avg_pages_per_user * 10) / 10} />
              <MetricRow label="Avg Time/User" value={formatDuration(engagementStats.avg_time_per_user)} />
              <MetricRow label="Avg Engagement" value={Math.round(engagementStats.avg_engagement_score)} />
              <MetricRow label="Return Rate" value={`${Math.round(engagementStats.return_rate)}%`} color={colors.success} />
              <MetricRow label="Bounce Rate" value={`${Math.round(engagementStats.overall_bounce_rate)}%`} color={colors.danger} />
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No engagement data</div>
          )}
        </Card>
      </Grid>

      {/* Geographic & Device Distribution */}
      <div style={{ marginTop: '24px' }}>
        <Grid cols={2} gap="24px">
          <Card title="Top Countries" icon="🌍">
            {stats.topCountries?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.topCountries.slice(0, 6).map((country: any) => {
                  const total = stats.topCountries.reduce((sum: number, c: any) => sum + c.count, 0);
                  return (
                    <div key={country.country}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary }}>{country.countryName || country.country}</span>
                        <span style={{ color: colors.text.muted }}>{country.count} ({getPercentage(country.count, total)}%)</span>
                      </div>
                      <ProgressBar value={country.count} max={total} gradient={gradients.mixed} height={6} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No geographic data</div>
            )}
          </Card>

          <Card title="Devices" icon="📱">
            {stats.deviceBreakdown?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.deviceBreakdown.map((device: any) => {
                  const total = stats.deviceBreakdown.reduce((sum: number, d: any) => sum + d.count, 0);
                  const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲', unknown: '🖥️' };
                  return (
                    <div key={device.device}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {icons[device.device] || '🖥️'} {device.device || 'Unknown'}
                        </span>
                        <span style={{ color: colors.text.muted }}>{device.count} ({getPercentage(device.count, total)}%)</span>
                      </div>
                      <ProgressBar value={device.count} max={total} color={colors.primary} height={6} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No device data</div>
            )}
          </Card>
        </Grid>
      </div>

      {/* Engagement Distribution & Visit Frequency Summary */}
      <div style={{ marginTop: '24px' }}>
        <Grid cols={2} gap="24px">
          <Card title="Engagement Distribution" icon="🎯">
            {engagementDistribution?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {engagementDistribution.slice(0, 4).map((seg: any) => {
                  const total = engagementDistribution.reduce((sum: number, s: any) => sum + s.count, 0);
                  const segColors: Record<string, string> = {
                    highly_engaged: colors.success,
                    engaged: colors.warning,
                    casual: colors.info,
                    new: colors.text.muted,
                  };
                  return (
                    <div key={seg.segment}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary, textTransform: 'capitalize' }}>{seg.segment.replace('_', ' ')}</span>
                        <span style={{ color: colors.text.muted }}>{seg.count} ({getPercentage(seg.count, total)}%)</span>
                      </div>
                      <ProgressBar value={seg.count} max={total} color={segColors[seg.segment] || colors.primary} height={6} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No engagement data</div>
            )}
          </Card>

          <Card title="Visit Frequency" icon="📊">
            {visitFrequency?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {visitFrequency.slice(0, 4).map((freq: any) => {
                  const total = visitFrequency.reduce((sum: number, f: any) => sum + f.count, 0);
                  return (
                    <div key={freq.visits_range}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: colors.text.primary }}>{freq.visits_range} visits</span>
                        <span style={{ color: colors.text.muted }}>{freq.count} ({getPercentage(freq.count, total)}%)</span>
                      </div>
                      <ProgressBar value={freq.count} max={total} gradient={gradients.mixed} height={6} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>No frequency data</div>
            )}
          </Card>
        </Grid>
      </div>
    </>
  );
}

function UserListTab({ users, searchQuery, setSearchQuery, sortBy, setSortBy, onUserClick }: any) {
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const sortOptions = [
    { value: 'last_visit', label: 'Last Active' },
    { value: 'engagement', label: 'Engagement Score' },
    { value: 'visits', label: 'Total Visits' },
    { value: 'watch_time', label: 'Watch Time' },
    { value: 'page_views', label: 'Page Views' },
    { value: 'first_visit', label: 'First Visit' },
  ];

  const engagementOptions = [
    { value: 'all', label: 'All Engagement' },
    { value: 'highly_engaged', label: '🔥 Highly Engaged (80+)' },
    { value: 'engaged', label: '⭐ Engaged (50-79)' },
    { value: 'casual', label: '👋 Casual (20-49)' },
    { value: 'new', label: '🆕 New (<20)' },
  ];

  const userTypeOptions = [
    { value: 'all', label: 'All Users' },
    { value: 'power', label: '💪 Power Users (20+ visits)' },
    { value: 'regular', label: '✅ Regular (10-19 visits)' },
    { value: 'returning', label: '🔄 Returning (3-9 visits)' },
    { value: 'new', label: '🆕 New (1-2 visits)' },
  ];

  // Get unique countries from users
  const countries = useMemo(() => {
    const countrySet = new Set<string>();
    users.forEach((u: UserEngagement) => {
      if (u.countries) countrySet.add(u.countries);
    });
    return Array.from(countrySet).sort();
  }, [users]);

  const countryOptions = [
    { value: 'all', label: 'All Countries' },
    ...countries.map(c => ({ value: c, label: c })),
  ];

  // Apply all filters
  const filteredUsers = useMemo(() => {
    return users.filter((u: UserEngagement) => {
      // Search filter
      if (searchQuery && !u.user_id.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Engagement filter
      if (engagementFilter !== 'all') {
        if (engagementFilter === 'highly_engaged' && u.engagement_score < 80) return false;
        if (engagementFilter === 'engaged' && (u.engagement_score < 50 || u.engagement_score >= 80)) return false;
        if (engagementFilter === 'casual' && (u.engagement_score < 20 || u.engagement_score >= 50)) return false;
        if (engagementFilter === 'new' && u.engagement_score >= 20) return false;
      }
      // User type filter
      if (userTypeFilter !== 'all') {
        if (userTypeFilter === 'power' && u.total_visits < 20) return false;
        if (userTypeFilter === 'regular' && (u.total_visits < 10 || u.total_visits >= 20)) return false;
        if (userTypeFilter === 'returning' && (u.total_visits < 3 || u.total_visits >= 10)) return false;
        if (userTypeFilter === 'new' && u.total_visits >= 3) return false;
      }
      // Country filter
      if (countryFilter !== 'all' && u.countries !== countryFilter) return false;
      return true;
    });
  }, [users, searchQuery, engagementFilter, userTypeFilter, countryFilter]);

  // Paginate
  const paginatedUsers = useMemo(() => {
    const start = page * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [searchQuery, engagementFilter, userTypeFilter, countryFilter, sortBy]);

  const getEngagementLabel = (score: number) => {
    if (score >= 80) return 'Highly Engaged';
    if (score >= 50) return 'Engaged';
    if (score >= 20) return 'Casual';
    return 'New';
  };

  const getUserTypeBadge = (visits: number) => {
    if (visits >= 20) return { label: 'Power User', color: colors.pink };
    if (visits >= 10) return { label: 'Regular', color: colors.success };
    if (visits >= 3) return { label: 'Returning', color: colors.warning };
    return { label: 'New', color: colors.info };
  };

  const columns = [
    {
      key: 'user_id',
      header: 'User ID',
      render: (u: UserEngagement) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <code style={{ fontSize: '12px', color: colors.text.muted }}>{u.user_id.substring(0, 16)}...</code>
          <Badge color={getUserTypeBadge(u.total_visits).color}>{getUserTypeBadge(u.total_visits).label}</Badge>
        </div>
      ),
    },
    { key: 'total_visits', header: 'Visits', render: (u: UserEngagement) => <strong>{u.total_visits}</strong> },
    { key: 'total_page_views', header: 'Page Views' },
    { key: 'total_time_on_site', header: 'Time on Site', render: (u: UserEngagement) => formatDuration(u.total_time_on_site) },
    { key: 'avg_session_duration', header: 'Avg Session', render: (u: UserEngagement) => formatDuration(u.avg_session_duration) },
    {
      key: 'engagement_score',
      header: 'Engagement',
      render: (u: UserEngagement) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '36px', 
            height: '36px', 
            borderRadius: '50%', 
            background: `conic-gradient(${getEngagementColor(u.engagement_score)} ${u.engagement_score}%, rgba(255,255,255,0.1) 0)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              background: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '600',
              color: getEngagementColor(u.engagement_score)
            }}>
              {u.engagement_score}
            </div>
          </div>
          <span style={{ fontSize: '11px', color: getEngagementColor(u.engagement_score) }}>
            {getEngagementLabel(u.engagement_score)}
          </span>
        </div>
      ),
    },
    { key: 'last_visit', header: 'Last Active', render: (u: UserEngagement) => formatTimeAgo(u.last_visit) },
    { key: 'first_visit', header: 'First Visit', render: (u: UserEngagement) => formatDate(u.first_visit).split(',')[0] },
  ];

  return (
    <>
      {/* Filter Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '16px', 
        flexWrap: 'wrap',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by user ID..." />
        <Select value={sortBy} onChange={setSortBy} options={sortOptions} />
        <Select value={engagementFilter} onChange={setEngagementFilter} options={engagementOptions} />
        <Select value={userTypeFilter} onChange={setUserTypeFilter} options={userTypeOptions} />
        {countries.length > 1 && <Select value={countryFilter} onChange={setCountryFilter} options={countryOptions} />}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setViewMode('table')}
            style={{
              padding: '8px 12px',
              background: viewMode === 'table' ? colors.primary : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '6px',
              color: viewMode === 'table' ? '#fff' : colors.text.muted,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >📋 Table</button>
          <button
            onClick={() => setViewMode('cards')}
            style={{
              padding: '8px 12px',
              background: viewMode === 'cards' ? colors.primary : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '6px',
              color: viewMode === 'cards' ? '#fff' : colors.text.muted,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >🃏 Cards</button>
        </div>
      </div>

      {/* Results Summary */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
        color: colors.text.muted,
        fontSize: '14px'
      }}>
        <span>Showing {paginatedUsers.length} of {filteredUsers.length} users {filteredUsers.length !== users.length && `(filtered from ${users.length})`}</span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '6px 12px',
                background: page === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '6px',
                color: page === 0 ? colors.text.muted : colors.text.primary,
                cursor: page === 0 ? 'not-allowed' : 'pointer'
              }}
            >← Prev</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '6px 12px',
                background: page >= totalPages - 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '6px',
                color: page >= totalPages - 1 ? colors.text.muted : colors.text.primary,
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer'
              }}
            >Next →</button>
          </div>
        )}
      </div>

      {viewMode === 'table' ? (
        <DataTable 
          data={paginatedUsers} 
          columns={columns} 
          maxRows={pageSize} 
          emptyMessage="No users match your filters"
          onRowClick={onUserClick}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {paginatedUsers.map((u: UserEngagement) => (
            <div 
              key={u.user_id}
              onClick={() => onUserClick(u)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = colors.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <code style={{ fontSize: '11px', color: colors.text.muted, display: 'block', marginBottom: '6px' }}>{u.user_id.substring(0, 20)}...</code>
                  <Badge color={getUserTypeBadge(u.total_visits).color}>{getUserTypeBadge(u.total_visits).label}</Badge>
                  {u.countries && <span style={{ marginLeft: '8px', fontSize: '12px' }}>{u.countries}</span>}
                </div>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%', 
                  background: `conic-gradient(${getEngagementColor(u.engagement_score)} ${u.engagement_score}%, rgba(255,255,255,0.1) 0)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ 
                    width: '38px', 
                    height: '38px', 
                    borderRadius: '50%', 
                    background: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: getEngagementColor(u.engagement_score)
                  }}>
                    {u.engagement_score}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ color: colors.text.muted, fontSize: '11px', marginBottom: '2px' }}>Visits</div>
                  <div style={{ color: colors.text.primary, fontWeight: '600' }}>{u.total_visits}</div>
                </div>
                <div>
                  <div style={{ color: colors.text.muted, fontSize: '11px', marginBottom: '2px' }}>Page Views</div>
                  <div style={{ color: colors.text.primary, fontWeight: '600' }}>{u.total_page_views}</div>
                </div>
                <div>
                  <div style={{ color: colors.text.muted, fontSize: '11px', marginBottom: '2px' }}>Time on Site</div>
                  <div style={{ color: colors.text.primary, fontWeight: '600' }}>{formatDuration(u.total_time_on_site)}</div>
                </div>
                <div>
                  <div style={{ color: colors.text.muted, fontSize: '11px', marginBottom: '2px' }}>Watch Time</div>
                  <div style={{ color: colors.text.primary, fontWeight: '600' }}>{formatDuration(u.total_watch_time)}</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.text.muted }}>
                <span>First: {formatDate(u.first_visit).split(',')[0]}</span>
                <span>Last: {formatTimeAgo(u.last_visit)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredUsers.length === 0 && (
        <EmptyState 
          icon="🔍" 
          title="No Users Found" 
          message="Try adjusting your filters or search query"
        />
      )}
    </>
  );
}

function SegmentsTab({ engagementDistribution, visitFrequency }: any) {
  const segmentColors: Record<string, string> = {
    highly_engaged: colors.success,
    engaged: colors.warning,
    casual: colors.info,
    new: colors.text.muted,
  };

  return (
    <Grid cols={2} gap="24px">
      <Card title="Engagement Segments" icon="🎯">
        {engagementDistribution.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {engagementDistribution.map((seg: any) => {
              const total = engagementDistribution.reduce((sum: number, s: any) => sum + s.count, 0);
              return (
                <div key={seg.segment}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary, textTransform: 'capitalize' }}>
                      {seg.segment.replace('_', ' ')}
                    </span>
                    <span style={{ color: colors.text.muted }}>{seg.count} ({getPercentage(seg.count, total)}%)</span>
                  </div>
                  <ProgressBar value={seg.count} max={total} color={segmentColors[seg.segment] || colors.primary} height={10} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="🎯" title="No Segment Data" message="Engagement segments will appear as users interact" />
        )}
      </Card>

      <Card title="Visit Frequency" icon="📊">
        {visitFrequency.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {visitFrequency.map((freq: any) => {
              const total = visitFrequency.reduce((sum: number, f: any) => sum + f.count, 0);
              return (
                <div key={freq.visits_range}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: colors.text.primary }}>{freq.visits_range} visits</span>
                    <span style={{ color: colors.text.muted }}>{freq.count} ({getPercentage(freq.count, total)}%)</span>
                  </div>
                  <ProgressBar value={freq.count} max={total} color={colors.primary} height={10} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="📊" title="No Frequency Data" message="Visit frequency data will appear as users return" />
        )}
      </Card>
    </Grid>
  );
}

function ActivityTab({ stats, users }: { stats: any; users: UserEngagement[] }) {
  // Calculate activity distribution
  const activityByHour = useMemo(() => {
    const hours: Record<number, number> = {};
    users.forEach(u => {
      const hour = new Date(u.last_visit).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    return hours;
  }, [users]);

  const maxHourCount = Math.max(...Object.values(activityByHour), 1);

  return (
    <>
      <Grid cols={2} gap="24px">
        <Card title="Current Activity" icon="🟢">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ActivityRow label="Watching VOD" value={stats.liveWatching} total={stats.liveUsers} icon="▶️" color={colors.purple} />
            <ActivityRow label="Live TV" value={stats.liveTVViewers} total={stats.liveUsers} icon="📺" color={colors.warning} />
            <ActivityRow label="Browsing" value={stats.liveBrowsing} total={stats.liveUsers} icon="🔍" color={colors.info} />
          </div>
        </Card>

        <Card title="User Activity by Hour" icon="🕐">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px' }}>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = activityByHour[hour] || 0;
              const heightPx = maxHourCount > 0 ? Math.max((count / maxHourCount) * 100, count > 0 ? 4 : 0) : 0;
              return (
                <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div 
                    style={{ 
                      width: '100%', 
                      height: `${heightPx}px`,
                      background: gradients.mixed, 
                      borderRadius: '2px 2px 0 0',
                    }} 
                    title={`${hour}:00 - ${count} users`}
                  />
                  {hour % 4 === 0 && <span style={{ fontSize: '9px', color: colors.text.muted, marginTop: '4px' }}>{hour}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </Grid>
    </>
  );
}

// Helper Components
function FunnelRow({ label, value, percentage, color }: { label: string; value: number; percentage: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: colors.text.primary }}>{label}</span>
        <span style={{ color: colors.text.muted }}>{formatNumber(value)} ({percentage}%)</span>
      </div>
      <ProgressBar value={percentage} max={100} color={color} height={8} />
    </div>
  );
}

function MetricRow({ label, value, color = colors.text.primary }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: colors.text.secondary }}>{label}</span>
      <span style={{ color, fontSize: '16px', fontWeight: '600' }}>{value}</span>
    </div>
  );
}

function ActivityRow({ label, value, total, icon, color }: { label: string; value: number; total: number; icon: string; color: string }) {
  const pct = getPercentage(value, total);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ color: colors.text.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon} {label}
        </span>
        <span style={{ color: colors.text.muted }}>{value} ({pct}%)</span>
      </div>
      <ProgressBar value={value} max={total || 1} color={color} height={8} />
    </div>
  );
}
