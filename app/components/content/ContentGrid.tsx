'use client';

import { useCallback, useRef, useState, useEffect, memo } from 'react';
import { ContentCard } from './ContentCard';
import type { MediaItem } from '@/types/media';

export interface ContentGridProps {
  items: MediaItem[];
  onItemSelect?: (id: string) => void;
  onItemClick?: (item: MediaItem) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  layout?: 'grid' | 'masonry';
  className?: string;
  emptyMessage?: string;
  tvGroup?: string;
}

/**
 * ContentGrid - Optimized responsive grid layout for content cards
 * Performance optimizations:
 * - Uses CSS animations instead of Framer Motion
 * - Progressive loading with intersection observer
 * - Memoized components to prevent unnecessary re-renders
 * - Reduced animation complexity
 */
export const ContentGrid: React.FC<ContentGridProps> = memo(({
  items,
  onItemSelect,
  onItemClick,
  onLoadMore,
  hasMore = false,
  loading = false,
  layout = 'grid',
  className = '',
  emptyMessage = 'No content found',
  tvGroup = 'content-grid',
}) => {
  const observerTarget = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(24); // Start with 24 items

  // Progressive loading - show more items as user scrolls
  useEffect(() => {
    if (items.length <= visibleCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 12, items.length));
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [items.length, visibleCount]);

  // Reset visible count when items change
  useEffect(() => {
    setVisibleCount(24);
  }, [items]);

  // Infinite scroll for loading more from API
  useEffect(() => {
    if (!onLoadMore || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount >= items.length) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [onLoadMore, hasMore, loading, visibleCount, items.length]);

  const handleItemSelect = useCallback(
    (id: string) => {
      if (onItemClick) {
        const item = items.find(i => i.id === id);
        if (item) onItemClick(item);
      } else {
        onItemSelect?.(id);
      }
    },
    [onItemSelect, onItemClick, items]
  );

  // Grid layout classes
  const gridClasses = layout === 'grid'
    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4'
    : 'columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 md:gap-4';

  // Empty state
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-6xl mb-4 opacity-50">🎬</div>
        <p className="text-xl text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  const visibleItems = items.slice(0, visibleCount);

  return (
    <div ref={containerRef} className={`content-grid ${className}`}>
      <div className={gridClasses} data-tv-group={tvGroup}>
        {visibleItems.map((item, index) => (
          <div
            key={item.id}
            className="content-grid-item"
            style={{
              animation: index < 24 ? `fadeInUp 0.3s ease-out ${Math.min(index * 0.02, 0.3)}s both` : 'none',
            }}
          >
            <ContentCard
              item={item}
              onSelect={handleItemSelect}
              priority={index < 6}
            />
          </div>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className={`${gridClasses} mt-4`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <ContentCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      {/* Progressive/Infinite scroll trigger */}
      {(visibleCount < items.length || hasMore) && !loading && (
        <div ref={observerTarget} className="h-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* CSS Animation keyframes */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
});

ContentGrid.displayName = 'ContentGrid';

/**
 * ContentCardSkeleton - Optimized loading placeholder
 */
const ContentCardSkeleton: React.FC = memo(() => {
  return (
    <div className="content-card-skeleton">
      <div className="bg-gray-800/50 rounded-xl overflow-hidden">
        <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
        <div className="p-3 space-y-2">
          <div className="h-4 bg-gray-700/50 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-700/30 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    </div>
  );
});

ContentCardSkeleton.displayName = 'ContentCardSkeleton';

export default ContentGrid;
