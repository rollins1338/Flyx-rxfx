/**
 * Custom hook for video player functionality
 * Handles HLS streaming, controls, and player state
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { getTvPlaylistUrl, getPpvStreamProxyUrl, getCdnLiveStreamProxyUrl } from '@/app/lib/proxy-config';

export interface PlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isLoading: boolean;
  error: string | null;
  volume: number;
  currentTime: number;
  duration: number;
  buffered: number;
}

export interface StreamSource {
  type: 'dlhd' | 'ppv' | 'cdnlive';
  channelId: string;
  title: string;
  poster?: string;
}

export function useVideoPlayer() {
  const { trackLiveTVEvent, startLiveTVSession, endLiveTVSession } = useAnalytics();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    isMuted: true, // Start muted for autoplay to work
    isFullscreen: false,
    isLoading: false,
    error: null,
    volume: 1,
    currentTime: 0,
    duration: 0,
    buffered: 0,
  });

  const [currentSource, setCurrentSource] = useState<StreamSource | null>(null);

  // Get stream URL based on source type
  const getStreamUrl = useCallback((source: StreamSource): string => {
    switch (source.type) {
      case 'dlhd':
        return getTvPlaylistUrl(source.channelId);
      case 'ppv':
        // PPV needs to fetch stream URL from API first, return API endpoint
        return `/api/livetv/ppv-stream?uri=${encodeURIComponent(source.channelId)}`;
      case 'cdnlive':
        // CDN Live channelId format: "channelName|countryCode"
        const parts = source.channelId.split('|');
        const channelName = encodeURIComponent(parts[0] || source.channelId);
        const countryCode = parts[1] || 'us';
        return `/api/livetv/cdnlive-stream?channel=${channelName}&code=${countryCode}`;
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }, []);

  // Load HLS stream
  const loadStream = useCallback(async (source: StreamSource) => {
    if (!videoRef.current) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    setCurrentSource(source);

    try {
      // Dynamic import HLS.js
      const Hls = (await import('hls.js')).default;
      
      if (!Hls.isSupported()) {
        throw new Error('HLS is not supported in this browser');
      }

      // Destroy existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      let streamUrl = getStreamUrl(source);
      
      // For CDN Live and PPV, we need to fetch the stream URL from the API first
      if (source.type === 'cdnlive' || source.type === 'ppv') {
        const apiResponse = await fetch(streamUrl);
        const apiData = await apiResponse.json();
        
        if (!apiData.success || !apiData.streamUrl) {
          // Check for specific offline error
          const errorMsg = apiData.error || `Failed to get ${source.type.toUpperCase()} stream URL`;
          if (errorMsg.toLowerCase().includes('offline') || errorMsg.toLowerCase().includes('not live')) {
            throw new Error('This stream is not currently live. Please try again when the event starts.');
          }
          throw new Error(errorMsg);
        }
        
        // Proxy streams through Cloudflare for proper CORS and header handling
        if (source.type === 'ppv') {
          streamUrl = getPpvStreamProxyUrl(apiData.streamUrl);
        } else if (source.type === 'cdnlive') {
          streamUrl = getCdnLiveStreamProxyUrl(apiData.streamUrl);
        } else {
          streamUrl = apiData.streamUrl;
        }
      }
      
      // Create new HLS instance
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        // Note: Referer headers are handled by the proxy, not the browser
      });

      hlsRef.current = hls;

      // HLS event handlers
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setState(prev => ({ ...prev, isLoading: false }));
        const video = videoRef.current;
        if (video) {
          // Start muted for autoplay to work (browser policy)
          video.muted = true;
          video.play().then(() => {
            // Try to unmute after successful play
            setTimeout(() => {
              if (video) {
                video.muted = false;
                setState(prev => ({ ...prev, isMuted: false }));
              }
            }, 100);
          }).catch(err => {
            console.warn('Autoplay failed:', err);
            // Keep muted if autoplay fails
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS Error:', data);
        
        if (data.fatal) {
          // Check if it's an offline stream error
          const errorMsg = data.details || 'Stream error';
          if (errorMsg.includes('image') || errorMsg.includes('offline')) {
            setState(prev => ({ 
              ...prev, 
              isLoading: false, 
              error: 'This stream is not currently live. Please try again when the event starts.' 
            }));
          } else {
            setState(prev => ({ 
              ...prev, 
              isLoading: false, 
              error: `Stream error: ${data.details}` 
            }));
          }
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (videoRef.current) {
          const buffered = videoRef.current.buffered;
          if (buffered.length > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            const currentTime = videoRef.current.currentTime;
            setState(prev => ({ 
              ...prev, 
              buffered: ((bufferedEnd - currentTime) / 30) * 100 
            }));
          }
        }
      });

      // Load the stream
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);

      // Start analytics session
      startLiveTVSession({
        channelId: source.channelId,
        channelName: source.title,
        category: source.type,
      });

      // Track event
      trackLiveTVEvent({
        action: 'play_start',
        channelId: source.channelId,
        channelName: source.title,
        category: source.type,
      });

    } catch (error) {
      console.error('Error loading stream:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load stream' 
      }));
    }
  }, [getStreamUrl, trackLiveTVEvent, startLiveTVSession]);

  // Stop stream
  const stopStream = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }

    // End analytics session
    endLiveTVSession();

    setState(prev => ({
      ...prev,
      isPlaying: false,
      isLoading: false,
      error: null,
      currentTime: 0,
      duration: 0,
      buffered: 0,
    }));

    setCurrentSource(null);
  }, [endLiveTVSession]);

  // Play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (state.isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [state.isPlaying]);

  // Mute/unmute
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;

    videoRef.current.muted = !videoRef.current.muted;
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    if (!videoRef.current) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    videoRef.current.volume = clampedVolume;
    setState(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!videoRef.current) return;

    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setState(prev => ({ ...prev, isPlaying: false }));
    const handleTimeUpdate = () => {
      setState(prev => ({ 
        ...prev, 
        currentTime: video.currentTime,
        duration: video.duration || 0,
      }));
    };
    const handleVolumeChange = () => {
      setState(prev => ({ 
        ...prev, 
        volume: video.volume,
        isMuted: video.muted,
      }));
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState(prev => ({ ...prev, isFullscreen: !!document.fullscreenElement }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    // Refs
    videoRef,
    
    // State
    ...state,
    currentSource,
    
    // Actions
    loadStream,
    stopStream,
    togglePlay,
    toggleMute,
    setVolume,
    toggleFullscreen,
  };
}