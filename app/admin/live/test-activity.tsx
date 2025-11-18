'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export default function TestLiveActivity() {
  const { getUserSession, updateActivity } = useAnalytics();
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    // Get session info
    const userSession = getUserSession();
    setSession(userSession);

    if (userSession) {
      setStatus('Session active');
      
      // Test sending activity
      updateActivity({
        type: 'browsing',
      });

      setStatus('Activity sent');
    } else {
      setStatus('No session found');
    }
  }, [getUserSession, updateActivity]);

  const testWatching = () => {
    updateActivity({
      type: 'watching',
      contentId: 'test-123',
      contentTitle: 'Test Movie',
      contentType: 'movie',
      currentPosition: 100,
      duration: 3600,
      quality: '1080p',
    });
    setStatus('Watching activity sent');
  };

  const testBrowsing = () => {
    updateActivity({
      type: 'browsing',
    });
    setStatus('Browsing activity sent');
  };

  return (
    <div style={{ padding: '2rem', color: 'white' }}>
      <h1>Live Activity Test</h1>
      
      <div style={{ marginTop: '1rem' }}>
        <strong>Status:</strong> {status}
      </div>

      {session && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Session Info:</strong>
          <pre style={{ background: '#222', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem' }}>
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={testBrowsing}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#e50914',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Test Browsing
        </button>

        <button
          onClick={testWatching}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#e50914',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Test Watching
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <p>Open browser console to see debug logs</p>
        <p>Then check <a href="/admin/live" style={{ color: '#e50914' }}>/admin/live</a> to see if activity appears</p>
      </div>
    </div>
  );
}
