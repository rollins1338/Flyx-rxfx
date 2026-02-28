'use client';

/**
 * LiveActivitySummary - Compact summary of real-time user activity
 * Uses RealtimeSlice context for SSE-based data
 */

import { useRealtimeSlice } from '../context/slices';
import { colors, getPercentage } from './ui';

export default function LiveActivitySummary() {
  const realtime = useRealtimeSlice();
  const loading = realtime.loading;

  const total = realtime.data.liveUsers;
  const watching = realtime.data.watching;
  const livetv = realtime.data.livetv;
  const browsing = realtime.data.browsing;
  const peakToday = realtime.data.peakToday;
  const peakTime = realtime.data.peakTime;

  const formatPeakTime = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ 
            margin: 0, 
            color: colors.text.primary, 
            fontSize: '16px', 
            fontWeight: '600', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            Live Activity
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              background: total > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
              borderRadius: '12px',
              fontSize: '10px',
              color: total > 0 ? colors.success : colors.text.muted,
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                background: total > 0 ? colors.success : colors.text.muted,
                borderRadius: '50%',
                animation: total > 0 ? 'pulse 2s infinite' : 'none',
              }} />
              {total > 0 ? 'LIVE' : 'IDLE'}
            </span>
          </h3>
          <p style={{ margin: '4px 0 0 0', color: colors.text.muted, fontSize: '12px' }}>
            Real-time user activity breakdown
          </p>
        </div>
        {peakToday > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.text.muted, fontSize: '11px' }}>Peak today</div>
            <div style={{ color: colors.pink, fontSize: '16px', fontWeight: '700' }}>{peakToday}</div>
            {peakTime > 0 && (
              <div style={{ color: colors.text.muted, fontSize: '10px' }}>at {formatPeakTime(peakTime)}</div>
            )}
          </div>
        )}
      </div>

      {/* Main count */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'baseline', 
        gap: '8px', 
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'rgba(16, 185, 129, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      }}>
        <span style={{ fontSize: '36px', fontWeight: '700', color: colors.success }}>
          {loading ? '...' : total}
        </span>
        <span style={{ color: colors.text.secondary, fontSize: '14px' }}>users on site</span>
      </div>

      {/* Activity breakdown */}
      {total > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ActivityRow icon="▶️" label="Watching content" value={watching} total={total} color={colors.primary} />
          <ActivityRow icon="📺" label="Live TV" value={livetv} total={total} color={colors.warning} />
          <ActivityRow icon="🔍" label="Browsing" value={browsing} total={total} color={colors.info} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px', color: colors.text.muted, fontSize: '13px' }}>
          No active users right now
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function ActivityRow({ 
  icon, 
  label, 
  value, 
  total, 
  color 
}: { 
  icon: string; 
  label: string; 
  value: number; 
  total: number; 
  color: string;
}) {
  const percentage = getPercentage(value, total);
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '16px', width: '24px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: colors.text.primary, fontSize: '13px' }}>{label}</span>
          <span style={{ color: colors.text.primary, fontSize: '13px', fontWeight: '600' }}>
            {value} <span style={{ color: colors.text.muted, fontWeight: '400' }}>({percentage}%)</span>
          </span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            width: `${percentage}%`, 
            background: color, 
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
