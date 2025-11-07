'use client';

import { useState, useEffect, useCallback } from 'react';

interface LiveActivity {
  id: string;
  userId: string;
  contentId: string;
  contentTitle: string;
  contentType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  action: 'started' | 'watching' | 'paused' | 'completed';
  progress: number;
  location: {
    country?: string;
    city?: string;
    ip: string;
  };
  device: {
    userAgent: string;
    platform?: string;
    browser?: string;
  };
  timestamp: string;
  duration: number;
}

interface LiveActivityStats {
  totalActivities: number;
  activeNow: number;
  uniqueUsers: number;
  topContent: Record<string, number>;
  topCountries: Record<string, number>;
  deviceBreakdown: Record<string, number>;
}

interface LiveActivityData {
  activities: LiveActivity[];
  stats: LiveActivityStats;
  timestamp: string;
  totalCount: number;
}

export default function LiveActivityTracker() {
  const [data, setData] = useState<LiveActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'recent'>('active');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLiveActivity = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/live-activity?type=${filter}&limit=100`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch live activity');
      }
    } catch (err) {
      setError('Network error while fetching live activity');
      console.error('Live activity fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial fetch
  useEffect(() => {
    fetchLiveActivity();
  }, [fetchLiveActivity]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchLiveActivity();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveActivity]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'started': return '#10b981';
      case 'watching': return '#3b82f6';
      case 'paused': return '#f59e0b';
      case 'completed': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'started':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <polygon points="10,8 16,12 10,16" fill="currentColor"/>
          </svg>
        );
      case 'watching':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
        );
      case 'paused':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="10" y1="15" x2="10" y2="9" stroke="currentColor" strokeWidth="2"/>
            <line x1="14" y1="15" x2="14" y2="9" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      case 'completed':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(15, 15, 35, 0.6)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid rgba(120, 119, 198, 0.3)',
            borderTop: '3px solid #7877c6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ color: '#e2e8f0', fontSize: '16px' }}>Loading live activity...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fca5a5', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            Failed to Load Live Activity
          </div>
          <div style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchLiveActivity();
            }}
            style={{
              padding: '8px 16px',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(15, 15, 35, 0.6)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div>
          <h3 style={{
            margin: '0 0 4px 0',
            color: '#f8fafc',
            fontSize: '20px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              animation: 'pulse 2s infinite'
            }}></div>
            Live Activity Tracker
          </h3>
          <p style={{
            margin: 0,
            color: '#94a3b8',
            fontSize: '14px'
          }}>
            Real-time monitoring • Last updated {data ? formatTimeAgo(data.timestamp) : 'Never'}
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'active', label: 'Active Now' },
              { key: 'recent', label: 'Recent' },
              { key: 'all', label: 'All' }
            ].map((filterOption) => (
              <button
                key={filterOption.key}
                onClick={() => setFilter(filterOption.key as any)}
                style={{
                  padding: '6px 12px',
                  background: filter === filterOption.key 
                    ? 'rgba(120, 119, 198, 0.2)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  color: filter === filterOption.key ? '#7877c6' : '#94a3b8',
                  border: filter === filterOption.key 
                    ? '1px solid rgba(120, 119, 198, 0.3)' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                {filterOption.label}
              </button>
            ))}
          </div>
          
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '6px 12px',
              background: autoRefresh 
                ? 'rgba(16, 185, 129, 0.2)' 
                : 'rgba(255, 255, 255, 0.05)',
              color: autoRefresh ? '#10b981' : '#94a3b8',
              border: autoRefresh 
                ? '1px solid rgba(16, 185, 129, 0.3)' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              animation: autoRefresh ? 'pulse 2s infinite' : 'none'
            }}></div>
            Auto-refresh
          </button>
          
          {/* Manual refresh */}
          <button
            onClick={fetchLiveActivity}
            style={{
              padding: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#94a3b8',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 16H3v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {data && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>
              {data.stats.activeNow}
            </div>
            <div style={{ color: '#6ee7b7', fontSize: '12px', fontWeight: '500' }}>
              Active Now
            </div>
          </div>
          
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>
              {data.stats.uniqueUsers}
            </div>
            <div style={{ color: '#93c5fd', fontSize: '12px', fontWeight: '500' }}>
              Unique Users
            </div>
          </div>
          
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: '700' }}>
              {data.stats.totalActivities}
            </div>
            <div style={{ color: '#c4b5fd', fontSize: '12px', fontWeight: '500' }}>
              Total Activities
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        background: 'rgba(0, 0, 0, 0.2)'
      }}>
        {data && data.activities.length > 0 ? (
          <div style={{ padding: '16px' }}>
            {data.activities.map((activity, index) => (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 0',
                  borderBottom: index < data.activities.length - 1 
                    ? '1px solid rgba(255, 255, 255, 0.05)' 
                    : 'none'
                }}
              >
                {/* Status indicator */}
                <div style={{
                  color: getActionColor(activity.action),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '24px'
                }}>
                  {getActionIcon(activity.action)}
                </div>
                
                {/* Content info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: '#f8fafc',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {activity.contentTitle}
                    {activity.contentType === 'tv' && activity.season && activity.episode && (
                      <span style={{ color: '#94a3b8', fontWeight: '400' }}>
                        {' '}S{activity.season}E{activity.episode}
                      </span>
                    )}
                  </div>
                  <div style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ textTransform: 'capitalize' }}>{activity.action}</span>
                    {activity.progress > 0 && (
                      <>
                        <span>•</span>
                        <span>{activity.progress}%</span>
                      </>
                    )}
                    {activity.duration > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatDuration(activity.duration)}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Location & Device */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '2px',
                  minWidth: '120px'
                }}>
                  <div style={{
                    color: '#e2e8f0',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>🌍</span>
                    <span>{activity.location.country}</span>
                  </div>
                  <div style={{
                    color: '#94a3b8',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>💻</span>
                    <span>{activity.device.platform}</span>
                  </div>
                </div>
                
                {/* Timestamp */}
                <div style={{
                  color: '#6b7280',
                  fontSize: '11px',
                  minWidth: '60px',
                  textAlign: 'right'
                }}>
                  {formatTimeAgo(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: '#94a3b8'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📺</div>
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
              No {filter === 'active' ? 'active' : filter === 'recent' ? 'recent' : ''} activity
            </div>
            <div style={{ fontSize: '14px' }}>
              {filter === 'active' 
                ? 'No users are currently watching content'
                : filter === 'recent'
                ? 'No activity in the last hour'
                : 'No activity recorded yet'
              }
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}