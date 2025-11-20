'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { contentTitleCache } from '../../lib/utils/content-title-cache';
import { Users } from 'lucide-react';

interface ContentStat {
    contentId: string;
    contentTitle: string;
    contentType: string;
    views: number;
    totalWatchTime: number;
    avgCompletion: number;
    uniqueViewers: number;
    displayTitle?: string;
}

export default function ContentStats() {
    const { dateRange, setIsLoading } = useAdmin();
    const [stats, setStats] = useState<ContentStat[]>([]);
    const [loadingTitles, setLoadingTitles] = useState(false);
    const [contentType, setContentType] = useState('all');

    useEffect(() => {
        fetchStats();
    }, [dateRange, contentType]);

    const fetchStats = async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();

            if (dateRange.startDate && dateRange.endDate) {
                params.append('startDate', dateRange.startDate.toISOString());
                params.append('endDate', dateRange.endDate.toISOString());
            } else {
                params.append('period', dateRange.period);
            }

            if (contentType !== 'all') {
                params.append('contentType', contentType);
            }

            const response = await fetch(`/api/admin/analytics?${params}`);
            if (response.ok) {
                const data = await response.json();
                const rawStats = data.data.contentPerformance || []; // Updated from topContent
                setStats(rawStats);

                // Fetch titles for all content
                if (rawStats.length > 0) {
                    setLoadingTitles(true);
                    try {
                        const titlesMap = await contentTitleCache.getTitles(
                            rawStats.map((stat: any) => ({
                                contentId: stat.contentId,
                                contentType: stat.contentType as 'movie' | 'tv'
                            }))
                        );

                        // Update stats with fetched titles
                        setStats(prevStats => prevStats.map(stat => ({
                            ...stat,
                            displayTitle: titlesMap.get(`${stat.contentType}-${stat.contentId}`) || stat.contentTitle || `${stat.contentType === 'movie' ? 'Movie' : 'Show'} #${stat.contentId}`
                        })));
                    } catch (err) {
                        console.error('Failed to fetch titles:', err);
                    } finally {
                        setLoadingTitles(false);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch content stats:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
        <div>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Top Content</h2>
                    <select
                        value={contentType}
                        onChange={(e) => setContentType(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: '#e2e8f0',
                            fontSize: '14px',
                            fontWeight: '500',
                            backdropFilter: 'blur(10px)',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        <option value="all" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>All Content</option>
                        <option value="movie" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>Movies</option>
                        <option value="tv" style={{ background: '#1a1a2e', color: '#e2e8f0' }}>TV Shows</option>
                    </select>
                </div>

                {loadingTitles && (
                    <div style={{ color: '#94a3b8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTop: '2px solid #7877c6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        Fetching titles...
                    </div>
                )}
            </div>

            {stats.length === 0 ? (
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
                            <rect x="2" y="3" width="20" height="14" rx="2" stroke="white" strokeWidth="2" />
                            <path d="M8 21L16 21" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            <path d="M12 17L12 21" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <h3 style={{ color: '#f8fafc', marginBottom: '8px' }}>No Content Data Yet</h3>
                    <p style={{ color: '#94a3b8', margin: 0 }}>
                        Content statistics will appear here once users start watching videos.
                    </p>
                </div>
            ) : (
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    backdropFilter: 'blur(20px)'
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr',
                        gap: '20px',
                        padding: '20px 28px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#94a3b8',
                        letterSpacing: '0.5px'
                    }}>
                        <div>Title</div>
                        <div>Type</div>
                        <div>Views</div>
                        <div>Unique</div>
                        <div>Watch Time</div>
                        <div>Completion</div>
                    </div>

                    {/* Content */}
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {stats.map((stat, index) => (
                            <div
                                key={stat.contentId}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr',
                                    gap: '20px',
                                    padding: '20px 28px',
                                    borderBottom: index < stats.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                                    transition: 'all 0.3s ease',
                                    cursor: 'default'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                }}
                            >
                                <div style={{
                                    fontSize: '14px',
                                    color: '#f8fafc',
                                    fontWeight: '500',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span title={stat.displayTitle || stat.contentId}>
                                        {stat.displayTitle || stat.contentId}
                                    </span>
                                </div>

                                <div>
                                    <span style={{
                                        padding: '6px 14px',
                                        borderRadius: '16px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        background: stat.contentType === 'movie'
                                            ? 'rgba(16, 185, 129, 0.2)'
                                            : 'rgba(245, 158, 11, 0.2)',
                                        color: stat.contentType === 'movie' ? '#34d399' : '#fbbf24',
                                        border: `1px solid ${stat.contentType === 'movie' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                                        letterSpacing: '0.5px'
                                    }}>
                                        {stat.contentType}
                                    </span>
                                </div>

                                <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '15px' }}>
                                    {stat.views.toLocaleString()}
                                </div>

                                <div style={{ fontWeight: '600', color: '#94a3b8', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Users size={14} />
                                    {stat.uniqueViewers?.toLocaleString() || 0}
                                </div>

                                <div style={{ fontWeight: '600', color: '#f8fafc', fontSize: '15px' }}>
                                    {formatDuration(stat.totalWatchTime)}
                                </div>

                                <div>
                                    <div style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '24px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                                                borderRadius: '12px',
                                                width: `${Math.min(stat.avgCompletion, 100)}%`,
                                                transition: 'width 0.3s ease',
                                                boxShadow: '0 0 10px rgba(120, 119, 198, 0.4)'
                                            }}
                                        ></div>
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: '#f8fafc',
                                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                                        }}>
                                            {Math.round(stat.avgCompletion)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
