'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMobileGestures } from '@/hooks/useMobileGestures';
import styles from './MobileVideoPlayer.module.css';

interface MobileVideoPlayerProps {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
  streamUrl: string;
  onBack?: () => void;
  onError?: (error: string) => void;
  onSourceChange?: (sourceIndex: number) => void;
  availableSources?: Array<{ title: string; url: string; quality?: string }>;
  currentSourceIndex?: number;
  nextEpisode?: { season: number; episode: number; title?: string } | null;
  onNextEpisode?: () => void;
}

// Format time as MM:SS or HH:MM:SS
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Haptic feedback helper
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const duration = type === 'light' ? 10 : type === 'medium' ? 25 : 50;
    navigator.vibrate(duration);
  }
};

export default function MobileVideoPlayer({
  tmdbId: _tmdbId,
  mediaType,
  season,
  episode,
  title,
  streamUrl,
  onBack,
  onError,
  onSourceChange,
  availableSources = [],
  currentSourceIndex = 0,
  nextEpisode,
  onNextEpisode,
}: MobileVideoPlayerProps) {
  const mobileInfo = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekPreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Gesture feedback state
  const [seekPreview, setSeekPreview] = useState<{ show: boolean; time: number; delta: number } | null>(null);
  const [doubleTapIndicator, setDoubleTapIndicator] = useState<{ show: boolean; side: 'left' | 'right'; x: number; y: number } | null>(null);
  const [brightnessLevel, setBrightnessLevel] = useState(1);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [showBrightnessOverlay, setShowBrightnessOverlay] = useState(false);
  const [showVolumeOverlay, setShowVolumeOverlay] = useState(false);
  const [longPressActive, setLongPressActive] = useState(false);
  const [showGestureHint, setShowGestureHint] = useState(false);

  // Refs for gesture calculations
  const seekStartTimeRef = useRef(0);
  const brightnessStartRef = useRef(1);
  const volumeStartRef = useRef(1);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!isLocked) {
      setShowControls(true);
      if (isPlaying && !showSourceMenu && !showSpeedMenu) {
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000);
      }
    }
  }, [isPlaying, showSourceMenu, showSpeedMenu, isLocked]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || isLocked) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
    triggerHaptic('light');
    resetControlsTimeout();
  }, [isLocked, resetControlsTimeout]);

  // Seek to time
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || isLocked) return;
    const newTime = Math.max(0, Math.min(time, duration));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration, isLocked]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    if (isLocked) return;
    seekTo(currentTime + seconds);
    triggerHaptic('light');
  }, [currentTime, seekTo, isLocked]);

  // Gesture callbacks
  const handleTap = useCallback(() => {
    if (isLocked) {
      // Show unlock hint
      setShowControls(true);
      setTimeout(() => setShowControls(false), 2000);
      return;
    }
    // Toggle controls visibility
    if (showControls) {
      setShowControls(false);
    } else {
      resetControlsTimeout();
    }
  }, [isLocked, showControls, resetControlsTimeout]);

  const handleDoubleTap = useCallback((x: number, y: number, side: 'left' | 'center' | 'right') => {
    if (isLocked) return;
    
    if (side === 'center') {
      // Double tap center = play/pause
      togglePlay();
      return;
    }

    // Double tap sides = seek
    const seekAmount = side === 'left' ? -10 : 10;
    skip(seekAmount);
    
    // Show indicator
    setDoubleTapIndicator({ show: true, side, x, y });
    setTimeout(() => setDoubleTapIndicator(null), 600);
    
    triggerHaptic('medium');
  }, [isLocked, togglePlay, skip]);

  const handleLongPress = useCallback(() => {
    if (isLocked) return;
    
    // Long press = 2x speed while held
    setLongPressActive(true);
    if (videoRef.current) {
      videoRef.current.playbackRate = 2;
    }
    triggerHaptic('heavy');
  }, [isLocked]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressActive) {
      setLongPressActive(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = playbackSpeed;
      }
    }
  }, [longPressActive, playbackSpeed]);

  const handleHorizontalDrag = useCallback((_deltaX: number, progress: number) => {
    if (isLocked) return;
    
    // Seek preview - map drag to time
    const seekDelta = progress * duration * 0.5; // 50% of duration for full swipe
    const previewTime = Math.max(0, Math.min(duration, seekStartTimeRef.current + seekDelta));
    
    setSeekPreview({
      show: true,
      time: previewTime,
      delta: seekDelta,
    });
  }, [isLocked, duration]);

  const handleHorizontalDragEnd = useCallback((_deltaX: number) => {
    if (isLocked || !seekPreview) return;
    
    // Apply seek
    seekTo(seekPreview.time);
    
    // Hide preview after short delay
    if (seekPreviewTimeoutRef.current) clearTimeout(seekPreviewTimeoutRef.current);
    seekPreviewTimeoutRef.current = setTimeout(() => setSeekPreview(null), 300);
    
    triggerHaptic('light');
  }, [isLocked, seekPreview, seekTo]);

  const handleVerticalDragLeft = useCallback((_deltaY: number, progress: number) => {
    if (isLocked) return;
    
    // Brightness control (inverted - drag up = brighter)
    const newBrightness = Math.max(0.2, Math.min(1.5, brightnessStartRef.current - progress));
    setBrightnessLevel(newBrightness);
    setShowBrightnessOverlay(true);
  }, [isLocked]);

  const handleVerticalDragLeftEnd = useCallback(() => {
    brightnessStartRef.current = brightnessLevel;
    setTimeout(() => setShowBrightnessOverlay(false), 500);
  }, [brightnessLevel]);

  const handleVerticalDragRight = useCallback((_deltaY: number, progress: number) => {
    if (isLocked) return;
    
    // Volume control (inverted - drag up = louder)
    const newVolume = Math.max(0, Math.min(1, volumeStartRef.current - progress));
    setVolumeLevel(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setShowVolumeOverlay(true);
  }, [isLocked]);

  const handleVerticalDragRightEnd = useCallback(() => {
    volumeStartRef.current = volumeLevel;
    setTimeout(() => setShowVolumeOverlay(false), 500);
  }, [volumeLevel]);

  const handleGestureStart = useCallback((type: string) => {
    if (type === 'horizontal-drag') {
      seekStartTimeRef.current = currentTime;
    } else if (type === 'vertical-drag-left') {
      brightnessStartRef.current = brightnessLevel;
    } else if (type === 'vertical-drag-right') {
      volumeStartRef.current = volumeLevel;
    }
  }, [currentTime, brightnessLevel, volumeLevel]);

  const handleGestureEnd = useCallback((type: string) => {
    if (type === 'long-press') {
      handleLongPressEnd();
    }
  }, [handleLongPressEnd]);

  // Initialize gesture handler
  const { isGestureActive } = useMobileGestures(containerRef as React.RefObject<HTMLElement>, {
    onTap: handleTap,
    onDoubleTap: handleDoubleTap,
    onLongPress: handleLongPress,
    onHorizontalDrag: handleHorizontalDrag,
    onHorizontalDragEnd: handleHorizontalDragEnd,
    onVerticalDragLeft: handleVerticalDragLeft,
    onVerticalDragLeftEnd: handleVerticalDragLeftEnd,
    onVerticalDragRight: handleVerticalDragRight,
    onVerticalDragRightEnd: handleVerticalDragRightEnd,
    onGestureStart: handleGestureStart,
    onGestureEnd: handleGestureEnd,
    enabled: !showSourceMenu && !showSpeedMenu,
    preventScroll: true,
    doubleTapMaxDelay: 300,
    longPressDelay: 500,
    dragThreshold: 15,
  });

  // HLS config optimized for mobile
  const hlsConfig = useMemo(() => ({
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 30,
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
    maxBufferSize: 30 * 1000 * 1000,
    maxBufferHole: 0.5,
    manifestLoadingTimeOut: 15000,
    manifestLoadingMaxRetry: 4,
    levelLoadingTimeOut: 15000,
    fragLoadingTimeOut: 25000,
    fragLoadingMaxRetry: 6,
    startLevel: -1,
    abrEwmaDefaultEstimate: 500000,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.5,
  }), []);

  // Initialize HLS
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);

    // iOS Safari: Use native HLS
    if (mobileInfo.isIOS && mobileInfo.supportsHLS) {
      video.src = streamUrl;
      
      const handleLoadedMetadata = () => {
        setDuration(video.duration);
        setIsLoading(false);
      };
      
      const handleError = () => {
        const err = video.error;
        setError(`Playback error: ${err?.message || 'Unknown error'}`);
        setIsLoading(false);
        onError?.(err?.message || 'Playback failed');
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
    }

    // Android/Other: Use HLS.js
    if (Hls.isSupported()) {
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => setIsLoading(false));

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setError('Playback failed. Try another source.');
            setIsLoading(false);
            onError?.('Fatal playback error');
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    video.src = streamUrl;
  }, [streamUrl, mobileInfo.isIOS, mobileInfo.supportsHLS, hlsConfig, onError]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => { setIsPlaying(true); resetControlsTimeout(); };
    const handlePause = () => { setIsPlaying(false); setShowControls(true); };
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => { setIsBuffering(false); setIsLoading(false); };
    const handleTimeUpdate = () => {
      if (!isGestureActive) setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isGestureActive, resetControlsTimeout]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (videoRef.current as any)?.webkitDisplayingFullscreen
      );
      setIsFullscreen(isNowFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    const video = videoRef.current;
    if (video) {
      video.addEventListener('webkitbeginfullscreen', handleFullscreenChange);
      video.addEventListener('webkitendfullscreen', handleFullscreenChange);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', handleFullscreenChange);
        video.removeEventListener('webkitendfullscreen', handleFullscreenChange);
      }
    };
  }, []);

  // Show gesture hint on first use
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('mobile-player-hint-seen');
    if (!hasSeenHint && !isLoading) {
      setTimeout(() => {
        setShowGestureHint(true);
        setTimeout(() => {
          setShowGestureHint(false);
          localStorage.setItem('mobile-player-hint-seen', 'true');
        }, 5000);
      }, 2000);
    }
  }, [isLoading]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    try {
      if (!isFullscreen) {
        if ((video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if (container.requestFullscreen) {
          await container.requestFullscreen();
        }
        
        if (screen.orientation && 'lock' in screen.orientation) {
          try { await (screen.orientation as any).lock('landscape'); } catch {}
        }
      } else {
        if ((video as any).webkitExitFullscreen) {
          (video as any).webkitExitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        
        if (screen.orientation && 'unlock' in screen.orientation) {
          try { (screen.orientation as any).unlock(); } catch {}
        }
      }
    } catch (e) {
      console.error('[MobilePlayer] Fullscreen error:', e);
    }
    triggerHaptic('light');
  }, [isFullscreen]);

  // Lock/unlock controls
  const toggleLock = useCallback(() => {
    setIsLocked(prev => !prev);
    triggerHaptic('medium');
    if (!isLocked) {
      setShowControls(false);
    }
  }, [isLocked]);

  // Change playback speed
  const changeSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
    triggerHaptic('light');
  }, []);

  // Progress bar touch handler
  const handleProgressTouch = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    seekTo(pos * duration);
    triggerHaptic('light');
  }, [duration, seekTo, isLocked]);

  // Speed options
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isFullscreen ? styles.fullscreen : ''}`}
      style={{ filter: `brightness(${brightnessLevel})` }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        autoPlay={false}
        controls={false}
        preload="metadata"
        webkit-playsinline="true"
        x-webkit-airplay="allow"
      />

      {/* Loading Overlay */}
      {(isLoading || isBuffering) && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <p>{isLoading ? 'Loading...' : 'Buffering...'}</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorIcon}>⚠️</div>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={() => {
            setError(null);
            setIsLoading(true);
            videoRef.current?.load();
          }}>
            Retry
          </button>
        </div>
      )}

      {/* Double Tap Indicator */}
      {doubleTapIndicator?.show && (
        <div 
          className={`${styles.doubleTapIndicator} ${styles[doubleTapIndicator.side]}`}
          style={{ left: doubleTapIndicator.x, top: doubleTapIndicator.y }}
        >
          <div className={styles.doubleTapRipple} />
          <div className={styles.doubleTapIcon}>
            {doubleTapIndicator.side === 'left' ? '⏪' : '⏩'}
          </div>
          <span>10s</span>
        </div>
      )}

      {/* Seek Preview */}
      {seekPreview?.show && (
        <div className={styles.seekPreview}>
          <div className={styles.seekPreviewTime}>{formatTime(seekPreview.time)}</div>
          <div className={styles.seekPreviewDelta}>
            {seekPreview.delta >= 0 ? '+' : ''}{formatTime(Math.abs(seekPreview.delta))}
          </div>
          <div className={styles.seekPreviewBar}>
            <div 
              className={styles.seekPreviewProgress} 
              style={{ width: `${(seekPreview.time / duration) * 100}%` }} 
            />
          </div>
        </div>
      )}

      {/* Brightness Overlay */}
      {showBrightnessOverlay && (
        <div className={styles.gestureOverlay}>
          <div className={styles.gestureIcon}>☀️</div>
          <div className={styles.gestureBar}>
            <div className={styles.gestureFill} style={{ height: `${(brightnessLevel / 1.5) * 100}%` }} />
          </div>
          <span>{Math.round((brightnessLevel / 1.5) * 100)}%</span>
        </div>
      )}

      {/* Volume Overlay */}
      {showVolumeOverlay && (
        <div className={styles.gestureOverlay}>
          <div className={styles.gestureIcon}>{volumeLevel === 0 ? '🔇' : volumeLevel < 0.5 ? '🔉' : '🔊'}</div>
          <div className={styles.gestureBar}>
            <div className={styles.gestureFill} style={{ height: `${volumeLevel * 100}%` }} />
          </div>
          <span>{Math.round(volumeLevel * 100)}%</span>
        </div>
      )}

      {/* Long Press Speed Indicator */}
      {longPressActive && (
        <div className={styles.speedIndicator}>
          <span>2x Speed</span>
        </div>
      )}

      {/* Gesture Hint */}
      {showGestureHint && (
        <div className={styles.gestureHint}>
          <div className={styles.gestureHintRow}>
            <span>👆 Tap</span>
            <span>Show/hide controls</span>
          </div>
          <div className={styles.gestureHintRow}>
            <span>👆👆 Double tap sides</span>
            <span>Skip ±10s</span>
          </div>
          <div className={styles.gestureHintRow}>
            <span>👆 Hold</span>
            <span>2x speed</span>
          </div>
          <div className={styles.gestureHintRow}>
            <span>↔️ Swipe horizontal</span>
            <span>Seek</span>
          </div>
          <div className={styles.gestureHintRow}>
            <span>↕️ Swipe left side</span>
            <span>Brightness</span>
          </div>
          <div className={styles.gestureHintRow}>
            <span>↕️ Swipe right side</span>
            <span>Volume</span>
          </div>
        </div>
      )}

      {/* Lock Indicator */}
      {isLocked && showControls && (
        <div className={styles.lockIndicator}>
          <span>🔒 Tap to unlock</span>
        </div>
      )}

      {/* Controls Overlay */}
      <div className={`${styles.controls} ${showControls && !isLocked ? styles.visible : ''}`}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <button className={styles.iconButton} onClick={onBack} aria-label="Go back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          
          <div className={styles.titleArea}>
            <h2 className={styles.title}>{title}</h2>
            {mediaType === 'tv' && season && episode && (
              <span className={styles.episodeInfo}>S{season} E{episode}</span>
            )}
          </div>

          <div className={styles.topButtons}>
            <button className={styles.iconButton} onClick={toggleLock} aria-label="Lock controls">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </button>
            <button className={styles.iconButton} onClick={() => setShowSourceMenu(true)} aria-label="Change source">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Center Controls */}
        <div className={styles.centerControls}>
          <button className={styles.centerButton} onClick={() => skip(-10)} aria-label="Rewind 10 seconds">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
            <span>10</span>
          </button>
          
          <button className={styles.playButton} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <button className={styles.centerButton} onClick={() => skip(10)} aria-label="Forward 10 seconds">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
            <span>10</span>
          </button>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          {/* Progress Bar */}
          <div 
            className={styles.progressContainer}
            onTouchStart={handleProgressTouch}
            onTouchMove={handleProgressTouch}
          >
            <div className={styles.progressBuffered} style={{ width: `${buffered}%` }} />
            <div className={styles.progressFilled} style={{ width: `${(currentTime / duration) * 100}%` }} />
            <div className={styles.progressThumb} style={{ left: `${(currentTime / duration) * 100}%` }} />
          </div>

          {/* Time and Controls */}
          <div className={styles.bottomControls}>
            <span className={styles.time}>{formatTime(currentTime)}</span>
            
            <div className={styles.bottomButtons}>
              <button 
                className={styles.speedButton} 
                onClick={() => setShowSpeedMenu(true)}
                aria-label="Playback speed"
              >
                {playbackSpeed}x
              </button>
              
              {nextEpisode && (
                <button className={styles.iconButton} onClick={onNextEpisode} aria-label="Next episode">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>
              )}
              
              <button className={styles.iconButton} onClick={toggleFullscreen} aria-label="Toggle fullscreen">
                {isFullscreen ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>
            </div>
            
            <span className={styles.time}>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Source Menu */}
      {showSourceMenu && (
        <div className={styles.menuOverlay} onClick={() => setShowSourceMenu(false)}>
          <div className={styles.menuContent} onClick={e => e.stopPropagation()}>
            <div className={styles.menuHeader}>
              <h3>Select Source</h3>
              <button className={styles.menuClose} onClick={() => setShowSourceMenu(false)}>✕</button>
            </div>
            <div className={styles.menuList}>
              {availableSources.map((source, index) => (
                <button
                  key={index}
                  className={`${styles.menuItem} ${index === currentSourceIndex ? styles.active : ''}`}
                  onClick={() => {
                    onSourceChange?.(index);
                    setShowSourceMenu(false);
                    triggerHaptic('light');
                  }}
                >
                  <span>{source.title || `Source ${index + 1}`}</span>
                  {source.quality && <span className={styles.quality}>{source.quality}</span>}
                  {index === currentSourceIndex && <span className={styles.checkmark}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Speed Menu */}
      {showSpeedMenu && (
        <div className={styles.menuOverlay} onClick={() => setShowSpeedMenu(false)}>
          <div className={styles.menuContent} onClick={e => e.stopPropagation()}>
            <div className={styles.menuHeader}>
              <h3>Playback Speed</h3>
              <button className={styles.menuClose} onClick={() => setShowSpeedMenu(false)}>✕</button>
            </div>
            <div className={styles.menuList}>
              {speedOptions.map(speed => (
                <button
                  key={speed}
                  className={`${styles.menuItem} ${speed === playbackSpeed ? styles.active : ''}`}
                  onClick={() => changeSpeed(speed)}
                >
                  <span>{speed}x</span>
                  {speed === 1 && <span className={styles.normalLabel}>Normal</span>}
                  {speed === playbackSpeed && <span className={styles.checkmark}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unlock Button (when locked) */}
      {isLocked && (
        <button className={styles.unlockButton} onClick={toggleLock} aria-label="Unlock controls">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z" />
          </svg>
        </button>
      )}
    </div>
  );
}
