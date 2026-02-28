'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { NAV_ITEMS } from './nav-config';
import { filterCommandItems, type CommandItem } from './nav-utils';
import styles from './navigation.module.css';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// Build command items from nav config
const NAV_COMMAND_ITEMS: CommandItem[] = NAV_ITEMS.map(item => ({
  id: item.id,
  label: item.label,
  path: item.path,
  icon: null, // Icons rendered via item.icon component in JSX
  section: 'navigation' as const,
}));

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<Element | null>(null);
  const router = useRouter();

  const filtered = filterCommandItems(NAV_COMMAND_ITEMS, query);

  // Build results list: filtered nav items + search option when query is non-empty
  const hasQuery = query.trim().length > 0;
  const results = hasQuery
    ? [...filtered, { id: '__search__', label: `Search for '${query.trim()}'`, path: `/search?q=${encodeURIComponent(query.trim())}`, icon: null, section: 'navigation' as const }]
    : filtered;

  // Capture trigger element and auto-focus input on open
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      setQuery('');
      setFocusedIndex(0);
      // Delay to ensure overlay is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      // Return focus to trigger element on close
      if (triggerRef.current && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    }
  }, [open]);

  // Navigate to a result and close
  const selectResult = useCallback((path: string) => {
    router.push(path);
    onClose();
  }, [router, onClose]);

  // Keyboard handling within the palette
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % (results.length + 1)); // +1 for input
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + results.length + 1) % (results.length + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex > 0 && results[focusedIndex - 1]) {
          selectResult(results[focusedIndex - 1].path);
        } else if (focusedIndex === 0 && hasQuery) {
          selectResult(`/search?q=${encodeURIComponent(query.trim())}`);
        }
        break;
      case 'Tab':
        // Trap focus within the overlay
        e.preventDefault();
        if (e.shiftKey) {
          setFocusedIndex(prev => (prev - 1 + results.length + 1) % (results.length + 1));
        } else {
          setFocusedIndex(prev => (prev + 1) % (results.length + 1));
        }
        break;
    }
  }, [results, focusedIndex, hasQuery, query, selectResult, onClose]);

  // Update focus when focusedIndex changes
  useEffect(() => {
    if (!open) return;
    if (focusedIndex === 0) {
      inputRef.current?.focus();
    } else {
      resultRefs.current[focusedIndex - 1]?.focus();
    }
  }, [focusedIndex, open]);

  // Close on overlay backdrop click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.paletteOverlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.palettePanel}>
        <input
          ref={inputRef}
          className={styles.paletteInput}
          type="text"
          placeholder="Search pages or type a command…"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setFocusedIndex(0);
          }}
          aria-label="Search commands"
        />
        <div className={styles.paletteResults} role="listbox" data-tv-group="command-palette">
          {results.map((item, index) => {
            const Icon = item.id === '__search__'
              ? Search
              : NAV_ITEMS.find(n => n.id === item.id)?.icon ?? Search;
            const isFocused = focusedIndex === index + 1;
            return (
              <button
                key={item.id}
                ref={el => { resultRefs.current[index] = el; }}
                className={`${styles.paletteItem} ${isFocused ? styles.paletteItemFocused : ''}`}
                onClick={() => selectResult(item.path)}
                role="option"
                aria-selected={isFocused}
                tabIndex={-1}
                data-tv-focusable="true"
              >
                <Icon className={styles.navIcon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
