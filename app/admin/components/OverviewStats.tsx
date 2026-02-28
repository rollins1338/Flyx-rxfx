'use client';

/**
 * OverviewStats - Uses slice contexts (no StatsContext dependency)
 * All data comes from RealtimeSlice, UserSlice, ContentSlice, GeoSlice
 */

import { useRealtimeSlice, useUserSlice, useContentSlice, useGeoSlice } from '../context/slices';
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
  const realtime = useRealtimeSlice();
  const users = useUserSlice();
  const content = useContentSlice();
  const geo = useGeoSlice();

  const loading = realtime.loading && users.loading && content.loading;

  if (loading && !realtime.lastUpdate && !users.lastUpdate) {
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
          value={content.data.totalSessions} 
          icon="📊" 
          color={colors.primary}
          gradient={gradients.primary}
        />
        <StatCard 
          title="Watch Time" 
          value={formatDurationMinutes(content.data.totalWatchTime)} 
          icon="⏱️" 
          color={colors.success}
          gradient={gradients.success}
        />
        <StatCard 
          title="Avg Session" 
          value={`${content.data.avgSessionDuration}m`} 
          icon="📈" 
          color={colors.pink}
          gradient={gradients.pink}
        />
        <StatCard 
          title="Completion" 
          value={`${content.data.completionRate}%`} 
          icon="✅" 
          color={colors.warning}
          gradient={gradients.warning}
        />
      </Grid>

      {/* Live Activity */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard 
          title="Live Users" 
          value={realtime.data.liveUsers} 
          icon="🟢" 
          color={colors.success}
          pulse={realtime.data.liveUsers > 0}
        />
        <StatCard 
          title="Live TV" 
          value={realtime.data.livetv} 
          icon="📺" 
          color={colors.warning}
          pulse={realtime.data.livetv > 0}
        />
        <StatCard title="DAU" value={users.data.dau} icon="📊" color={colors.primary} />
        <StatCard title="WAU" value={users.data.wau} icon="📈" color={colors.info} />
        <StatCard title="MAU" value={users.data.mau} icon="📅" color={colors.purple} />
      </Grid>

      {/* User Metrics */}
      <Grid cols="auto-fit" minWidth="160px" gap="16px">
        <StatCard title="New Today" value={users.data.newToday} icon="🆕" color={colors.success} />
        <StatCard title="Returning" value={users.data.returningUsers} icon="🔄" color={colors.info} />
        <StatCard 
          title="Retention" 
          value={`${users.data.dau > 0 ? Math.round((users.data.returningUsers / users.data.dau) * 100) : 0}%`} 
          icon="💪" 
          color={colors.purple} 
        />
      </Grid>

      {/* Device & Geographic Distribution */}
      <Grid cols={2} gap="20px">
        <Card title="Device Distribution" icon="📱">
          {users.data.deviceBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users.data.deviceBreakdown.slice(0, 4).map((device) => {
                const total = users.data.deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
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
          {geo.data.topCountries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {geo.data.topCountries.slice(0, 5).map((country) => {
                const total = geo.data.topCountries.reduce((sum, c) => sum + c.count, 0);
                return (
                  <div key={country.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: colors.text.primary, fontSize: '13px' }}>
                        {country.name || country.country}
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
