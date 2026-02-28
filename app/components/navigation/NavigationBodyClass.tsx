'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useViewport } from '@/hooks/useViewport';
import { useSidebarState } from '@/hooks/useSidebarState';

/**
 * Applies CSS classes to <body> to offset content for the fixed sidebar.
 * This ensures even absolute-positioned elements respect the sidebar width.
 */
export function NavigationBodyClass() {
  const pathname = usePathname() ?? '/';
  const viewport = useViewport();
  const { collapsed } = useSidebarState();

  const isWatchMode = pathname.startsWith('/watch');
  const isAdminRoute = pathname.startsWith('/admin');
  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';

  useEffect(() => {
    const body = document.body;
    // Remove all nav-related classes first
    body.classList.remove('nav-sidebar', 'nav-rail', 'nav-mobile', 'nav-hidden');

    if (isAdminRoute || isWatchMode) {
      body.classList.add('nav-hidden');
    } else if (isMobile) {
      body.classList.add('nav-mobile');
    } else if (isTablet || collapsed) {
      body.classList.add('nav-rail');
    } else {
      body.classList.add('nav-sidebar');
    }

    return () => {
      body.classList.remove('nav-sidebar', 'nav-rail', 'nav-mobile', 'nav-hidden');
    };
  }, [isWatchMode, isAdminRoute, isMobile, isTablet, collapsed]);

  return null;
}
