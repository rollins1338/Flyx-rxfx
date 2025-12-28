/**
 * Category Filters Component
 * Clean dropdown for sport categories with live toggle
 */

import { memo, useState, useRef, useEffect } from 'react';
import styles from '../LiveTV.module.css';

interface LiveCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface CategoryFiltersProps {
  categories: LiveCategory[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  showLiveOnly: boolean;
  onLiveOnlyChange: (showLive: boolean) => void;
}

export const CategoryFilters = memo(function CategoryFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  showLiveOnly,
  onLiveOnlyChange,
}: CategoryFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCategoryData = categories.find(c => c.id === selectedCategory) || categories[0];
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const handleCategorySelect = (categoryId: string) => {
    onCategoryChange(categoryId);
    setIsOpen(false);
  };

  return (
    <div className={styles.filtersBar}>
      {/* Live Only Toggle */}
      <button
        onClick={() => onLiveOnlyChange(!showLiveOnly)}
        className={`${styles.liveToggle} ${showLiveOnly ? styles.active : ''}`}
        aria-pressed={showLiveOnly}
      >
        <span className={styles.liveDotIndicator}></span>
        <span>Live Only</span>
      </button>

      {/* Category Dropdown */}
      <div className={styles.categoryDropdownWrapper} ref={dropdownRef}>
        <button
          className={styles.categoryDropdownTrigger}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className={styles.categoryDropdownIcon}>
            {selectedCategoryData?.icon || '🏆'}
          </span>
          <span className={styles.categoryDropdownLabel}>
            {selectedCategoryData?.name || 'All Sports'}
          </span>
          <span className={styles.categoryDropdownCount}>
            {selectedCategory === 'all' ? totalCount : selectedCategoryData?.count || 0}
          </span>
          <svg 
            className={`${styles.categoryDropdownChevron} ${isOpen ? styles.open : ''}`}
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className={styles.categoryDropdownMenu} role="listbox">
            <div className={styles.categoryDropdownScroll}>
              {categories.map((category) => {
                const isActive = selectedCategory === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={`${styles.categoryDropdownItem} ${isActive ? styles.active : ''}`}
                    role="option"
                    aria-selected={isActive}
                  >
                    <span className={styles.categoryDropdownItemIcon}>{category.icon}</span>
                    <span className={styles.categoryDropdownItemName}>{category.name}</span>
                    <span className={styles.categoryDropdownItemCount}>{category.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});