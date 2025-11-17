'use client';

import { useState, useEffect } from 'react';
import styles from './analytics.module.css';

interface WatchSession {
  id: string;
  content_id: string;
  content_type: string;
  content_title: string;
  season_number?: number;
  episode_number?: number;
  started_at: number;
  ended_at?: number;
  total_watch_time: number;
  last_position: number;
  duration: number;
  completion_percentage: number;
  quality?: string;
  device_type?: string;
  is_completed: boolean;
  pause_count: number;
  seek_count: number;
}

interface Analytics {
  totalSessions: number;
  totalWatchTime: number;
  averageWatchTime: number;
  averageCompletionRate: number;
  totalPauses: number;
  totalSeeks: number;
  completedSessions: number;
  completionRate: number;
  deviceBreakdown: Record<string, number>;
  qualityBreakdown: Record<string, number>;
}

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        'all': 0,
      };

      const startDate = ranges[timeRange] ? now - ranges[timeRange] : 0;
      const params = new URLSearchParams({
        limit: '100',
        ...(startDate && { startDate: startDate.toString() }),
      });

      const response = await fetch(`/api/analytics/watch-session?${params}`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Watch Session Analytics</h1>
        <div className={styles.timeRangeSelector}>
          <button
            className={timeRange === '24h' ? styles.active : ''}
            onClick={() => setTimeRange('24h')}
          >
            24 Hours
          </button>
          <button
            className={timeRange === '7d' ? styles.active : ''}
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </button>
          <button
            className={timeRange === '30d' ? styles.active : ''}
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </button>
          <button
            className={timeRange === 'all' ? styles.active : ''}
            onClick={() => setTimeRange('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {analytics && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>Total Sessions</h3>
            <p className={styles.statValue}>{analytics.totalSessions}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Watch Time</h3>
            <p className={styles.statValue}>{formatDuration(analytics.totalWatchTime)}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Avg Watch Time</h3>
            <p className={styles.statValue}>{formatDuration(analytics.averageWatchTime)}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Completion Rate</h3>
            <p className={styles.statValue}>{analytics.completionRate}%</p>
          </div>
          <div className={styles.statCard}>
            <h3>Avg Completion</h3>
            <p className={styles.statValue}>{analytics.averageCompletionRate}%</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Pauses</h3>
            <p className={styles.statValue}>{analytics.totalPauses}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Total Seeks</h3>
            <p className={styles.statValue}>{analytics.totalSeeks}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Completed</h3>
            <p className={styles.statValue}>{analytics.completedSessions}</p>
          </div>
        </div>
      )}

      {analytics && (
        <div className={styles.breakdownSection}>
          <div className={styles.breakdown}>
            <h3>Device Breakdown</h3>
            <div className={styles.breakdownList}>
              {Object.entries(analytics.deviceBreakdown).map(([device, count]) => (
                <div key={device} className={styles.breakdownItem}>
                  <span>{device}</span>
                  <span>{count} sessions</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.breakdown}>
            <h3>Quality Breakdown</h3>
            <div className={styles.breakdownList}>
              {Object.entries(analytics.qualityBreakdown).map(([quality, count]) => (
                <div key={quality} className={styles.breakdownItem}>
                  <span>{quality}</span>
                  <span>{count} sessions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.sessionsSection}>
        <h2>Recent Watch Sessions</h2>
        <div className={styles.tableContainer}>
          <table className={styles.sessionsTable}>
            <thead>
              <tr>
                <th>Content</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Watch Time</th>
                <th>Completion</th>
                <th>Device</th>
                <th>Quality</th>
                <th>Pauses</th>
                <th>Seeks</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <div className={styles.contentInfo}>
                      <strong>{session.content_title || session.content_id}</strong>
                      {session.season_number && session.episode_number && (
                        <small>S{session.season_number}E{session.episode_number}</small>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(session.started_at)}</td>
                  <td>{formatDuration(session.duration)}</td>
                  <td>{formatDuration(session.total_watch_time)}</td>
                  <td>
                    <span className={session.is_completed ? styles.completed : ''}>
                      {Math.round(session.completion_percentage)}%
                    </span>
                  </td>
                  <td>{session.device_type || 'unknown'}</td>
                  <td>{session.quality || 'auto'}</td>
                  <td>{session.pause_count}</td>
                  <td>{session.seek_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
