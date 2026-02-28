'use client';

import { useState, useEffect } from 'react';

export type Viewport = 'mobile' | 'tablet' | 'desktop' | 'tv';

const BREAKPOINTS = {
  tablet: 768,
  desktop: 1280,
  tv: 1920,
} as const;

function getViewport(width: number): Viewport {
  if (width >= BREAKPOINTS.tv) return 'tv';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Returns the current viewport category based on window width.
 * mobile: <768, tablet: 768-1279, desktop: 1280-1919, tv: ≥1920
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getViewport(window.innerWidth);
  });

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        setViewport(getViewport(window.innerWidth));
      }, 100);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewport;
}
