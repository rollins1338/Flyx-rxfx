'use client';

import { usePathname } from 'next/navigation';
import { useViewport } from '@/hooks/useViewport';
import { useSidebarState } from '@/hooks/useSidebarState';

/**
 * Injects a <style> tag that sets margin-left on the body to offset
 * content for the fixed sidebar. Using a style tag is more reliable
 * than classList manipulation via useEffect.
 */
export function NavigationBodyStyle() {
  const pathname = usePathname() ?? '/';
  const viewport = useViewport();
  const { collapsed } = useSidebarState();

  const isWatchMode = pathname.startsWith('/watch');
  const isAdminRoute = pathname.startsWith('/admin');
  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';

  let marginLeft = '0px';
  let paddingBottom = '0px';

  if (!isAdminRoute && !isWatchMode) {
    if (isMobile) {
      paddingBottom = 'var(--bottom-tab-height)';
    } else if (isTablet || collapsed) {
      marginLeft = 'var(--sidebar-collapsed-width)';
    } else {
      marginLeft = 'var(--sidebar-width)';
    }
  }

  return (
    <style>{`
      body {
        margin-left: ${marginLeft} !important;
        padding-bottom: ${paddingBottom} !important;
        transition: margin-left 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }
    `}</style>
  );
}
