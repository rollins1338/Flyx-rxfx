'use client';

import { useState, useCallback, memo } from 'react';
import Image from 'next/image';
import type { MediaItem } from '@/types/media';

export interface ContentCardProps {
  item: MediaItem;
  onSelect?: (id: string) => void;
  priority?: boolean;
  className?: string;
}

/**
 * ContentCard - Optimized display component for movies and TV shows
 * Performance optimizations:
 * - Uses CSS transforms instead of Framer Motion
 * - Memoized to prevent unnecessary re-renders
 * - Simplified hover effects
 * - Native lazy loading
 */
export const ContentCard: React.FC<ContentCardProps> = memo(({
  item,
  onSelect,
  priority = false,
  className = '',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = useCallback(() => {
    onSelect?.(String(item.id));
  }, [onSelect, item.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(String(item.id));
    }
  }, [onSelect, item.id]);

  // Format rating
  const rating = item.rating || item.vote_average || 0;
  const formattedRating = rating.toFixed(1);

  // Get rating color
  const ratingColor = rating >= 7 ? 'text-green-400' : rating >= 5 ? 'text-yellow-400' : 'text-red-400';

  // Get poster URL - use smaller size for better performance
  const posterUrl = item.posterPath || item.poster_path || '';

  return (
    <div 
      className={`content-card group cursor-pointer ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-tv-focusable="true"
      tabIndex={0}
      role="button"
      aria-label={`${item.title || item.name} - ${item.mediaType === 'movie' ? 'Movie' : 'TV Show'}`}
    >
      <div className="relative overflow-hidden rounded-xl bg-gray-800/50 transform transition-all duration-200 ease-out group-hover:scale-[1.02] group-hover:-translate-y-1 group-focus-within:scale-[1.02] group-focus-within:-translate-y-1 group-focus-within:ring-2 group-focus-within:ring-purple-500">
        {/* Poster Image */}
        <div className="relative aspect-[2/3] w-full bg-gray-900">
          {posterUrl && !imageError ? (
            <>
              {/* Loading placeholder */}
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800 animate-pulse" />
              )}
              
              <Image
                src={posterUrl}
                alt={item.title || item.name || 'Content'}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
                className={`object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                priority={priority}
                loading={priority ? 'eager' : 'lazy'}
              />
            </>
          ) : (
            /* Fallback for missing/error images */
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center p-2">
                <div className="text-3xl mb-1">
                  {item.mediaType === 'movie' ? '🎬' : '📺'}
                </div>
                <p className="text-xs text-gray-400 font-medium line-clamp-2">
                  {item.title || item.name || 'Untitled'}
                </p>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

          {/* Rating badge - simplified */}
          <div className="absolute top-2 right-2 z-10">
            <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-md flex items-center gap-1">
              <svg className={`w-3 h-3 ${ratingColor}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className={`text-xs font-bold ${ratingColor}`}>
                {formattedRating}
              </span>
            </div>
          </div>

          {/* Media type badge */}
          <div className="absolute top-2 left-2 z-10">
            <div className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
              <span className="text-xs font-semibold text-white uppercase">
                {item.mediaType === 'movie' ? 'Movie' : 'TV'}
              </span>
            </div>
          </div>

          {/* Play button overlay - CSS only */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-purple-600/90 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Content info - simplified */}
        <div className="p-3 space-y-1">
          <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
            {item.title || item.name || 'Untitled'}
          </h3>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            {(item.releaseDate || item.release_date || item.first_air_date) && (
              <span>{new Date(item.releaseDate || item.release_date || item.first_air_date || '').getFullYear()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ContentCard.displayName = 'ContentCard';

export default ContentCard;
