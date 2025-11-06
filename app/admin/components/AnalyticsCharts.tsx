'use client';

import { useState, useEffect } from 'react';

interface DailyMetric {
  date: string;
  views: number;
  watchTime: number;
  sessions: number;
}

export default function AnalyticsCharts() {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.data.dailyMetrics || []);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '40px',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ fontSize: '18px', color: '#94a3b8' }}>Loading analytics...</div>
      </div>
    );
  }

  const maxViews = Math.max(...metrics.map(m => m.views), 1);
  const maxWatchTime = Math.max(...metrics.map(m => m.watchTime), 1);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            padding: '12px 16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#e2e8f0',
            fontSize: '14px',
            fontWeight: '500',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          <option value="week" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>Last 7 Days</option>
          <option value="month" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>Last 30 Days</option>
        </select>
      </div>

      {metrics.length === 0 ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '60px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{ 
            width: '64px',
            height: '64px',
            marginBottom: '16px',
            margin: '0 auto 16px auto',
            background: 'linear-gradient(135deg, #7877c6 0%, #ff77c6 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(120, 119, 198, 0.4)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3V21H21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 9L12 6L16 10L20 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 style={{ color: '#f8fafc', marginBottom: '8px' }}>No Analytics Data Yet</h3>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Start using your video player to see analytics data here.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px'
        }}>
          <ChartCard
            title="Daily Views"
            data={metrics}
            dataKey="views"
            max={maxViews}
            color="#7877c6"
            gradient="linear-gradient(135deg, #7877c6 0%, #9333ea 100%)"
          />
          <ChartCard
            title="Daily Watch Time (minutes)"
            data={metrics}
            dataKey="watchTime"
            max={maxWatchTime}
            color="#10b981"
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          />
        </div>
      )}
    </div>
  );
}

function ChartCard({ 
  title, 
  data, 
  dataKey, 
  max, 
  color,
  gradient 
}: { 
  title: string; 
  data: DailyMetric[]; 
  dataKey: keyof DailyMetric; 
  max: number;
  color: string;
  gradient: string;
}) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      padding: '28px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Gradient accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: gradient
      }}></div>

      <h3 style={{ 
        margin: '0 0 24px 0', 
        color: '#f8fafc',
        fontSize: '18px',
        fontWeight: '600',
        letterSpacing: '-0.5px'
      }}>
        {title}
      </h3>
      
      <div style={{
        display: 'flex',
        alignItems: 'end',
        gap: '6px',
        height: '220px',
        padding: '10px 0',
        position: 'relative'
      }}>
        {/* Grid lines */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: '30px',
          background: `
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to top, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }}></div>

        {data.map((metric) => {
          const value = metric[dataKey] as number;
          const height = max > 0 ? (value / max) * 100 : 0;
          
          return (
            <div
              key={metric.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                position: 'relative',
                zIndex: 1
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${height}%`,
                  background: gradient,
                  borderRadius: '4px 4px 0 0',
                  minHeight: value > 0 ? '3px' : '0',
                  position: 'relative',
                  marginBottom: 'auto',
                  boxShadow: value > 0 ? `0 0 10px ${color}40` : 'none',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                title={`${new Date(metric.date).toLocaleDateString()}: ${value}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scaleY(1.05)';
                  e.currentTarget.style.boxShadow = `0 0 15px ${color}60`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scaleY(1)';
                  e.currentTarget.style.boxShadow = value > 0 ? `0 0 10px ${color}40` : 'none';
                }}
              >
                {value > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '11px',
                    color: '#e2e8f0',
                    whiteSpace: 'nowrap',
                    background: 'rgba(0, 0, 0, 0.7)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: '500'
                  }}>
                    {value}
                  </div>
                )}
              </div>
              
              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                marginTop: '12px',
                transform: 'rotate(-45deg)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
                fontWeight: '500'
              }}>
                {new Date(metric.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}