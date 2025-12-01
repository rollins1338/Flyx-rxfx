'use client';

import { useState, useMemo } from 'react';

interface GeographicData {
  country: string;
  countryName?: string;
  count: number;
  uniqueUsers?: number;
  sessions?: number;
}

interface Props {
  data: GeographicData[];
}

// Accurate country paths for world map (simplified but geographically correct)
const WORLD_MAP_PATHS: Record<string, { d: string; name: string; cx: number; cy: number }> = {
  'US': {
    d: 'M 158 190 L 168 185 L 185 188 L 200 185 L 215 190 L 225 195 L 230 205 L 225 215 L 210 220 L 195 218 L 180 215 L 165 210 L 155 205 L 150 195 Z M 85 195 L 95 190 L 110 192 L 120 198 L 115 208 L 100 212 L 88 208 Z',
    name: 'United States',
    cx: 190,
    cy: 200
  },
  'CA': {
    d: 'M 120 120 L 150 110 L 190 115 L 230 120 L 250 135 L 245 155 L 230 165 L 200 170 L 170 168 L 140 160 L 115 145 L 110 130 Z',
    name: 'Canada',
    cx: 180,
    cy: 140
  },
  'MX': {
    d: 'M 140 225 L 160 220 L 175 225 L 185 235 L 180 250 L 165 260 L 150 255 L 140 245 L 135 235 Z',
    name: 'Mexico',
    cx: 160,
    cy: 240
  },
  'BR': {
    d: 'M 270 290 L 300 280 L 330 290 L 340 320 L 330 360 L 300 380 L 270 370 L 255 340 L 260 310 Z',
    name: 'Brazil',
    cx: 300,
    cy: 330
  },
  'AR': {
    d: 'M 260 380 L 280 375 L 290 390 L 285 420 L 270 450 L 255 445 L 250 415 L 255 395 Z',
    name: 'Argentina',
    cx: 270,
    cy: 415
  },
  'GB': {
    d: 'M 468 145 L 475 140 L 480 145 L 478 155 L 472 160 L 466 155 L 465 148 Z',
    name: 'United Kingdom',
    cx: 472,
    cy: 150
  },
  'DE': {
    d: 'M 500 150 L 515 145 L 525 150 L 525 165 L 515 175 L 500 170 L 495 160 Z',
    name: 'Germany',
    cx: 510,
    cy: 160
  },
  'FR': {
    d: 'M 475 165 L 495 160 L 505 170 L 500 185 L 485 190 L 470 185 L 468 172 Z',
    name: 'France',
    cx: 485,
    cy: 175
  },
  'IT': {
    d: 'M 505 175 L 515 170 L 525 180 L 520 200 L 510 210 L 500 200 L 502 185 Z',
    name: 'Italy',
    cx: 512,
    cy: 190
  },
  'ES': {
    d: 'M 455 185 L 475 180 L 485 190 L 480 205 L 460 210 L 450 200 L 452 190 Z',
    name: 'Spain',
    cx: 467,
    cy: 195
  },
  'RU': {
    d: 'M 540 100 L 620 90 L 720 95 L 780 110 L 800 130 L 790 155 L 750 165 L 680 160 L 600 155 L 550 145 L 535 125 Z',
    name: 'Russia',
    cx: 670,
    cy: 130
  },
  'CN': {
    d: 'M 700 180 L 750 175 L 780 185 L 790 210 L 775 240 L 740 250 L 700 245 L 680 220 L 685 195 Z',
    name: 'China',
    cx: 735,
    cy: 215
  },
  'JP': {
    d: 'M 810 185 L 825 180 L 835 190 L 830 210 L 815 215 L 805 205 L 805 192 Z',
    name: 'Japan',
    cx: 820,
    cy: 198
  },
  'IN': {
    d: 'M 650 220 L 680 215 L 700 230 L 695 265 L 670 285 L 645 275 L 640 245 L 645 228 Z',
    name: 'India',
    cx: 670,
    cy: 250
  },
  'AU': {
    d: 'M 760 350 L 810 340 L 850 355 L 855 390 L 830 420 L 780 425 L 750 400 L 755 370 Z',
    name: 'Australia',
    cx: 805,
    cy: 385
  },
  'ZA': {
    d: 'M 530 380 L 560 375 L 575 390 L 570 415 L 545 425 L 525 415 L 525 395 Z',
    name: 'South Africa',
    cx: 550,
    cy: 400
  },
  'EG': {
    d: 'M 545 220 L 570 215 L 580 230 L 575 250 L 555 255 L 540 245 L 542 228 Z',
    name: 'Egypt',
    cx: 560,
    cy: 235
  },
  'NG': {
    d: 'M 490 275 L 515 270 L 525 285 L 520 305 L 500 310 L 485 300 L 488 282 Z',
    name: 'Nigeria',
    cx: 505,
    cy: 290
  },
  'KR': {
    d: 'M 795 195 L 805 190 L 812 198 L 808 212 L 798 215 L 792 208 Z',
    name: 'South Korea',
    cx: 800,
    cy: 203
  },
  'SE': {
    d: 'M 510 105 L 520 95 L 530 100 L 528 125 L 518 135 L 508 125 L 508 112 Z',
    name: 'Sweden',
    cx: 518,
    cy: 115
  },
  'NL': {
    d: 'M 488 148 L 498 145 L 502 152 L 498 160 L 490 158 L 486 152 Z',
    name: 'Netherlands',
    cx: 494,
    cy: 153
  },
  'PL': {
    d: 'M 520 150 L 540 145 L 550 155 L 545 170 L 530 175 L 518 168 L 518 158 Z',
    name: 'Poland',
    cx: 533,
    cy: 160
  },
  'TR': {
    d: 'M 545 185 L 585 180 L 600 190 L 595 205 L 565 210 L 545 205 L 543 193 Z',
    name: 'Turkey',
    cx: 570,
    cy: 195
  },
  'SA': {
    d: 'M 580 235 L 615 230 L 630 250 L 620 275 L 590 280 L 575 265 L 578 245 Z',
    name: 'Saudi Arabia',
    cx: 600,
    cy: 255
  },
  'AE': {
    d: 'M 620 260 L 635 255 L 642 265 L 638 278 L 625 280 L 618 272 Z',
    name: 'UAE',
    cx: 630,
    cy: 268
  },
  'TH': {
    d: 'M 720 260 L 735 255 L 742 270 L 738 290 L 725 295 L 715 285 L 718 268 Z',
    name: 'Thailand',
    cx: 728,
    cy: 275
  },
  'SG': {
    d: 'M 738 305 L 745 302 L 748 308 L 745 314 L 738 312 Z',
    name: 'Singapore',
    cx: 743,
    cy: 308
  },
  'ID': {
    d: 'M 740 315 L 790 310 L 820 320 L 815 340 L 775 345 L 745 338 L 742 325 Z',
    name: 'Indonesia',
    cx: 780,
    cy: 328
  },
  'PH': {
    d: 'M 785 260 L 798 255 L 805 268 L 800 285 L 788 288 L 782 278 L 783 265 Z',
    name: 'Philippines',
    cx: 792,
    cy: 272
  },
  'VN': {
    d: 'M 745 245 L 758 240 L 765 255 L 760 280 L 748 285 L 742 270 L 743 252 Z',
    name: 'Vietnam',
    cx: 753,
    cy: 262
  },
  'MY': {
    d: 'M 725 295 L 745 290 L 755 300 L 750 315 L 735 318 L 722 310 L 723 300 Z',
    name: 'Malaysia',
    cx: 738,
    cy: 305
  },
  'PK': {
    d: 'M 630 210 L 655 205 L 668 218 L 662 238 L 642 245 L 628 235 L 628 218 Z',
    name: 'Pakistan',
    cx: 648,
    cy: 225
  },
  'BD': {
    d: 'M 685 235 L 700 230 L 708 242 L 702 258 L 688 260 L 682 250 L 683 240 Z',
    name: 'Bangladesh',
    cx: 693,
    cy: 248
  },
  'CO': {
    d: 'M 225 275 L 250 270 L 260 285 L 255 305 L 235 310 L 220 300 L 222 282 Z',
    name: 'Colombia',
    cx: 240,
    cy: 290
  },
  'PE': {
    d: 'M 230 310 L 255 305 L 265 325 L 258 355 L 238 360 L 225 345 L 228 320 Z',
    name: 'Peru',
    cx: 245,
    cy: 335
  },
  'CL': {
    d: 'M 250 365 L 265 360 L 272 380 L 268 430 L 255 450 L 245 440 L 248 390 Z',
    name: 'Chile',
    cx: 258,
    cy: 405
  },
  'NZ': {
    d: 'M 870 410 L 885 405 L 895 420 L 890 440 L 875 445 L 865 435 L 868 418 Z',
    name: 'New Zealand',
    cx: 880,
    cy: 425
  },
  'IE': {
    d: 'M 455 145 L 465 140 L 470 148 L 466 158 L 458 158 L 453 152 Z',
    name: 'Ireland',
    cx: 462,
    cy: 150
  },
  'PT': {
    d: 'M 448 188 L 455 185 L 458 195 L 455 210 L 448 212 L 445 200 Z',
    name: 'Portugal',
    cx: 452,
    cy: 198
  },
  'GR': {
    d: 'M 530 190 L 545 185 L 552 198 L 548 215 L 535 218 L 528 208 L 528 195 Z',
    name: 'Greece',
    cx: 540,
    cy: 202
  },
  'UA': {
    d: 'M 545 155 L 580 150 L 595 162 L 590 180 L 565 185 L 545 178 L 543 165 Z',
    name: 'Ukraine',
    cx: 568,
    cy: 168
  },
  'IL': {
    d: 'M 560 210 L 568 205 L 572 215 L 568 230 L 562 232 L 558 222 Z',
    name: 'Israel',
    cx: 565,
    cy: 218
  },
  'KE': {
    d: 'M 565 295 L 585 290 L 595 305 L 590 325 L 572 330 L 562 318 L 563 302 Z',
    name: 'Kenya',
    cx: 578,
    cy: 310
  },
  'Local': {
    d: 'M 158 190 L 168 185 L 185 188 L 200 185 L 215 190 L 225 195 L 230 205 L 225 215 L 210 220 L 195 218 L 180 215 L 165 210 L 155 205 L 150 195 Z',
    name: 'Local Development',
    cx: 190,
    cy: 200
  },
};

export default function GeographicHeatmap({ data }: Props) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
  const totalViewers = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);
  
  const countryDataMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(d => { map[d.country] = d.count; });
    return map;
  }, [data]);

  const getHeatColor = (count: number) => {
    if (count === 0) return 'rgba(99, 102, 241, 0.08)';
    const intensity = count / maxCount;
    if (intensity > 0.8) return '#ef4444';
    if (intensity > 0.6) return '#f97316';
    if (intensity > 0.4) return '#eab308';
    if (intensity > 0.2) return '#22c55e';
    return '#3b82f6';
  };

  const getHeatOpacity = (count: number) => {
    if (count === 0) return 0.15;
    const intensity = count / maxCount;
    return 0.4 + (intensity * 0.5);
  };

  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 25, 0.98), rgba(15, 15, 35, 0.95))',
        padding: '60px',
        borderRadius: '20px',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        textAlign: 'center',
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          margin: '0 auto 24px auto',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 60px rgba(99, 102, 241, 0.5)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          <span style={{ fontSize: '48px' }}>🌍</span>
        </div>
        <h3 style={{ color: '#f8fafc', marginBottom: '12px', fontSize: '22px' }}>No Geographic Data Yet</h3>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px' }}>
          Viewer locations will appear on the map as users watch content
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(5, 5, 15, 0.99), rgba(10, 10, 25, 0.98))',
      borderRadius: '24px',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      overflow: 'hidden',
      boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 28px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.05), transparent)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(99, 102, 241, 0.35)',
          }}>
            <span style={{ fontSize: '24px' }}>🌐</span>
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '20px', fontWeight: '700' }}>
              Global Viewer Heatmap
            </h3>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
              Real-time geographic distribution • {data.length} countries
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
        }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            padding: '10px 18px',
            borderRadius: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 12px #22c55e',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ color: '#22c55e', fontSize: '14px', fontWeight: '600' }}>
              {totalViewers.toLocaleString()} Total Viewers
            </span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div style={{ position: 'relative', padding: '30px' }}>
        <svg
          viewBox="0 0 950 500"
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '400px',
            filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.1))',
          }}
        >
          <defs>
            {/* Grid pattern */}
            <pattern id="mapGrid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(99, 102, 241, 0.06)" strokeWidth="0.5"/>
            </pattern>
            {/* Glow filter */}
            <filter id="countryGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Pulse animation gradient */}
            <radialGradient id="pulseGrad">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
            </radialGradient>
          </defs>
          
          {/* Background */}
          <rect width="950" height="500" fill="url(#mapGrid)" rx="12"/>
          
          {/* Latitude/Longitude lines */}
          {[100, 200, 300, 400].map(y => (
            <line key={`lat-${y}`} x1="50" y1={y} x2="900" y2={y} stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" strokeDasharray="5,5"/>
          ))}
          {[150, 300, 450, 600, 750].map(x => (
            <line key={`lng-${x}`} x1={x} y1="50" x2={x} y2="450" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" strokeDasharray="5,5"/>
          ))}

          {/* Country paths */}
          {Object.entries(WORLD_MAP_PATHS).map(([code, country]) => {
            const count = countryDataMap[code] || 0;
            const isHovered = hoveredCountry === code;
            const hasData = count > 0;
            
            return (
              <g key={code}>
                <path
                  d={country.d}
                  fill={hasData ? getHeatColor(count) : 'rgba(99, 102, 241, 0.08)'}
                  fillOpacity={hasData ? getHeatOpacity(count) : 0.15}
                  stroke={isHovered ? '#fff' : hasData ? getHeatColor(count) : 'rgba(99, 102, 241, 0.2)'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{
                    cursor: hasData ? 'pointer' : 'default',
                    transition: 'all 0.3s ease',
                    filter: isHovered && hasData ? 'url(#countryGlow)' : 'none',
                  }}
                  onMouseEnter={() => {
                    if (hasData) {
                      setHoveredCountry(code);
                    }
                  }}
                  onMouseLeave={() => setHoveredCountry(null)}
                />
                {/* Pulse effect for countries with data */}
                {hasData && (
                  <circle
                    cx={country.cx}
                    cy={country.cy}
                    r={8 + (count / maxCount) * 12}
                    fill="url(#pulseGrad)"
                    style={{ animation: 'pulse 2s ease-in-out infinite' }}
                  />
                )}
                {/* Data point */}
                {hasData && (
                  <circle
                    cx={country.cx}
                    cy={country.cy}
                    r={4 + (count / maxCount) * 6}
                    fill={getHeatColor(count)}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{
                      filter: 'drop-shadow(0 0 8px ' + getHeatColor(count) + ')',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredCountry(code)}
                    onMouseLeave={() => setHoveredCountry(null)}
                  />
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {hoveredCountry && countryDataMap[hoveredCountry] && WORLD_MAP_PATHS[hoveredCountry] && (
            <g>
              <rect
                x={WORLD_MAP_PATHS[hoveredCountry].cx - 70}
                y={WORLD_MAP_PATHS[hoveredCountry].cy - 55}
                width="140"
                height="45"
                rx="10"
                fill="rgba(0, 0, 0, 0.95)"
                stroke={getHeatColor(countryDataMap[hoveredCountry])}
                strokeWidth="2"
              />
              <text
                x={WORLD_MAP_PATHS[hoveredCountry].cx}
                y={WORLD_MAP_PATHS[hoveredCountry].cy - 35}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="13"
                fontWeight="700"
              >
                {WORLD_MAP_PATHS[hoveredCountry].name}
              </text>
              <text
                x={WORLD_MAP_PATHS[hoveredCountry].cx}
                y={WORLD_MAP_PATHS[hoveredCountry].cy - 18}
                textAnchor="middle"
                fill={getHeatColor(countryDataMap[hoveredCountry])}
                fontSize="14"
                fontWeight="800"
              >
                {countryDataMap[hoveredCountry].toLocaleString()} viewers
              </text>
            </g>
          )}
        </svg>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.05); }
          }
        `}</style>
      </div>

      {/* Legend */}
      <div style={{
        padding: '20px 28px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        background: 'rgba(0, 0, 0, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Intensity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {[
              { color: '#3b82f6', label: 'Low' },
              { color: '#22c55e', label: 'Medium' },
              { color: '#eab308', label: 'High' },
              { color: '#f97316', label: 'Very High' },
              { color: '#ef4444', label: 'Highest' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '4px',
                  background: item.color,
                  boxShadow: `0 0 10px ${item.color}50`,
                }} />
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Country List */}
      <div style={{
        padding: '24px 28px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <h4 style={{
          margin: '0 0 20px 0',
          color: '#94a3b8',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          fontWeight: '600',
        }}>
          Top Countries by Viewers
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px',
        }}>
          {data.slice(0, 12).map((item, index) => {
            const percentage = totalViewers > 0 ? (item.count / totalViewers) * 100 : 0;
            const barPercentage = (item.count / maxCount) * 100;
            const countryInfo = WORLD_MAP_PATHS[item.country];
            
            return (
              <div
                key={item.country}
                style={{
                  position: 'relative',
                  padding: '14px 18px',
                  background: hoveredCountry === item.country 
                    ? 'rgba(99, 102, 241, 0.15)' 
                    : 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  border: `1px solid ${hoveredCountry === item.country ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.04)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                }}
                onMouseEnter={() => setHoveredCountry(item.country)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                {/* Progress bar */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${barPercentage}%`,
                  background: `linear-gradient(90deg, ${getHeatColor(item.count)}30, transparent)`,
                  transition: 'width 0.3s ease',
                }} />
                
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `${getHeatColor(item.count)}20`,
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: getHeatColor(item.count),
                    }}>
                      #{index + 1}
                    </span>
                    <span style={{ fontSize: '22px' }}>{getCountryFlag(item.country)}</span>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: '600', fontSize: '14px' }}>
                        {item.countryName || countryInfo?.name || item.country}
                      </div>
                      {item.country !== 'Unknown' && item.country !== 'Local' && item.country.length === 2 && (
                        <div style={{ color: '#64748b', fontSize: '11px' }}>{item.country}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: getHeatColor(item.count), fontWeight: '700', fontSize: '16px' }}>
                      {item.count.toLocaleString()}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
