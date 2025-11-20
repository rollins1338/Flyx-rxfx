'use client';

import { useState } from 'react';

interface GeographicData {
    country: string;
    count: number;
}

interface Props {
    data: GeographicData[];
}

// Country code to full name mapping fallback
const COUNTRY_NAMES: Record<string, string> = {
    'US': 'United States',
    'GB': 'United Kingdom',
    // ... keep existing if needed, but Intl.DisplayNames is better
    'Unknown': 'Unknown',
    'Local': 'Local'
};

export default function GeographicHeatmap({ data }: Props) {
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

    // Region names translator
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    const getCountryName = (code: string) => {
        if (code === 'Unknown' || code === 'Local') return code;
        try {
            return regionNames.of(code) || code;
        } catch (e) {
            return COUNTRY_NAMES[code] || code;
        }
    };

    if (!data || data.length === 0) {
        return (
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
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="white" strokeWidth="2" />
                    </svg>
                </div>
                <h3 style={{ color: '#f8fafc', marginBottom: '8px' }}>No Geographic Data Yet</h3>
                <p style={{ color: '#94a3b8', margin: 0 }}>
                    Viewer location data will appear here once users start watching content.
                </p>
            </div>
        );
    }

    const maxCount = Math.max(...data.map(d => d.count));
    const topCountries = data.slice(0, 10);

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '28px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)'
        }}>
            <h3 style={{
                margin: '0 0 24px 0',
                color: '#f8fafc',
                fontSize: '18px',
                fontWeight: '600',
                letterSpacing: '-0.5px'
            }}>
                Viewer Distribution by Country
            </h3>

            {/* Country List with Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topCountries.map((item) => {
                    const percentage = (item.count / maxCount) * 100;
                    const countryName = getCountryName(item.country);

                    return (
                        <div
                            key={item.country}
                            style={{
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={() => setHoveredCountry(item.country)}
                            onMouseLeave={() => setHoveredCountry(null)}
                        >
                            {/* Background bar */}
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${percentage}%`,
                                background: hoveredCountry === item.country
                                    ? 'linear-gradient(90deg, rgba(120, 119, 198, 0.4), rgba(255, 119, 198, 0.4))'
                                    : 'linear-gradient(90deg, rgba(120, 119, 198, 0.2), rgba(255, 119, 198, 0.2))',
                                borderRadius: '8px',
                                transition: 'all 0.3s ease'
                            }} />

                            {/* Content */}
                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                zIndex: 1
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        fontSize: '20px',
                                        minWidth: '32px',
                                        textAlign: 'center'
                                    }}>
                                        {getCountryFlag(item.country)}
                                    </span>
                                    <div>
                                        <div style={{
                                            color: '#f8fafc',
                                            fontWeight: '500',
                                            fontSize: '14px'
                                        }}>
                                            {countryName}
                                        </div>
                                        <div style={{
                                            color: '#94a3b8',
                                            fontSize: '12px',
                                            marginTop: '2px'
                                        }}>
                                            {item.country !== 'Unknown' && item.country !== 'Local' && item.country}
                                        </div>
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{
                                        color: '#7877c6',
                                        fontWeight: '600',
                                        fontSize: '16px'
                                    }}>
                                        {item.count}
                                    </div>
                                    <div style={{
                                        color: '#94a3b8',
                                        fontSize: '12px',
                                        minWidth: '45px',
                                        textAlign: 'right'
                                    }}>
                                        {Math.round(percentage)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Total viewers */}
            <div style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Total Viewers
                </span>
                <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '18px' }}>
                    {data.reduce((sum, item) => sum + item.count, 0)}
                </span>
            </div>
        </div>
    );
}

function getCountryFlag(countryCode: string): string {
    if (!countryCode || countryCode === 'Unknown' || countryCode === 'Local') {
        return '🌍';
    }

    // Check if it's a valid 2-letter ISO code
    if (countryCode.length !== 2) {
        return '📍'; // Generic pin for non-standard codes or full names
    }

    // Convert country code to flag emoji
    try {
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    } catch (e) {
        return '🌍';
    }
}
