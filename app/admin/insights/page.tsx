'use client';
import { useStats } from '../context/StatsContext';

export default function InsightsPage() {
  const { stats, loading } = useStats();
  
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  
  return (
    <div>
      <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 28, fontWeight: 700, marginBottom: 24 }}>📊 User Insights</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card label="Total Users" value={stats.totalUsers} icon="👥" />
        <Card label="Active Today" value={stats.activeToday} icon="📊" />
        <Card label="Active Week" value={stats.activeThisWeek} icon="📈" />
        <Card label="Active Month" value={stats.activeThisMonth} icon="📅" />
        <Card label="Online Now" value={stats.liveUsers} icon="🟢" />
        <Card label="New Today" value={stats.newUsersToday} icon="🆕" />
        <Card label="Sessions" value={stats.totalSessions} icon="▶️" />
        <Card label="Completion Rate" value={`${stats.completionRate}%`} icon="✅" />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', color: '#f8fafc' }}>🌍 Top Countries</h3>
          {stats.topCountries?.slice(0, 5).map((c: any) => (
            <div key={c.country} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#f8fafc' }}>{c.countryName || c.country}</span>
              <span style={{ color: '#94a3b8' }}>{c.count}</span>
            </div>
          )) || <div style={{ color: '#64748b' }}>No data</div>}
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', color: '#f8fafc' }}>🔥 Top Content</h3>
          {stats.topContent?.slice(0, 5).map((c: any) => (
            <div key={c.contentId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{c.contentTitle}</span>
              <span style={{ color: '#94a3b8' }}>{c.watchCount} views</span>
            </div>
          )) || <div style={{ color: '#64748b' }}>No data</div>}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}
