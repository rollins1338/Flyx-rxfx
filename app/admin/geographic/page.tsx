'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import GeographicHeatmap from '../components/GeographicHeatmap';

interface GeoStat {
    country: string;
    count: number;
}

export default function AdminGeographicPage() {
    const { dateRange, setIsLoading } = useAdmin();
    const [geographic, setGeographic] = useState<GeoStat[]>([]);

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();

            if (dateRange.startDate && dateRange.endDate) {
                params.append('startDate', dateRange.startDate.toISOString());
                params.append('endDate', dateRange.endDate.toISOString());
            } else {
                params.append('period', dateRange.period);
            }

            const response = await fetch(`/api/admin/analytics?${params}`);

            if (response.ok) {
                const data = await response.json();
                setGeographic(data.data.geographic || []);
            }
        } catch (err) {
            console.error('Failed to fetch geographic data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <div style={{
                marginBottom: '32px',
                paddingBottom: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <h2 style={{
                    margin: 0,
                    color: '#f8fafc',
                    fontSize: '24px',
                    fontWeight: '600',
                    letterSpacing: '-0.5px'
                }}>
                    Geographic Distribution
                </h2>
                <p style={{
                    margin: '8px 0 0 0',
                    color: '#94a3b8',
                    fontSize: '16px'
                }}>
                    Analyze where your audience is located
                </p>
            </div>

            <GeographicHeatmap data={geographic} />
        </div>
    );
}
