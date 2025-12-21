'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Extend window for Cast SDK and AirPlay detection
declare global {
  interface Window {
    WebKitPlaybackTargetAvailabilityEvent?: any;
    chrome?: {
      cast?: {
        isAvailable?: boolean;
        SessionRequest?: any;
        ApiConfig?: any;
        initialize?: (config: any, onSuccess: () => void, onError: (error: any) => void) => void;
        requestSession?: (onSuccess: (session: any) => void, onError: (error: any) => void) => void;
        media?: {
          MediaInfo?: any;
          GenericMediaMetadata?: any;
          LoadRequest?: any;
        };
      };
    };
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
  }
}

export interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isCasting: boolean;
  deviceName: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING';
  // AirPlay specific
  isAirPlayAvailable: boolean;
  isAirPlayActive: boolean;
  // Error state for UI feedback
  lastError: string | null;
}

export interface UseCastOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  videoRef?: any;
}

export interface CastMedia {
  url: string;
  title: string;
  subtitle?: string;
  posterUrl?: string;
  contentType?: string;
  isLive?: boolean;
  startTime?: number;
}

// Detect iOS/Safari/Android/Chrome
const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isSafari = () => {
  if (typeof window === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

const isAndroid = () => {
  if (typeof window === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

const isChrome = () => {
  if (typeof window === 'undefined') return false;
  return /chrome/i.test(navigator.userAgent) && !/edge|edg/i.test(navigator.userAgent);
};

// Google Cast Application ID - use default media receiver for HLS
const CAST_APP_ID = 'CC1AD845'; // Default Media Receiver

// Load Google Cast SDK script
const loadCastSDK = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    // Check if already loaded
    if (window.chrome?.cast?.isAvailable) {
      console.log('[useCast] Cast SDK already available');
      resolve(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="cast_sender"]')) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.chrome?.cast?.isAvailable) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 5000);
      return;
    }

    // Set up callback before loading script
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      console.log('[useCast] Cast SDK loaded, available:', isAvailable);
      resolve(isAvailable);
    };

    // Load the Cast SDK
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    script.onerror = () => {
      console.error('[useCast] Failed to load Cast SDK');
      resolve(false);
    };
    document.head.appendChild(script);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!window.chrome?.cast?.isAvailable) {
        console.warn('[useCast] Cast SDK load timeout');
        resolve(false);
      }
    }, 10000);
  });
};

export function useCast(options: UseCastOptions = {}) {
  const [state, setState] = useState<CastState>({
    isAvailable: true, // Always show button - let user try casting
    isConnected: false,
    isCasting: false,
    deviceName: null,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playerState: 'IDLE',
    isAirPlayAvailable: false,
    isAirPlayActive: false,
    lastError: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const hasRemotePlaybackRef = useRef(false);
  const hasAirPlayRef = useRef(false);
  const hasCastSDKRef = useRef(false);
  const castSessionRef = useRef<any>(null);
  const castMediaRef = useRef<any>(null);
  const isIOSRef = useRef(false);
  const isSafariRef = useRef(false);
  const isAndroidRef = useRef(false);
  const isChromeRef = useRef(false);
  
  // Store callbacks in refs to avoid re-running effects when they change
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  
  // Keep refs in sync
  useEffect(() => { onConnectRef.current = options.onConnect; }, [options.onConnect]);
  useEffect(() => { onDisconnectRef.current = options.onDisconnect; }, [options.onDisconnect]);
  useEffect(() => { onErrorRef.current = options.onError; }, [options.onError]);

  // Detect platform and initialize Cast SDK on mount
  useEffect(() => {
    // Detect platform first
    isIOSRef.current = isIOS();
    isSafariRef.current = isSafari();
    isAndroidRef.current = isAndroid();
    isChromeRef.current = isChrome();
    console.log('[useCast] Platform detection:', { 
      isIOS: isIOSRef.current, 
      isSafari: isSafariRef.current,
      isAndroid: isAndroidRef.current,
      isChrome: isChromeRef.current
    });

    // Only load Cast SDK on Chrome (desktop or Android), not on iOS
    if ((isChromeRef.current || isAndroidRef.current) && !isIOSRef.current) {
      const initCastSDK = async () => {
        const available = await loadCastSDK();
        hasCastSDKRef.current = available;
        
        if (available && window.chrome?.cast) {
          console.log('[useCast] Initializing Cast SDK...');
          
          try {
            const sessionRequest = new window.chrome.cast.SessionRequest(CAST_APP_ID);
            const apiConfig = new window.chrome.cast.ApiConfig(
              sessionRequest,
              // Session listener - called when a session is created
              (session: any) => {
                console.log('[useCast] Cast session created:', session.displayName);
                castSessionRef.current = session;
                setState(prev => ({
                  ...prev,
                  isConnected: true,
                  isCasting: true,
                  deviceName: session.displayName || 'Chromecast',
                  lastError: null,
                }));
                onConnectRef.current?.();
                
                // Listen for session updates
                session.addUpdateListener((isAlive: boolean) => {
                  if (!isAlive) {
                    console.log('[useCast] Cast session ended');
                    castSessionRef.current = null;
                    castMediaRef.current = null;
                    setState(prev => ({
                      ...prev,
                      isConnected: false,
                      isCasting: false,
                      deviceName: null,
                    }));
                    onDisconnectRef.current?.();
                  }
                });
              },
              // Receiver listener - called when receiver availability changes
              (availability: string) => {
                console.log('[useCast] Cast receiver availability:', availability);
                const isAvailable = availability === 'available';
                setState(prev => ({ ...prev, isAvailable: isAvailable || prev.isAirPlayAvailable }));
              }
            );

            window.chrome!.cast!.initialize!(
              apiConfig,
              () => {
                console.log('[useCast] Cast SDK initialized successfully');
              },
              (error: any) => {
                console.error('[useCast] Cast SDK initialization error:', error);
              }
            );
          } catch (e) {
            console.error('[useCast] Cast SDK setup error:', e);
          }
        }
      };

      initCastSDK();
    }
  }, []); // Empty deps - only run once on mount

  // Check for Remote Playback API and AirPlay availability
  useEffect(() => {
    const video = options.videoRef?.current as HTMLVideoElement | null;
    if (!video) return;

    // Check AirPlay (Safari/iOS)
    // On iOS Safari, webkitShowPlaybackTargetPicker is the key method
    const hasAirPlay = !!(
      window.WebKitPlaybackTargetAvailabilityEvent || 
      'webkitCurrentPlaybackTargetIsWireless' in video ||
      'webkitShowPlaybackTargetPicker' in video
    );
    
    hasAirPlayRef.current = hasAirPlay;
    console.log('[useCast] AirPlay available:', hasAirPlay);
    
    if (hasAirPlay) {
      setState(prev => ({ ...prev, isAirPlayAvailable: true, isAvailable: true }));
    }

    // Check Remote Playback API (Chrome/Edge - NOT available on iOS)
    // @ts-ignore - remote is not in standard types
    const remote = video.remote;
    if (remote && !isIOSRef.current) {
      hasRemotePlaybackRef.current = true;
      console.log('[useCast] Remote Playback API available');
      
      // Watch for device availability
      remote.watchAvailability((_available: boolean) => {
        setState(prev => ({ 
          ...prev, 
          isAvailable: true, // Always keep available
        }));
      }).then((id: number) => {
        watchIdRef.current = id;
      }).catch(() => {
        // watchAvailability not supported (common on localhost/HTTP)
        // This is expected - prompt() can still work
      });

      // Listen for state changes
      const handleConnecting = () => {
        console.log('[useCast] Remote Playback: connecting');
        setState(prev => ({ ...prev, isConnected: false, isCasting: false, lastError: null }));
      };

      const handleConnect = () => {
        console.log('[useCast] Remote Playback: connected');
        setState(prev => ({ ...prev, isConnected: true, isCasting: true, lastError: null }));
        onConnectRef.current?.();
      };

      const handleDisconnect = () => {
        console.log('[useCast] Remote Playback: disconnected');
        setState(prev => ({ ...prev, isConnected: false, isCasting: false }));
        onDisconnectRef.current?.();
      };

      remote.addEventListener('connecting', handleConnecting);
      remote.addEventListener('connect', handleConnect);
      remote.addEventListener('disconnect', handleDisconnect);

      return () => {
        remote.removeEventListener('connecting', handleConnecting);
        remote.removeEventListener('connect', handleConnect);
        remote.removeEventListener('disconnect', handleDisconnect);
        
        if (watchIdRef.current !== null) {
          remote.cancelWatchAvailability(watchIdRef.current).catch(() => {});
        }
      };
    }
  }, [options.videoRef]); // Only re-run when videoRef changes

  // Listen for AirPlay state changes (Safari/iOS)
  useEffect(() => {
    const video = options.videoRef?.current as HTMLVideoElement | null;
    if (!video) return;

    const handleAirPlayAvailability = (event: any) => {
      const available = event.availability === 'available';
      console.log('[useCast] AirPlay availability changed:', available);
      setState(prev => ({ ...prev, isAirPlayAvailable: available, isAvailable: true }));
    };

    const handleAirPlayChange = () => {
      // @ts-ignore
      const isWireless = video.webkitCurrentPlaybackTargetIsWireless || false;
      console.log('[useCast] AirPlay wireless state changed:', isWireless);
      setState(prev => ({ 
        ...prev, 
        isAirPlayActive: isWireless,
        isCasting: isWireless || prev.isCasting,
        isConnected: isWireless || prev.isConnected,
        lastError: null,
      }));
      
      if (isWireless) {
        onConnectRef.current?.();
      } else {
        onDisconnectRef.current?.();
      }
    };

    // Safari/iOS AirPlay events
    video.addEventListener('webkitplaybacktargetavailabilitychanged', handleAirPlayAvailability);
    video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange);

    return () => {
      video.removeEventListener('webkitplaybacktargetavailabilitychanged', handleAirPlayAvailability);
      video.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handleAirPlayChange);
    };
  }, [options.videoRef]); // Only re-run when videoRef changes

  // Request cast session - shows device picker
  const requestSession = useCallback(async () => {
    const video = options.videoRef?.current as HTMLVideoElement | null;
    if (!video) {
      const error = 'No video element available';
      console.error('[useCast] requestSession failed:', error);
      setState(prev => ({ ...prev, lastError: error }));
      onErrorRef.current?.(error);
      return false;
    }

    // Clear previous error
    setState(prev => ({ ...prev, lastError: null }));

    // Log detailed state for debugging
    const castSDKAvailable = window.chrome?.cast?.isAvailable || false;
    const castRequestSession = !!window.chrome?.cast?.requestSession;
    // @ts-ignore
    const hasRemote = !!video.remote;
    
    console.log('[useCast] Requesting session...', { 
      isIOS: isIOSRef.current, 
      isSafari: isSafariRef.current,
      isAndroid: isAndroidRef.current,
      isChrome: isChromeRef.current,
      hasAirPlay: hasAirPlayRef.current,
      hasRemotePlayback: hasRemotePlaybackRef.current,
      hasCastSDK: hasCastSDKRef.current,
      castSDKAvailable,
      castRequestSession,
      hasRemote,
      videoSrc: video.src ? 'set' : 'empty',
      videoReadyState: video.readyState,
    });

    // For iOS/Safari, ALWAYS try AirPlay first
    // @ts-ignore
    if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
      try {
        console.log('[useCast] Showing AirPlay picker...');
        // On iOS, the video must be playing or have played for AirPlay to work
        // Try to ensure video is ready
        if (video.readyState < 2) {
          console.log('[useCast] Video not ready, attempting to load...');
          video.load();
          // Wait a bit for video to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // @ts-ignore
        video.webkitShowPlaybackTargetPicker();
        return true;
      } catch (e) {
        console.error('[useCast] AirPlay picker failed:', e);
        // On iOS, if AirPlay fails, there's no fallback
        if (isIOSRef.current) {
          const error = 'AirPlay is not available. Make sure your Apple TV or AirPlay device is on the same network.';
          setState(prev => ({ ...prev, lastError: error }));
          onErrorRef.current?.(error);
          return false;
        }
        // On desktop Safari, continue to try other methods
      }
    }

    // Try Remote Playback API FIRST (works with more devices including some smart TVs)
    // @ts-ignore
    const remote = video.remote;
    if (remote && !isIOSRef.current) {
      try {
        console.log('[useCast] Trying Remote Playback API...');
        // Check if video has a source - Remote Playback requires a valid source
        if (!video.src && !video.currentSrc) {
          console.log('[useCast] Video has no source, skipping Remote Playback API');
        } else {
          await remote.prompt();
          return true;
        }
      } catch (error: any) {
        console.log('[useCast] Remote Playback error:', error.name, error.message);
        if (error.name === 'NotAllowedError') {
          // User cancelled - not an error
          console.log('[useCast] User cancelled cast prompt');
          return false;
        }
        if (error.name === 'InvalidStateError') {
          // Video source not compatible or not set
          console.log('[useCast] Remote Playback not available for this source');
        }
        // Continue to try Google Cast SDK
      }
    }

    // Try Google Cast SDK (Chrome desktop and Android)
    // Check both the ref AND the window object directly in case SDK loaded after init
    const castAvailable = hasCastSDKRef.current || window.chrome?.cast?.isAvailable;
    if (castAvailable && window.chrome?.cast?.requestSession) {
      console.log('[useCast] Requesting Google Cast session...');
      return new Promise<boolean>((resolve) => {
        window.chrome!.cast!.requestSession!(
          (session: any) => {
            console.log('[useCast] Cast session established:', session.displayName);
            castSessionRef.current = session;
            setState(prev => ({
              ...prev,
              isConnected: true,
              isCasting: false, // Not casting media yet
              deviceName: session.displayName || 'Chromecast',
              lastError: null,
            }));
            onConnectRef.current?.();
            
            // Listen for session updates
            session.addUpdateListener((isAlive: boolean) => {
              if (!isAlive) {
                console.log('[useCast] Cast session ended');
                castSessionRef.current = null;
                castMediaRef.current = null;
                setState(prev => ({
                  ...prev,
                  isConnected: false,
                  isCasting: false,
                  deviceName: null,
                  playerState: 'IDLE',
                }));
                onDisconnectRef.current?.();
              }
            });
            
            resolve(true);
          },
          (error: any) => {
            console.error('[useCast] Cast session request error:', error);
            let errorMessage: string;
            
            if (error.code === 'cancel') {
              // User cancelled - not an error
              console.log('[useCast] User cancelled cast picker');
              resolve(false);
              return;
            } else if (error.code === 'receiver_unavailable') {
              errorMessage = 'No Chromecast devices found. For LG/Samsung TVs, try "Cast tab" from Chrome menu instead.';
            } else if (error.code === 'session_error') {
              errorMessage = 'Failed to connect. For smart TVs (LG/Samsung), use "Cast tab" from Chrome menu (⋮ → Cast).';
            } else if (error.code === 'timeout') {
              errorMessage = 'Connection timed out. Please try again.';
            } else {
              errorMessage = error.description || 'Failed to connect to cast device';
            }
            
            setState(prev => ({ ...prev, lastError: errorMessage }));
            onErrorRef.current?.(errorMessage);
            resolve(false);
          }
        );
      });
    }

    // If we're on Chrome but Cast SDK isn't available yet, try to load it now
    if (isChromeRef.current && !castAvailable) {
      console.log('[useCast] Cast SDK not ready, attempting to load...');
      const loaded = await loadCastSDK();
      if (loaded && window.chrome?.cast?.requestSession) {
        console.log('[useCast] Cast SDK loaded, requesting session...');
        return new Promise<boolean>((resolve) => {
          window.chrome!.cast!.requestSession!(
            (session: any) => {
              console.log('[useCast] Cast session established:', session.displayName);
              castSessionRef.current = session;
              setState(prev => ({
                ...prev,
                isConnected: true,
                isCasting: false,
                deviceName: session.displayName || 'Chromecast',
                lastError: null,
              }));
              onConnectRef.current?.();
              resolve(true);
            },
            (error: any) => {
              if (error.code === 'cancel') {
                resolve(false);
                return;
              }
              const errorMessage = error.description || 'Failed to connect to cast device';
              setState(prev => ({ ...prev, lastError: errorMessage }));
              onErrorRef.current?.(errorMessage);
              resolve(false);
            }
          );
        });
      }
    }

    // No casting method available
    let error: string;
    if (isIOSRef.current) {
      error = 'AirPlay is not available on this device.';
    } else if (isAndroidRef.current) {
      error = 'Casting requires the Google Home app. Make sure your Chromecast is set up.';
    } else {
      error = 'For LG/Samsung smart TVs, use Chrome menu (⋮) → Cast → Sources → Cast tab. For Chromecast, make sure it\'s on the same network.';
    }
    setState(prev => ({ ...prev, lastError: error }));
    onErrorRef.current?.(error);
    return false;
  }, [options.videoRef]); // Only depends on videoRef

  // Load media on cast device
  const loadMedia = useCallback(async (media: CastMedia) => {
    console.log('[useCast] Loading media:', media.title);
    
    // For Google Cast SDK
    if (castSessionRef.current && window.chrome?.cast?.media) {
      try {
        const mediaInfo = new window.chrome.cast.media.MediaInfo(media.url, media.contentType || 'application/x-mpegURL');
        
        // Set up metadata
        const metadata = new window.chrome.cast.media.GenericMediaMetadata();
        metadata.title = media.title;
        if (media.subtitle) {
          metadata.subtitle = media.subtitle;
        }
        if (media.posterUrl) {
          metadata.images = [{ url: media.posterUrl }];
        }
        mediaInfo.metadata = metadata;
        
        // Set stream type
        mediaInfo.streamType = media.isLive ? 'LIVE' : 'BUFFERED';
        
        // Create load request
        const loadRequest = new window.chrome.cast.media.LoadRequest(mediaInfo);
        if (media.startTime && media.startTime > 0) {
          loadRequest.currentTime = media.startTime;
        }
        loadRequest.autoplay = true;
        
        return new Promise<boolean>((resolve) => {
          castSessionRef.current.loadMedia(
            loadRequest,
            (mediaSession: any) => {
              console.log('[useCast] Media loaded successfully on Chromecast');
              castMediaRef.current = mediaSession;
              setState(prev => ({
                ...prev,
                isCasting: true,
                playerState: 'PLAYING',
                duration: mediaSession.media?.duration || 0,
              }));
              
              // Listen for media status updates
              mediaSession.addUpdateListener((isAlive: boolean) => {
                if (isAlive && castMediaRef.current) {
                  const playerState = castMediaRef.current.playerState;
                  setState(prev => ({
                    ...prev,
                    currentTime: castMediaRef.current.currentTime || 0,
                    duration: castMediaRef.current.media?.duration || prev.duration,
                    playerState: playerState === 'PLAYING' ? 'PLAYING' : 
                                 playerState === 'PAUSED' ? 'PAUSED' :
                                 playerState === 'BUFFERING' ? 'BUFFERING' : 'IDLE',
                  }));
                }
              });
              
              resolve(true);
            },
            (error: any) => {
              console.error('[useCast] Failed to load media on Chromecast:', error);
              const errorMessage = error.description || 'Failed to load media on Chromecast';
              setState(prev => ({ ...prev, lastError: errorMessage }));
              onErrorRef.current?.(errorMessage);
              resolve(false);
            }
          );
        });
      } catch (e) {
        console.error('[useCast] Error loading media:', e);
        return false;
      }
    }
    
    // For Remote Playback API and AirPlay, the video element's current source is used
    // No need to load media separately - just return connected state
    return state.isConnected || state.isAirPlayActive;
  }, [state.isConnected, state.isAirPlayActive]);

  // Stop casting / stop media
  const stop = useCallback(() => {
    console.log('[useCast] Stopping cast');
    
    // Stop media on Chromecast
    if (castMediaRef.current) {
      try {
        castMediaRef.current.stop(
          null,
          () => console.log('[useCast] Media stopped'),
          (error: any) => console.error('[useCast] Error stopping media:', error)
        );
      } catch (e) {
        console.error('[useCast] Error stopping media:', e);
      }
      castMediaRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isCasting: false, 
      playerState: 'IDLE',
      currentTime: 0,
    }));
  }, []);

  // Disconnect from cast device
  const disconnect = useCallback(() => {
    console.log('[useCast] Disconnecting cast session');
    
    // Stop media first
    stop();
    
    // End Chromecast session
    if (castSessionRef.current) {
      try {
        castSessionRef.current.stop(
          () => console.log('[useCast] Session stopped'),
          (error: any) => console.error('[useCast] Error stopping session:', error)
        );
      } catch (e) {
        console.error('[useCast] Error stopping session:', e);
      }
      castSessionRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      isCasting: false, 
      isConnected: false, 
      isAirPlayActive: false,
      deviceName: null,
      playerState: 'IDLE',
    }));
    
    onDisconnectRef.current?.();
  }, [stop]);

  // Play or pause media on cast device
  const playOrPause = useCallback(() => {
    if (!castMediaRef.current) return;
    
    const playerState = castMediaRef.current.playerState;
    
    if (playerState === 'PLAYING') {
      castMediaRef.current.pause(
        null,
        () => {
          console.log('[useCast] Paused');
          setState(prev => ({ ...prev, playerState: 'PAUSED' }));
        },
        (error: any) => console.error('[useCast] Pause error:', error)
      );
    } else {
      castMediaRef.current.play(
        null,
        () => {
          console.log('[useCast] Playing');
          setState(prev => ({ ...prev, playerState: 'PLAYING' }));
        },
        (error: any) => console.error('[useCast] Play error:', error)
      );
    }
  }, []);

  // Seek to position on cast device
  const seek = useCallback((time: number) => {
    if (!castMediaRef.current) return;
    
    const seekRequest = {
      currentTime: time,
    };
    
    castMediaRef.current.seek(
      seekRequest,
      () => {
        console.log('[useCast] Seeked to:', time);
        setState(prev => ({ ...prev, currentTime: time }));
      },
      (error: any) => console.error('[useCast] Seek error:', error)
    );
  }, []);

  // Set volume on cast device (0-1)
  const setVolume = useCallback((volume: number) => {
    if (!castSessionRef.current) return;
    
    try {
      castSessionRef.current.setReceiverVolumeLevel(
        volume,
        () => {
          console.log('[useCast] Volume set to:', volume);
          setState(prev => ({ ...prev, volume, isMuted: volume === 0 }));
        },
        (error: any) => console.error('[useCast] Volume error:', error)
      );
    } catch (e) {
      console.error('[useCast] Error setting volume:', e);
    }
  }, []);

  // Toggle mute on cast device
  const toggleMute = useCallback(() => {
    if (!castSessionRef.current) return;
    
    const newMuted = !state.isMuted;
    
    try {
      castSessionRef.current.setReceiverMuted(
        newMuted,
        () => {
          console.log('[useCast] Mute toggled:', newMuted);
          setState(prev => ({ ...prev, isMuted: newMuted }));
        },
        (error: any) => console.error('[useCast] Mute error:', error)
      );
    } catch (e) {
      console.error('[useCast] Error toggling mute:', e);
    }
  }, [state.isMuted]);

  return {
    ...state,
    requestSession,
    loadMedia,
    stop,
    disconnect,
    playOrPause,
    seek,
    setVolume,
    toggleMute,
    showAirPlayPicker: requestSession,
  };
}
