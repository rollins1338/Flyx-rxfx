'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { MediaItem } from '@/types/media';
import { queueSync } from '@/lib/sync/auto-sync';

export interface WatchlistItem {
  id: number | string;
  title: string;
  posterPath: string;
  backdropPath?: string;
  mediaType: 'movie' | 'tv';
  releaseDate?: string;
  rating?: number;
  overview?: string;
  genres?: { id: number; name: string }[];
  addedAt: number;
}

interface WatchlistContextType {
  items: WatchlistItem[];
  addToWatchlist: (item: MediaItem) => void;
  removeFromWatchlist: (id: number | string) => void;
  isInWatchlist: (id: number | string) => boolean;
  clearWatchlist: () => void;
}

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const STORAGE_KEY = 'flyx_watchlist';

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch (err) {
      console.error('[Watchlist] Error loading from localStorage:', err);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when items change and trigger sync
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        // Queue sync to server when watchlist changes
        queueSync();
      } catch (err) {
        console.error('[Watchlist] Error saving to localStorage:', err);
      }
    }
  }, [items, isLoaded]);

  const addToWatchlist = useCallback((item: MediaItem) => {
    const posterUrl = item.posterPath || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '');
    const backdropUrl = item.backdropPath || (item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : '');
    const mediaTypeValue = (item.mediaType || item.media_type || 'movie') as 'movie' | 'tv';
    
    const watchlistItem: WatchlistItem = {
      id: item.id,
      title: item.title || item.name || 'Unknown',
      posterPath: posterUrl,
      backdropPath: backdropUrl,
      mediaType: mediaTypeValue,
      releaseDate: item.releaseDate || item.release_date || item.first_air_date,
      rating: item.rating || item.vote_average,
      overview: item.overview,
      genres: item.genres,
      addedAt: Date.now(),
    };

    setItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [watchlistItem, ...prev];
    });
  }, []);

  const removeFromWatchlist = useCallback((id: number | string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const isInWatchlist = useCallback((id: number | string) => {
    return items.some(item => item.id === id);
  }, [items]);

  const clearWatchlist = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <WatchlistContext.Provider value={{ items, addToWatchlist, removeFromWatchlist, isInWatchlist, clearWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
}
