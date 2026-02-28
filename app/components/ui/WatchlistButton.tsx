'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import type { MediaItem } from '@/types/media';

interface WatchlistButtonProps {
  item: MediaItem;
  variant?: 'icon' | 'full' | 'compact';
  className?: string;
}

export function WatchlistButton({ item, variant = 'full', className = '' }: WatchlistButtonProps) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();
  const { trackEvent } = useAnalytics();
  
  const mediaType = (item.mediaType || item.media_type || 'movie') as 'movie' | 'tv';
  const inWatchlist = isInWatchlist(item.id, mediaType);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (inWatchlist) {
      removeFromWatchlist(item.id, mediaType);
      trackEvent('watchlist_removed', { content_id: item.id, source: 'button' });
    } else {
      addToWatchlist(item);
      trackEvent('watchlist_added', { content_id: item.id, source: 'button' });
    }
  };

  if (variant === 'icon') {
    return (
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 text-xl md:text-2xl font-bold ${
          inWatchlist 
            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30' 
            : 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
        } ${className}`}
        aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        data-tv-focusable="true"
      >
        <AnimatePresence mode="wait">
          {inWatchlist ? (
            <motion.span
              key="check"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className="leading-none"
            >
              ✓
            </motion.span>
          ) : (
            <motion.span
              key="plus"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -180 }}
              className="leading-none"
            >
              +
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all duration-300 ${
          inWatchlist 
            ? 'bg-violet-600 text-white' 
            : 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
        } ${className}`}
        aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
        data-tv-focusable="true"
      >
        <AnimatePresence mode="wait">
          {inWatchlist ? (
            <motion.svg
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </motion.svg>
          ) : (
            <motion.svg
              key="plus"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </motion.svg>
          )}
        </AnimatePresence>
        <span className="hidden sm:inline">{inWatchlist ? 'In List' : 'Watchlist'}</span>
      </motion.button>
    );
  }

  // Full variant (default)
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={`px-6 md:px-8 py-3 md:py-4 rounded-full flex items-center justify-center gap-2 md:gap-3 text-base md:text-lg font-semibold transition-all duration-300 ${
        inWatchlist 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' 
          : 'bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20'
      } ${className}`}
      aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
      data-tv-focusable="true"
      data-tv-group="hero-actions"
    >
      <AnimatePresence mode="wait">
        {inWatchlist ? (
          <motion.svg
            key="check"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </motion.svg>
        ) : (
          <motion.svg
            key="plus"
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -180 }}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </motion.svg>
        )}
      </AnimatePresence>
      <span>{inWatchlist ? 'In Watchlist' : 'Add to List'}</span>
    </motion.button>
  );
}

export default WatchlistButton;
