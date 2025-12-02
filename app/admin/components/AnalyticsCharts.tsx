'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart
} from 'recharts';
import GeographicHeatmap from './GeographicHeatmap';

interface DailyMetric {
  date: string;
  views: number;
  watchTime: number;
  sessions: number;
}

interface AdvancedMetrics {
  uniqueViewers: number;
  avgSessionDuration: number;
  bounceRate: number;
  totalPageViews?: number;
  uniqueVisitors?: number;
  avgTimeOnSite?: number;
}

interface PeakHour {
  hour: number;
  count: number;
}

interface DeviceStat {
  deviceType: string;
  count: number;
  [key: string]: string | number;
}

interface GeoStat {
  country: string;
  countryName?: string;
  count: number;
  uniqueUsers?: number;
}

interface ContentStat {
  contentId: string;
  contentTitle: string;
  contentType: string;
  views: number;
  totalWatchTime: number;
  avgCompletion: number;
  uniqueViewers: number;
}

export default function AnalyticsCharts() {
  const { dateRange, setIsLoading } = useAdmin();
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedMetrics | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [devices, setDevices] = useState<DeviceStat[]>([]);
  const [geographic, setGeographic] = useState<GeoStat[]>([]);
  const [topContent, setTopContent] = useState<ContentStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);

  const fetchMetrics = async () => {
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
        setMetrics(data.data.dailyMetrics || []);
        setAdvanced(data.data.advancedMetrics || null);
        setPeakHours(data.data.peakHours || []);
        setDevices(data.data.deviceBreakdown || []);
        setGeographic(data.data.geographic || []);
        setTopContent(data.data.contentPerformance || []);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const COLORS = ['#7877c6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '12px 16px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}>
          <p style={{ color: '#f8fafc', margin: '0 0 8px 0', fontWeight: '600', fontSize: '13px' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, margin: '4px 0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
              {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '60px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid rgba(120, 119, 198, 0.3)',
          borderTopColor: '#7877c6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <div style={{ fontSize: '16px', color: '#94a3b8' }}>Loading analytics...</div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Calculate totals for summary
  const totalViews = metrics.reduce((sum, m) => sum + m.views, 0);
  const totalWatchTime = metrics.reduce((sum, m) => sum + m.watchTime, 0);
  const totalSessions = metrics.reduce((sum, m) => sum + m.sessions, 0);
  const avgViewsPerDay = metrics.length > 0 ? Math.round(totalViews / metrics.length) : 0;

  return (
    <div>
      {/* Summary Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <QuickStat label="Total Views" value={totalViews} icon="👁️" color="#7877c6" />
        <QuickStat label="Watch Time" value={`${Math.round(totalWatchTime / 60)}h`} icon="⏱️" color="#10b981" />
        <QuickStat label="Sessions" value={totalSessions} icon="🔄" color="#f59e0b" />
        <QuickStat label="Avg/Day" value={avgViewsPerDay} icon="📊" color="#3b82f6" />
        {advanced && (
          <>
            <QuickStat label="Bounce Rate" value={`${advanced.bounceRate}%`} icon="↩️" color="#ef4444" />
            <QuickStat label="Avg Session" value={`${advanced.avgSessionDuration}m`} icon="⏰" color="#ec4899" />
          </>
        )}
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Views, Sessions & Watch Time Over Time - Full Width */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: '380px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '16px', fontWeight: '600' }}>📈 Traffic Overview</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              <span style={{ color: '#7877c6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', background: '#7877c6', borderRadius: '2px' }} /> Views
              </span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} /> Sessions
              </span>
              <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }} /> Watch Time
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <ComposedChart data={metrics}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7877c6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7877c6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={11}
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              />
              <YAxis yAxisId="left" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Area yAxisId="left" type="monotone" dataKey="views" stroke="#7877c6" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" name="Views" />
              <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={2} dot={false} name="Sessions" />
              <Bar yAxisId="right" dataKey="watchTime" fill="#f59e0b" opacity={0.6} name="Watch Time (min)" radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Second Row - Device & Peak Hours */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Device Breakdown - Donut Chart */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: '320px'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>📱 Device Distribution</h3>
          {devices.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={devices}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="deviceType"
                >
                  {devices.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'capitalize' }}>{value || 'Unknown'}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', color: '#64748b' }}>
              No device data available
            </div>
          )}
        </div>

        {/* Peak Hours - Bar Chart */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: '320px'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>🕐 Peak Viewing Hours</h3>
          {peakHours.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis 
                  dataKey="hour" 
                  stroke="#64748b" 
                  fontSize={10}
                  tickFormatter={(hour) => `${hour}h`}
                />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Views" radius={[4, 4, 0, 0]}>
                  {peakHours.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count === Math.max(...peakHours.map(h => h.count)) ? '#7877c6' : 'rgba(120, 119, 198, 0.4)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', color: '#64748b' }}>
              No hourly data available
            </div>
          )}
        </div>
      </div>

      {/* Third Row - Geographic & Top Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Geographic Distribution */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: '350px',
          overflow: 'hidden'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>🌍 Geographic Distribution</h3>
          <GeographicHeatmap data={geographic} />
        </div>

        {/* Top Content */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: '350px',
          overflow: 'hidden'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>🎬 Top Content</h3>
          <div style={{ height: 'calc(100% - 40px)', overflowY: 'auto' }}>
            {topContent.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topContent.slice(0, 8).map((content, index) => {
                  const maxViews = Math.max(...topContent.map(c => c.views));
                  const percentage = maxViews > 0 ? (content.views / maxViews) * 100 : 0;
                  return (
                    <div key={content.contentId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ 
                        color: index < 3 ? '#f59e0b' : '#64748b', 
                        fontSize: '12px', 
                        fontWeight: '600',
                        width: '20px'
                      }}>
                        #{index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          color: '#f8fafc', 
                          fontSize: '13px', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          marginBottom: '4px'
                        }}>
                          {content.contentTitle}
                        </div>
                        <div style={{ 
                          height: '4px', 
                          background: 'rgba(255,255,255,0.1)', 
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${percentage}%`, 
                            background: 'linear-gradient(90deg, #7877c6, #ec4899)',
                            borderRadius: '2px'
                          }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '60px' }}>
                        <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '600' }}>{content.views}</div>
                        <div style={{ color: '#64748b', fontSize: '10px' }}>{content.avgCompletion}% avg</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                No content data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Country Breakdown Table */}
      {geographic.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>🗺️ Viewers by Country</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {geographic.slice(0, 12).map((geo) => {
              const total = geographic.reduce((sum, g) => sum + g.count, 0);
              const percentage = total > 0 ? Math.round((geo.count / total) * 100) : 0;
              return (
                <div key={geo.country} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <span style={{ fontSize: '20px' }}>{getCountryFlag(geo.country)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '500' }}>
                      {geo.countryName || geo.country}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>
                      {geo.count} users ({percentage}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderLeft: `3px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{label}</span>
      </div>
      <div style={{ color: '#f8fafc', fontSize: '22px', fontWeight: '700' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
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
