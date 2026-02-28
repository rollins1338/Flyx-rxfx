'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  tvGroup?: string; // Custom TV navigation group name
}

/**
 * ContentGrid - Responsive grid layout for content cards
 * Features:
 * - Responsive grid with auto-fit columns
 * - Infinite scroll support
 * - Smooth animations
 * - Loading states
 * - Empty state handling
 */
export const ContentGrid: React.FC<ContentGridProps> = ({
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
  const [visibleItems, setVisibleItems] = useState<MediaItem[]>([]);

  // Load items progressively for better performance
  useEffect(() => {
    if (items.length <= 20) {
      setVisibleItems(items);
    } else {
      // Load in batches
      const batchSize = 20;
      let currentBatch = 0;
      
      const loadBatch = () => {
        const start = currentBatch * batchSize;
        const end = start + batchSize;
        const batch = items.slice(start, end);
        
        if (batch.length > 0) {
          setVisibleItems(prev => [...prev, ...batch]);
          currentBatch++;
          
          if (end < items.length) {
            requestAnimationFrame(loadBatch);
          }
        }
      };
      
      setVisibleItems([]);
      loadBatch();
    }
  }, [items]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
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
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [onLoadMore, hasMore, loading]);

  const handleItemSelect = useCallback(
    (id: string) => {
      if (onItemClick) {
        const item = items.find(i => i.id === id);
        if (item) {
          onItemClick(item);
        }
      } else {
        onItemSelect?.(id);
      }
    },
    [onItemSelect, onItemClick, items]
  );

  // Grid layout classes
  const gridClasses = layout === 'grid'
    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6'
    : 'columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4 md:gap-6';

  // Empty state
  if (!loading && visibleItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-6xl mb-4 opacity-50">🎬</div>
        <p className="text-xl text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`content-grid ${className}`}>
      <div className={gridClasses} data-tv-group={tvGroup}>
        <AnimatePresence mode="popLayout">
          {visibleItems.map((item, index) => (
            <motion.div
              key={`${item.mediaType || 'content'}-${item.id}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                duration: 0.3,
                delay: Math.min(index * 0.03, 0.5),
                ease: [0.34, 1.56, 0.64, 1],
              }}
              layout
            >
              <ContentCard
                item={item}
                onSelect={handleItemSelect}
                priority={index < 6}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className={`${gridClasses} mt-6`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <ContentCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasMore && !loading && (
        <div ref={observerTarget} className="h-20 flex items-center justify-center">
          <div className="text-gray-500 text-sm">Loading more...</div>
        </div>
      )}
    </div>
  );
};

/**
 * ContentCardSkeleton - Loading placeholder matching ContentCard layout
 */
const ContentCardSkeleton: React.FC = () => {
  return (
    <div className="content-card-skeleton animate-pulse">
      <div className="bg-gray-800/50 rounded-2xl overflow-hidden border border-gray-700/50">
        {/* Image skeleton */}
        <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 relative">
          <div className="absolute top-2 right-2 w-12 h-12 rounded-full bg-gray-700/50" />
          <div className="absolute top-2 left-2 w-16 h-6 rounded-md bg-gray-700/50" />
        </div>
        
        {/* Content skeleton */}
        <div className="p-4 space-y-2">
          <div className="h-4 bg-gray-700/50 rounded w-3/4" />
          <div className="h-3 bg-gray-700/30 rounded w-1/2" />
          <div className="space-y-1">
            <div className="h-2 bg-gray-700/20 rounded w-full" />
            <div className="h-2 bg-gray-700/20 rounded w-5/6" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentGrid;
