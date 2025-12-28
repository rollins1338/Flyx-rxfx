/**
 * Category Filters Component
 * Horizontal scrollable sport category filters
 */

import { memo } from 'react';
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
  return (
    <div className={styles.filtersSection}>
      <div className={styles.filtersContainer}>
        {/* Live Only Toggle */}
        <button
          onClick={() => onLiveOnlyChange(!showLiveOnly)}
          className={`${styles.liveOnlyButton} ${showLiveOnly ? styles.active : ''}`}
          aria-pressed={showLiveOnly}
        >
          <span className={styles.liveIndicatorDot}></span>
          Live Only
        </button>

        {/* Category Pills */}
        <div className={styles.categoryFilters}>
          <div className={styles.categoryScrollContainer}>
            {categories.map((category) => {
              const isActive = selectedCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className={`${styles.categoryPill} ${isActive ? styles.active : ''}`}
                  aria-pressed={isActive}
                >
                  <span className={styles.categoryIcon}>{category.icon}</span>
                  <span className={styles.categoryName}>{category.name}</span>
                  <span className={styles.categoryCount}>{category.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});