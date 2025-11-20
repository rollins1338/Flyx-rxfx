'use client';

import { useState, useEffect } from 'react';
import GeographicHeatmap from './GeographicHeatmap';

interface GeographicData {
    country: string;
    count: number;
}

export default function GeographicTab() {
    const [data, setData] = useState<GeographicData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Reusing the analytics endpoint which returns geographic data
            const response = await fetch('/api/admin/analytics?period=month');
            if (response.ok) {
                const result = await response.json();
                setData(result.data.geographic || []);
            }
        } catch (err) {
            console.error('Failed to fetch geographic data:', err);
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
                <div style={{ fontSize: '18px', color: '#94a3b8' }}>Loading geographic data...</div>
            </div>
        );
    }

    return (
        <div>
            <GeographicHeatmap data={data} />
        </div>
    );
}
