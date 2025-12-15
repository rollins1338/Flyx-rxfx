'use client';

import { useState, useEffect } from 'react';

interface BannerConfig {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  enabled: boolean;
  dismissible: boolean;
  linkText?: string;
  linkUrl?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function BannerManagementPage() {
  const [banner, setBanner] = useState<BannerConfig>({
    id: 'main-banner',
    message: '',
    type: 'info',
    enabled: false,
    dismissible: true,
    linkText: '',
    linkUrl: '',
    expiresAt: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    try {
      const response = await fetch('/api/admin/banner');
      const data = await response.json();
      if (data.banner) {
        setBanner(data.banner);
      }
    } catch (error) {
      console.error('Failed to fetch banner:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBanner = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/admin/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banner),
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: 'Banner saved successfully!' });
        fetchBanner();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save banner' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const disableBanner = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/admin/banner', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setBanner(prev => ({ ...prev, enabled: false }));
        setMessage({ type: 'success', text: 'Banner disabled!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to disable banner' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', color: '#94a3b8' }}>
        Loading banner settings...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>
          📢 Site Banner Management
        </h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>
          Display announcements and notifications to all users
        </p>
      </div>

      {/* Preview */}
      {banner.message && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontSize: '16px' }}>Preview</h3>
          <div style={{
            padding: '12px 20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'white',
            background: banner.type === 'info' ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95))' :
                        banner.type === 'warning' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(234, 88, 12, 0.95))' :
                        banner.type === 'success' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))' :
                        'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))',
            opacity: banner.enabled ? 1 : 0.5,
          }}>
            <span>
              {banner.type === 'info' && 'ℹ️'}
              {banner.type === 'warning' && '⚠️'}
              {banner.type === 'success' && '✅'}
              {banner.type === 'error' && '🚨'}
            </span>
            <span>{banner.message}</span>
            {banner.linkText && banner.linkUrl && (
              <span style={{ textDecoration: 'underline', fontWeight: '600' }}>
                {banner.linkText} →
              </span>
            )}
            {!banner.enabled && (
              <span style={{ marginLeft: '10px', opacity: 0.7 }}>(Disabled)</span>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
        {/* Enable Toggle */}
        <div style={{ 
          padding: '16px', 
          background: banner.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)', 
          border: `1px solid ${banner.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`, 
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <label style={{ display: 'block', color: '#f8fafc', fontWeight: '600', marginBottom: '4px' }}>
              Banner Status
            </label>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              {banner.enabled ? '🟢 Banner is visible to all users' : '⚫ Banner is hidden'}
            </span>
          </div>
          <button
            onClick={() => setBanner({ ...banner, enabled: !banner.enabled })}
            style={{
              padding: '8px 20px',
              background: banner.enabled ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {banner.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Message */}
        <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
          <label style={{ display: 'block', color: '#f8fafc', fontWeight: '500', marginBottom: '8px' }}>
            Message *
          </label>
          <textarea
            value={banner.message}
            onChange={(e) => setBanner({ ...banner, message: e.target.value })}
            placeholder="Enter your announcement message..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Type */}
        <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
          <label style={{ display: 'block', color: '#f8fafc', fontWeight: '500', marginBottom: '8px' }}>
            Banner Type
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['info', 'warning', 'success', 'error'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setBanner({ ...banner, type })}
                style={{
                  padding: '8px 16px',
                  background: banner.type === type ? 
                    (type === 'info' ? 'rgba(59, 130, 246, 0.3)' :
                     type === 'warning' ? 'rgba(245, 158, 11, 0.3)' :
                     type === 'success' ? 'rgba(16, 185, 129, 0.3)' :
                     'rgba(239, 68, 68, 0.3)') : 
                    'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${banner.type === type ? 
                    (type === 'info' ? 'rgba(59, 130, 246, 0.5)' :
                     type === 'warning' ? 'rgba(245, 158, 11, 0.5)' :
                     type === 'success' ? 'rgba(16, 185, 129, 0.5)' :
                     'rgba(239, 68, 68, 0.5)') : 
                    'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {type === 'info' && 'ℹ️ Info'}
                {type === 'warning' && '⚠️ Warning'}
                {type === 'success' && '✅ Success'}
                {type === 'error' && '🚨 Error'}
              </button>
            ))}
          </div>
        </div>

        {/* Link (Optional) */}
        <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
          <label style={{ display: 'block', color: '#f8fafc', fontWeight: '500', marginBottom: '8px' }}>
            Link (Optional)
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={banner.linkText || ''}
              onChange={(e) => setBanner({ ...banner, linkText: e.target.value })}
              placeholder="Link text (e.g., Learn more)"
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
              }}
            />
            <input
              type="text"
              value={banner.linkUrl || ''}
              onChange={(e) => setBanner({ ...banner, linkUrl: e.target.value })}
              placeholder="URL (e.g., /about)"
              style={{
                flex: 2,
                padding: '10px 12px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
          <label style={{ display: 'block', color: '#f8fafc', fontWeight: '500', marginBottom: '12px' }}>
            Options
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={banner.dismissible}
                onChange={(e) => setBanner({ ...banner, dismissible: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#7877c6' }}
              />
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                Allow users to dismiss the banner
              </span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Expires at:</span>
              <input
                type="datetime-local"
                value={banner.expiresAt ? banner.expiresAt.slice(0, 16) : ''}
                onChange={(e) => setBanner({ ...banner, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: message.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '14px'
          }}>
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={saveBanner}
            disabled={saving || !banner.message}
            style={{
              padding: '12px 24px',
              background: '#7877c6',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving || !banner.message ? 'not-allowed' : 'pointer',
              opacity: saving || !banner.message ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Banner'}
          </button>
          {banner.enabled && (
            <button
              onClick={disableBanner}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '14px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              Disable Banner
            </button>
          )}
        </div>

        {/* Last Updated */}
        {banner.updatedAt && (
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>
            Last updated: {new Date(banner.updatedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
