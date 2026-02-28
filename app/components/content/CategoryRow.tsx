'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ContentCard } from './ContentCard';
import type { MediaItem } from '@/types/media';
import { shouldReduceAnimations } from '@/lib/utils/performance';

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
export const CategoryRow: React.FC<CategoryRowProps> = ({
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
  const [reduceMotion, setReduceMotion] = useState(false);

  // Check for reduced motion preference on mount
  useEffect(() => {
    setReduceMotion(shouldReduceAnimations());
  }, []);

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
        {/* Left arrow - simplified for low-end devices */}
        {reduceMotion ? (
          canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
              aria-label="Scroll left"
              disabled={isScrolling}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )
        ) : (
          <AnimatePresence>
            {canScrollLeft && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 hover:scale-110 transform"
                aria-label="Scroll left"
                disabled={isScrolling}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {/* Right arrow - simplified for low-end devices */}
        {reduceMotion ? (
          canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
              aria-label="Scroll right"
              disabled={isScrolling}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        ) : (
          <AnimatePresence>
            {canScrollRight && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 hover:scale-110 transform"
                aria-label="Scroll right"
                disabled={isScrolling}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        )}

        {/* Cards container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-6 py-2 scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.map((item, index) => (
            reduceMotion ? (
              // Simple version for low-end devices - no staggered animations
              <div
                key={`${item.mediaType || 'content'}-${item.id}`}
                className="flex-shrink-0 w-[140px] sm:w-[180px] md:w-[220px]"
              >
                <ContentCard
                  item={item}
                  onSelect={(id) => {
                    if (onItemClick) {
                      onItemClick(item);
                    } else {
                      onItemSelect?.(id);
                    }
                  }}
                  priority={index < 6}
                />
              </div>
            ) : (
              // Full animation version for capable devices
              <motion.div
                key={`${item.mediaType || 'content'}-${item.id}`}
                className="flex-shrink-0 w-[140px] sm:w-[180px] md:w-[220px]"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.95 }}
                transition={{
                  delay: Math.min(index * 0.05, 0.5),
                  duration: 0.4,
                }}
              >
                <ContentCard
                  item={item}
                  onSelect={(id) => {
                    if (onItemClick) {
                      onItemClick(item);
                    } else {
                      onItemSelect?.(id);
                    }
                  }}
                  priority={index < 6}
                />
              </motion.div>
            )
          ))}
        </div>

        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  );
};

export default CategoryRow;
