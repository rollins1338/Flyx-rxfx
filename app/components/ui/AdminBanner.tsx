'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import styles from './AdminBanner.module.css';

interface BannerConfig {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  enabled: boolean;
  dismissible: boolean;
  linkText?: string;
  linkUrl?: string;
  expiresAt?: string;
}

export default function AdminBanner() {
  const [banner, setBanner] = useState<BannerConfig | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Hide banner on video player, live TV, details, about, and reverse-engineering pages
  const isHiddenPage =
    pathname?.startsWith('/watch') ||
    pathname?.startsWith('/livetv') ||
    pathname?.startsWith('/details') ||
    pathname?.startsWith('/about') ||
    pathname?.startsWith('/reverse-engineering');

  useEffect(() => {
    // Check if user has dismissed this banner
    const dismissedBanners = localStorage.getItem('dismissedBanners');
    if (dismissedBanners) {
      const dismissed = JSON.parse(dismissedBanners);
      if (dismissed.includes('main-banner')) {
        // Check if dismissal is still valid (24 hours)
        const dismissedAt = localStorage.getItem('bannerDismissedAt');
        if (dismissedAt) {
          const dismissedTime = new Date(dismissedAt).getTime();
          const now = Date.now();
          // Reset dismissal after 24 hours
          if (now - dismissedTime > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('dismissedBanners');
            localStorage.removeItem('bannerDismissedAt');
          } else {
            setDismissed(true);
          }
        }
      }
    }

    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    try {
      const response = await fetch('/api/admin/banner');
      const data = await response.json();
      if (data.banner && data.banner.enabled) {
        setBanner(data.banner);
      }
    } catch (error) {
      console.error('Failed to fetch banner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('dismissedBanners', JSON.stringify(['main-banner']));
    localStorage.setItem('bannerDismissedAt', new Date().toISOString());
  };

  // Don't show on player/details pages or if dismissed/loading/no banner
  if (loading || !banner || dismissed || isHiddenPage) {
    return null;
  }

  return (
    <div className={`${styles.banner} ${styles[banner.type]}`}>
      <div className={styles.content}>
        <span className={styles.icon}>
          {banner.type === 'info' && 'ℹ️'}
          {banner.type === 'warning' && '⚠️'}
          {banner.type === 'success' && '✅'}
          {banner.type === 'error' && '🚨'}
        </span>
        <span className={styles.message}>{banner.message}</span>
        {banner.linkText && banner.linkUrl && (
          <a 
            href={banner.linkUrl} 
            className={styles.link}
            target={banner.linkUrl.startsWith('http') ? '_blank' : undefined}
            rel={banner.linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {banner.linkText} →
          </a>
        )}
      </div>
      {banner.dismissible && (
        <button 
          className={styles.dismissBtn} 
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      )}
    </div>
  );
}
