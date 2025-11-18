'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

export default function LiveActivityDebug() {
  const { getUserSession, updateActivity } = useAnalytics();
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState('Initializing...');
  const [apiTest, setApiTest] = useState<any>(null);

  useEffect(() => {
    // Get session info
    const userSession = getUserSession();
    setSession(userSession);

    if (userSession) {
      setStatus('✅ Session active');
      
      // Test sending activity
      updateActivity({
        type: 'browsing',
      });

      setStatus('✅ Activity sent - check console');
    } else {
      setStatus('❌ No session found');
    }

    // Test API directly
    testAPI();
  }, []);

  const testAPI = async () => {
    try {
      // Test GET
      const getResponse = await fetch('/api/analytics/live-activity?maxAge=5');
      const getData = await getResponse.json();
      
      setApiTest({
        get: {
          status: getResponse.status,
          data: getData,
        },
      });
    } catch (error) {
      setApiTest({
        error: String(error),
      });
    }
  };

  const testWatching = async () => {
    updateActivity({
      type: 'watching',
      contentId: 'test-123',
      contentTitle: 'Test Movie',
      contentType: 'movie',
      currentPosition: 100,
      duration: 3600,
      quality: '1080p',
    });
    setStatus('✅ Watching activity sent');
    
    // Refresh API test after a second
    setTimeout(testAPI, 1000);
  };

  const testBrowsing = async () => {
    updateActivity({
      type: 'browsing',
    });
    setStatus('✅ Browsing activity sent');
    
    // Refresh API test after a second
    setTimeout(testAPI, 1000);
  };

  return (
    <div style={{ padding: '2rem', color: 'white', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🔍 Live Activity Debug</h1>
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2>Status</h2>
        <div style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>{status}</div>
      </div>

      {session && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
          <h2>Session Info</h2>
          <pre style={{ background: '#0a0a0a', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem', overflow: 'auto' }}>
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2>Test Actions</h2>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={testBrowsing}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#e50914',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Send Browsing Activity
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
              fontSize: '1rem',
            }}
          >
            Send Watching Activity
          </button>

          <button
            onClick={testAPI}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#333',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Refresh API Test
          </button>
        </div>
      </div>

      {apiTest && (
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
          <h2>API Test Results</h2>
          <pre style={{ background: '#0a0a0a', padding: '1rem', borderRadius: '4px', marginTop: '0.5rem', overflow: 'auto' }}>
            {JSON.stringify(apiTest, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
        <h2>Instructions</h2>
        <ol style={{ lineHeight: '1.8' }}>
          <li>Open browser console (F12) to see debug logs</li>
          <li>Click "Send Browsing Activity" or "Send Watching Activity"</li>
          <li>Check console for "[Analytics]" logs</li>
          <li>Check "API Test Results" to see if activities are stored</li>
          <li>Go to <a href="/admin/live" style={{ color: '#e50914' }}>/admin/live</a> to see if activity appears</li>
        </ol>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#2a1a1a', borderRadius: '8px', border: '1px solid #e50914' }}>
        <h2>⚠️ Troubleshooting</h2>
        <ul style={{ lineHeight: '1.8' }}>
          <li>If no session: Analytics not initialized</li>
          <li>If API returns empty: Database not set up or activities expired</li>
          <li>If console shows errors: Check network tab for failed requests</li>
          <li>If activities don't appear in /admin/live: Check maxAge parameter (default 5 minutes)</li>
        </ul>
      </div>
    </div>
  );
}
