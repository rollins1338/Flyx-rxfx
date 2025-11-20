'use client';

export default function AdminSettingsPage() {
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
                    Settings
                </h2>
                <p style={{
                    margin: '8px 0 0 0',
                    color: '#94a3b8',
                    fontSize: '16px'
                }}>
                    Configure admin dashboard preferences
                </p>
            </div>

            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '40px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
                backdropFilter: 'blur(20px)'
            }}>
                <h3 style={{ color: '#f8fafc', marginBottom: '10px' }}>Settings Coming Soon</h3>
                <p style={{ color: '#94a3b8' }}>
                    Configuration options will be available in a future update.
                </p>
            </div>
        </div>
    );
}
