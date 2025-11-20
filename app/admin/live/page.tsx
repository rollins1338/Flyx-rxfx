'use client';

import LiveActivityTracker from '../components/LiveActivityTracker';

export default function AdminLivePage() {
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
          Live Activity
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          color: '#94a3b8',
          fontSize: '16px'
        }}>
          Monitor real-time user activity and sessions
        </p>
      </div>

      <LiveActivityTracker />
    </div>
  );
}
