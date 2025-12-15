'use client';

import { useRef, useState, useEffect, memo, useCallback } from 'react';
import { ContentCard } from './ContentCard';
import type { MediaItem } from '@/types/media';

export interface CategoryRowProps {
  title: string;
  items: MediaItem[];
  onItemSelect?: (id: string) => void;
  onItemClick?: (item: MediaItem) => void;
  onViewAll?: () => void;
  className?: string;
}

/**
 * CategoryRow - Horizontal scrolling row of content cards
 * Features:
 * - Smooth horizontal scrolling
 * - Navigation arrows
 * - Snap scrolling
 * - Touch/swipe support
 * - Keyboard navigation
 */
export const CategoryRow: React.FC<CategoryRowProps> = memo(({
  title,
  items,
  onItemSelect,
  onItemClick,
  onViewAll,
  className = '',
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollPosition();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    window.addEventListener('resize', checkScrollPosition);

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
      window.removeEventListener('resize', checkScrollPosition);
    };
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container || isScrolling) return;

    setIsScrolling(true);
    const scrollAmount = container.clientWidth * 0.8;
    const targetScroll = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });

    setTimeout(() => setIsScrolling(false), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scroll('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scroll('right');
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`category-row ${className}`} onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          {title}
        </h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium flex items-center gap-1 group"
            aria-label={`View all ${title}`}
          >
            View All
            <svg
              className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable container */}
      <div className="relative group">
        {/* Left arrow - CSS only */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/90 hover:scale-110"
            aria-label="Scroll left"
            disabled={isScrolling}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right arrow - CSS only */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/90 hover:scale-110"
            aria-label="Scroll right"
            disabled={isScrolling}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Cards container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-6 py-2 scroll-smooth snap-x snap-mandatory"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {items.map((item, index) => (
            <CategoryRowCard
              key={item.id}
              item={item}
              index={index}
              onItemClick={onItemClick}
              onItemSelect={onItemSelect}
            />
          ))}
        </div>

        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
});

CategoryRow.displayName = 'CategoryRow';

// Memoized card wrapper for better performance
const CategoryRowCard = memo(function CategoryRowCard({
  item,
  index,
  onItemClick,
  onItemSelect,
}: {
  item: MediaItem;
  index: number;
  onItemClick?: (item: MediaItem) => void;
  onItemSelect?: (id: string) => void;
}) {
  const handleSelect = useCallback((id: string) => {
    if (onItemClick) {
      onItemClick(item);
    } else {
      onItemSelect?.(id);
    }
  }, [item, onItemClick, onItemSelect]);

  return (
    <div
      className="flex-shrink-0 w-[160px] sm:w-[200px] md:w-[220px] snap-start"
      style={{
        animation: index < 12 ? `fadeSlideIn 0.3s ease-out ${Math.min(index * 0.03, 0.3)}s both` : 'none',
      }}
    >
      <ContentCard
        item={item}
        onSelect={handleSelect}
        priority={index < 6}
      />
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
});

export default CategoryRow;
