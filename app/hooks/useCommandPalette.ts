'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Manages command palette open state and registers global Ctrl+K / Cmd+K shortcut.
 * Shortcut is disabled on `/watch` routes.
 */
export function useCommandPalette(): { open: boolean; setOpen: (v: boolean) => void } {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire on /watch routes
      if (pathname?.startsWith('/watch')) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    },
    [pathname],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { open, setOpen };
}
