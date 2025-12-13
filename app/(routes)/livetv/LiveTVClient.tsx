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
}

interface XfinityChannel {
  id: string;
  name: string;
  category: string;
  categoryInfo: { name: string; icon: string };
  hasEast: boolean;
  hasWest: boolean;
  eastName?: string;
  westName?: string;
  isHD: boolean;
}

interface XfinityCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

// Memoized channel card to prevent re-renders
const ChannelCard = memo(function ChannelCard({ 
  channel, 
  preferWestCoast, 
  onSelect 
}: { 
  channel: XfinityChannel; 
  preferWestCoast: boolean; 
  onSelect: (channel: XfinityChannel) => void;
}) {
  return (
    <button
      className={styles.channelCard}
      onClick={() => onSelect(channel)}
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
        {channel.hasEast && channel.hasWest && channel.eastName !== channel.westName && (
          <span className={styles.coastIndicator}>
            {preferWestCoast ? '🌄 West' : '🌅 East'}
          </span>
        )}
      </div>
      <span className={styles.playIcon}>▶</span>
    </button>
  );
});

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
  
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [xfinityChannels, setXfinityChannels] = useState<XfinityChannel[]>([]);
  const [xfinityCategories, setXfinityCategories] = useState<XfinityCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [preferWestCoast, setPreferWestCoast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { trackPageView('/livetv'); }, [trackPageView]);

  useEffect(() => {
    fetchChannels();
  }, [selectedCategory, searchQuery]);

  const fetchChannels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      
      const response = await fetch(`/api/livetv/xfinity-channels?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setXfinityChannels(data.channels);
        setXfinityCategories(data.categories);
      } else {
        setError('Failed to load channels');
      }
    } catch {
      setError('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = useCallback((xfinityChannel: XfinityChannel) => {
    const coastParam = preferWestCoast ? ':west' : ':east';
    const channel: Channel = {
      id: `xfinity-${xfinityChannel.id}`,
      name: xfinityChannel.name,
      category: xfinityChannel.category,
      country: 'us',
      streamId: xfinityChannel.id + coastParam,
      firstLetter: xfinityChannel.name.charAt(0),
      isHD: xfinityChannel.isHD,
      categoryInfo: xfinityChannel.categoryInfo,
      countryInfo: { name: 'United States', flag: '🇺🇸' },
    };
    setSelectedChannel(channel);
    trackLiveTVEvent({
      action: 'channel_select',
      channelId: xfinityChannel.id,
      channelName: xfinityChannel.name,
      category: xfinityChannel.categoryInfo.name,
    });
    trackEvent('livetv_channel_selected', { 
      channelId: xfinityChannel.id, 
      channelName: xfinityChannel.name,
      preferWest: preferWestCoast,
    });
  }, [trackLiveTVEvent, trackEvent, preferWestCoast]);

  const totalChannels = xfinityCategories.reduce((sum, cat) => sum + cat.count, 0);

  // Memoize the channel list to prevent re-renders when player state changes
  const channelList = useMemo(() => (
    xfinityChannels.map((channel) => (
      <ChannelCard
        key={channel.id}
        channel={channel}
        preferWestCoast={preferWestCoast}
        onSelect={handleChannelSelect}
      />
    ))
  ), [xfinityChannels, preferWestCoast, handleChannelSelect]);

  return (
    <div className={styles.container}>
      <Navigation />

      {/* Hide layout when player is open to save resources */}
      <div className={styles.layout} style={{ display: selectedChannel ? 'none' : undefined }}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Live TV</h2>
            <span className={styles.channelCount}>{totalChannels} Channels</span>
          </div>

          {/* Search */}
          <div className={styles.sidebarSearch}>
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Category Filters */}
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
              {xfinityCategories.map((cat) => (
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
              <h3>Time Zone</h3>
              <button
                className={`${styles.filterItem} ${!preferWestCoast ? styles.active : ''}`}
                onClick={() => setPreferWestCoast(false)}
              >
                <span>🌅 East Coast</span>
              </button>
              <button
                className={`${styles.filterItem} ${preferWestCoast ? styles.active : ''}`}
                onClick={() => setPreferWestCoast(true)}
              >
                <span>🌄 West Coast</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          {isLoading ? (
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
              {xfinityChannels.length === 0 ? (
                <div className={styles.noResults}>
                  <p>No channels found</p>
                </div>
              ) : channelList}
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
  const playerRef = useRef<any>(null); // mpegts.js player
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
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
  
  // Account cycling state (internal - not displayed to user)
  const [isCycling, setIsCycling] = useState(false);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [failedAccounts, setFailedAccounts] = useState<string[]>([]); // Just IDs
  const [remainingAccounts, setRemainingAccounts] = useState<number>(0);
  const failedAccountsRef = useRef<string[]>([]); // Track failed account IDs for API calls

  const cast = useCast({
    onConnect: () => console.log('[LiveTV] Cast connected'),
    onDisconnect: () => {
      console.log('[LiveTV] Cast disconnected');
      setIsCastOverlayVisible(false);
    },
    onError: (error) => console.error('[LiveTV] Cast error:', error),
  });

  const getCastMedia = useCallback((): CastMedia => {
    return {
      url: `${window.location.origin}/api/livetv/xfinity-stream?channelId=${channel.streamId}`,
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
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.unload();
          playerRef.current.detachMediaElement();
          playerRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        playerRef.current = null;
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      updateActivity({ type: 'browsing' });
    };
  }, [channel.streamId]);

  // Delete an invalid account from the database
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
      setCurrentAccountId(null);
      setRemainingAccounts(0);
      setIsCycling(false);
    }
    
    setIsLoading(true);
    setError(null);

    // Cleanup previous player safely
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      playerRef.current = null;
    }
    
    // Reset video element
    if (videoRef.current) {
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }

    try {
      // Parse channel ID and coast preference
      const [channelId, coastPart] = channel.streamId.split(':');
      const coastParam = coastPart === 'west' ? '&coast=west' : '';
      
      // Build exclude parameter from failed accounts
      const excludeParam = failedAccountsRef.current.length > 0 
        ? `&excludeAccounts=${failedAccountsRef.current.join(',')}` 
        : '';
      
      // Get stream URL from our Xfinity/Stalker API
      const response = await fetch(`/api/livetv/xfinity-stream?channelId=${channelId}${coastParam}${excludeParam}`);
      const data = await response.json();
      
      // No accounts left
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
      
      // Track account internally (not displayed)
      if (data.account) {
        setCurrentAccountId(data.account.id);
        setRemainingAccounts(data.account.remainingAccounts || 0);
        if (isRetry) {
          setIsCycling(true);
        }
      }
      
      console.log('[LiveTV] Loading stream:', channel.name, 
        isRetry ? `(attempt ${failedAccountsRef.current.length + 1})` : '');

      // Use mpegts.js for MPEG-TS streams
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
        // Worker for better performance (offloads demuxing to separate thread)
        enableWorker: true,
        
        // Stash buffer - larger buffer for smoother playback
        enableStashBuffer: true,
        stashInitialSize: 1024 * 1024, // 1MB initial buffer (was 384KB)
        
        // Live stream latency settings - prioritize smoothness over low latency
        liveBufferLatencyChasing: true, // Enable latency chasing to prevent drift
        liveBufferLatencyMaxLatency: 8.0, // Allow up to 8 seconds behind live (was 5)
        liveBufferLatencyMinRemain: 3.0, // Keep at least 3 seconds buffered (was 1)
        liveSync: true, // Sync to live edge
        liveSyncMaxLatency: 10.0, // Max latency before seeking to live
        
        // Lazy loading disabled for live streams
        lazyLoad: false,
        lazyLoadMaxDuration: 3 * 60,
        lazyLoadRecoverDuration: 30,
        
        // Source buffer management
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 60, // Keep 1 min of backward buffer (was 3 min)
        autoCleanupMinBackwardDuration: 30, // Start cleanup after 30 sec (was 2 min)
        
        // Fix audio/video sync issues
        fixAudioTimestampGap: true,
        
        // Accurate seek for better playback
        accurateSeek: true,
        
        // Seek type for live streams
        seekType: 'range',
        
        // Range load - fetch more data at once
        rangeLoadZeroStart: false,
      });

      // Optimize video element for live streaming
      videoRef.current.preload = 'auto';
      
      player.attachMediaElement(videoRef.current);
      player.load();
      
      // Listen for statistics to monitor buffer health
      player.on(mpegts.Events.STATISTICS_INFO, (stats: any) => {
        // If buffer is getting low, show buffering indicator
        if (stats.decodedFrames > 0 && stats.droppedFrames / stats.decodedFrames > 0.1) {
          console.log('[LiveTV] High frame drop rate:', (stats.droppedFrames / stats.decodedFrames * 100).toFixed(1) + '%');
        }
      });

      // Track current account for error handler closure
      const accountAtLoad = data.account ? { id: data.account.id, mac: data.account.mac } : null;
      
      // Flag to prevent handling errors after cleanup
      let isDestroyed = false;

      player.on(mpegts.Events.ERROR, async (errorType: string, errorDetail: string) => {
        // Ignore errors after player has been destroyed (SourceBuffer cleanup errors)
        if (isDestroyed) return;
        
        // Ignore SourceBuffer removal errors - these happen during normal cleanup
        if (errorDetail.includes('SourceBuffer') || errorDetail.includes('removed from the parent')) {
          console.log('[LiveTV] Ignoring SourceBuffer cleanup error');
          return;
        }
        
        console.error('[LiveTV] mpegts error:', errorType, errorDetail);
        
        const isAccountError = errorDetail.includes('403') || 
                               errorDetail.includes('HttpStatusCodeInvalid') ||
                               errorDetail.includes('458') ||
                               errorDetail.includes('456');
        
        if (isAccountError && accountAtLoad) {
          isDestroyed = true; // Mark as destroyed before cleanup
          // Add to failed accounts list
          setFailedAccounts(prev => [...prev, accountAtLoad.id]);
          
          // Add to ref (for API calls)
          if (!failedAccountsRef.current.includes(accountAtLoad.id)) {
            failedAccountsRef.current.push(accountAtLoad.id);
          }
          
          // Delete the invalid account from database
          deleteInvalidAccount(accountAtLoad.id);
          
          // Cleanup current player before retry (safely)
          if (playerRef.current) {
            try {
              playerRef.current.pause();
              playerRef.current.unload();
              playerRef.current.detachMediaElement();
              playerRef.current.destroy();
            } catch (e) {
              // Ignore cleanup errors
            }
            playerRef.current = null;
          }
          
          // Try next account after a brief delay
          setTimeout(() => {
            loadStream(true);
          }, 800);
          return;
        }
        
        // Non-account error
        setIsCycling(false);
        setIsLoading(false);
        
        if (errorDetail.includes('Network') || errorDetail.includes('fetch')) {
          setBufferingStatus('Reconnecting...');
        } else {
          setError(`Stream error: ${errorDetail}`);
        }
        
        trackLiveTVEvent({
          action: 'error',
          channelId: channel.streamId,
          channelName: channel.name,
          errorMessage: `${errorType}: ${errorDetail}`,
        });
      });

      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        // This fires when stream data stops - only log it, don't auto-reconnect
        // The video 'ended' event will handle actual stream end
        console.log('[LiveTV] Loading complete');
      });

      player.on(mpegts.Events.MEDIA_INFO, () => {
        console.log('[LiveTV] Media info received - stream playing!');
        setIsCycling(false);
        setIsLoading(false);
        setBufferingStatus(null);
        videoRef.current?.play().catch(() => {});
      });

      playerRef.current = player;

    } catch (err: any) {
      console.error('[LiveTV] Stream load error:', err);
      
      // If we have a current account, mark it as failed and try next
      if (currentAccountId && currentAccountId !== 'fallback') {
        setFailedAccounts(prev => [...prev, currentAccountId]);
        
        if (!failedAccountsRef.current.includes(currentAccountId)) {
          failedAccountsRef.current.push(currentAccountId);
        }
        
        await deleteInvalidAccount(currentAccountId);
        
        setTimeout(() => {
          loadStream(true);
        }, 800);
        return;
      }
      
      setIsCycling(false);
      setError(err.message || 'Failed to load stream');
      setIsLoading(false);
    }
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
    
    // Debounce buffering status to avoid flickering
    let bufferingTimeout: NodeJS.Timeout | null = null;
    
    const onWaiting = () => {
      // Only show buffering after 500ms to avoid flicker on brief pauses
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
      if (bufferingTimeout) {
        clearTimeout(bufferingTimeout);
        bufferingTimeout = null;
      }
      setBufferingStatus(null);
    };
    
    const onCanPlay = () => {
      if (bufferingTimeout) {
        clearTimeout(bufferingTimeout);
        bufferingTimeout = null;
      }
      setBufferingStatus(null);
    };
    
    // Handle stalled streams - just show status, don't auto-reconnect
    const onStalled = () => {
      console.log('[LiveTV] Stream stalled');
      // Don't auto-reconnect on stall - it's often temporary
    };
    
    // Handle stream ended - auto reconnect for live streams
    // This only fires when the MediaSource actually ends
    const onEnded = () => {
      console.log('[LiveTV] Video ended - reconnecting...');
      setBufferingStatus('Reconnecting...');
      setTimeout(() => {
        loadStream(false);
      }, 2000);
    };
    
    // Handle errors at video element level
    const onError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      // Only reconnect on actual media errors, not on cleanup
      if (videoEl.error && videoEl.error.code !== MediaError.MEDIA_ERR_ABORTED) {
        console.log('[LiveTV] Video element error:', videoEl.error?.message);
        setBufferingStatus('Reconnecting...');
        setTimeout(() => {
          loadStream(false);
        }, 2000);
      }
    };
    
    // Track playback time - for future monitoring if needed
    const onTimeUpdate = () => {
      // Currently just a placeholder - can add monitoring later
    };
    
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('timeupdate', onTimeUpdate);
    
    return () => {
      if (bufferingTimeout) clearTimeout(bufferingTimeout);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('timeupdate', onTimeUpdate);
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
    // Always set timeout to hide, regardless of play state
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, CONTROLS_HIDE_DELAY);
  }, []);

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);
  
  const handleMouseLeave = useCallback(() => {
    // Hide faster when mouse leaves
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 800);
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Auto-hide controls when playing starts or after inactivity
  useEffect(() => {
    if (isPlaying) {
      // Start hide timer when playback begins
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, CONTROLS_HIDE_DELAY);
    } else {
      // Show controls when paused
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
          <span className={styles.sourceTag} title="IPTV Source">📡 IPTV</span>
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

        {/* Loading/Cycling UI - Simple progress bar */}
        {(isLoading || isCycling) && (
          <div className={styles.cyclingOverlay}>
            <div className={styles.cyclingSpinner} />
            
            <h3 className={styles.cyclingTitle}>
              Loading {channel.name}...
            </h3>
            
            {/* Progress bar - shows checked/total ratio */}
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
              <button 
                onClick={() => window.open(`mailto:support@flyx.tv?subject=Channel Issue: ${channel.name}&body=The channel "${channel.name}" had issues on ${new Date().toLocaleString()}.`, '_blank')}
                className={styles.feedbackBtn}
              >
                Report Issue
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
