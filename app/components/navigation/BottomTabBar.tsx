'use client';

import Link from 'next/link';
import { BOTTOM_TAB_ITEMS } from './nav-config';
import { isActiveRoute } from './nav-utils';
import styles from './navigation.module.css';

export interface BottomTabBarProps {
  currentPath: string;
}

export function BottomTabBar({ currentPath }: BottomTabBarProps) {
  // Hidden on /watch routes
  if (currentPath.startsWith('/watch')) return null;

  return (
    <nav className={styles.bottomTabBar} aria-label="Mobile navigation">
      {BOTTOM_TAB_ITEMS.map((item) => {
        const active = isActiveRoute(item.path, currentPath);
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.path}
            className={`${styles.tabItem} ${active ? styles.tabItemActive : ''}`}
            aria-current={active ? 'page' : undefined}
            data-tv-focusable="true"
            data-tv-group="bottom-tab"
          >
            <Icon className={styles.tabIcon} />
            <span className={styles.tabLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomTabBar;
