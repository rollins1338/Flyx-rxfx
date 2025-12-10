'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import { useCast, CastMedia } from '@/hooks/useCast';
import { getTvPlaylistUrl } from '@/app/lib/proxy-config';
import styles from './LiveTV.module.css';

/**
 * Check if an event is currently live based on its start time.
 * Events are considered live if they started within the last 3 hours.
 */
function isEventCurrentlyLive(dataTime: string, serverIsLive: boolean): boolean {
  // If server already says it's live, trust that
  if (serverIsLive) return true;
  
  if (!dataTime) return false;
  
  try {
    let eventTime: Date;
    
    if (/^\d+$/.test(dataTime)) {
      // Unix timestamp (seconds)
      eventTime = new Date(parseInt(dataTime) * 1000);
    } else {
      // Parse as date string - assume UK timezone (GMT)
      eventTime = new Date(dataTime + ' GMT');
    }
    
    const now = new Date();
    const diffMs = now.getTime() - eventTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Event is live if it started between 0 and 3 hours ago
    return diffHours >= 0 && diffHours <= 3;
  } catch {
    return false;
  }
}

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
}

interface FilterOption {
  id: string;
  name: string;
  icon?: string;
  flag?: string;
  count: number;
}

interface ChannelResponse {
  success: boolean;
  channels: Channel[];
  pagination: { page: number; limit: number; totalChannels: number; totalPages: number; hasMore: boolean };
  filters: { categories: FilterOption[]; countries: FilterOption[]; letters: string[] };
  stats: { totalChannels: number; lastUpdated: string };
}

interface SportEvent {
  id: string;
  time: string;
  dataTime: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  isLive: boolean;
  channels: { name: string; channelId: string; href: string }[];
}

interface ScheduleCategory {
  name: string;
  icon: string;
  events: SportEvent[];
}

interface ScheduleResponse {
  success: boolean;
  schedule: { date: string; timezone: string; categories: ScheduleCategory[] };
  stats: { totalCategories: number; totalEvents: number; totalChannels: number; liveEvents: number };
  filters: { sports: { name: string; icon: string; count: number }[] };
}

type BrowseMode = 'events' | 'channels';

export default function LiveTVClient() {
  const { 
    trackEvent, 
    trackPageView, 
    trackLiveTVEvent, 
    updateActivity, 
    trackInteraction,
    startLiveTVSession,
    endLiveTVSession,
    recordLiveTVBuffer,
    updateLiveTVQuality,
  } = useAnalytics();
  
  const [browseMode, setBrowseMode] = useState<BrowseMode>('events');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelFilters, setChannelFilters] = useState<ChannelResponse['filters'] | null>(null);
  const [channelStats, setChannelStats] = useState<ChannelResponse['stats'] | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [schedule, setSchedule] = useState<ScheduleCategory[]>([]);
  const [scheduleStats, setScheduleStats] = useState<ScheduleResponse['stats'] | null>(null);
  const [sportFilters, setSportFilters] = useState<ScheduleResponse['filters']['sports']>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSport, setSelectedSport] = useState('all');
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { trackPageView('/livetv'); }, [trackPageView]);

  useEffect(() => {
    if (browseMode === 'events') fetchSchedule();
    else fetchChannels();
  }, [browseMode, selectedSport, showLiveOnly, selectedCategory, searchQuery]);

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedSport !== 'all') params.set('sport', selectedSport);
      if (searchQuery) params.set('search', searchQuery);
      if (showLiveOnly) params.set('live', 'true');
      
      const response = await fetch(`/api/livetv/schedule?${params}`);
      const data: ScheduleResponse = await response.json();
      
      if (data.success) {
        setSchedule(data.schedule.categories);
        setScheduleStats(data.stats);
        setSportFilters(data.filters.sports);
      } else {
        setError('Failed to load schedule');
      }
    } catch {
      setError('Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChannels = async (loadMore = false) => {
    try {
      if (!loadMore) setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', loadMore ? String(page + 1) : '1');
      params.set('limit', '100');

      const response = await fetch(`/api/livetv/channels?${params}`);
      const data: ChannelResponse = await response.json();

      if (data.success) {
        if (loadMore) {
          setChannels(prev => [...prev, ...data.channels]);
          setPage(prev => prev + 1);
        } else {
          setChannels(data.channels);
          setPage(1);
        }
        setChannelFilters(data.filters);
        setChannelStats(data.stats);
        setHasMore(data.pagination.hasMore);
      } else {
        setError('Failed to load channels');
      }
    } catch {
      setError('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    trackLiveTVEvent({
      action: 'channel_select',
      channelId: channel.streamId,
      channelName: channel.name,
      category: channel.categoryInfo.name,
      country: channel.countryInfo.name,
    });
    trackInteraction({
      element: 'livetv_channel_card',
      action: 'click',
      context: {
        channelId: channel.streamId,
        channelName: channel.name,
        category: channel.category,
        isHD: channel.isHD,
      },
    });
  }, [trackLiveTVEvent, trackInteraction]);

  const handleEventChannelSelect = useCallback((channelId: string, channelName: string) => {
    const channel: Channel = {
      id: `event-${channelId}`,
      name: channelName,
      category: 'sports',
      country: 'international',
      streamId: channelId,
      firstLetter: channelName.charAt(0),
      isHD: true,
      categoryInfo: { name: 'Sports', icon: '⚽' },
      countryInfo: { name: 'International', flag: '🌐' },
    };
    setSelectedChannel(channel);
    trackLiveTVEvent({
      action: 'channel_select',
      channelId: channelId,
      channelName: channelName,
      category: 'Sports',
    });
    trackEvent('livetv_event_channel_selected', { channelId, channelName });
  }, [trackEvent]);

  // Get unique sports for sidebar
  const uniqueSports = sportFilters.reduce((acc, sport, index) => {
    if (!acc.find(s => s.name === sport.name)) {
      acc.push({ ...sport, uniqueId: `${sport.name}-${index}` });
    }
    return acc;
  }, [] as (typeof sportFilters[0] & { uniqueId: string })[]);

  // Track if component has mounted (for hydration-safe date calculations)
  const [hasMounted, setHasMounted] = useState(false);
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    setHasMounted(true);
    // Update live status every minute
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Get all events flat for easier display
  // Only recalculate live status after mount to avoid hydration mismatch
  const allEvents = useMemo(() => {
    return schedule.flatMap(cat => 
      cat.events.map(event => ({
        ...event,
        categoryIcon: cat.icon,
        categoryName: cat.name,
        // Only recalculate on client after mount, otherwise use server value
        isLive: hasMounted ? isEventCurrentlyLive(event.dataTime, event.isLive) : event.isLive,
      }))
    );
  }, [schedule, tick, hasMounted]);

  const filteredEvents = showLiveOnly ? allEvents.filter(e => e.isLive) : allEvents;
  const liveEvents = allEvents.filter(e => e.isLive);

  return (
    <div className={styles.container}>
      <Navigation />

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Live TV</h2>
            {scheduleStats && (
              <span className={styles.liveCount}>
                <span className={styles.liveDot} />
                {scheduleStats.liveEvents} Live
              </span>
            )}
          </div>

          {/* Mode Switch */}
          <div className={styles.modeSwitch}>
            <button 
              className={`${styles.modeBtn} ${browseMode === 'events' ? styles.active : ''}`}
              onClick={() => setBrowseMode('events')}
            >
              🏆 Events
            </button>
            <button 
              className={`${styles.modeBtn} ${browseMode === 'channels' ? styles.active : ''}`}
              onClick={() => setBrowseMode('channels')}
            >
              📺 Channels
            </button>
          </div>

          {/* Search */}
          <div className={styles.sidebarSearch}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Filters */}
          {browseMode === 'events' ? (
            <div className={styles.filterList}>
              <div className={styles.filterSection}>
                <h3>Sports</h3>
                <button
                  className={`${styles.filterItem} ${selectedSport === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedSport('all')}
                >
                  <span>📺 All Sports</span>
                  <span className={styles.filterCount}>{allEvents.length}</span>
                </button>
                <button
                  className={`${styles.filterItem} ${styles.liveFilter} ${showLiveOnly ? styles.active : ''}`}
                  onClick={() => setShowLiveOnly(!showLiveOnly)}
                >
                  <span><span className={styles.liveDot} /> Live Now</span>
                  <span className={styles.filterCount}>{liveEvents.length}</span>
                </button>
                {uniqueSports.slice(0, 10).map(sport => (
                  <button
                    key={sport.uniqueId}
                    className={`${styles.filterItem} ${selectedSport === sport.name ? styles.active : ''}`}
                    onClick={() => setSelectedSport(sport.name)}
                  >
                    <span>{sport.icon} {sport.name}</span>
                    <span className={styles.filterCount}>{sport.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.filterList}>
              <div className={styles.filterSection}>
                <h3>Categories</h3>
                <button
                  className={`${styles.filterItem} ${selectedCategory === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <span>📺 All Channels</span>
                  <span className={styles.filterCount}>{channelStats?.totalChannels || 0}</span>
                </button>
                {channelFilters?.categories.map((cat, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    className={`${styles.filterItem} ${selectedCategory === cat.id ? styles.active : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span>{cat.icon} {cat.name}</span>
                    <span className={styles.filterCount}>{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={() => browseMode === 'events' ? fetchSchedule() : fetchChannels()} className={styles.retryBtn}>
                Retry
              </button>
            </div>
          ) : browseMode === 'events' ? (
            /* Events View */
            <div className={styles.eventsGrid}>
              {filteredEvents.length === 0 ? (
                <div className={styles.noResults}>
                  <p>No events found</p>
                </div>
              ) : (
                filteredEvents.map((event, idx) => (
                  <div key={`${event.id}-${idx}`} className={`${styles.eventCard} ${event.isLive ? styles.live : ''}`}>
                    <div className={styles.eventHeader}>
                      <span className={styles.eventTime}>
                        {event.isLive ? (
                          <span className={styles.liveTag}><span className={styles.liveDot} /> LIVE</span>
                        ) : (
                          event.time
                        )}
                      </span>
                      <span className={styles.eventSport}>{event.categoryIcon}</span>
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
                      {event.channels.slice(0, 4).map((ch, chIdx) => (
                        <button
                          key={`${ch.channelId}-${chIdx}`}
                          className={styles.channelBtn}
                          onClick={() => handleEventChannelSelect(ch.channelId, ch.name)}
                        >
                          ▶ {ch.name}
                        </button>
                      ))}
                      {event.channels.length > 4 && (
                        <span className={styles.moreChannels}>+{event.channels.length - 4} more</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Channels View */
            <div className={styles.channelsGrid}>
              {channels.length === 0 ? (
                <div className={styles.noResults}>
                  <p>No channels found</p>
                </div>
              ) : (
                <>
                  {channels.map((channel, idx) => (
                    <button
                      key={`${channel.id}-${idx}`}
                      className={styles.channelCard}
                      onClick={() => handleChannelSelect(channel)}
                    >
                      <div className={styles.channelLogo}>
                        <span>{channel.name.charAt(0)}</span>
                        {channel.isHD && <span className={styles.hdBadge}>HD</span>}
                      </div>
                      <div className={styles.channelInfo}>
                        <span className={styles.channelName}>{channel.name}</span>
                        <span className={styles.channelMeta}>
                          {channel.categoryInfo.icon} {channel.categoryInfo.name}
                        </span>
                      </div>
                      <span className={styles.playIcon}>▶</span>
                    </button>
                  ))}
                  {hasMore && (
                    <button onClick={() => fetchChannels(true)} className={styles.loadMoreBtn}>
                      Load More
                    </button>
                  )}
                </>
              )}
            </div>
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



// Player Component with Custom Controls
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
  updateLiveTVQuality: _updateLiveTVQuality, // Available for future quality tracking
}: LiveTVPlayerProps) {
  const presenceContext = usePresenceContext();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const hlsRef = React.useRef<any>(null);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout>();
  const decryptRetryCount = React.useRef(0);
  const watchStartTimeRef = React.useRef<number>(0);
  const MAX_DECRYPT_RETRIES = 2;
  const CONTROLS_HIDE_DELAY = 3000; // 3 seconds
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bufferingStatus, setBufferingStatus] = useState<string | null>(null);
  const [isCastOverlayVisible, setIsCastOverlayVisible] = useState(false);
  const [streamSource, setStreamSource] = useState<'dlhd' | 'stalker'>('dlhd');

  // Cast to TV functionality
  const cast = useCast({
    onConnect: () => {
      console.log('[LiveTV] Cast connected');
    },
    onDisconnect: () => {
      console.log('[LiveTV] Cast disconnected');
      setIsCastOverlayVisible(false);
    },
    onError: (error) => {
      console.error('[LiveTV] Cast error:', error);
    },
  });

  // Build cast media object for live TV
  const getCastMedia = useCallback((): CastMedia => {
    const streamUrl = getTvPlaylistUrl(channel.streamId);
    // If it's a relative URL, make it absolute
    const absoluteUrl = streamUrl.startsWith('http') ? streamUrl : `${window.location.origin}${streamUrl}`;
    return {
      url: absoluteUrl,
      title: channel.name,
      subtitle: `${channel.categoryInfo.icon} ${channel.categoryInfo.name}`,
      contentType: 'application/x-mpegURL',
      isLive: true,
    };
  }, [channel]);

  // Handle cast button click
  const handleCastClick = useCallback(async () => {
    if (cast.isCasting) {
      cast.stop();
      setIsCastOverlayVisible(false);
    } else if (cast.isConnected) {
      const media = getCastMedia();
      videoRef.current?.pause();
      const success = await cast.loadMedia(media);
      if (success) {
        setIsCastOverlayVisible(true);
      }
    } else {
      const connected = await cast.requestSession();
      if (connected) {
        const media = getCastMedia();
        videoRef.current?.pause();
        const success = await cast.loadMedia(media);
        if (success) {
          setIsCastOverlayVisible(true);
        }
      }
    }
  }, [cast, getCastMedia]);

  useEffect(() => {
    decryptRetryCount.current = 0;
    watchStartTimeRef.current = 0;
    loadStream(false);
    return () => {
      // Track total watch duration on cleanup
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
      // End the Live TV session
      endLiveTVSession();
      
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      // Clear live activity
      updateActivity({ type: 'browsing' });
    };
  }, [channel.streamId]);

  const loadStream = async (invalidateCache = false) => {
    if (!videoRef.current) return;
    setIsLoading(true);
    setError(null);

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      let streamUrl: string;
      
      // First, check if there's a Stalker IPTV mapping for this channel
      try {
        const stalkerRes = await fetch(`/api/livetv/stalker-stream?channelId=${channel.streamId}`);
        const stalkerData = await stalkerRes.json();
        
        if (stalkerData.success && stalkerData.streamUrl) {
          console.log('[LiveTV] Using Stalker IPTV stream:', stalkerData.mapping?.stalkerChannelName);
          streamUrl = stalkerData.streamUrl;
          setStreamSource('stalker');
        } else {
          // Fall back to DLHD stream
          streamUrl = getTvPlaylistUrl(channel.streamId);
          if (invalidateCache) {
            streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'invalidate=true';
          }
          setStreamSource('dlhd');
        }
      } catch (stalkerErr) {
        // Stalker check failed, use DLHD
        console.log('[LiveTV] Stalker check failed, using DLHD:', stalkerErr);
        streamUrl = getTvPlaylistUrl(channel.streamId);
        if (invalidateCache) {
          streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'invalidate=true';
        }
        setStreamSource('dlhd');
      }

      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          // Buffer settings - balanced for live streams
          backBufferLength: 30, // Keep 30s behind
          maxBufferLength: 20, // Buffer 20 seconds ahead
          maxMaxBufferLength: 30, // Cap at 30 seconds
          maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer
          maxBufferHole: 0.5, // Allow small gaps
          // Live stream settings - CRITICAL for continuous playback
          liveSyncDurationCount: 3, // 3 segments behind live edge
          liveMaxLatencyDurationCount: 6, // Max 6 segments latency before seeking
          liveDurationInfinity: true,
          liveBackBufferLength: 30,
          // Playlist refresh - MUST refresh frequently for live streams!
          // Without this, playback stops after initial segments are exhausted
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 500,
          levelLoadingTimeOut: 10000,
          // Manifest/playlist refresh settings
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 500,
          manifestLoadingTimeOut: 10000,
          // Fragment loading
          fragLoadingMaxRetry: 4,
          fragLoadingRetryDelay: 500,
          fragLoadingTimeOut: 20000, // Give segments more time to load
          // Loading behavior
          startFragPrefetch: false,
          testBandwidth: false,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setBufferingStatus(null);
          decryptRetryCount.current = 0;
          console.log('[LiveTV] Manifest parsed, starting playback');
          videoRef.current?.play().catch(() => {});
        });

        // Monitor level/playlist loading for live stream health
        hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
          const details = data.details;
          // Log live stream status
          if (details.live) {
            console.log(`[LiveTV] Live playlist loaded: ${details.fragments?.length || 0} segments, target duration: ${details.targetduration}s`);
          }
          // If we're running low on segments, HLS.js should auto-refresh
          // but log it for debugging
          if (details.fragments && details.fragments.length < 3) {
            console.log('[LiveTV] Warning: Low segment count, waiting for playlist refresh');
          }
        });

        // Clear buffering status when fragment loads successfully
        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          setBufferingStatus(null);
          // Log fragment loading for debugging live stream continuity
          if (data.frag) {
            console.log(`[LiveTV] Fragment loaded: sn=${data.frag.sn}, duration=${data.frag.duration?.toFixed(1)}s`);
          }
        });

        // Handle buffer running dry - critical for live streams
        hls.on(Hls.Events.BUFFER_EOS, () => {
          console.log('[LiveTV] Buffer EOS - end of stream signal received');
          // For live streams, this shouldn't happen - try to recover
          setBufferingStatus('Refreshing stream...');
          // Force reload the playlist
          hls.startLoad(-1);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.log(`[LiveTV] HLS error: ${data.type} - ${data.details}`, data.fatal ? '(FATAL)' : '');
          
          // Handle fragment/segment loading errors - skip to next segment
          if (data.details === 'fragLoadError' || data.details === 'fragLoadTimeOut') {
            setBufferingStatus('Loading segment...');
            console.log('[LiveTV] Fragment load failed, skipping to next segment');
            // Skip the problematic fragment by seeking forward slightly
            if (videoRef.current && hls.media) {
              const currentTime = videoRef.current.currentTime;
              const buffered = videoRef.current.buffered;
              // Find next buffered region or skip 2 seconds
              let skipTo = currentTime + 2;
              for (let i = 0; i < buffered.length; i++) {
                if (buffered.start(i) > currentTime) {
                  skipTo = buffered.start(i);
                  break;
                }
              }
              videoRef.current.currentTime = skipTo;
              console.log(`[LiveTV] Skipped from ${currentTime.toFixed(1)}s to ${skipTo.toFixed(1)}s`);
            }
            // Don't treat as fatal - let HLS.js continue
            if (data.fatal) {
              hls.recoverMediaError();
            }
            return;
          }
          
          // Handle decryption errors by invalidating cache and retrying
          if (data.details === 'fragDecryptError' || data.details === 'keyLoadError') {
            setBufferingStatus('Refreshing stream key...');
            console.log(`[LiveTV] Key error, retry ${decryptRetryCount.current + 1}/${MAX_DECRYPT_RETRIES}`);
            if (decryptRetryCount.current < MAX_DECRYPT_RETRIES) {
              decryptRetryCount.current++;
              loadStream(true);
              return;
            }
          }
          
          // Handle buffer stall - don't seek, just wait for more data
          if (data.details === 'bufferStalledError') {
            setBufferingStatus('Buffering...');
            console.log('[LiveTV] Buffer stalled, waiting for data...');
            // Don't seek - just let HLS.js continue loading
            // Seeking can cause more stalls
            return;
          }
          
          // Handle buffer append errors
          if (data.details === 'bufferAppendError') {
            setBufferingStatus('Processing video...');
            console.log('[LiveTV] Buffer append error, recovering...');
            hls.recoverMediaError();
            return;
          }
          
          // Handle media errors - try to recover
          if (data.type === 'mediaError' && data.fatal) {
            setBufferingStatus('Recovering...');
            console.log('[LiveTV] Fatal media error, attempting recovery');
            hls.recoverMediaError();
            return;
          }
          
          // Handle network errors - try to recover
          if (data.type === 'networkError' && data.fatal) {
            setBufferingStatus('Reconnecting...');
            console.log('[LiveTV] Fatal network error, attempting recovery');
            hls.startLoad();
            return;
          }
          
          // Only show error for truly fatal unrecoverable errors
          if (data.fatal && data.type !== 'mediaError' && data.type !== 'networkError') {
            setBufferingStatus(null);
            setError('Stream error - channel may be offline');
            setIsLoading(false);
            // Track error
            trackLiveTVEvent({
              action: 'error',
              channelId: channel.streamId,
              channelName: channel.name,
              errorMessage: `${data.type}: ${data.details}`,
            });
          }
        });

        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoRef.current.src = streamUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          videoRef.current?.play().catch(() => {});
        });
      } else {
        setError('HLS not supported');
        setIsLoading(false);
      }
    } catch {
      setError('Failed to load stream');
      setIsLoading(false);
    }
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onPlay = () => {
      setIsPlaying(true);
      // Track play start
      if (watchStartTimeRef.current === 0) {
        watchStartTimeRef.current = Date.now();
        trackLiveTVEvent({
          action: 'play_start',
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
          country: channel.countryInfo.name,
        });
        // Start Live TV session for proper tracking
        startLiveTVSession({
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
          country: channel.countryInfo.name,
        });
        // Update live activity
        updateActivity({
          type: 'livetv',
          contentId: channel.streamId,
          contentTitle: channel.name,
          contentType: 'livetv',
          channelId: channel.streamId,
          channelName: channel.name,
          category: channel.categoryInfo.name,
        });
        // Update presence to "livetv"
        presenceContext?.setActivityType('livetv', {
          contentId: channel.streamId,
          contentTitle: channel.name,
        });
      }
    };
    
    const onPause = () => {
      setIsPlaying(false);
      // Track watch duration on pause
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
      // Update presence back to "browsing"
      presenceContext?.setActivityType('browsing');
    };
    
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    
    // Handle video waiting for data - common in live streams
    const onWaiting = () => {
      console.log('[LiveTV] Video waiting for data');
      setBufferingStatus('Buffering...');
      // Record buffer event for analytics
      recordLiveTVBuffer();
      trackLiveTVEvent({
        action: 'buffer',
        channelId: channel.streamId,
        channelName: channel.name,
      });
    };
    
    // Handle video stalled - no data available
    const onStalled = () => {
      console.log('[LiveTV] Video stalled - no data');
      setBufferingStatus('Loading...');
      // Try to kick HLS.js to fetch more data
      if (hlsRef.current) {
        hlsRef.current.startLoad(-1);
      }
    };
    
    // Handle video ended - shouldn't happen for live streams
    const onEnded = () => {
      console.log('[LiveTV] Video ended - attempting to resume live stream');
      setBufferingStatus('Reconnecting...');
      // For live streams, try to reload
      if (hlsRef.current) {
        hlsRef.current.startLoad(-1);
      }
    };
    
    // Clear buffering status when playing resumes
    const onPlaying = () => {
      setBufferingStatus(null);
    };
    
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('ended', onEnded);
    video.addEventListener('playing', onPlaying);
    
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('playing', onPlaying);
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Auto-hide controls after inactivity
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1000); // Hide faster when mouse leaves
    }
  }, [isPlaying]);

  const handleMouseEnter = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Show controls when paused
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
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
        {/* Close Button */}
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
        
        {/* Header */}
        <div className={styles.playerHeader}>
          <span className={styles.liveTag}><span className={styles.liveDot} /> LIVE</span>
          <span className={styles.channelTitle}>{channel.name}</span>
          <span className={styles.channelFlag}>{channel.countryInfo.flag}</span>
          {streamSource === 'stalker' && (
            <span className={styles.sourceTag} title="Using IPTV Stalker source">📡 IPTV</span>
          )}
        </div>

        {/* Video - NO controls attribute */}
        <video 
          ref={videoRef} 
          className={styles.video} 
          playsInline 
          onClick={togglePlay}
        />

        {/* Custom Controls - Always visible */}
        <div className={styles.customControls}>
          {/* Play/Pause */}
          <button className={styles.controlBtn} onClick={togglePlay} type="button">
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Volume */}
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

          {/* Live indicator */}
          <div className={styles.controlsLive}>
            <span className={styles.liveDot} /> LIVE
          </div>

          {/* Cast to TV */}
          {cast.isAvailable && (
            <button 
              className={`${styles.controlBtn} ${cast.isCasting ? styles.castActive : ''}`} 
              onClick={handleCastClick} 
              type="button"
              title={cast.isCasting ? 'Stop casting' : 'Cast to TV'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {cast.isCasting ? (
                  <>
                    <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                    <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                    <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                    <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                    <path d="M5 7v2h12v8h-4v2h6V7z" opacity="0.3" />
                  </>
                ) : (
                  <>
                    <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                    <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                    <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                    <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                  </>
                )}
              </svg>
            </button>
          )}

          {/* Fullscreen */}
          <button className={styles.controlBtn} onClick={toggleFullscreen} type="button">
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className={styles.playerOverlay}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>Loading {channel.name}...</p>
          </div>
        )}

        {/* Buffering Status Overlay - shows during playback issues */}
        {bufferingStatus && !isLoading && !error && (
          <div className={styles.bufferingOverlay}>
            <div className={styles.bufferingSpinner} />
            <p className={styles.bufferingText}>{bufferingStatus}</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className={styles.playerOverlay}>
            <p className={styles.errorText}>{error}</p>
            <div className={styles.errorActions}>
              <button onClick={() => { decryptRetryCount.current = 0; loadStream(true); }} className={styles.retryBtn}>Try Again</button>
              <button onClick={onClose} className={styles.closeErrorBtn}>Close</button>
            </div>
          </div>
        )}

        {/* Cast Overlay - shown when casting to TV */}
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
              <p className={styles.castSubtitle}>{channel.categoryInfo.icon} {channel.categoryInfo.name} • {channel.countryInfo.flag} {channel.countryInfo.name}</p>
              <div className={styles.castLiveIndicator}>
                <span className={styles.liveDot} /> LIVE
              </div>
              <button 
                className={styles.stopCastBtn}
                onClick={() => {
                  cast.stop();
                  setIsCastOverlayVisible(false);
                }}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
                Stop Casting
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
