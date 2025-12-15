'use client';

import { useState, useEffect, useCallback, useMemo, memo, useRef, ChangeEvent } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import { useCast, CastMedia } from '@/hooks/useCast';
import styles from './LiveTV.module.css';

// Types
interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  streamId: string;
  firstLetter: string;
  isHD?: boolean;
  categoryInfo: { name: string; icon: string };
  countryInfo: { name: string; flag: string };
  source?: 'xfinity' | 'dlhd';
}

interface DLHDChannel {
  id: string;
  name: string;
  category: string;
  country: string;
  firstLetter: string;
  categoryInfo: { name: string; icon: string };
  countryInfo: { name: string; flag: string };
}

interface DLHDCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface DLHDCountry {
  id: string;
  name: string;
  flag: string;
  count: number;
}

// DLHD Live Events Types
interface SportEvent {
  id: string;
  time: string;
  isoTime?: string; // ISO timestamp for local timezone conversion
  dataTime: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  isLive: boolean;
  channels: { name: string; channelId: string; href: string }[];
}

/**
 * Format event time in user's local timezone (12-hour format)
 */
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
    } catch {
      // Fall through to fallback
    }
  }
  // Fallback to original time if ISO parsing fails
  return fallbackTime || '';
}

interface ScheduleCategory {
  name: string;
  icon: string;
  events: SportEvent[];
}

// Memoized DLHD channel card
const DLHDChannelCard = memo(function DLHDChannelCard({ 
  channel, 
  onSelect 
}: { 
  channel: DLHDChannel; 
  onSelect: (channel: DLHDChannel) => void;
}) {
  return (
    <button
      className={styles.channelCard}
      onClick={() => onSelect(channel)}
    >
      <div className={styles.channelLogo}>
        <span>{channel.firstLetter}</span>
      </div>
      <div className={styles.channelInfo}>
        <span className={styles.channelName}>{channel.name}</span>
        <span className={styles.channelMeta}>
          {channel.categoryInfo.icon} {channel.categoryInfo.name}
        </span>
        <span className={styles.coastIndicator}>
          {channel.countryInfo.flag} {channel.countryInfo.name}
        </span>
      </div>
      <span className={styles.playIcon}>▶</span>
    </button>
  );
});

// Memoized event card for Live Events
const EventCard = memo(function EventCard({
  event,
  onChannelSelect,
}: {
  event: SportEvent;
  onChannelSelect: (channelId: string, channelName: string, eventTitle: string) => void;
}) {
  const displayedChannels = event.channels.slice(0, 4);
  const moreCount = event.channels.length - 4;
  
  // Format time in user's local timezone
  const localTime = formatLocalTime(event.isoTime, event.time);

  return (
    <div className={`${styles.eventCard} ${event.isLive ? styles.live : ''}`}>
      <div className={styles.eventHeader}>
        <span className={styles.eventTime}>{localTime}</span>
        <span className={styles.eventSport}>{event.sport ? getIcon(event.sport) : '📺'}</span>
        {event.isLive && (
          <span className={styles.liveTag}>
            <span className={styles.liveDot} /> LIVE
          </span>
        )}
      </div>
      <div className={styles.eventBody}>
        {event.teams ? (
          <div className={styles.matchup}>
            <span className={styles.team}>{event.teams.home}</span>
            <span className={styles.vs}>vs</span>
            <span className={styles.team}>{event.teams.away}</span>
          </div>
        ) : (
          <span className={styles.eventTitle}>{event.title}</span>
        )}
        {event.league && <span className={styles.league}>{event.league}</span>}
      </div>
      <div className={styles.eventChannels}>
        {displayedChannels.map((ch, idx) => (
          <button
            key={idx}
            className={styles.channelBtn}
            onClick={() => onChannelSelect(ch.channelId, ch.name, event.title)}
            disabled={!ch.channelId}
          >
            {ch.name}
          </button>
        ))}
        {moreCount > 0 && (
          <span className={styles.moreChannels}>+{moreCount} more</span>
        )}
      </div>
    </div>
  );
});

function getIcon(sport: string): string {
  const icons: Record<string, string> = {
    'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
    'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
    'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
    'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
    'am. football': '🏈', 'nfl': '🏈', 'tv shows': '📺',
  };
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (lower.includes(key)) return icon;
  }
  return '📺';
}

type ViewMode = 'events' | 'channels';

export default function LiveTVClient() {
  const { 
    trackEvent, 
    trackPageView, 
    trackLiveTVEvent, 
    updateActivity, 
    startLiveTVSession,
    endLiveTVSession,
    recordLiveTVBuffer,
    updateLiveTVQuality,
  } = useAnalytics();
  
  const [viewMode, setViewMode] = useState<ViewMode>('events');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  // DLHD Channels state
  const [dlhdChannels, setDlhdChannels] = useState<DLHDChannel[]>([]);
  const [dlhdCategories, setDlhdCategories] = useState<DLHDCategory[]>([]);
  const [dlhdCountries, setDlhdCountries] = useState<DLHDCountry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalChannels, setTotalChannels] = useState(0);

  // DLHD Live Events state
  const [allScheduleCategories, setAllScheduleCategories] = useState<ScheduleCategory[]>([]); // All categories for sidebar
  const [scheduleCategories, setScheduleCategories] = useState<ScheduleCategory[]>([]); // Filtered for display
  const [selectedSport, setSelectedSport] = useState('all');
  const [liveOnly, setLiveOnly] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [liveEventsCount, setLiveEventsCount] = useState(0);
  const [totalEventsCount, setTotalEventsCount] = useState(0); // Total unfiltered events

  useEffect(() => { trackPageView('/livetv'); }, [trackPageView]);

  // Fetch Live Events (DLHD schedule) - only on initial load or view mode change
  useEffect(() => {
    if (viewMode === 'events') {
      fetchSchedule();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);
  
  // Apply filters client-side when sport or liveOnly changes
  useEffect(() => {
    if (allScheduleCategories.length === 0) return;
    
    let filteredCategories = [...allScheduleCategories];
    
    // Filter by sport
    if (selectedSport !== 'all') {
      filteredCategories = filteredCategories.filter(
        cat => cat.name.toLowerCase() === selectedSport.toLowerCase()
      );
    }
    
    // Filter by live only
    if (liveOnly) {
      filteredCategories = filteredCategories
        .map(cat => ({
          ...cat,
          events: cat.events.filter(e => e.isLive)
        }))
        .filter(cat => cat.events.length > 0);
    }
    
    setScheduleCategories(filteredCategories);
  }, [selectedSport, liveOnly, allScheduleCategories]);

  // Fetch DLHD channels
  useEffect(() => {
    if (viewMode === 'channels') {
      fetchChannels();
    }
  }, [viewMode, selectedCategory, selectedCountry, searchQuery]);

  const fetchSchedule = async () => {
    try {
      setEventsLoading(true);
      setEventsError(null);
      
      // Always fetch ALL events first (no sport filter) for sidebar counts
      const allResponse = await fetch('/api/livetv/schedule');
      const allData = await allResponse.json();
      
      if (allData.success) {
        // Store all categories for sidebar display
        setAllScheduleCategories(allData.schedule.categories);
        setTotalEventsCount(allData.stats.totalEvents);
        
        // Calculate total live events from all categories
        const totalLive = allData.schedule.categories.reduce(
          (sum: number, cat: ScheduleCategory) => sum + cat.events.filter((e: SportEvent) => e.isLive).length, 
          0
        );
        setLiveEventsCount(totalLive);
        
        // Now apply client-side filtering for display
        let filteredCategories = allData.schedule.categories as ScheduleCategory[];
        
        // Filter by sport
        if (selectedSport !== 'all') {
          filteredCategories = filteredCategories.filter(
            cat => cat.name.toLowerCase() === selectedSport.toLowerCase()
          );
        }
        
        // Filter by live only
        if (liveOnly) {
          filteredCategories = filteredCategories
            .map(cat => ({
              ...cat,
              events: cat.events.filter((e: SportEvent) => e.isLive)
            }))
            .filter(cat => cat.events.length > 0);
        }
        
        setScheduleCategories(filteredCategories);
      } else {
        setEventsError('Failed to load live events');
      }
    } catch {
      setEventsError('Failed to load live events');
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedCountry !== 'all') params.set('country', selectedCountry);
      if (searchQuery) params.set('search', searchQuery);
      
      const response = await fetch(`/api/livetv/dlhd-channels?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setDlhdChannels(data.channels);
        setDlhdCategories(data.categories);
        setDlhdCountries(data.countries);
        setTotalChannels(data.totalChannels);
      } else {
        setError('Failed to load channels');
      }
    } catch {
      setError('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle DLHD event channel selection - routes through RPI proxy
  const handleEventChannelSelect = useCallback((channelId: string, channelName: string, eventTitle: string) => {
    if (!channelId) return;
    
    const channel: Channel = {
      id: `dlhd-${channelId}`,
      name: channelName,
      category: 'Sports',
      country: 'uk',
      streamId: channelId, // This is the DLHD channel ID (e.g., "325")
      firstLetter: channelName.charAt(0),
      isHD: true,
      categoryInfo: { name: eventTitle, icon: '⚽' },
      countryInfo: { name: 'United Kingdom', flag: '🇬🇧' },
      source: 'dlhd',
    };
    
    setSelectedChannel(channel);
    trackLiveTVEvent({
      action: 'channel_select',
      channelId: channelId,
      channelName: channelName,
      category: 'Sports',
    });
    trackEvent('livetv_event_channel_selected', { 
      channelId, 
      channelName,
      eventTitle,
      source: 'dlhd',
    });
  }, [trackLiveTVEvent, trackEvent]);

  const handleDLHDChannelSelect = useCallback((dlhdChannel: DLHDChannel) => {
    const channel: Channel = {
      id: `dlhd-${dlhdChannel.id}`,
      name: dlhdChannel.name,
      category: dlhdChannel.category,
      country: dlhdChannel.country,
      streamId: dlhdChannel.id, // DLHD channel ID
      firstLetter: dlhdChannel.firstLetter,
      isHD: true,
      categoryInfo: dlhdChannel.categoryInfo,
      countryInfo: dlhdChannel.countryInfo,
      source: 'dlhd',
    };
    setSelectedChannel(channel);
    trackLiveTVEvent({
      action: 'channel_select',
      channelId: dlhdChannel.id,
      channelName: dlhdChannel.name,
      category: dlhdChannel.categoryInfo.name,
    });
    trackEvent('livetv_channel_selected', { 
      channelId: dlhdChannel.id, 
      channelName: dlhdChannel.name,
      country: dlhdChannel.country,
      source: 'dlhd',
    });
  }, [trackLiveTVEvent, trackEvent]);



  // Memoize the DLHD channel list - deduplicate by ID to avoid React key warnings
  const channelList = useMemo(() => {
    // Deduplicate channels by ID (keep first occurrence)
    const seen = new Set<string>();
    const uniqueChannels = dlhdChannels.filter((channel) => {
      const key = String(channel.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return uniqueChannels.map((channel) => (
      <DLHDChannelCard
        key={channel.id}
        channel={channel}
        onSelect={handleDLHDChannelSelect}
      />
    ));
  }, [dlhdChannels, handleDLHDChannelSelect]);

  // Memoize the events list
  const eventsList = useMemo(() => (
    scheduleCategories.flatMap((cat) =>
      cat.events.map((event) => (
        <EventCard
          key={event.id}
          event={{ ...event, sport: cat.name }}
          onChannelSelect={handleEventChannelSelect}
        />
      ))
    )
  ), [scheduleCategories, handleEventChannelSelect]);

  return (
    <div className={styles.container}>
      <Navigation />

      {/* Hide layout when player is open */}
      <div className={styles.layout} style={{ display: selectedChannel ? 'none' : undefined }}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Live TV</h2>
            {viewMode === 'events' ? (
              <span className={styles.liveCount}>
                <span className={styles.liveDot} /> {liveEventsCount} Live
              </span>
            ) : (
              <span className={styles.channelCount}>{totalChannels} Channels</span>
            )}
          </div>

          {/* Mode Switch */}
          <div className={styles.modeSwitch}>
            <button
              className={`${styles.modeBtn} ${viewMode === 'events' ? styles.active : ''}`}
              onClick={() => setViewMode('events')}
            >
              🔴 Live Events
            </button>
            <button
              className={`${styles.modeBtn} ${viewMode === 'channels' ? styles.active : ''}`}
              onClick={() => setViewMode('channels')}
            >
              📺 Channels
            </button>
          </div>

          {viewMode === 'events' ? (
            /* Live Events Filters */
            <div className={styles.filterList}>
              <div className={styles.filterSection}>
                <h3>Filter</h3>
                <button
                  className={`${styles.filterItem} ${styles.liveFilter} ${liveOnly ? styles.active : ''}`}
                  onClick={() => setLiveOnly(!liveOnly)}
                >
                  <span>🔴 Live Now Only</span>
                  <span className={styles.filterCount}>{liveEventsCount}</span>
                </button>
              </div>
              <div className={styles.filterSection}>
                <h3>Sports</h3>
                <button
                  className={`${styles.filterItem} ${selectedSport === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedSport('all')}
                >
                  <span>📺 All Sports</span>
                  <span className={styles.filterCount}>{totalEventsCount}</span>
                </button>
                {allScheduleCategories.map((cat) => (
                  <button
                    key={cat.name}
                    className={`${styles.filterItem} ${selectedSport === cat.name.toLowerCase() ? styles.active : ''}`}
                    onClick={() => setSelectedSport(cat.name.toLowerCase())}
                  >
                    <span>{cat.icon} {cat.name}</span>
                    <span className={styles.filterCount}>{cat.events.length}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Channels Filters */
            <>
              <div className={styles.sidebarSearch}>
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.filterList}>
                <div className={styles.filterSection}>
                  <h3>Categories</h3>
                  <button
                    className={`${styles.filterItem} ${selectedCategory === 'all' ? styles.active : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    <span>📺 All Channels</span>
                    <span className={styles.filterCount}>{totalChannels}</span>
                  </button>
                  {dlhdCategories.map((cat) => (
                    <button
                      key={cat.id}
                      className={`${styles.filterItem} ${selectedCategory === cat.id ? styles.active : ''}`}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      <span>{cat.icon} {cat.name}</span>
                      <span className={styles.filterCount}>{cat.count}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.filterSection}>
                  <h3>Countries</h3>
                  <button
                    className={`${styles.filterItem} ${selectedCountry === 'all' ? styles.active : ''}`}
                    onClick={() => setSelectedCountry('all')}
                  >
                    <span>🌐 All Countries</span>
                    <span className={styles.filterCount}>{totalChannels}</span>
                  </button>
                  {dlhdCountries.slice(0, 10).map((country) => (
                    <button
                      key={country.id}
                      className={`${styles.filterItem} ${selectedCountry === country.id ? styles.active : ''}`}
                      onClick={() => setSelectedCountry(country.id)}
                    >
                      <span>{country.flag} {country.name}</span>
                      <span className={styles.filterCount}>{country.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          {viewMode === 'events' ? (
            /* Live Events Grid */
            eventsLoading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Loading live events...</p>
              </div>
            ) : eventsError ? (
              <div className={styles.error}>
                <p>{eventsError}</p>
                <button onClick={fetchSchedule} className={styles.retryBtn}>
                  Retry
                </button>
              </div>
            ) : (
              <div className={styles.eventsGrid}>
                {eventsList.length === 0 ? (
                  <div className={styles.noResults}>
                    <p>No live events found</p>
                  </div>
                ) : eventsList}
              </div>
            )
          ) : (
            /* Channels Grid */
            isLoading ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Loading channels...</p>
              </div>
            ) : error ? (
              <div className={styles.error}>
                <p>{error}</p>
                <button onClick={fetchChannels} className={styles.retryBtn}>
                  Retry
                </button>
              </div>
            ) : (
              <div className={styles.channelsGrid}>
                {dlhdChannels.length === 0 ? (
                  <div className={styles.noResults}>
                    <p>No channels found</p>
                  </div>
                ) : channelList}
              </div>
            )
          )}
        </main>
      </div>

      {/* Player Modal */}
      {selectedChannel && (
        <LiveTVPlayer 
          channel={selectedChannel} 
          onClose={() => setSelectedChannel(null)}
          trackLiveTVEvent={trackLiveTVEvent}
          updateActivity={updateActivity}
          startLiveTVSession={startLiveTVSession}
          endLiveTVSession={endLiveTVSession}
          recordLiveTVBuffer={recordLiveTVBuffer}
          updateLiveTVQuality={updateLiveTVQuality}
        />
      )}

      <Footer />
    </div>
  );
}


// Player Component
interface LiveTVPlayerProps {
  channel: Channel;
  onClose: () => void;
  trackLiveTVEvent: (event: {
    action: 'channel_select' | 'play_start' | 'play_stop' | 'error' | 'buffer' | 'quality_change';
    channelId: string;
    channelName: string;
    category?: string;
    country?: string;
    watchDuration?: number;
    errorMessage?: string;
    quality?: string;
  }) => void;
  updateActivity: (activity: any) => void;
  startLiveTVSession: (data: {
    channelId: string;
    channelName: string;
    category?: string;
    country?: string;
    quality?: string;
  }) => void;
  endLiveTVSession: () => void;
  recordLiveTVBuffer: () => void;
  updateLiveTVQuality: (quality: string) => void;
}

function LiveTVPlayer({ 
  channel, 
  onClose, 
  trackLiveTVEvent, 
  updateActivity,
  startLiveTVSession,
  endLiveTVSession,
  recordLiveTVBuffer,
  updateLiveTVQuality: _updateLiveTVQuality,
}: LiveTVPlayerProps) {
  const presenceContext = usePresenceContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const hlsRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const watchStartTimeRef = useRef<number>(0);
  const CONTROLS_HIDE_DELAY = 3000;
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bufferingStatus, setBufferingStatus] = useState<string | null>(null);
  const [isCastOverlayVisible, setIsCastOverlayVisible] = useState(false);

  // Account cycling state for Xfinity (internal - not displayed to user)
  const [isCycling, setIsCycling] = useState(false);
  const [failedAccounts, setFailedAccounts] = useState<string[]>([]);
  const [remainingAccounts, setRemainingAccounts] = useState<number>(0);
  const failedAccountsRef = useRef<string[]>([]);
  const currentAccountIdRef = useRef<string | null>(null);

  const cast = useCast({
    onConnect: () => console.log('[LiveTV] Cast connected'),
    onDisconnect: () => {
      console.log('[LiveTV] Cast disconnected');
      setIsCastOverlayVisible(false);
    },
    onError: (error) => console.error('[LiveTV] Cast error:', error),
  });

  const getCastMedia = useCallback((): CastMedia => {
    // Different stream URL based on source
    let streamUrl: string;
    
    if (channel.source === 'dlhd') {
      // Use CF Worker directly for DLHD streams
      const cfProxyUrl = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL;
      if (cfProxyUrl) {
        const baseUrl = cfProxyUrl.replace(/\/(tv|dlhd)\/?$/, '');
        streamUrl = `${baseUrl}/dlhd?channel=${channel.streamId}`;
      } else {
        streamUrl = `${window.location.origin}/api/dlhd-proxy?channel=${channel.streamId}`;
      }
    } else {
      streamUrl = `${window.location.origin}/api/livetv/xfinity-stream?channelId=${channel.streamId}`;
    }
    
    return {
      url: streamUrl,
      title: channel.name,
      subtitle: `${channel.categoryInfo.icon} ${channel.categoryInfo.name}`,
      contentType: 'application/x-mpegURL',
      isLive: true,
    };
  }, [channel]);

  const handleCastClick = useCallback(async () => {
    if (cast.isCasting) {
      cast.stop();
      setIsCastOverlayVisible(false);
    } else if (cast.isConnected) {
      const media = getCastMedia();
      videoRef.current?.pause();
      const success = await cast.loadMedia(media);
      if (success) setIsCastOverlayVisible(true);
    } else {
      const connected = await cast.requestSession();
      if (connected) {
        const media = getCastMedia();
        videoRef.current?.pause();
        const success = await cast.loadMedia(media);
        if (success) setIsCastOverlayVisible(true);
      }
    }
  }, [cast, getCastMedia]);

  useEffect(() => {
    watchStartTimeRef.current = 0;
    loadStream();
    return () => {
      if (watchStartTimeRef.current > 0) {
        const watchDuration = Math.round((Date.now() - watchStartTimeRef.current) / 1000);
        trackLiveTVEvent({
          action: 'play_stop',
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
          watchDuration,
        });
      }
      endLiveTVSession();
      // Cleanup HLS.js player
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) { /* ignore */ }
        hlsRef.current = null;
      }
      // Cleanup mpegts.js player
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.unload();
          playerRef.current.detachMediaElement();
          playerRef.current.destroy();
        } catch (e) { /* ignore */ }
        playerRef.current = null;
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      updateActivity({ type: 'browsing' });
    };
  }, [channel.streamId]);

  const deleteInvalidAccount = async (accountId: string) => {
    try {
      await fetch('/api/livetv/xfinity-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteInvalid', accountId }),
      });
      console.log('[LiveTV] Deleted invalid account:', accountId);
    } catch (err) {
      console.error('[LiveTV] Failed to delete account:', err);
    }
  };

  const loadStream = async (isRetry = false) => {
    if (!videoRef.current) return;
    
    // Reset state on fresh load
    if (!isRetry) {
      setFailedAccounts([]);
      failedAccountsRef.current = [];
      currentAccountIdRef.current = null;
      setRemainingAccounts(0);
      setIsCycling(false);
    }
    
    setIsLoading(true);
    setError(null);

    // Cleanup previous players
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch (e) { /* ignore */ }
      hlsRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
      } catch (e) { /* ignore */ }
      playerRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }

    try {
      // Route based on source type
      if (channel.source === 'dlhd') {
        await loadDLHDStream();
      } else {
        await loadXfinityStream(isRetry);
      }
    } catch (err: any) {
      console.error('[LiveTV] Stream load error:', err);
      setError(err.message || 'Failed to load stream');
      setIsLoading(false);
    }
  };

  // Load DLHD stream using HLS.js - routes through CF Worker → RPI proxy
  const loadDLHDStream = async () => {
    if (!videoRef.current) return;
    
    console.log('[LiveTV] Loading DLHD stream for channel:', channel.streamId);
    
    // Use Cloudflare Worker directly if available, otherwise fall back to Vercel API
    const cfProxyUrl = process.env.NEXT_PUBLIC_CF_TV_PROXY_URL;
    let m3u8Url: string;
    
    if (cfProxyUrl) {
      // Direct to CF Worker (faster, bypasses Vercel)
      const baseUrl = cfProxyUrl.replace(/\/(tv|dlhd)\/?$/, '');
      m3u8Url = `${baseUrl}/dlhd?channel=${channel.streamId}`;
      console.log('[LiveTV] Using CF Worker directly:', m3u8Url);
    } else {
      // Fallback to Vercel API (which forwards to CF Worker)
      m3u8Url = `/api/dlhd-proxy?channel=${channel.streamId}`;
      console.log('[LiveTV] Using Vercel API proxy');
    }
    
    const Hls = (await import('hls.js')).default;
    
    if (!Hls.isSupported()) {
      // Fallback for Safari
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = m3u8Url;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        return;
      }
      setError('HLS playback not supported in this browser');
      setIsLoading(false);
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
      maxBufferLength: 30, // Reduced for live - don't buffer too far ahead
      maxMaxBufferLength: 60,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      liveDurationInfinity: true,
      // Aggressive playlist refresh for live streams
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 6, // More retries for level/playlist loading
      levelLoadingRetryDelay: 500, // Start with 500ms delay
      levelLoadingMaxRetryTimeout: 30000, // Max 30s between retries
      // Fragment loading
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 500,
      // Manifest loading
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 4,
      manifestLoadingRetryDelay: 500,
      // Custom XHR setup for debugging and CORS handling
      xhrSetup: (xhr: XMLHttpRequest, url: string) => {
        xhr.withCredentials = false;
        // Log key loading attempts for debugging
        if (url.includes('/key') || url.includes('wmsxx')) {
          console.log('[LiveTV] Loading key from:', url);
        }
      },
    });

    hls.loadSource(m3u8Url);
    hls.attachMedia(videoRef.current);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[LiveTV] DLHD manifest parsed');
      setIsLoading(false);
      setError(null); // Clear any previous errors
      videoRef.current?.play().catch(() => {});
    });
    
    // Log key loading events for debugging
    hls.on(Hls.Events.KEY_LOADING, (_event: any, data: any) => {
      console.log('[LiveTV] Loading key:', data.frag?.decryptdata?.uri);
    });
    
    hls.on(Hls.Events.KEY_LOADED, () => {
      console.log('[LiveTV] Key loaded successfully');
      setError(null); // Clear error when key loads successfully
    });
    
    // Retry counters for error recovery
    let keyRetryCount = 0;
    const MAX_KEY_RETRIES = 5;
    let networkRetryCount = 0;
    const MAX_NETWORK_RETRIES = 5;
    
    // Clear error and buffering status when fragments load successfully (stream recovered)
    hls.on(Hls.Events.FRAG_LOADED, () => {
      // Reset retry counts on successful fragment load
      keyRetryCount = 0;
      networkRetryCount = 0;
      // Clear any error/buffering states
      setError(null);
      setBufferingStatus(null);
    });
    
    hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
      // Log all errors with details for debugging
      console.error('[LiveTV] HLS error:', {
        type: data.type,
        details: data.details,
        fatal: data.fatal,
        url: data.url || data.frag?.url || data.context?.url,
        response: data.response ? {
          code: data.response.code,
          text: data.response.text?.substring(0, 100)
        } : undefined
      });
      
      // Handle key load errors specifically - these are common with encrypted streams
      if (data.details === 'keyLoadError') {
        console.error('[LiveTV] Key load error details:', {
          keyUrl: data.frag?.decryptdata?.uri,
          networkDetails: data.networkDetails,
          response: data.response
        });
        
        keyRetryCount++;
        if (keyRetryCount <= MAX_KEY_RETRIES) {
          console.log(`[LiveTV] Key load error, retry ${keyRetryCount}/${MAX_KEY_RETRIES}...`);
          // Show buffering status instead of error during retries
          setBufferingStatus(`Reconnecting... (${keyRetryCount}/${MAX_KEY_RETRIES})`);
          setTimeout(() => hls.startLoad(), 1000 * keyRetryCount);
          return;
        }
        console.error('[LiveTV] Key load failed after retries, reloading stream...');
        // Instead of showing error, try reloading the entire stream
        keyRetryCount = 0;
        setBufferingStatus('Refreshing stream...');
        setTimeout(() => {
          hls.destroy();
          loadDLHDStream();
        }, 2000);
        return;
      }
      
      // Handle level/playlist load errors (common with live streams)
      if (data.details === 'levelLoadError' || data.details === 'levelLoadTimeOut') {
        console.log('[LiveTV] Level load error, HLS.js will auto-retry');
        setBufferingStatus('Refreshing playlist...');
        // HLS.js handles retries automatically with our config, just show status
        return;
      }
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            networkRetryCount++;
            if (networkRetryCount <= MAX_NETWORK_RETRIES) {
              console.log(`[LiveTV] Network error, retry ${networkRetryCount}/${MAX_NETWORK_RETRIES}...`);
              setBufferingStatus(`Reconnecting... (${networkRetryCount}/${MAX_NETWORK_RETRIES})`);
              setTimeout(() => hls.startLoad(), 1000 * networkRetryCount);
            } else {
              console.log('[LiveTV] Network error, reloading stream...');
              networkRetryCount = 0;
              setBufferingStatus('Refreshing stream...');
              setTimeout(() => {
                hls.destroy();
                loadDLHDStream();
              }, 2000);
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[LiveTV] Media error, attempting recovery...');
            setBufferingStatus('Recovering...');
            hls.recoverMediaError();
            break;
          default:
            // Only show error for truly unrecoverable issues
            setError(`Stream error: ${data.details}`);
            setIsLoading(false);
            break;
        }
      } else {
        // Non-fatal errors - just log and let HLS.js handle recovery
        console.log('[LiveTV] Non-fatal error, HLS.js will handle recovery');
      }
    });

    hlsRef.current = hls;
  };

  // Load Xfinity/IPTV stream using mpegts.js
  const loadXfinityStream = async (isRetry: boolean) => {
    if (!videoRef.current) return;
    
    const [channelId, coastPart] = channel.streamId.split(':');
    const coastParam = coastPart === 'west' ? '&coast=west' : '';
    const excludeParam = failedAccountsRef.current.length > 0 
      ? `&excludeAccounts=${failedAccountsRef.current.join(',')}` 
      : '';
    
    const response = await fetch(`/api/livetv/xfinity-stream?channelId=${channelId}${coastParam}${excludeParam}`);
    const data = await response.json();
    
    if (data.noAccountsLeft) {
      setIsCycling(false);
      setIsLoading(false);
      setError('No available sources for this channel');
      return;
    }
    
    if (!data.success || !data.streamUrl) {
      throw new Error(data.error || 'Failed to get stream');
    }

    const streamUrl = data.streamUrl;
    
    if (data.account) {
      currentAccountIdRef.current = data.account.id;
      setRemainingAccounts(data.account.remainingAccounts || 0);
      if (isRetry) setIsCycling(true);
    }
    
    console.log('[LiveTV] Loading Xfinity stream:', channel.name);

    const mpegtsModule = await import('mpegts.js');
    const mpegts = mpegtsModule.default;

    if (!mpegts.isSupported()) {
      setError('Your browser does not support MPEG-TS playback');
      setIsLoading(false);
      return;
    }

    const player = mpegts.createPlayer({
      type: 'mpegts',
      isLive: true,
      url: streamUrl,
    }, {
      enableWorker: true,
      enableStashBuffer: true,
      stashInitialSize: 1024 * 1024,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 8.0,
      liveBufferLatencyMinRemain: 3.0,
      liveSync: true,
      liveSyncMaxLatency: 10.0,
      lazyLoad: false,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 60,
      autoCleanupMinBackwardDuration: 30,
      fixAudioTimestampGap: true,
      accurateSeek: true,
      seekType: 'range',
    });

    videoRef.current.preload = 'auto';
    player.attachMediaElement(videoRef.current);
    player.load();
    
    const accountAtLoad = data.account ? { id: data.account.id } : null;
    let isDestroyed = false;

    player.on(mpegts.Events.ERROR, async (errorType: string, errorDetail: string) => {
      if (isDestroyed) return;
      if (errorDetail.includes('SourceBuffer') || errorDetail.includes('removed from the parent')) return;
      
      console.error('[LiveTV] mpegts error:', errorType, errorDetail);
      
      const isAccountError = errorDetail.includes('403') || 
                             errorDetail.includes('HttpStatusCodeInvalid') ||
                             errorDetail.includes('458') ||
                             errorDetail.includes('456');
      
      if (isAccountError && accountAtLoad) {
        isDestroyed = true;
        setFailedAccounts(prev => [...prev, accountAtLoad.id]);
        if (!failedAccountsRef.current.includes(accountAtLoad.id)) {
          failedAccountsRef.current.push(accountAtLoad.id);
        }
        deleteInvalidAccount(accountAtLoad.id);
        
        if (playerRef.current) {
          try {
            playerRef.current.pause();
            playerRef.current.unload();
            playerRef.current.detachMediaElement();
            playerRef.current.destroy();
          } catch (e) { /* ignore */ }
          playerRef.current = null;
        }
        
        setTimeout(() => loadStream(true), 800);
        return;
      }
      
      setIsCycling(false);
      setIsLoading(false);
      
      if (errorDetail.includes('Network') || errorDetail.includes('fetch')) {
        setBufferingStatus('Reconnecting...');
      } else {
        setError(`Stream error: ${errorDetail}`);
      }
    });

    player.on(mpegts.Events.MEDIA_INFO, () => {
      console.log('[LiveTV] Media info received');
      setIsCycling(false);
      setIsLoading(false);
      setBufferingStatus(null);
      videoRef.current?.play().catch(() => {});
    });

    playerRef.current = player;
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onPlay = () => {
      setIsPlaying(true);
      if (watchStartTimeRef.current === 0) {
        watchStartTimeRef.current = Date.now();
        trackLiveTVEvent({
          action: 'play_start',
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
          country: channel.countryInfo.name,
        });
        startLiveTVSession({
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
          country: channel.countryInfo.name,
        });
        updateActivity({
          type: 'livetv',
          contentId: channel.streamId,
          contentTitle: channel.name,
          contentType: 'livetv',
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
        });
        presenceContext?.setActivityType('livetv', {
          contentId: channel.streamId,
          contentTitle: channel.name,
        });
      }
    };
    
    const onPause = () => {
      setIsPlaying(false);
      if (watchStartTimeRef.current > 0) {
        const watchDuration = Math.round((Date.now() - watchStartTimeRef.current) / 1000);
        trackLiveTVEvent({
          action: 'play_stop',
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
          watchDuration,
        });
      }
      presenceContext?.setActivityType('browsing');
    };
    
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    let bufferingTimeout: NodeJS.Timeout | null = null;
    
    const onWaiting = () => {
      if (bufferingTimeout) clearTimeout(bufferingTimeout);
      bufferingTimeout = setTimeout(() => {
        setBufferingStatus('Buffering...');
        recordLiveTVBuffer();
        trackLiveTVEvent({
          action: 'buffer',
          channelId: channel.streamId,
          channelName: channel.name,
        });
      }, 500);
    };
    
    const onPlaying = () => {
      if (bufferingTimeout) { clearTimeout(bufferingTimeout); bufferingTimeout = null; }
      setBufferingStatus(null);
    };
    
    const onCanPlay = () => {
      if (bufferingTimeout) { clearTimeout(bufferingTimeout); bufferingTimeout = null; }
      setBufferingStatus(null);
    };
    
    const onEnded = () => {
      console.log('[LiveTV] Video ended - reconnecting...');
      setBufferingStatus('Reconnecting...');
      setTimeout(() => loadStream(false), 2000);
    };
    
    const onError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      if (videoEl.error && videoEl.error.code !== MediaError.MEDIA_ERR_ABORTED) {
        console.log('[LiveTV] Video element error:', videoEl.error?.message);
        setBufferingStatus('Reconnecting...');
        setTimeout(() => loadStream(false), 2000);
      }
    };
    
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    
    return () => {
      if (bufferingTimeout) clearTimeout(bufferingTimeout);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    videoRef.current.muted = val === 0;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY);
  }, []);

  const handleMouseMove = useCallback(() => resetControlsTimeout(), [resetControlsTimeout]);
  const handleMouseLeave = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 800);
  }, []);
  const handleMouseEnter = useCallback(() => resetControlsTimeout(), [resetControlsTimeout]);

  useEffect(() => {
    if (isPlaying) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY);
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      if (e.key === 'f') toggleFullscreen();
      if (e.key === 'm') toggleMute();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isPlaying]);

  const sourceLabel = channel.source === 'dlhd' ? '🌐 DLHD' : '📡 IPTV';

  return (
    <div className={styles.playerModal} onClick={onClose}>
      <div 
        ref={containerRef} 
        className={`${styles.playerContainer} ${showControls ? styles.showControls : styles.hideControls}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
      >
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        
        <div className={styles.playerHeader}>
          <span className={styles.liveTag}><span className={styles.liveDot} /> LIVE</span>
          <span className={styles.channelTitle}>{channel.name}</span>
          <span className={styles.channelFlag}>{channel.countryInfo.flag}</span>
          <span className={styles.sourceTag} title={channel.source === 'dlhd' ? 'DLHD Source' : 'IPTV Source'}>
            {sourceLabel}
          </span>
        </div>

        <video 
          ref={videoRef} 
          className={styles.video} 
          playsInline 
          onClick={togglePlay}
          autoPlay
          muted={false}
          preload="auto"
        />

        <div className={styles.customControls}>
          <button className={styles.controlBtn} onClick={togglePlay} type="button">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className={styles.controlBtn} onClick={toggleMute} type="button">
            {isMuted || volume === 0 ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className={styles.volumeSlider}
          />
          <div className={styles.spacer} />
          <div className={styles.controlsLive}>
            <span className={styles.liveDot} /> LIVE
          </div>
          {cast.isAvailable && (
            <button 
              className={`${styles.controlBtn} ${cast.isCasting ? styles.castActive : ''}`} 
              onClick={handleCastClick} 
              type="button"
              title={cast.isCasting ? 'Stop casting' : 'Cast to TV'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
              </svg>
            </button>
          )}
          <button className={styles.controlBtn} onClick={toggleFullscreen} type="button">
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>

        {/* Loading/Cycling UI */}
        {(isLoading || isCycling) && (
          <div className={styles.cyclingOverlay}>
            <div className={styles.cyclingSpinner} />
            <h3 className={styles.cyclingTitle}>Loading {channel.name}...</h3>
            <div className={styles.cyclingProgress}>
              <div className={styles.cyclingProgressBar}>
                <div 
                  className={styles.cyclingProgressFill}
                  style={{ 
                    width: failedAccounts.length === 0 
                      ? '10%' 
                      : `${Math.min((failedAccounts.length / Math.max(remainingAccounts + failedAccounts.length, 1)) * 100, 95)}%` 
                  }}
                />
              </div>
            </div>
            <p className={styles.cyclingHint}>
              {failedAccounts.length === 0 
                ? 'Connecting to stream...'
                : 'Finding best available source...'
              }
            </p>
          </div>
        )}

        {bufferingStatus && !isLoading && !error && (
          <div className={styles.bufferingOverlay}>
            <div className={styles.bufferingSpinner} />
            <p className={styles.bufferingText}>{bufferingStatus}</p>
          </div>
        )}

        {error && (
          <div className={styles.noAccountsOverlay}>
            <div className={styles.noAccountsIcon}>📡</div>
            <h3 className={styles.noAccountsTitle}>
              {error.includes('No available') ? 'Channel Unavailable' : 'Stream Error'}
            </h3>
            <p className={styles.noAccountsText}>
              {error.includes('No available') 
                ? 'This channel is temporarily unavailable. Please try again later or select a different channel.'
                : error
              }
            </p>
            <div className={styles.errorActions}>
              <button onClick={() => {
                setFailedAccounts([]);
                failedAccountsRef.current = [];
                loadStream();
              }} className={styles.retryBtn}>
                Try Again
              </button>
              <button onClick={onClose} className={styles.closeErrorBtn}>Close</button>
            </div>
          </div>
        )}

        {isCastOverlayVisible && cast.isCasting && (
          <div className={styles.castOverlay}>
            <div className={styles.castOverlayContent}>
              <div className={styles.castingTo}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                  <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                  <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                </svg>
                <span>Casting to TV</span>
              </div>
              <h2 className={styles.castTitle}>{channel.name}</h2>
              <p className={styles.castSubtitle}>{channel.categoryInfo.icon} {channel.categoryInfo.name}</p>
              <div className={styles.castLiveIndicator}>
                <span className={styles.liveDot} /> LIVE
              </div>
              <button 
                className={styles.stopCastBtn}
                onClick={() => { cast.stop(); setIsCastOverlayVisible(false); }}
                type="button"
              >
                Stop Casting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
