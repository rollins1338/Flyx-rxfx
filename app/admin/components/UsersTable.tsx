'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Clock, Activity, MapPin } from 'lucide-react';

interface UserStat {
    userId: string;
    username: string;
    email: string;
    image: string;
    totalSessions: number;
    totalWatchTime: number;
    lastActive: number;
    country: string;
}

export default function UsersTable() {
    const { dateRange, setIsLoading } = useAdmin();
    const [users, setUsers] = useState<UserStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, [dateRange]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
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
                setUsers(data.data.usersStats || []);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
            setIsLoading(false);
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        if (!timestamp) return 'Never';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const isOnline = (lastActive: number) => {
        return Date.now() - lastActive < 5 * 60 * 1000; // Active in last 5 mins
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
                <div style={{ fontSize: '18px', color: '#94a3b8' }}>Loading user data...</div>
            </div>
        );
    }

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
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f8fafc' }}>Active Users</h2>
                <span style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '4px 12px',
                    borderRadius: '20px'
                }}>
                    Top {users.length} Users
                </span>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: '20px',
                padding: '16px 28px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '13px',
                fontWeight: '600',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                <div>User</div>
                <div>Status</div>
                <div>Watch Time</div>
                <div>Sessions</div>
                <div>Country</div>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {users.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        No user activity found in this period.
                    </div>
                ) : (
                    users.map((user, index) => (
                        <div
                            key={user.userId}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                                gap: '20px',
                                padding: '16px 28px',
                                borderBottom: index < users.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                                alignItems: 'center',
                                transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    border: '2px solid rgba(255, 255, 255, 0.1)'
                                }}>
                                    {user.username.substring(0, 2).toUpperCase()}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ color: '#f8fafc', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.username}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.email || 'No email'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: isOnline(user.lastActive) ? '#10b981' : '#64748b',
                                        boxShadow: isOnline(user.lastActive) ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
                                    }}></div>
                                    <span style={{ color: isOnline(user.lastActive) ? '#10b981' : '#94a3b8', fontSize: '13px', fontWeight: '500' }}>
                                        {isOnline(user.lastActive) ? 'Online' : formatTimeAgo(user.lastActive)}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: '500' }}>
                                <Clock size={14} color="#94a3b8" />
                                {formatDuration(user.totalWatchTime)}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: '500' }}>
                                <Activity size={14} color="#94a3b8" />
                                {user.totalSessions}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
                                <MapPin size={14} color="#94a3b8" />
                                {user.country === 'Unknown' ? 'N/A' : user.country}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
