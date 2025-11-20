'use client';

import { useState, useEffect } from 'react';
import { contentTitleCache } from '../../lib/utils/content-title-cache';

interface Session {
    id: string;
    user_id: string;
    user_name?: string;
    user_email?: string;
    content_id: string;
    content_type: string;
    started_at: string;
    duration: number;
    device_type: string;
    ip_address?: string;
    displayTitle?: string;
}

export default function SessionsTab() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchSessions();
    }, [page]);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/sessions?page=${page}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                const rawSessions = data.data || [];
                setSessions(rawSessions);
                setTotalPages(data.pagination.totalPages);

                // Fetch titles
                if (rawSessions.length > 0) {
                    try {
                        const titlesMap = await contentTitleCache.getTitles(
                            rawSessions.map((s: any) => ({
                                contentId: s.content_id,
                                contentType: s.content_type as 'movie' | 'tv'
                            }))
                        );

                        setSessions(prev => prev.map(s => ({
                            ...s,
                            displayTitle: titlesMap.get(`${s.content_type}-${s.content_id}`) || `${s.content_type} #${s.content_id}`
                        })));
                    } catch (err) {
                        console.error('Failed to fetch titles for sessions:', err);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)'
        }}>
            <div style={{
                padding: '20px 28px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>Recent Sessions</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        disabled={page === 1 || loading}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        style={{
                            padding: '8px 16px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: page === 1 ? 'not-allowed' : 'pointer',
                            opacity: page === 1 ? 0.5 : 1
                        }}
                    >
                        Previous
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        disabled={page === totalPages || loading}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        style={{
                            padding: '8px 16px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: page === totalPages ? 'not-allowed' : 'pointer',
                            opacity: page === totalPages ? 0.5 : 1
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>

            {loading && sessions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading sessions...</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                textAlign: 'left',
                                color: '#94a3b8',
                                fontSize: '14px'
                            }}>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Time</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>User</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Content</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Duration</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Device</th>
                                <th style={{ padding: '16px 24px', fontWeight: '600' }}>Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((session) => (
                                <tr key={session.id} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <td style={{ padding: '16px 24px', color: '#e2e8f0', fontSize: '14px' }}>
                                        {formatDate(session.started_at)}
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#e2e8f0', fontSize: '14px' }}>
                                        {session.user_name || session.user_email || 'Anonymous'}
                                        <div style={{ fontSize: '12px', color: '#64748b' }}>{session.user_id.substring(0, 8)}...</div>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#e2e8f0', fontSize: '14px' }}>
                                        <div style={{ fontWeight: '500' }}>{session.displayTitle || session.content_id}</div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: session.content_type === 'movie' ? '#34d399' : '#fbbf24',
                                            textTransform: 'uppercase',
                                            fontWeight: '600',
                                            marginTop: '4px'
                                        }}>
                                            {session.content_type}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#e2e8f0', fontSize: '14px' }}>
                                        {formatDuration(session.duration)}
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#e2e8f0', fontSize: '14px' }}>
                                        {session.device_type}
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#e2e8f0', fontSize: '14px' }}>
                                        {/* Placeholder for location if we have IP geo-location later */}
                                        {session.ip_address ? '📍 ' + session.ip_address : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
