/**
 * SearchSuggestions Component
 * Displays search suggestions with fuzzy matching and recent searches
 */

'use client';

import React, { useEffect, useState } from 'react';
import styles from './SearchSuggestions.module.css';

export interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
  maxSuggestions?: number;
}

const RECENT_SEARCHES_KEY = 'flyx_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// Popular search terms for suggestions
const POPULAR_SEARCHES = [
  'action movies',
  'comedy series',
  'thriller',
  'sci-fi',
  'drama',
  'horror',
  'romance',
  'documentary',
  'anime',
  'marvel',
  'dc comics',
  'star wars',
  'netflix originals',
];

/**
 * Simple fuzzy matching algorithm
 */
function fuzzyMatch(query: string, target: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  
  if (lowerTarget.includes(lowerQuery)) {
    return 1;
  }
  
  let score = 0;
  let queryIndex = 0;
  
  for (let i = 0; i < lowerTarget.length && queryIndex < lowerQuery.length; i++) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      score++;
      queryIndex++;
    }
  }
  
  return queryIndex === lowerQuery.length ? score / lowerQuery.length : 0;
}

/**
 * Get recent searches from localStorage
 */
function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save search to recent searches
 */
export function saveRecentSearch(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return;
  
  try {
    const recent = getRecentSearches();
    const filtered = recent.filter(s => s.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  onSelect,
  maxSuggestions = 5,
}) => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Get fuzzy matched suggestions
  const getSuggestions = (): string[] => {
    if (!query.trim()) {
      return recentSearches.slice(0, maxSuggestions);
    }

    // Combine recent and popular searches
    const uniqueSet = new Set([...recentSearches, ...POPULAR_SEARCHES]);
    const allSuggestions = Array.from(uniqueSet);
    
    // Score and filter suggestions
    const scored = allSuggestions
      .map(suggestion => ({
        text: suggestion,
        score: fuzzyMatch(query, suggestion),
      }))
      .filter(item => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);

    return scored.map(item => item.text);
  };

  const suggestions = getSuggestions();

  if (suggestions.length === 0) {
    return null;
  }

  const handleSelect = (suggestion: string) => {
    saveRecentSearch(suggestion);
    setRecentSearches(getRecentSearches());
    onSelect(suggestion);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  return (
    <div className={styles.suggestions}>
      {!query && recentSearches.length > 0 && (
        <div className={styles.suggestionsHeader}>
          <span className={styles.headerTitle}>Recent Searches</span>
          <button
            className={styles.clearButton}
            onClick={handleClearRecent}
            type="button"
          >
            Clear
          </button>
        </div>
      )}

      <div className={styles.suggestionsList}>
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            className={styles.suggestionItem}
            onClick={() => handleSelect(suggestion)}
            type="button"
          >
            <div className={styles.suggestionIcon}>
              {!query && recentSearches.includes(suggestion) ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 14A6 6 0 108 2a6 6 0 000 12z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 5v3l2 2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M7 13A6 6 0 107 1a6 6 0 000 12zM15 15l-3.35-3.35"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <span className={styles.suggestionText}>{suggestion}</span>
            <div className={styles.suggestionArrow}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchSuggestions;
