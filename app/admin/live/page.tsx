'use client';

import { useState, useEffect } from 'react';
import styles from './live.module.css';

interface LiveActivity {
  id: string;
  user_id: string;
  session_id: string;
  activity_type: string;
  content_id?: string;
  content_title?: string;
  content_type?: string;
  season_number?: number;
  episode_number?: number;
  current_position?: number;
  duration?: number;
  quality?: string;
  device_type?: string;
  country?: string;
  started_at: number;
  last_heartbeat: number;
  is_active: boolean;
}

interface LiveStats {
  totalActive: number;
  watching: number;
  browsing: number;
  byDevice: Record<string, number>;
  byCountry: Record<string, number>;
  topContent: Array<{
    contentId: string;
    contentTitle: string;
    contentType: string;
    count: number;
  }>;
}

export default function LiveActivityPage() {
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchLiveActivity();

    if (autoRefresh) {
      const interval = setInterval(fetchLiveActivity, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchLiveActivity = async () => {
    try {
      const response = await fetch('/api/analytics/live-activity?maxAge=5');
      const data = await response.json();

      if (data.success) {
        setActivities(data.activities);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch live activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (position: number, duration: number) => {
    if (!duration) return 0;
    return Math.round((position / duration) * 100);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading live activity...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Live Activity</h1>
          <p className={styles.subtitle}>Real-time user activity monitoring</p>
        </div>
        <div className={styles.controls}>
          <button
            className={`${styles.refreshButton} ${autoRefresh ? styles.active : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '⏸ Pause' : '▶ Resume'} Auto-refresh
          </button>
          <button className={styles.refreshButton} onClick={fetchLiveActivity}>
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* Summary Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.totalActive}</div>
                <div className={styles.statLabel}>Active Users</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>▶️</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.watching}</div>
                <div className={styles.statLabel}>Watching Now</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>🔍</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.browsing}</div>
                <div className={styles.statLabel}>Browsing</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>📱</div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>
                  {Object.keys(stats.byDevice).length}
                </div>
                <div className={styles.statLabel}>Device Types</div>
              </div>
            </div>
          </div>

          {/* Device & Country Breakdown */}
          <div className={styles.breakdownSection}>
            <div className={styles.breakdown}>
              <h3>By Device</h3>
              <div className={styles.breakdownList}>
                {Object.entries(stats.byDevice).map(([device, count]) => (
                  <div key={device} className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>{device}</span>
                    <div className={styles.breakdownBar}>
                      <div
                        className={styles.breakdownBarFill}
                        style={{
                          width: `${(count / stats.totalActive) * 100}%`,
                        }}
                      />
                    </div>
                    <span className={styles.breakdownValue}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.breakdown}>
              <h3>By Country</h3>
              <div className={styles.breakdownList}>
                {Object.entries(stats.byCountry).slice(0, 5).map(([country, count]) => (
                  <div key={country} className={styles.breakdownItem}>
                    <span className={styles.breakdownLabel}>{country}</span>
                    <div className={styles.breakdownBar}>
                      <div
                        className={styles.breakdownBarFill}
                        style={{
                          width: `${(count / stats.totalActive) * 100}%`,
                        }}
                      />
                    </div>
                    <span className={styles.breakdownValue}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Content */}
          {stats.topContent.length > 0 && (
            <div className={styles.section}>
              <h2>Most Watched Right Now</h2>
              <div className={styles.topContentGrid}>
                {stats.topContent.map((content) => (
                  <div key={content.contentId} className={styles.topContentCard}>
                    <div className={styles.topContentInfo}>
                      <div className={styles.topContentTitle}>
                        {content.contentTitle || content.contentId}
                      </div>
                      <div className={styles.topContentType}>
                        {content.contentType}
                      </div>
                    </div>
                    <div className={styles.topContentCount}>
                      {content.count} {content.count === 1 ? 'viewer' : 'viewers'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Live Activity List */}
      <div className={styles.section}>
        <h2>Active Sessions ({activities.length})</h2>
        {activities.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>😴</div>
            <p>No active users right now</p>
            <p className={styles.emptySubtext}>Check back later or wait for users to visit</p>
          </div>
        ) : (
          <div className={styles.activityList}>
            {activities.map((activity) => (
              <div key={activity.id} className={styles.activityCard}>
                <div className={styles.activityHeader}>
                  <div className={styles.activityStatus}>
                    <span className={`${styles.statusDot} ${styles.active}`} />
                    <span className={styles.activityType}>
                      {activity.activity_type === 'watching' ? '▶️ Watching' : '🔍 Browsing'}
                    </span>
                  </div>
                  <div className={styles.activityTime}>
                    {formatTime(activity.last_heartbeat)}
                  </div>
                </div>

                {activity.content_title && (
                  <div className={styles.activityContent}>
                    <div className={styles.contentTitle}>
                      {activity.content_title}
                    </div>
                    {activity.season_number && activity.episode_number && (
                      <div className={styles.contentEpisode}>
                        S{activity.season_number}E{activity.episode_number}
                      </div>
                    )}
                    {activity.current_position !== undefined && activity.duration && (
                      <div className={styles.progressSection}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${getProgressPercentage(activity.current_position, activity.duration)}%`,
                            }}
                          />
                        </div>
                        <div className={styles.progressText}>
                          {formatDuration(activity.current_position)} / {formatDuration(activity.duration)}
                          {' '}({getProgressPercentage(activity.current_position, activity.duration)}%)
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.activityMeta}>
                  <span className={styles.metaItem}>
                    📱 {activity.device_type || 'unknown'}
                  </span>
                  {activity.quality && (
                    <span className={styles.metaItem}>
                      🎬 {activity.quality}
                    </span>
                  )}
                  {activity.country && (
                    <span className={styles.metaItem}>
                      🌍 {activity.country}
                    </span>
                  )}
                  <span className={styles.metaItem}>
                    ⏱️ Active for {formatTime(activity.started_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
