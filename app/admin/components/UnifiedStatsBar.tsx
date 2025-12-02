'use client';

/**
 * Unified Stats Bar
 * Displays consistent real-time stats across all admin pages
 * Uses the StatsContext for single source of truth
 */

import { useStats } from '../context/StatsContext';

export default function UnifiedStatsBar() {
  const { stats, loading, lastRefresh, refresh } = useStats();

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '12px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '24px',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Left side - Key metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Live Users */}
        <StatItem
          icon="🟢"
          label="Live Now"
          value={stats.liveUsers}
          loading={loading}
          pulse={stats.liveUsers > 0}
          color="#10b981"
        />
        
        {/* DAU */}
        <StatItem
          icon="📊"
          label="Today (DAU)"
          value={stats.activeToday}
          loading={loading}
          color="#7877c6"
        />
        
        {/* WAU */}
        <StatItem
          icon="📈"
          label="This Week"
          value={stats.activeThisWeek}
          loading={loading}
          color="#f59e0b"
        />
        
        {/* Sessions Today */}
        <StatItem
          icon="▶️"
          label="Sessions"
          value={stats.totalSessions}
          loading={loading}
          color="#3b82f6"
        />
        
        {/* Watch Time */}
        <StatItem
          icon="⏱️"
          label="Watch Time"
          value={`${stats.totalWatchTime}m`}
          loading={loading}
          color="#ec4899"
        />
      </div>

      {/* Right side - Last updated & refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#64748b', fontSize: '11px' }}>
          {lastRefresh 
            ? `Updated ${lastRefresh.toLocaleTimeString()}`
            : 'Loading...'
          }
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#94a3b8',
            fontSize: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <span style={{ 
            display: 'inline-block',
            animation: loading ? 'spin 1s linear infinite' : 'none'
          }}>
            🔄
          </span>
          Refresh
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function StatItem({ 
  icon, 
  label, 
  value, 
  loading, 
  pulse = false,
  color = '#94a3b8'
}: { 
  icon: string; 
  label: string; 
  value: string | number; 
  loading: boolean;
  pulse?: boolean;
  color?: string;
}) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '6px 12px',
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      <span style={{ 
        fontSize: '14px',
        position: 'relative',
      }}>
        {icon}
        {pulse && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '6px',
            height: '6px',
            background: '#10b981',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
          }} />
        )}
      </span>
      <div>
        <div style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
        <div style={{ 
          color: color, 
          fontSize: '16px', 
          fontWeight: '700',
          opacity: loading ? 0.5 : 1,
        }}>
          {loading ? '...' : (typeof value === 'number' ? value.toLocaleString() : value)}
        </div>
      </div>
    </div>
  );
}
