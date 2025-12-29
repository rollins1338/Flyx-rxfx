/**
 * Custom hook for managing LiveTV data and state
 * Consolidates all data fetching and state management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

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

export interface DLHDChannel {
  id: string;
  name: string;
  category: string;
  country: string;
  firstLetter: string;
  categoryInfo?: { name: string; icon: string };
  countryInfo?: { name: string; flag: string };
}

export interface LiveCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface LiveTVState {
  events: LiveEvent[];
  dlhdChannels: DLHDChannel[];
  categories: LiveCategory[];
  loading: boolean;
  error: string | null;
  selectedSource: 'all' | 'channels' | 'dlhd' | 'ppv' | 'cdnlive';
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

const CHANNEL_CATEGORY_ICONS: Record<string, { name: string; icon: string }> = {
  sports: { name: 'Sports', icon: '⚽' },
  entertainment: { name: 'Entertainment', icon: '🎬' },
  movies: { name: 'Movies', icon: '🎥' },
  news: { name: 'News', icon: '📰' },
  kids: { name: 'Kids', icon: '🧸' },
  documentary: { name: 'Documentary', icon: '🌍' },
  music: { name: 'Music', icon: '🎵' },
};

// Keywords to categorize CDN Live channels
const SPORT_KEYWORDS = ['sport', 'espn', 'fox sport', 'bein', 'dazn', 'arena', 'sky sport', 
  'canal sport', 'eleven', 'polsat sport', 'cosmote', 'nova sport', 'match', 'premier', 
  'football', 'soccer', 'nba', 'nfl', 'nhl', 'mlb', 'tennis', 'golf', 'f1', 'motorsport'];

function categorizeChannel(channelName: string): string {
  const nameLower = channelName.toLowerCase();
  for (const keyword of SPORT_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      return 'sports';
    }
  }
  if (nameLower.includes('news') || nameLower.includes('cnn') || nameLower.includes('bbc')) {
    return 'news';
  }
  return 'entertainment';
}

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
    dlhdChannels: [],
    categories: [],
    loading: true,
    error: null,
    selectedSource: 'all',
    selectedCategory: 'all',
    searchQuery: '',
    showLiveOnly: false,
  });

  // Fetch DLHD channels (the actual working channels)
  const fetchDLHDChannels = useCallback(async (): Promise<DLHDChannel[]> => {
    try {
      const response = await fetch('/api/livetv/dlhd-channels');
      if (!response.ok) throw new Error('Failed to fetch DLHD channels');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'DLHD channels API error');

      return data.channels || [];
    } catch (error) {
      console.error('Failed to fetch DLHD channels:', error);
      return [];
    }
  }, []);

  // Fetch DLHD schedule (live events)
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

  // Fetch CDN Live channels (transformed to events)
  const fetchCDNLiveEvents = useCallback(async (): Promise<LiveEvent[]> => {
    try {
      // Use the direct channels API which is more reliable
      const response = await fetch('/api/livetv/cdn-live-channels');
      if (!response.ok) {
        console.warn('CDN Live channels API failed:', response.status);
        return [];
      }
      
      const data = await response.json();
      if (data.error) {
        console.warn('CDN Live API returned error:', data.error);
        return [];
      }

      const channels = data.channels || [];
      
      // Transform channels into events
      // Only include online channels
      const events: LiveEvent[] = channels
        .filter((channel: any) => channel.status === 'online')
        .map((channel: any) => ({
          id: `cdnlive-${channel.name.toLowerCase().replace(/\s+/g, '-')}-${channel.code}`,
          title: channel.name,
          sport: categorizeChannel(channel.name),
          time: 'Live',
          isLive: true,
          source: 'cdnlive' as const,
          poster: channel.image,
          viewers: channel.viewers?.toString(),
          // Store channel name and code for stream URL construction
          cdnliveEmbedId: `${channel.name}|${channel.code}`,
          channels: [{
            name: channel.name,
            // channelId format: "channelName|countryCode" for CDN Live
            channelId: `${channel.name}|${channel.code}`,
            href: channel.url,
          }],
        }));

      return events;
    } catch (error) {
      console.error('Error fetching CDN Live channels:', error);
      return [];
    }
  }, []);

  // Fetch all events and channels
  const fetchAllData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [dlhdEvents, ppvEvents, cdnliveEvents, dlhdChannels] = await Promise.all([
        fetchDLHDEvents(),
        fetchPPVEvents(),
        fetchCDNLiveEvents(),
        fetchDLHDChannels(),
      ]);

      const allEvents = [...dlhdEvents, ...ppvEvents, ...cdnliveEvents];
      
      // Generate categories from events (for sports filtering)
      const sportCategoryMap = new Map<string, number>();
      
      allEvents.forEach(event => {
        if (event.sport) {
          const sport = event.sport.toLowerCase();
          sportCategoryMap.set(sport, (sportCategoryMap.get(sport) || 0) + 1);
        }
      });

      // Generate categories from DLHD channels
      const channelCategoryMap = new Map<string, number>();
      dlhdChannels.forEach((channel: DLHDChannel) => {
        channelCategoryMap.set(channel.category, (channelCategoryMap.get(channel.category) || 0) + 1);
      });

      const categories: LiveCategory[] = [
        { id: 'all', name: 'All', icon: '🏆', count: allEvents.length + dlhdChannels.length },
        // Sport categories from events
        ...Array.from(sportCategoryMap.entries()).map(([sport, count]) => ({
          id: sport,
          name: sport.charAt(0).toUpperCase() + sport.slice(1),
          icon: getSportIcon(sport),
          count,
        })),
        // Channel categories
        ...Array.from(channelCategoryMap.entries()).map(([category, count]) => ({
          id: `channel-${category}`,
          name: CHANNEL_CATEGORY_ICONS[category]?.name || category,
          icon: CHANNEL_CATEGORY_ICONS[category]?.icon || '📺',
          count,
        })),
      ];

      setState(prev => ({
        ...prev,
        events: allEvents,
        dlhdChannels,
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
  }, [fetchDLHDEvents, fetchPPVEvents, fetchCDNLiveEvents, fetchDLHDChannels]);

  // Filter DLHD channels based on current state
  const filteredDLHDChannels = useMemo(() => {
    let filtered = state.dlhdChannels;

    // Filter by category
    if (state.selectedCategory !== 'all') {
      // Check if it's a channel category (prefixed with 'channel-')
      if (state.selectedCategory.startsWith('channel-')) {
        const category = state.selectedCategory.replace('channel-', '');
        filtered = filtered.filter(channel => channel.category === category);
      }
    }

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(channel =>
        channel.name.toLowerCase().includes(query) ||
        channel.category.toLowerCase().includes(query) ||
        channel.country.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [state.dlhdChannels, state.selectedCategory, state.searchQuery]);

  // Filter events based on current state
  const filteredEvents = useMemo(() => {
    let filtered = state.events;

    // Filter by source (skip if 'channels' since that's for DLHD channels, not events)
    if (state.selectedSource !== 'all' && state.selectedSource !== 'channels') {
      filtered = filtered.filter(event => event.source === state.selectedSource);
    }

    // Filter by category (only sport categories, not channel categories)
    if (state.selectedCategory !== 'all' && !state.selectedCategory.startsWith('channel-')) {
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
      channels: state.dlhdChannels.length,
      dlhd: state.events.filter(event => event.source === 'dlhd').length,
      ppv: state.events.filter(event => event.source === 'ppv').length,
      cdnlive: state.events.filter(event => event.source === 'cdnlive').length,
    };

    return {
      live: liveCount,
      total: totalCount + state.dlhdChannels.length,
      sources: sourceStats,
    };
  }, [state.events, state.dlhdChannels]);

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

  // Initial load only
  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual refresh function (no auto-refresh to prevent flickering)
  const refresh = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    // State
    events: filteredEvents,
    dlhdChannels: filteredDLHDChannels,
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