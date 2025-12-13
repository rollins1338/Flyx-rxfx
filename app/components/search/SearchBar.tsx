/**
 * SearchBar Component
 * Expanding search bar with smooth animations and keyboard navigation
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import styles from './SearchBar.module.css';

export interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search movies and TV shows...',
  autoFocus = false,
  expanded: controlledExpanded,
  onExpandChange,
}) => {
  const [query, setQuery] = useState('');
  const [internalExpanded, setInternalExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { trackSearch, trackInteraction } = useAnalytics();
  
  // Use controlled or uncontrolled expanded state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  // Debounce search query with 150ms delay
  const debouncedQuery = useDebounce(query, 150);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      onSearch(debouncedQuery);
      
      // Track search event
      trackSearch({
        query: debouncedQuery,
        resultsCount: 0, // Will be updated when results are received
      });
    }
  }, [debouncedQuery, onSearch, trackSearch]);

  // Auto-focus when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      handleExpand();
    }
  }, [autoFocus]);

  const handleExpand = () => {
    const newExpanded = true;
    if (controlledExpanded === undefined) {
      setInternalExpanded(newExpanded);
    }
    onExpandChange?.(newExpanded);
    
    trackInteraction({
      element: 'search_bar',
      action: 'click',
      context: {
        action_type: 'expand',
      },
    });
  };

  const handleCollapse = () => {
    if (!query.trim()) {
      const newExpanded = false;
      if (controlledExpanded === undefined) {
        setInternalExpanded(newExpanded);
      }
      onExpandChange?.(newExpanded);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
    
    trackInteraction({
      element: 'search_bar',
      action: 'click',
      context: {
        action_type: 'clear',
        previousQuery: query,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query) {
        handleClear();
      } else {
        handleCollapse();
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className={`${styles.searchBar} ${expanded ? styles.expanded : ''}`}>
      <button
        className={styles.searchIcon}
        onClick={handleExpand}
        aria-label="Search"
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <input
        ref={inputRef}
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onFocus={handleExpand}
        onBlur={handleCollapse}
        onKeyDown={handleKeyDown}
        aria-label="Search input"
      />

      {query && (
        <button
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Clear search"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;
