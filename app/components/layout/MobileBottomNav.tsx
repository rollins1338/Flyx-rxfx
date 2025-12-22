'use client';

import { usePathname, useRouter } from 'next/navigation';
import styles from './MobileBottomNav.module.css';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide on watch pages for immersive experience
  if (pathname?.startsWith('/watch')) return null;

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'movies',
      label: 'Movies',
      path: '/movies',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      path: '/search',
      isCenter: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      id: 'series',
      label: 'Series',
      path: '/series',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      ),
    },
    {
      id: 'anime',
      label: 'Anime',
      path: '/anime',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname?.startsWith(path + '/');
  };

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''} ${item.isCenter ? styles.center : ''}`}
          onClick={() => router.push(item.path)}
          aria-label={item.label}
          aria-current={isActive(item.path) ? 'page' : undefined}
        >
          <span className={styles.icon}>{item.icon}</span>
          {!item.isCenter && <span className={styles.label}>{item.label}</span>}
        </button>
      ))}
    </nav>
  );
}
