'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import {
  AreaChart,
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
  Legend
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
}

interface PeakHour {
  hour: number;
  count: number;
}

interface DeviceStat {
  deviceType: string;
  count: number;
  [key: string]: any;
}

interface GeoStat {
  country: string;
  count: number;
}

export default function AnalyticsCharts() {
  const { dateRange, setIsLoading } = useAdmin();
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedMetrics | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [devices, setDevices] = useState<DeviceStat[]>([]);
  const [geographic, setGeographic] = useState<GeoStat[]>([]);
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
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
        }}>
          <p style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontWeight: '600' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, margin: '4px 0', fontSize: '13px' }}>
              {entry.name}: {entry.value.toLocaleString()}
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
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '40px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ fontSize: '18px', color: '#94a3b8' }}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Advanced Metrics Cards */}
      {advanced && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          <MetricCard
            title="Unique Viewers"
            value={advanced.uniqueViewers.toLocaleString()}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            color="#3b82f6"
          />
          <MetricCard
            title="Avg. Session Duration"
            value={`${advanced.avgSessionDuration}m`}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            color="#10b981"
          />
          <MetricCard
            title="Bounce Rate"
            value={`${advanced.bounceRate}%`}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            }
            color="#f59e0b"
          />
        </div>
      )}

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Views Over Time */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          height: '400px'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '20px', fontSize: '18px' }}>Views & Watch Time</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWatchTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              />
              <YAxis yAxisId="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="views" stroke="#8884d8" fillOpacity={1} fill="url(#colorViews)" name="Views" />
              <Area yAxisId="right" type="monotone" dataKey="watchTime" stroke="#82ca9d" fillOpacity={1} fill="url(#colorWatchTime)" name="Watch Time (m)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Device Breakdown */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          height: '400px'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '20px', fontSize: '18px' }}>Device Breakdown</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={devices}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="count"
                nameKey="deviceType"
              >
                {devices.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Peak Hours */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          height: '350px'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '20px', fontSize: '18px' }}>Peak Viewing Hours</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="hour" stroke="#94a3b8" tickFormatter={(hour) => `${hour}:00`} />
              <YAxis stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#8884d8" name="Views" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Geographic Heatmap */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          height: '350px',
          overflow: 'hidden'
        }}>
          <h3 style={{ color: '#f8fafc', marginBottom: '20px', fontSize: '18px' }}>Geographic Distribution</h3>
          <GeographicHeatmap data={geographic} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: `${color}20`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '4px' }}>{title}</div>
        <div style={{ color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>{value}</div>
      </div>
    </div>
  );
}