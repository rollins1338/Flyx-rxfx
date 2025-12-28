/**
 * Custom hook for managing LiveTV data and state
 * Consolidates all data fetching and state management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CableChannel, CABLE_CHANNELS, CHANNEL_CATEGORIES } from '@/app/lib/data/cable-channels';

export interface LiveEvent {
  id: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  time: string;
  isoTime?: string;
  isLive: boolean;
  source: 'dlhd' | 'ppv' | 'cdnlive';
  poster?: string;
  viewers?: string;
  channels: Array<{
    name: string;
    channelId: string;
    href: string;
  }>;
  // PPV specific
  ppvUriName?: string;
  startsAt?: number;
  endsAt?: number;
  // CDN Live specific
  cdnliveEmbedId?: string;
}

export interface LiveCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface LiveTVState {
  events: LiveEvent[];
  cableChannels: CableChannel[];
  categories: LiveCategory[];
  loading: boolean;
  error: string | null;
  selectedSource: 'all' | 'cable' | 'dlhd' | 'ppv' | 'cdnlive';
  selectedCategory: string;
  searchQuery: string;
  showLiveOnly: boolean;
}

const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'am. football': '🏈', 'nfl': '🏈', 'darts': '🎯', '24/7': '📺',
};

function getSportIcon(sport: string): string {
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📺';
}

function formatLocalTime(isoTime?: string, fallbackTime?: string): string {
  if (isoTime) {
    try {
      const date = new Date(isoTime);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch {}
  }
  return fallbackTime || '';
}

export function useLiveTVData() {
  const [state, setState] = useState<LiveTVState>({
    events: [],
    cableChannels: [],
    categories: [],
    loading: true,
    error: null,
    selectedSource: 'all',
    selectedCategory: 'all',
    searchQuery: '',
    showLiveOnly: false,
  });

  // Fetch cable channels
  const fetchCableChannels = useCallback(async (): Promise<CableChannel[]> => {
    try {
      // For now, return the static cable channels list
      // In the future, this could fetch from Stalker portals or other sources
      return CABLE_CHANNELS;
    } catch (error) {
      console.error('Failed to fetch cable channels:', error);
      return [];
    }
  }, []);

  // Fetch DLHD schedule
  const fetchDLHDEvents = useCallback(async (): Promise<LiveEvent[]> => {
    try {
      const response = await fetch('/api/livetv/schedule');
      if (!response.ok) throw new Error('Failed to fetch DLHD events');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'DLHD API error');

      const events: LiveEvent[] = [];
      
      for (const category of data.schedule.categories) {
        for (const event of category.events) {
          events.push({
            id: `dlhd-${event.id}`,
            title: event.title,
            sport: event.sport,
            league: event.league,
            teams: event.teams,
            time: formatLocalTime(event.isoTime, event.time),
            isoTime: event.isoTime,
            isLive: event.isLive,
            source: 'dlhd',
            channels: event.channels,
          });
        }
      }

      return events;
    } catch (error) {
      console.error('Error fetching DLHD events:', error);
      return [];
    }
  }, []);

  // Fetch PPV streams
  const fetchPPVEvents = useCallback(async (): Promise<LiveEvent[]> => {
    try {
      const response = await fetch('/api/livetv/ppv-streams');
      if (!response.ok) throw new Error('Failed to fetch PPV streams');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'PPV API error');

      const events: LiveEvent[] = [];
      
      for (const category of data.categories) {
        for (const stream of category.streams) {
          const startTime = new Date(stream.startsAt * 1000);
          events.push({
            id: `ppv-${stream.id}`,
            title: stream.name,
            sport: category.name,
            time: startTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }),
            isLive: stream.isLive || stream.isAlwaysLive,
            source: 'ppv',
            poster: stream.poster,
            viewers: stream.viewers,
            ppvUriName: stream.uriName,
            startsAt: stream.startsAt,
            endsAt: stream.endsAt,
            channels: [{
              name: stream.name,
              channelId: stream.uriName,
              href: `/livetv/ppv/${stream.uriName}`,
            }],
          });
        }
      }

      return events;
    } catch (error) {
      console.error('Error fetching PPV events:', error);
      return [];
    }
  }, []);

  // Fetch all events and cable channels
  const fetchAllData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [dlhdEvents, ppvEvents, cableChannels] = await Promise.all([
        fetchDLHDEvents(),
        fetchPPVEvents(),
        fetchCableChannels(),
      ]);

      const allEvents = [...dlhdEvents, ...ppvEvents];
      
      // Generate categories from events
      const categoryMap = new Map<string, number>();
      
      allEvents.forEach(event => {
        if (event.sport) {
          const sport = event.sport.toLowerCase();
          categoryMap.set(sport, (categoryMap.get(sport) || 0) + 1);
        }
      });

      // Generate categories from cable channels
      const cableCategories = new Map<string, number>();
      cableChannels.forEach(channel => {
        cableCategories.set(channel.category, (cableCategories.get(channel.category) || 0) + 1);
      });

      const categories: LiveCategory[] = [
        { id: 'all', name: 'All', icon: '🏆', count: allEvents.length },
        ...Array.from(categoryMap.entries()).map(([sport, count]) => ({
          id: sport,
          name: sport.charAt(0).toUpperCase() + sport.slice(1),
          icon: getSportIcon(sport),
          count,
        })),
        // Add cable categories when cable source is selected
        ...Array.from(cableCategories.entries()).map(([category, count]) => ({
          id: category,
          name: CHANNEL_CATEGORIES[category as keyof typeof CHANNEL_CATEGORIES]?.name || category,
          icon: CHANNEL_CATEGORIES[category as keyof typeof CHANNEL_CATEGORIES]?.icon || '📺',
          count,
        })),
      ];

      setState(prev => ({
        ...prev,
        events: allEvents,
        cableChannels,
        categories,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load data',
        loading: false,
      }));
    }
  }, [fetchDLHDEvents, fetchPPVEvents, fetchCableChannels]);

  // Filter cable channels based on current state
  const filteredCableChannels = useMemo(() => {
    let filtered = state.cableChannels;

    // Filter by category (for cable channels, use channel categories)
    if (state.selectedCategory !== 'all') {
      // Map sport categories to channel categories
      const categoryMapping: Record<string, string[]> = {
        'sports': ['sports'],
        'news': ['news'],
        'entertainment': ['entertainment', 'movies'],
        'kids': ['kids'],
        'movies': ['movies'],
        'documentary': ['documentary'],
        'music': ['music'],
      };
      
      const channelCategories = categoryMapping[state.selectedCategory] || [state.selectedCategory];
      filtered = filtered.filter(channel => 
        channelCategories.includes(channel.category)
      );
    }

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(channel =>
        channel.name.toLowerCase().includes(query) ||
        channel.shortName.toLowerCase().includes(query) ||
        channel.aliases.some(alias => alias.toLowerCase().includes(query)) ||
        channel.category.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [state.cableChannels, state.selectedCategory, state.searchQuery]);

  // Filter events based on current state
  const filteredEvents = useMemo(() => {
    let filtered = state.events;

    // Filter by source
    if (state.selectedSource !== 'all') {
      filtered = filtered.filter(event => event.source === state.selectedSource);
    }

    // Filter by category
    if (state.selectedCategory !== 'all') {
      filtered = filtered.filter(event => 
        event.sport?.toLowerCase() === state.selectedCategory
      );
    }

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.sport?.toLowerCase().includes(query) ||
        event.league?.toLowerCase().includes(query) ||
        event.teams?.home.toLowerCase().includes(query) ||
        event.teams?.away.toLowerCase().includes(query)
      );
    }

    // Filter by live only
    if (state.showLiveOnly) {
      filtered = filtered.filter(event => event.isLive);
    }

    return filtered;
  }, [state.events, state.selectedSource, state.selectedCategory, state.searchQuery, state.showLiveOnly]);

  // Stats
  const stats = useMemo(() => {
    const liveCount = state.events.filter(event => event.isLive).length;
    const totalCount = state.events.length;
    const sourceStats = {
      cable: state.cableChannels.length,
      dlhd: state.events.filter(event => event.source === 'dlhd').length,
      ppv: state.events.filter(event => event.source === 'ppv').length,
      cdnlive: state.events.filter(event => event.source === 'cdnlive').length,
    };

    return {
      live: liveCount,
      total: totalCount + state.cableChannels.length,
      sources: sourceStats,
    };
  }, [state.events, state.cableChannels]);

  // Actions
  const setSelectedSource = useCallback((source: LiveTVState['selectedSource']) => {
    setState(prev => ({ ...prev, selectedSource: source }));
  }, []);

  const setSelectedCategory = useCallback((category: string) => {
    setState(prev => ({ ...prev, selectedCategory: category }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setShowLiveOnly = useCallback((showLive: boolean) => {
    setState(prev => ({ ...prev, showLiveOnly: showLive }));
  }, []);

  const refresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchAllData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  return {
    // State
    events: filteredEvents,
    cableChannels: filteredCableChannels,
    categories: state.categories,
    loading: state.loading,
    error: state.error,
    selectedSource: state.selectedSource,
    selectedCategory: state.selectedCategory,
    searchQuery: state.searchQuery,
    showLiveOnly: state.showLiveOnly,
    stats,
    
    // Actions
    setSelectedSource,
    setSelectedCategory,
    setSearchQuery,
    setShowLiveOnly,
    refresh,
  };
}