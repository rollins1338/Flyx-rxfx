'use client';

import { useState, useEffect } from 'react';
import styles from './users.module.css';

interface UserMetrics {
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  returningUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  retentionRate: number;
  avgSessionsPerUser: number;
  totalActiveUsers: number;
}

interface Growth {
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  sessions: number;
}

interface DailyMetric {
  date: string;
  daily_active_users: number;
  new_users: number;
  returning_users: number;
  total_sessions: number;
  total_watch_time: number;
  avg_session_duration: number;
  unique_content_views: number;
}

export default function UsersPage() {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/user-metrics?days=${timeRange}&includeDaily=true`
      );
      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
        setGrowth(data.growth);
        setDailyMetrics(data.dailyMetrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch user metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatGrowth = (growth: number) => {
    const sign = growth > 0 ? '+' : '';
    return `${sign}${growth}%`;
  };

  const getGrowthClass = (growth: number) => {
    if (growth > 0) return styles.positive;
    if (growth < 0) return styles.negative;
    return styles.neutral;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading user metrics...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>User Analytics</h1>
        <div className={styles.timeRangeSelector}>
          <button
            className={timeRange === 7 ? styles.active : ''}
            onClick={() => setTimeRange(7)}
          >
            7 Days
          </button>
          <button
            className={timeRange === 30 ? styles.active : ''}
            onClick={() => setTimeRange(30)}
          >
            30 Days
          </button>
          <button
            className={timeRange === 90 ? styles.active : ''}
            onClick={() => setTimeRange(90)}
          >
            90 Days
          </button>
        </div>
      </div>

      {metrics && growth && (
        <>
          {/* Key Metrics */}
          <div className={styles.section}>
            <h2>Active Users</h2>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Daily Active Users</div>
                <div className={styles.metricValue}>{formatNumber(metrics.dau)}</div>
                <div className={`${styles.metricGrowth} ${getGrowthClass(growth.dau)}`}>
                  {formatGrowth(growth.dau)} vs previous period
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Weekly Active Users</div>
                <div className={styles.metricValue}>{formatNumber(metrics.wau)}</div>
                <div className={`${styles.metricGrowth} ${getGrowthClass(growth.wau)}`}>
                  {formatGrowth(growth.wau)} vs previous period
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Monthly Active Users</div>
                <div className={styles.metricValue}>{formatNumber(metrics.mau)}</div>
                <div className={`${styles.metricGrowth} ${getGrowthClass(growth.mau)}`}>
                  {formatGrowth(growth.mau)} vs previous period
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total Active Users</div>
                <div className={styles.metricValue}>{formatNumber(metrics.totalActiveUsers)}</div>
                <div className={styles.metricSubtext}>
                  In last {timeRange} days
                </div>
              </div>
            </div>
          </div>

          {/* User Growth */}
          <div className={styles.section}>
            <h2>User Growth</h2>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>New Users</div>
                <div className={styles.metricValue}>{formatNumber(metrics.newUsers)}</div>
                <div className={`${styles.metricGrowth} ${getGrowthClass(growth.newUsers)}`}>
                  {formatGrowth(growth.newUsers)} vs previous period
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Returning Users</div>
                <div className={styles.metricValue}>{formatNumber(metrics.returningUsers)}</div>
                <div className={styles.metricSubtext}>
                  {metrics.retentionRate}% retention rate
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Retention Rate</div>
                <div className={styles.metricValue}>{metrics.retentionRate}%</div>
                <div className={styles.metricSubtext}>
                  Returning / Total Active
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>New vs Returning</div>
                <div className={styles.metricValue}>
                  {metrics.returningUsers > metrics.newUsers ? 'Returning' : 'New'}
                </div>
                <div className={styles.metricSubtext}>
                  {Math.round((Math.max(metrics.returningUsers, metrics.newUsers) / 
                    (metrics.returningUsers + metrics.newUsers)) * 100)}% of total
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className={styles.section}>
            <h2>Engagement</h2>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Total Sessions</div>
                <div className={styles.metricValue}>{formatNumber(metrics.totalSessions)}</div>
                <div className={`${styles.metricGrowth} ${getGrowthClass(growth.sessions)}`}>
                  {formatGrowth(growth.sessions)} vs previous period
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Avg Sessions per User</div>
                <div className={styles.metricValue}>{metrics.avgSessionsPerUser}</div>
                <div className={styles.metricSubtext}>
                  Per active user
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Avg Session Duration</div>
                <div className={styles.metricValue}>
                  {formatDuration(metrics.avgSessionDuration)}
                </div>
                <div className={styles.metricSubtext}>
                  Per session
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>DAU/MAU Ratio</div>
                <div className={styles.metricValue}>
                  {metrics.mau > 0 ? Math.round((metrics.dau / metrics.mau) * 100) : 0}%
                </div>
                <div className={styles.metricSubtext}>
                  Stickiness metric
                </div>
              </div>
            </div>
          </div>

          {/* Daily Breakdown */}
          {dailyMetrics.length > 0 && (
            <div className={styles.section}>
              <h2>Daily Breakdown (Last {Math.min(timeRange, dailyMetrics.length)} Days)</h2>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>DAU</th>
                      <th>New Users</th>
                      <th>Returning</th>
                      <th>Sessions</th>
                      <th>Avg Duration</th>
                      <th>Content Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyMetrics.slice(0, 30).map((day) => (
                      <tr key={day.date}>
                        <td>{new Date(day.date).toLocaleDateString()}</td>
                        <td>{formatNumber(day.daily_active_users)}</td>
                        <td>{formatNumber(day.new_users)}</td>
                        <td>{formatNumber(day.returning_users)}</td>
                        <td>{formatNumber(day.total_sessions)}</td>
                        <td>{formatDuration(day.avg_session_duration)}</td>
                        <td>{formatNumber(day.unique_content_views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Insights */}
          <div className={styles.section}>
            <h2>Insights</h2>
            <div className={styles.insightsGrid}>
              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>📈</div>
                <div className={styles.insightContent}>
                  <h3>User Growth</h3>
                  <p>
                    {growth.newUsers > 0 
                      ? `New user acquisition is up ${growth.newUsers}% compared to the previous period.`
                      : growth.newUsers < 0
                      ? `New user acquisition is down ${Math.abs(growth.newUsers)}%. Consider marketing initiatives.`
                      : 'New user acquisition is stable.'}
                  </p>
                </div>
              </div>

              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>🔄</div>
                <div className={styles.insightContent}>
                  <h3>Retention</h3>
                  <p>
                    {metrics.retentionRate >= 60
                      ? `Excellent retention rate of ${metrics.retentionRate}%. Users are coming back!`
                      : metrics.retentionRate >= 40
                      ? `Good retention rate of ${metrics.retentionRate}%. Room for improvement.`
                      : `Retention rate of ${metrics.retentionRate}% needs attention. Focus on engagement.`}
                  </p>
                </div>
              </div>

              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>⚡</div>
                <div className={styles.insightContent}>
                  <h3>Engagement</h3>
                  <p>
                    {metrics.avgSessionsPerUser >= 3
                      ? `High engagement with ${metrics.avgSessionsPerUser} sessions per user on average.`
                      : metrics.avgSessionsPerUser >= 1.5
                      ? `Moderate engagement with ${metrics.avgSessionsPerUser} sessions per user.`
                      : `Low engagement. Consider improving content discovery.`}
                  </p>
                </div>
              </div>

              <div className={styles.insightCard}>
                <div className={styles.insightIcon}>🎯</div>
                <div className={styles.insightContent}>
                  <h3>Stickiness</h3>
                  <p>
                    {metrics.mau > 0 && (metrics.dau / metrics.mau) >= 0.2
                      ? `Strong stickiness with ${Math.round((metrics.dau / metrics.mau) * 100)}% DAU/MAU ratio.`
                      : metrics.mau > 0 && (metrics.dau / metrics.mau) >= 0.1
                      ? `Moderate stickiness. Encourage daily usage with notifications.`
                      : `Low daily engagement. Focus on creating daily habits.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
