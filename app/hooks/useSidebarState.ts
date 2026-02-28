'use client';

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'flyx_sidebar_collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false; // Default to expanded on read failure
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore write errors (private browsing, full storage, etc.)
  }
}

/**
 * Manages sidebar collapsed/expanded state persisted to localStorage.
 * Defaults to expanded (false) on read failure.
 */
export function useSidebarState(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
