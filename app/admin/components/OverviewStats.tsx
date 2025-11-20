'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Eye, Clock, Users, Activity } from 'lucide-react';

interface Stats {
  totalViews: number;
  totalWatchTime: number;
  uniqueSessions: number;
  avgSessionDuration: number;
}

export default function OverviewStats() {
  const { dateRange, setIsLoading } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    try {
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
        setStats(data.data.overview);
      } else {
        setError('Failed to fetch statistics');
      }
    } catch (err) {
      setError('Network error');
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!stats && !error) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: '140px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            animation: 'pulse 2s infinite'
          }}></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#fca5a5',
        padding: '16px',
        borderRadius: '12px',
        textAlign: 'center',
        marginBottom: '32px',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }}>
        {error} <button onClick={fetchStats} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer' }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '24px',
      marginBottom: '32px'
    }}>
      <StatCard
        title="Total Views"
        value={stats?.totalViews.toLocaleString() || '0'}
        icon={<Eye size={24} />}
        color="#7877c6"
        gradient="linear-gradient(135deg, #7877c6 0%, #9333ea 100%)"
      />
      <StatCard
        title="Watch Time"
        value={stats ? `${Math.round(stats.totalWatchTime / 60)}h ${stats.totalWatchTime % 60}m` : '0m'}
        icon={<Clock size={24} />}
        color="#10b981"
        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
      />
      <StatCard
        title="Unique Sessions"
        value={stats?.uniqueSessions.toLocaleString() || '0'}
        icon={<Users size={24} />}
        color="#f59e0b"
        gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
      />
      <StatCard
        title="Avg Session"
        value={stats ? `${Math.round(stats.avgSessionDuration)}m` : '0m'}
        icon={<Activity size={24} />}
        color="#ff77c6"
        gradient="linear-gradient(135deg, #ff77c6 0%, #ec4899 100%)"
      />
    </div>
  );
}

function StatCard({ title, value, icon, color, gradient }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
      transition: 'all 0.3s ease'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = `0 12px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px ${color}20`;
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: gradient
      }}></div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: gradient,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: `0 4px 12px ${color}40`
        }}>
          {icon}
        </div>
        <h3 style={{
          margin: 0,
          color: '#94a3b8',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {title}
        </h3>
      </div>

      <div style={{
        fontSize: '32px',
        fontWeight: '700',
        color: '#f8fafc',
        lineHeight: '1'
      }}>
        {value}
      </div>
    </div>
  );
}