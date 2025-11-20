'use client';

import { useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';
import AdminLogin from './components/AdminLogin';

export default function Layout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/admin/me');
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            }
        } catch (err) {
            console.error('Auth check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
                color: '#e2e8f0'
            }}>
                Loading...
            </div>
        );
    }

    if (!user) {
        return <AdminLogin onLoginSuccess={setUser} />;
    }

    return <AdminLayout>{children}</AdminLayout>;
}
