'use client';

import OverviewStats from './components/OverviewStats';
import SystemStatus from './components/SystemStatus';
import AnalyticsCharts from './components/AnalyticsCharts';

export default function AdminOverviewPage() {
  return (
    <div>
      <div style={{
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h2 style={{
          margin: 0,
          color: '#f8fafc',
          fontSize: '24px',
          fontWeight: '600',
          letterSpacing: '-0.5px'
        }}>
          Dashboard Overview
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          color: '#94a3b8',
          fontSize: '16px'
        }}>
          Monitor your platform's performance and analytics
        </p>
      </div>

      <OverviewStats />

      <div style={{ marginTop: '32px' }}>
        <h3 style={{ color: '#f8fafc', marginBottom: '20px', fontSize: '18px' }}>System Status</h3>
        <SystemStatus />
      </div>

      <div style={{ marginTop: '32px' }}>
        <h3 style={{ color: '#f8fafc', marginBottom: '20px', fontSize: '18px' }}>Recent Trends</h3>
        <AnalyticsCharts />
      </div>
    </div>
  );
}