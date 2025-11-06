'use client';

import { useState, useEffect } from 'react';

interface Stats {
  totalViews: number;
  totalWatchTime: number;
  uniqueSessions: number;
  avgSessionDuration: number;
}

export default function OverviewStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/analytics?period=week');
      
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
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '28px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            animation: 'pulse 2s infinite'
          }}>
            <div style={{ 
              height: '24px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '6px', 
              marginBottom: '12px' 
            }}></div>
            <div style={{ 
              height: '36px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '6px' 
            }}></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#fca5a5',
        padding: '24px',
        borderRadius: '16px',
        textAlign: 'center',
        marginBottom: '32px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        backdropFilter: 'blur(20px)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#f87171' }}>Error Loading Statistics</h3>
        <p style={{ margin: '0 0 16px 0' }}>{error}</p>
        <button 
          onClick={fetchStats}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '40px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        marginBottom: '32px',
        backdropFilter: 'blur(20px)'
      }}>
        <h3 style={{ color: '#94a3b8', margin: 0 }}>No data available</h3>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '24px',
      marginBottom: '32px'
    }}>
      <StatCard 
        title="Total Views" 
        value={stats.totalViews.toLocaleString()} 
        icon={(
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          </svg>
        )}
        color="#7877c6"
        gradient="linear-gradient(135deg, #7877c6 0%, #9333ea 100%)"
      />
      <StatCard 
        title="Watch Time" 
        value={`${Math.round(stats.totalWatchTime / 60)}h ${stats.totalWatchTime % 60}m`}
        icon={(
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        color="#10b981"
        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
      />
      <StatCard 
        title="Unique Sessions" 
        value={stats.uniqueSessions.toLocaleString()}
        icon={(
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
            <path d="M23 21V19C23 18.1645 22.7155 17.3541 22.2094 16.7006C21.7033 16.047 20.9999 15.5866 20.2 15.3954" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 3.13C16.8003 3.32127 17.5037 3.78167 18.0098 4.43524C18.5159 5.08882 18.8004 5.89925 18.8004 6.735C18.8004 7.57075 18.5159 8.38118 18.0098 9.03476C17.5037 9.68833 16.8003 10.1487 16 10.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        color="#f59e0b"
        gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
      />
      <StatCard 
        title="Avg Session" 
        value={`${Math.round(stats.avgSessionDuration / 60)}m`}
        icon={(
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18 17L13 12L9 16L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
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
      padding: '28px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
      transition: 'all 0.3s ease',
      cursor: 'pointer'
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
      {/* Gradient accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: gradient
      }}></div>
      
      {/* Glowing orb effect */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        borderRadius: '50%',
        opacity: 0.6
      }}></div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '14px', 
        marginBottom: '12px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: gradient,
          borderRadius: '8px',
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
          fontSize: '13px', 
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {title}
        </h3>
      </div>
      
      <div style={{ 
        fontSize: '36px', 
        fontWeight: '700', 
        color: '#f8fafc',
        lineHeight: '1',
        position: 'relative',
        zIndex: 1,
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      }}>
        {value}
      </div>
    </div>
  );
}