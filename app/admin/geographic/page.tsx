'use client';

/**
 * Consolidated Geographic View
 *
 * Wires GeoSlice context for SSE-based real-time data.
 * Country and city distribution with real-time active users overlay.
 *
 * Requirements: 6.1, 6.2
 */

import { useState, useMemo } from 'react';
import { useGeoSlice } from '../context/slices';
import {
  colors,
  gradients,
  formatNumber,
  StatCard,
  Card,
  Grid,
  ProgressBar,
  TabSelector,
  PageHeader,
  LoadingState,
  EmptyState,
  getPercentage,
} from '../components/ui';

type TabId = 'countries' | 'cities' | 'realtime';

function getRegion(countryCode: string): string {
  const regions: Record<string, string[]> = {
    'North America': ['US', 'CA', 'MX'],
    'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT', 'CH', 'IE', 'PT'],
    'Asia Pacific': ['JP', 'KR', 'CN', 'IN', 'AU', 'NZ', 'SG', 'HK', 'TW', 'TH', 'MY', 'PH', 'ID', 'VN'],
    'Latin America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE'],
    'Middle East': ['AE', 'SA', 'IL', 'TR', 'EG'],
    'Africa': ['ZA', 'NG', 'KE', 'MA'],
  };
  for (const [region, countries] of Object.entries(regions)) {
    if (countries.includes(countryCode)) return region;
  }
  return 'Other';
}

export default function GeographicPage() {
  const geo = useGeoSlice();
  const [activeTab, setActiveTab] = useState<TabId>('countries');
  const gd = geo.data;

  const tabs = [
    { id: 'countries', label: 'Countries', icon: '🌍' },
    { id: 'cities', label: 'Cities', icon: '🏙️' },
    { id: 'realtime', label: 'Real-time', icon: '🟢' },
  ];

  const totalCountryUsers = useMemo(
    () => gd.topCountries.reduce((s, c) => s + c.count, 0),
    [gd.topCountries]
  );

  const regionBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    gd.topCountries.forEach((c) => {
      const r = getRegion(c.country);
      map[r] = (map[r] || 0) + c.count;
    });
    return Object.entries(map)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);
  }, [gd.topCountries]);

  return (
    <div>
      <PageHeader title="Geographic Analytics" icon="🌍" subtitle="User distribution across the globe"
        actions={<ConnectionBadge connected={geo.connected} />} />

      {/* Summary */}
      <Grid cols="auto-fit" minWidth="180px" gap="16px">
        <StatCard title="Countries" value={gd.topCountries.length} icon="🌍" color={colors.primary} />
        <StatCard title="Cities" value={gd.topCities.length} icon="🏙️" color={colors.purple} />
        <StatCard title="Active Now" value={gd.realtimeGeo.reduce((s, g) => s + g.count, 0)} icon="🟢" color={colors.success} pulse />
        <StatCard title="Regions" value={regionBreakdown.length} icon="🗺️" color={colors.warning} />
      </Grid>

      <div style={{ marginTop: '24px' }}>
        <TabSelector tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      </div>

      {geo.loading ? (
        <LoadingState message="Loading geographic data..." />
      ) : activeTab === 'countries' ? (
        <CountriesTab countries={gd.topCountries} total={totalCountryUsers} regions={regionBreakdown} />
      ) : activeTab === 'cities' ? (
        <CitiesTab cities={gd.topCities} />
      ) : (
        <RealtimeTab realtimeGeo={gd.realtimeGeo} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Countries Tab                                                      */
/* ------------------------------------------------------------------ */

function CountriesTab({
  countries,
  total,
  regions,
}: {
  countries: Array<{ country: string; name: string; count: number }>;
  total: number;
  regions: Array<{ region: string; count: number }>;
}) {
  if (countries.length === 0) {
    return <EmptyState icon="🌍" title="No Geographic Data" message="Country data will appear as users visit the site" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Grid cols={2} gap="20px">
        <Card title="Top Countries" icon="🌍">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {countries.slice(0, 12).map((c) => {
              const pct = getPercentage(c.count, total);
              return (
                <div key={c.country}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary }}>{c.name || c.country}</span>
                    <span style={{ color: colors.text.muted }}>{formatNumber(c.count)} ({pct}%)</span>
                  </div>
                  <ProgressBar value={c.count} max={total} gradient={gradients.primary} height={6} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Regional Distribution" icon="🗺️">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {regions.map((r) => {
              const pct = getPercentage(r.count, total);
              return (
                <div key={r.region}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: colors.text.primary }}>{r.region}</span>
                    <span style={{ color: colors.text.muted }}>{formatNumber(r.count)} ({pct}%)</span>
                  </div>
                  <ProgressBar value={r.count} max={total} gradient={gradients.purple} height={6} />
                </div>
              );
            })}
          </div>
        </Card>
      </Grid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cities Tab                                                         */
/* ------------------------------------------------------------------ */

function CitiesTab({ cities }: { cities: Array<{ city: string; country: string; name: string; count: number }> }) {
  if (cities.length === 0) {
    return <EmptyState icon="🏙️" title="No City Data" message="City data will appear as users visit the site" />;
  }

  const total = cities.reduce((s, c) => s + c.count, 0);

  return (
    <Card title="Top Cities" icon="🏙️">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {cities.slice(0, 15).map((c) => {
          const pct = getPercentage(c.count, total);
          return (
            <div key={`${c.city}-${c.country}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: colors.text.primary }}>
                  {c.city}{' '}
                  <span style={{ color: colors.text.muted, fontSize: '12px' }}>({c.name || c.country})</span>
                </span>
                <span style={{ color: colors.text.muted }}>{formatNumber(c.count)} ({pct}%)</span>
              </div>
              <ProgressBar value={c.count} max={total} gradient={gradients.success} height={6} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Real-time Tab (active users overlay)                               */
/* ------------------------------------------------------------------ */

function RealtimeTab({ realtimeGeo }: { realtimeGeo: Array<{ country: string; name: string; count: number }> }) {
  if (realtimeGeo.length === 0) {
    return <EmptyState icon="🟢" title="No Active Users" message="Real-time geographic data will appear when users are online" />;
  }

  return (
    <Card title="Currently Active By Location" icon="🟢">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {realtimeGeo.slice(0, 15).map((loc) => (
          <div key={loc.country} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: colors.text.primary, fontSize: '14px' }}>{loc.name || loc.country}</span>
            <span style={{ color: colors.success, fontWeight: '600', fontSize: '14px' }}>{loc.count} online</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                             */
/* ------------------------------------------------------------------ */

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px',
      background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
      border: `1px solid ${connected ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
      fontSize: '11px', color: connected ? colors.success : colors.warning,
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? colors.success : colors.warning }} />
      {connected ? 'Live' : 'Polling'}
    </div>
  );
}
