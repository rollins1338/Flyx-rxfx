'use client';

/**
 * Admin Overview Page - OPTIMIZED
 * 
 * Uses unified stats context - no additional API calls
 * All components share the same data source
 */

import OverviewStats from './components/OverviewStats';
import LiveActivitySummary from './components/LiveActivitySummary';
import { useStats } from './context/StatsContext';
import { colors, formatTimeAgo } from './components/ui';

export default function AdminOverviewPage() {
  const { lastRefresh, loading } = useStats();

  return (
    <div>
      <div style={{
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{
              margin: 0,
              color: colors.text.primary,
              fontSize: '24px',
              fontWeight: '600',
              letterSpacing: '-0.5px'
            }}>
              Dashboard Overview
            </h2>
            <p style={{
              margin: '8px 0 0 0',
              color: colors.text.secondary,
              fontSize: '16px'
            }}>
              Monitor your platform's performance and analytics
            </p>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            color: colors.text.muted,
            fontSize: '12px'
          }}>
            {loading && (
              <span style={{ 
                width: '12px', 
                height: '12px', 
                border: '2px solid rgba(120, 119, 198, 0.3)',
                borderTopColor: colors.primary,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            )}
            {lastRefresh && `Updated ${formatTimeAgo(lastRefresh.getTime())}`}
          </div>
        </div>
      </div>

      {/* Live Activity Summary - prominent position */}
      <div style={{ marginBottom: '24px' }}>
        <LiveActivitySummary />
      </div>

      {/* Overview Stats - all from unified context */}
      <OverviewStats />

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
