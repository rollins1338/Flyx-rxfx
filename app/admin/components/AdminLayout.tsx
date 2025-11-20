'use client';

import { ReactNode } from 'react';
import { AdminProvider } from '../context/AdminContext';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <AdminProvider>
            <div style={{
                display: 'flex',
                minHeight: '100vh',
                background: '#0f172a',
                color: '#f8fafc'
            }}>
                <AdminSidebar />
                <div style={{
                    flex: 1,
                    marginLeft: '260px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <AdminHeader />
                    <main style={{
                        flex: 1,
                        padding: '32px',
                        overflowY: 'auto'
                    }}>
                        {children}
                    </main>
                </div>
            </div>
        </AdminProvider>
    );
}
