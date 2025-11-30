'use client';

import { useState, useMemo } from 'react';

interface GeographicData {
  country: string;
  count: number;
}

interface Props {
  data: GeographicData[];
}

// Country coordinates for the map (approximate center points)
const COUNTRY_COORDS: Record<string, { x: number; y: number; name: string }> = {
  'US': { x: 150, y: 180, name: 'United States' },
  'CA': { x: 160, y: 120, name: 'Canada' },
  'MX': { x: 140, y: 220, name: 'Mexico' },
  'BR': { x: 280, y: 320, name: 'Brazil' },
  'AR': { x: 260, y: 380, name: 'Argentina' },
  'CL': { x: 240, y: 370, name: 'Chile' },
  'CO': { x: 230, y: 270, name: 'Colombia' },
  'PE': { x: 220, y: 300, name: 'Peru' },
  'GB': { x: 430, y: 140, name: 'United Kingdom' },
  'DE': { x: 470, y: 150, name: 'Germany' },
  'FR': { x: 450, y: 160, name: 'France' },
  'IT': { x: 480, y: 175, name: 'Italy' },
  'ES': { x: 430, y: 180, name: 'Spain' },
  'PT': { x: 415, y: 180, name: 'Portugal' },
  'NL': { x: 455, y: 145, name: 'Netherlands' },
  'BE': { x: 450, y: 150, name: 'Belgium' },
  'SE': { x: 490, y: 110, name: 'Sweden' },
  'NO': { x: 475, y: 100, name: 'Norway' },
  'FI': { x: 520, y: 100, name: 'Finland' },
  'DK': { x: 470, y: 130, name: 'Denmark' },
  'PL': { x: 500, y: 145, name: 'Poland' },
  'AT': { x: 485, y: 160, name: 'Austria' },
  'CH': { x: 465, y: 165, name: 'Switzerland' },
  'IE': { x: 415, y: 140, name: 'Ireland' },
  'RU': { x: 600, y: 120, name: 'Russia' },
  'UA': { x: 540, y: 155, name: 'Ukraine' },
  'TR': { x: 540, y: 185, name: 'Turkey' },
  'GR': { x: 510, y: 185, name: 'Greece' },
  'JP': { x: 780, y: 180, name: 'Japan' },
  'KR': { x: 755, y: 185, name: 'South Korea' },
  'CN': { x: 700, y: 190, name: 'China' },
  'IN': { x: 640, y: 230, name: 'India' },
  'AU': { x: 770, y: 360, name: 'Australia' },
  'NZ': { x: 830, y: 400, name: 'New Zealand' },
  'SG': { x: 710, y: 280, name: 'Singapore' },
  'HK': { x: 730, y: 220, name: 'Hong Kong' },
  'TW': { x: 745, y: 215, name: 'Taiwan' },
  'TH': { x: 695, y: 250, name: 'Thailand' },
  'MY': { x: 705, y: 275, name: 'Malaysia' },
  'PH': { x: 745, y: 250, name: 'Philippines' },
  'ID': { x: 725, y: 295, name: 'Indonesia' },
  'VN': { x: 710, y: 240, name: 'Vietnam' },
  'AE': { x: 580, y: 225, name: 'UAE' },
  'SA': { x: 560, y: 225, name: 'Saudi Arabia' },
  'IL': { x: 540, y: 200, name: 'Israel' },
  'EG': { x: 520, y: 215, name: 'Egypt' },
  'ZA': { x: 520, y: 370, name: 'South Africa' },
  'NG': { x: 470, y: 270, name: 'Nigeria' },
  'KE': { x: 545, y: 290, name: 'Kenya' },
  'MA': { x: 425, y: 200, name: 'Morocco' },
  'PK': { x: 620, y: 210, name: 'Pakistan' },
  'BD': { x: 660, y: 225, name: 'Bangladesh' },
  'VE': { x: 245, y: 265, name: 'Venezuela' },
  'Local': { x: 150, y: 180, name: 'Local Development' },
  'Unknown': { x: 450, y: 250, name: 'Unknown' },
};

export default function GeographicHeatmap({ data }: Props) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
  const totalViewers = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  const getCountryName = (code: string) => {
    return COUNTRY_COORDS[code]?.name || code;
  };

  const getHeatColor = (count: number) => {
    const intensity = count / maxCount;
    if (intensity > 0.8) return '#ff3366';
    if (intensity > 0.6) return '#ff6b9d';
    if (intensity > 0.4) return '#a855f7';
    if (intensity > 0.2) return '#8b5cf6';
    return '#6366f1';
  };

  const getPulseSize = (count: number) => {
    const intensity = count / maxCount;
    return 8 + (intensity * 20);
  };

  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.95), rgba(20, 20, 40, 0.9))',
        padding: '60px',
        borderRadius: '20px',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        textAlign: 'center',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px auto',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 40px rgba(99, 102, 241, 0.4)',
        }}>
          <span style={{ fontSize: '36px' }}>🌍</span>
        </div>
        <h3 style={{ color: '#f8fafc', marginBottom: '8px', fontSize: '20px' }}>No Geographic Data Yet</h3>
        <p style={{ color: '#94a3b8', margin: 0 }}>
          Viewer locations will appear here as users watch content
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.98), rgba(15, 15, 30, 0.95))',
      borderRadius: '20px',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>
            🌐 Global Viewer Distribution
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
            Real-time geographic heatmap
          </p>
        </div>
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          padding: '8px 16px',
          borderRadius: '20px',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          <span style={{ color: '#a5b4fc', fontSize: '14px', fontWeight: '600' }}>
            {totalViewers.toLocaleString()} viewers
          </span>
        </div>
      </div>

      {/* World Map */}
      <div style={{ position: 'relative', padding: '20px' }}>
        <svg
          viewBox="0 0 900 450"
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '350px',
          }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="0.5"/>
            </pattern>
            <radialGradient id="pulseGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <rect width="900" height="450" fill="url(#grid)" />
          
          {/* Simplified world map outline */}
          <path
            d="M 80 150 Q 100 120 150 110 Q 200 100 250 120 Q 280 130 300 150 L 320 180 Q 340 200 320 230 Q 300 260 280 280 Q 260 300 240 320 Q 220 340 200 350 Q 180 360 160 340 Q 140 320 120 280 Q 100 240 90 200 Q 80 170 80 150 Z"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />
          {/* Europe */}
          <path
            d="M 400 100 Q 450 90 500 100 Q 550 110 580 140 Q 600 170 580 200 Q 560 220 520 210 Q 480 200 450 180 Q 420 160 410 130 Q 400 110 400 100 Z"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />
          {/* Asia */}
          <path
            d="M 550 100 Q 650 80 750 120 Q 800 150 780 200 Q 760 250 720 280 Q 680 300 640 280 Q 600 260 580 220 Q 560 180 550 140 Q 545 110 550 100 Z"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />
          {/* Africa */}
          <path
            d="M 450 220 Q 480 210 520 230 Q 560 260 550 320 Q 540 380 500 400 Q 460 410 440 380 Q 420 340 430 290 Q 440 250 450 220 Z"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />
          {/* Australia */}
          <path
            d="M 720 320 Q 780 310 820 340 Q 840 370 820 400 Q 780 420 740 400 Q 710 380 720 350 Q 720 330 720 320 Z"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />
          {/* South America */}
          <path
            d="M 220 260 Q 280 250 300 290 Q 310 340 280 390 Q 250 420 220 400 Q 200 370 210 320 Q 215 280 220 260 Z"
            fill="rgba(99, 102, 241, 0.05)"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />

          {/* Data points with pulse animation */}
          {data.map((item, index) => {
            const coords = COUNTRY_COORDS[item.country];
            if (!coords) return null;
            
            const size = getPulseSize(item.count);
            const color = getHeatColor(item.count);
            const isHovered = hoveredCountry === item.country;
            const isSelected = selectedCountry === item.country;
            
            return (
              <g key={item.country}>
                {/* Outer pulse ring */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={size * 1.5}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  opacity="0.3"
                  style={{
                    animation: `pulse ${2 + index * 0.1}s ease-in-out infinite`,
                  }}
                />
                {/* Middle ring */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={size}
                  fill={color}
                  opacity="0.2"
                  filter="url(#glow)"
                />
                {/* Core dot */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isHovered || isSelected ? size * 0.6 : size * 0.4}
                  fill={color}
                  filter="url(#glow)"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={() => setHoveredCountry(item.country)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  onClick={() => setSelectedCountry(selectedCountry === item.country ? null : item.country)}
                />
                {/* Country label on hover */}
                {(isHovered || isSelected) && (
                  <g>
                    <rect
                      x={coords.x - 60}
                      y={coords.y - 45}
                      width="120"
                      height="35"
                      rx="8"
                      fill="rgba(0, 0, 0, 0.9)"
                      stroke={color}
                      strokeWidth="1"
                    />
                    <text
                      x={coords.x}
                      y={coords.y - 30}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {coords.name}
                    </text>
                    <text
                      x={coords.x}
                      y={coords.y - 16}
                      textAnchor="middle"
                      fill={color}
                      fontSize="12"
                      fontWeight="700"
                    >
                      {item.count.toLocaleString()} viewers
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Connection lines between top countries */}
          {data.length > 1 && data.slice(0, 5).map((item, i) => {
            if (i === 0) return null;
            const fromCoords = COUNTRY_COORDS[data[0].country];
            const toCoords = COUNTRY_COORDS[item.country];
            if (!fromCoords || !toCoords) return null;
            
            return (
              <line
                key={`line-${i}`}
                x1={fromCoords.x}
                y1={fromCoords.y}
                x2={toCoords.x}
                y2={toCoords.y}
                stroke="rgba(99, 102, 241, 0.15)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}
        </svg>

        {/* CSS for pulse animation */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.2); opacity: 0.1; }
          }
        `}</style>
      </div>

      {/* Country List */}
      <div style={{
        padding: '20px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Top Countries
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.slice(0, 10).map((item, index) => {
            const percentage = (item.count / maxCount) * 100;
            const globalPercentage = totalViewers > 0 ? (item.count / totalViewers) * 100 : 0;
            const isHovered = hoveredCountry === item.country;
            
            return (
              <div
                key={item.country}
                style={{
                  position: 'relative',
                  padding: '12px 16px',
                  background: isHovered ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  border: `1px solid ${isHovered ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.04)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={() => setHoveredCountry(item.country)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                {/* Progress bar background */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${getHeatColor(item.count)}20, transparent)`,
                  borderRadius: '10px',
                  transition: 'width 0.3s ease',
                }} />
                
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(99, 102, 241, 0.2)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#a5b4fc',
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontSize: '20px' }}>{getCountryFlag(item.country)}</span>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: '500', fontSize: '14px' }}>
                        {getCountryName(item.country)}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>
                        {item.country !== 'Unknown' && item.country !== 'Local' ? item.country : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: getHeatColor(item.count), fontWeight: '700', fontSize: '16px' }}>
                        {item.count.toLocaleString()}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>
                        {globalPercentage.toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>Low</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#a855f7' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>Medium</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff6b9d' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>High</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff3366' }} />
          <span style={{ color: '#64748b', fontSize: '12px' }}>Highest</span>
        </div>
      </div>
    </div>
  );
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode === 'Unknown') return '🌍';
  if (countryCode === 'Local') return '💻';
  if (countryCode.length !== 2) return '📍';
  
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌍';
  }
}
