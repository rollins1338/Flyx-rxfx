'use client';

/**
 * OverviewStats - OPTIMIZED
 * 
 * Uses ONLY unified stats context - no additional API calls
 * All data comes from StatsContext which is already fetched once
 */

import { useStats } from '../context/StatsContext';
import { 
  StatCard, 
  Grid, 
  Card, 
  ProgressBar,
  colors, 
  gradients,
  formatDurationMinutes,
  getPercentage,
} from './ui';

export default function OverviewStats() {
  const { stats, loading } = useStats();

  if (loading && !stats.lastUpdated) {
    return (
      <Grid cols="auto-fit" minWidth="200px" gap="20px">
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ 
            height: '120px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '12px', 
            animation: 'pulse 2s infinite' 
          }} />
        ))}
      </Grid>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Primary Metrics */}
      <Grid cols="auto-fit" minWidth="180px" gap="16px">
        <StatCard 
          title="Total Sessions" 
          value={stats.totalSessions} 
          icon="📊" 
          color={colors.primary}
          gradient={gradients.primary}
        />
        <StatCard 
          title="Watch Time" 
          value={formatDurationMinutes(stats.totalWatchTime)} 
          icon="⏱️" 
          color={colors.success}
          gradient={gradients.success}
        />
        <StatCard 
          title="Avg Session" 
          value={`${stats.avgSessionDuration}m`} 
          icon="📈" 
          color={colors.pink}
          gradient={gradients.pink}
        />
        <StatCard 
          title="Completion" 
          value={`${stats.completionRate}%`} 
          icon="✅" 
          color={colors.warning}
          gradient={gradients.warning}
        />
      </Grid>

      {/* Live Activity */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard 
          title="Live Users" 
          value={stats.liveUsers} 
          icon="🟢" 
          color={colors.success}
          pulse={stats.liveUsers > 0}
        />
        <StatCard 
          title="Live TV" 
          value={stats.liveTVViewers} 
          icon="📺" 
          color={colors.warning}
          pulse={stats.liveTVViewers > 0}
        />
        <StatCard title="DAU" value={stats.activeToday} icon="📊" color={colors.primary} />
        <StatCard title="WAU" value={stats.activeThisWeek} icon="📈" color={colors.info} />
        <StatCard title="MAU" value={stats.activeThisMonth} icon="📅" color={colors.purple} />
      </Grid>

      {/* User Metrics */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="New Today" value={stats.newUsersToday} icon="🆕" color={colors.success} />
        <StatCard title="Returning" value={stats.returningUsers} icon="🔄" color={colors.info} />
        <StatCard 
          title="Retention" 
          value={`${stats.activeToday > 0 ? Math.round((stats.returningUsers / stats.activeToday) * 100) : 0}%`} 
          icon="💪" 
          color={colors.purple} 
        />
        <StatCard title="Page Views" value={stats.pageViews} icon="👁️" color={colors.cyan} />
        <StatCard title="Visitors" value={stats.uniqueVisitors} icon="🧑‍💻" color={colors.pink} />
      </Grid>

      {/* Device & Geographic Distribution */}
      <Grid cols={2} gap="20px">
        <Card title="Device Distribution" icon="📱">
          {stats.deviceBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.deviceBreakdown.slice(0, 4).map((device) => {
                const total = stats.deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
                const icons: Record<string, string> = { desktop: '💻', mobile: '📱', tablet: '📲', unknown: '🖥️' };
                return (
                  <ProgressBar 
                    key={device.device}
                    label={`${icons[device.device] || '🖥️'} ${device.device || 'Unknown'}`}
                    value={device.count}
                    max={total}
                    gradient={gradients.mixed}
                    showLabel
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>
              No device data
            </div>
          )}
        </Card>

        <Card title="Top Countries" icon="🌍">
          {stats.topCountries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.topCountries.slice(0, 5).map((country) => {
                const total = stats.topCountries.reduce((sum, c) => sum + c.count, 0);
                return (
                  <div key={country.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: colors.text.primary, fontSize: '13px' }}>
                        {country.countryName || country.country}
                      </span>
                      <span style={{ color: colors.text.muted, fontSize: '12px' }}>
                        {country.count} ({getPercentage(country.count, total)}%)
                      </span>
                    </div>
                    <ProgressBar value={country.count} max={total} gradient={gradients.mixed} height={6} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: colors.text.muted, textAlign: 'center', padding: '20px' }}>
              No geographic data
            </div>
          )}
        </Card>
      </Grid>
    </div>
  );
}
