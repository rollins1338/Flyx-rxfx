'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useStats } from '../context/StatsContext';

// Use unified stats for key metrics - SINGLE SOURCE OF TRUTH

// Helper function to get country flag emoji
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'Unknown' || countryCode === 'Local') return '🌍';
  if (countryCode.length !== 2) return '📍';
  
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌍';
  }
}

// Helper function to get country name from ISO code
function getCountryNameFromCode(code: string): string {
  if (!code || code === 'Unknown' || code === 'Local') return code;
  if (code.length !== 2) return code;
  
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

interface UserStat {
  userId: string;
  username: string;
  email: string;
  image: string;
  totalSessions: number;
  totalWatchTime: number;
  lastActive: number;
  country: string;
  city?: string;
  deviceType?: string;
}

interface UserMetrics {
  totalUsers: number;
  activeToday: number;
  activeThisWeek: number;
  avgWatchTimePerUser: number;
  topDevices: Array<{ device: string; count: number }>;
  engagementRate: number;
}

export default function AdminUsersPage() {
  const { dateRange, setIsLoading } = useAdmin();
  // Use unified stats for key metrics - SINGLE SOURCE OF TRUTH
  const { stats: unifiedStats } = useStats();
  
  const [users, setUsers] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'lastActive' | 'watchTime' | 'sessions'>('lastActive');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [localDevices, setLocalDevices] = useState<Array<{ device: string; count: number }>>([]);

  // Key metrics from unified stats - SINGLE SOURCE OF TRUTH
  const metrics: UserMetrics = {
    totalUsers: unifiedStats.totalUsers,
    activeToday: unifiedStats.activeToday,
    activeThisWeek: unifiedStats.activeThisWeek,
    avgWatchTimePerUser: unifiedStats.totalUsers > 0 
      ? Math.round(unifiedStats.totalWatchTime / unifiedStats.totalUsers) 
      : 0,
    topDevices: unifiedStats.deviceBreakdown.length > 0 
      ? unifiedStats.deviceBreakdown.slice(0, 5) 
      : localDevices,
    engagementRate: unifiedStats.totalUsers > 0 
      ? Math.round((unifiedStats.activeThisWeek / unifiedStats.totalUsers) * 100) 
      : 0,
  };

  useEffect(() => {
    fetchUserData();
  }, [dateRange]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setIsLoading(true);
      const params = new URLSearchParams();
      if (dateRange.startDate && dateRange.endDate) {
        params.append('startDate', dateRange.startDate.toISOString());
        params.append('endDate', dateRange.endDate.toISOString());
      } else {
        params.append('period', dateRange.period);
      }

      const response = await fetch(`/api/admin/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        const usersData = data.data.usersStats || [];
        const devices = data.data.deviceBreakdown || [];
        setUsers(usersData);
        // Store devices as fallback if unified stats don't have them
        setLocalDevices(devices.slice(0, 5).map((d: { deviceType: string; count: number }) => ({ device: d.deviceType, count: d.count })));
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const isOnline = (lastActive: number) => Date.now() - lastActive < 5 * 60 * 1000;

  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u => u.username?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query) || u.userId?.toLowerCase().includes(query));
    }
    if (filterStatus === 'online') result = result.filter(u => isOnline(u.lastActive));
    else if (filterStatus === 'offline') result = result.filter(u => !isOnline(u.lastActive));

    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'lastActive': aVal = a.lastActive; bVal = b.lastActive; break;
        case 'watchTime': aVal = a.totalWatchTime; bVal = b.totalWatchTime; break;
        case 'sessions': aVal = a.totalSessions; bVal = b.totalSessions; break;
        default: aVal = a.lastActive; bVal = b.lastActive;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [users, searchQuery, filterStatus, sortBy, sortOrder]);

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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading user analytics...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>User Analytics & Management</h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>Comprehensive user behavior analysis and engagement metrics</p>
      </div>

      {/* Key metrics from unified stats - SINGLE SOURCE OF TRUTH */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard title="Total Users" value={metrics.totalUsers} icon="👥" color="#7877c6" />
        <MetricCard title="Active Today" value={metrics.activeToday} icon="🟢" color="#10b981" subtitle="Last 24h (DAU)" />
        <MetricCard title="Active This Week" value={metrics.activeThisWeek} icon="📊" color="#f59e0b" subtitle="WAU" />
        <MetricCard title="Avg Watch Time" value={`${metrics.avgWatchTimePerUser}m`} icon="⏱️" color="#ec4899" subtitle="Per user" />
        <MetricCard title="Engagement Rate" value={`${metrics.engagementRate}%`} icon="📈" color="#3b82f6" subtitle="Weekly active" />
        <MetricCard title="Online Now" value={unifiedStats.liveUsers} icon="🔴" color="#ef4444" pulse />
      </div>

      {metrics.topDevices.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>User Devices</h3>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {metrics.topDevices.map((device) => {
              const total = metrics.topDevices.reduce((sum, d) => sum + d.count, 0);
              const percentage = total > 0 ? Math.round((device.count / total) * 100) : 0;
              return (
                <div key={device.device} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{device.device === 'desktop' ? '💻' : device.device === 'mobile' ? '📱' : device.device === 'tablet' ? '📲' : '🖥️'}</span>
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: '600', textTransform: 'capitalize' }}>{device.device || 'Unknown'}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{device.count} users ({percentage}%)</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none' }} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} style={selectStyle}>
          <option value="all">All Users</option>
          <option value="online">Online Only</option>
          <option value="offline">Offline Only</option>
        </select>
        <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [field, order] = e.target.value.split('-'); setSortBy(field as typeof sortBy); setSortOrder(order as typeof sortOrder); }} style={selectStyle}>
          <option value="lastActive-desc">Last Active</option>
          <option value="watchTime-desc">Most Watch Time</option>
          <option value="sessions-desc">Most Sessions</option>
        </select>
      </div>

      <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px' }}>Users ({filteredUsers.length})</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Watch Time</th>
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>Country</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No users found</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.userId} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '14px' }}>{user.username?.substring(0, 2).toUpperCase() || '??'}</div>
                        <div>
                          <div style={{ color: '#f8fafc', fontWeight: '500' }}>{user.username || 'Anonymous'}</div>
                          <div style={{ color: '#64748b', fontSize: '12px' }}>{user.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline(user.lastActive) ? '#10b981' : '#64748b', boxShadow: isOnline(user.lastActive) ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none' }} />
                        <span style={{ color: isOnline(user.lastActive) ? '#10b981' : '#94a3b8', fontSize: '13px', fontWeight: '500' }}>{isOnline(user.lastActive) ? 'Online' : formatTimeAgo(user.lastActive)}</span>
                      </div>
                    </td>
                    <td style={tdStyle}><span style={{ color: '#f8fafc', fontWeight: '500' }}>{formatDuration(user.totalWatchTime)}</span></td>
                    <td style={tdStyle}><span style={{ color: '#f8fafc', fontWeight: '500' }}>{user.totalSessions}</span></td>
                    <td style={tdStyle}>
                      <span style={{ color: '#f8fafc' }}>
                        {user.country === 'Unknown' || !user.country || user.country.length !== 2
                          ? '🌍 N/A' 
                          : `${getCountryFlag(user.country)} ${getCountryNameFromCode(user.country)}`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle: React.CSSProperties = { padding: '14px 16px', color: '#e2e8f0', fontSize: '14px' };

function MetricCard({ title, value, icon, color, subtitle, pulse }: { title: string; value: string | number; icon: string; color: string; subtitle?: string; pulse?: boolean }) {
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px', position: 'relative' }}>{icon}{pulse && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{title}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {subtitle && <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>{subtitle}</div>}
      <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}
