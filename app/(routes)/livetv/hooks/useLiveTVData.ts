/**
 * Custom hook for managing LiveTV data and state
 * Provider-based architecture with separate data for each provider
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type Provider = 'dlhd' | 'cdnlive' | 'ppv' | 'streamed';

export interface LiveEvent {
  id: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  time: string;
  isoTime?: string;
  isLive: boolean;
  source: Provider;
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
  // Streamed specific
  streamedId?: string;
  streamedSources?: Array<{ source: string; id: string }>;
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

export interface ProviderData {
  events: LiveEvent[];
  channels: DLHDChannel[];
  categories: LiveCategory[];
  loading: boolean;
  error: string | null;
}

export interface ProviderStats {
  dlhd: { events: number; channels: number; live: number };
  cdnlive: { channels: number };
  ppv: { events: number; live: number };
  streamed: { events: number; live: number };
}

const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'am. football': '🏈', 'american-football': '🏈', 'nfl': '🏈', 
  'darts': '🎯', '24/7': '📺', 'fight': '🥊', 'other': '📺',
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

function generateCategories(events: LiveEvent[], channels: DLHDChannel[], isChannelView: boolean): LiveCategory[] {
  if (isChannelView) {
    // Generate categories from channels
    const categoryMap = new Map<string, number>();
    channels.forEach(channel => {
      categoryMap.set(channel.category, (categoryMap.get(channel.category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        id: category,
        name: CHANNEL_CATEGORY_ICONS[category]?.name || category.charAt(0).toUpperCase() + category.slice(1),
        icon: CHANNEL_CATEGORY_ICONS[category]?.icon || '📺',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  } else {
    // Generate categories from events (sports)
    const sportMap = new Map<string, number>();
    events.forEach(event => {
      if (event.sport) {
        const sport = event.sport.toLowerCase();
        sportMap.set(sport, (sportMap.get(sport) || 0) + 1);
      }
    });

    return Array.from(sportMap.entries())
      .map(([sport, count]) => ({
        id: sport,
        name: sport.charAt(0).toUpperCase() + sport.slice(1).replace(/-/g, ' '),
        icon: getSportIcon(sport),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }
}

export function useLiveTVData() {
  const [selectedProvider, setSelectedProvider] = useState<Provider>('dlhd');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Provider-specific data
  const [dlhdData, setDlhdData] = useState<ProviderData>({
    events: [], channels: [], categories: [], loading: true, error: null
  });
  const [cdnliveData, setCdnliveData] = useState<ProviderData>({
    events: [], channels: [], categories: [], loading: true, error: null
  });
  const [ppvData, setPpvData] = useState<ProviderData>({
    events: [], channels: [], categories: [], loading: true, error: null
  });
  const [streamedData, setStreamedData] = useState<ProviderData>({
    events: [], channels: [], categories: [], loading: true, error: null
  });

  // Fetch DLHD data (events + channels)
  const fetchDLHDData = useCallback(async () => {
    setDlhdData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [eventsRes, channelsRes] = await Promise.all([
        fetch('/api/livetv/schedule'),
        fetch('/api/livetv/dlhd-channels'),
      ]);

      const eventsJson = await eventsRes.json();
      const channelsJson = await channelsRes.json();

      const events: LiveEvent[] = [];
      if (eventsJson.success && eventsJson.schedule?.categories) {
        for (const category of eventsJson.schedule.categories) {
          for (const event of category.events || []) {
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
              channels: event.channels || [],
            });
          }
        }
      }

      const channels: DLHDChannel[] = channelsJson.success ? (channelsJson.channels || []) : [];
      const categories = generateCategories(events, channels, false);

      setDlhdData({
        events,
        channels,
        categories,
        loading: false,
        error: null,
      });
    } catch (error) {
      setDlhdData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load DLHD data',
      }));
    }
  }, []);

  // Fetch CDN Live data
  const fetchCDNLiveData = useCallback(async () => {
    setCdnliveData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/livetv/cdn-live-channels');
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const channels = data.channels || [];
      const onlineChannels = channels.filter((c: any) => c.status === 'online');

      // Transform channels to events for display
      const events: LiveEvent[] = onlineChannels.map((channel: any) => ({
        id: `cdnlive-${channel.name.toLowerCase().replace(/\s+/g, '-')}-${channel.code}`,
        title: channel.name,
        sport: categorizeChannel(channel.name),
        time: 'Live',
        isLive: true,
        source: 'cdnlive' as const,
        poster: channel.image,
        viewers: channel.viewers?.toString(),
        cdnliveEmbedId: `${channel.name}|${channel.code}`,
        channels: [{
          name: channel.name,
          channelId: `${channel.name}|${channel.code}`,
          href: channel.url,
        }],
      }));

      const categories = generateCategories(events, [], false);

      setCdnliveData({
        events,
        channels: [],
        categories,
        loading: false,
        error: null,
      });
    } catch (error) {
      setCdnliveData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load CDN Live data',
      }));
    }
  }, []);

  // Fetch PPV data
  const fetchPPVData = useCallback(async () => {
    setPpvData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/livetv/ppv-streams');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'PPV API error');
      }

      const events: LiveEvent[] = [];
      for (const category of data.categories || []) {
        for (const stream of category.streams || []) {
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

      const categories = generateCategories(events, [], false);

      setPpvData({
        events,
        channels: [],
        categories,
        loading: false,
        error: null,
      });
    } catch (error) {
      setPpvData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load PPV data',
      }));
    }
  }, []);

  // Fetch Streamed data
  const fetchStreamedData = useCallback(async () => {
    setStreamedData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/livetv/streamed-events');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Streamed API error');
      }

      const events: LiveEvent[] = data.events || [];
      const categories = generateCategories(events, [], false);

      setStreamedData({
        events,
        channels: [],
        categories,
        loading: false,
        error: null,
      });
    } catch (error) {
      setStreamedData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load Streamed data',
      }));
    }
  }, []);

  // Initial load - fetch all providers
  useEffect(() => {
    fetchDLHDData();
    fetchCDNLiveData();
    fetchPPVData();
    fetchStreamedData();
  }, [fetchDLHDData, fetchCDNLiveData, fetchPPVData, fetchStreamedData]);

  // Get current provider data
  const currentProviderData = useMemo(() => {
    switch (selectedProvider) {
      case 'dlhd': return dlhdData;
      case 'cdnlive': return cdnliveData;
      case 'ppv': return ppvData;
      case 'streamed': return streamedData;
      default: return dlhdData;
    }
  }, [selectedProvider, dlhdData, cdnliveData, ppvData, streamedData]);

  // Filter by search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return currentProviderData;

    const query = searchQuery.toLowerCase();
    
    const filteredEvents = currentProviderData.events.filter(event =>
      event.title.toLowerCase().includes(query) ||
      event.sport?.toLowerCase().includes(query) ||
      event.league?.toLowerCase().includes(query) ||
      event.teams?.home.toLowerCase().includes(query) ||
      event.teams?.away.toLowerCase().includes(query)
    );

    const filteredChannels = currentProviderData.channels.filter(channel =>
      channel.name.toLowerCase().includes(query) ||
      channel.category.toLowerCase().includes(query) ||
      channel.country.toLowerCase().includes(query)
    );

    return {
      ...currentProviderData,
      events: filteredEvents,
      channels: filteredChannels,
    };
  }, [currentProviderData, searchQuery]);

  // Stats for all providers
  const stats: ProviderStats = useMemo(() => ({
    dlhd: {
      events: dlhdData.events.length,
      channels: dlhdData.channels.length,
      live: dlhdData.events.filter(e => e.isLive).length,
    },
    cdnlive: {
      channels: cdnliveData.events.length, // CDN Live events are actually channels
    },
    ppv: {
      events: ppvData.events.length,
      live: ppvData.events.filter(e => e.isLive).length,
    },
    streamed: {
      events: streamedData.events.length,
      live: streamedData.events.filter(e => e.isLive).length,
    },
  }), [dlhdData, cdnliveData, ppvData, streamedData]);

  // Refresh current provider
  const refresh = useCallback(() => {
    switch (selectedProvider) {
      case 'dlhd': fetchDLHDData(); break;
      case 'cdnlive': fetchCDNLiveData(); break;
      case 'ppv': fetchPPVData(); break;
      case 'streamed': fetchStreamedData(); break;
    }
  }, [selectedProvider, fetchDLHDData, fetchCDNLiveData, fetchPPVData, fetchStreamedData]);

  // Refresh all providers
  const refreshAll = useCallback(() => {
    fetchDLHDData();
    fetchCDNLiveData();
    fetchPPVData();
    fetchStreamedData();
  }, [fetchDLHDData, fetchCDNLiveData, fetchPPVData, fetchStreamedData]);

  return {
    // Current provider
    selectedProvider,
    setSelectedProvider,
    
    // Current provider data (filtered)
    events: filteredData.events,
    channels: filteredData.channels,
    categories: filteredData.categories,
    loading: filteredData.loading,
    error: filteredData.error,
    
    // Search
    searchQuery,
    setSearchQuery,
    
    // Stats
    stats,
    
    // Actions
    refresh,
    refreshAll,
  };
}

// Helper function to categorize CDN Live channels
function categorizeChannel(channelName: string): string {
  const nameLower = channelName.toLowerCase();
  const sportKeywords = ['sport', 'espn', 'fox sport', 'bein', 'dazn', 'arena', 'sky sport', 
    'canal sport', 'eleven', 'polsat sport', 'cosmote', 'nova sport', 'match', 'premier', 
    'football', 'soccer', 'nba', 'nfl', 'nhl', 'mlb', 'tennis', 'golf', 'f1', 'motorsport'];
  
  for (const keyword of sportKeywords) {
    if (nameLower.includes(keyword)) return 'sports';
  }
  if (nameLower.includes('news') || nameLower.includes('cnn') || nameLower.includes('bbc')) {
    return 'news';
  }
  return 'entertainment';
}
