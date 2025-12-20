'use client';

import { usePathname, useRouter } from 'next/navigation';
import styles from './MobileBottomNav.module.css';

interface MobileBottomNavProps {
  visible?: boolean;
}

export default function MobileBottomNav({ visible = true }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (!visible) return null;

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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="2" />
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
      isSearch: true,
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
          <rect x="2" y="7" width="20" height="15" rx="2" />
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
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const handleClick = (path: string) => {
    router.push(path);
  };

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${isActive(item.path) ? styles.active : ''} ${item.isSearch ? styles.searchItem : ''}`}
          onClick={() => handleClick(item.path)}
          aria-label={item.label}
          aria-current={isActive(item.path) ? 'page' : undefined}
        >
          {item.isSearch ? (
            <span className={styles.searchIcon}>{item.icon}</span>
          ) : (
            <span className={styles.icon}>{item.icon}</span>
          )}
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
