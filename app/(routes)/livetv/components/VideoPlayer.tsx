/**
 * Video Player Component
 * Full-featured video player with controls and HLS support
 */

'use client';

import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { LiveEvent, DLHDChannel } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

const SPORT_ICONS: Record<string, string> = {
  soccer: '\u26BD',
  football: '\u26BD',
  basketball: '\uD83C\uDFC0',
  tennis: '\uD83C\uDFBE',
  cricket: '\uD83C\uDFCF',
  hockey: '\uD83C\uDFD2',
  baseball: '\u26BE',
  golf: '\u26F3',
  rugby: '\uD83C\uDFC9',
  motorsport: '\uD83C\uDFCE\uFE0F',
  f1: '\uD83C\uDFCE\uFE0F',
  boxing: '\uD83E\uDD4A',
  mma: '\uD83E\uDD4A',
  ufc: '\uD83E\uDD4A',
  wwe: '\uD83E\uDD3C',
  volleyball: '\uD83C\uDFD0',
  nfl: '\uD83C\uDFC8',
  darts: '\uD83C\uDFAF',
};

function getSportIcon(sport: string): string {
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '\uD83D\uDCFA';
}

interface VideoPlayerProps {
  event?: LiveEvent | null;
  channel?: DLHDChannel | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoPlayer = memo(function VideoPlayer({
  event,
  channel,
  isOpen,
  onClose,
}: VideoPlayerProps) {
  const {
    videoRef,
    isPlaying,
    isMuted,
    isFullscreen,
    isLoading,
    error,
    volume,
    currentSource,
    loadStream,
    stopStream,
    togglePlay,
    toggleMute,
    setVolume,
    toggleFullscreen,
  } = useVideoPlayer();

  const [showControls, setShowControls] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);


  // Reset hide timer - shows controls and sets timeout to hide them
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isLoading) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isLoading]);

  // Load stream when event or channel changes
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }
    
    if (event) {
      let channelId: string;
      
      if (event.source === 'ppv' && event.ppvUriName) {
        // PPV: use ppvUriName
        channelId = event.ppvUriName;
      } else if (event.source === 'dlhd' && event.channels && event.channels.length > 0) {
        // DLHD: use the first channel's channelId (numeric ID)
        channelId = event.channels[0].channelId;
      } else if (event.source === 'cdnlive' && event.channels && event.channels.length > 0) {
        // CDN Live: use channelName|countryCode format
        channelId = event.channels[0].channelId;
      } else if (event.source === 'streamed' && event.streamedSources && event.streamedSources.length > 0) {
        // Streamed: use source:id format
        const src = event.streamedSources[0];
        channelId = `${src.source}:${src.id}`;
      } else {
        // Fallback to event.id
        channelId = event.id;
      }
      
      loadStream({
        type: event.source as 'dlhd' | 'ppv' | 'cdnlive' | 'streamed',
        channelId,
        title: event.title,
        poster: event.poster,
      });
    } else if (channel) {
      loadStream({
        type: 'dlhd',
        channelId: channel.id,
        title: channel.name,
        poster: undefined,
      });
    } else {
      stopStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, channel?.id, isOpen]);

  // Show/hide controls based on playing state
  useEffect(() => {
    if (isPlaying && !isLoading) {
      resetHideTimer();
    } else {
      setShowControls(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    }
  }, [isPlaying, isLoading, resetHideTimer]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse/touch interaction - reset hide timer
  const handleInteraction = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      handleInteraction();
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          e.preventDefault();
          if (!isFullscreen) {
            onClose();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, volume, togglePlay, toggleMute, toggleFullscreen, setVolume, onClose, handleInteraction]);

  if (!isOpen || (!event && !channel)) {
    return null;
  }

  const displayTitle = event?.title || channel?.name || 'Stream';
  const displaySport = event?.sport || channel?.category || '';
  const isLive = event?.isLive ?? true;


  return (
    <div className={styles.playerModal}>
      <div 
        ref={containerRef}
        className={styles.playerContainer}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          className={styles.videoElement}
          playsInline
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
            handleInteraction();
          }}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
            <p>Loading stream...</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className={styles.errorOverlay}>
            <div className={styles.errorContent}>
              <div className={styles.errorIcon}>Error</div>
              <h3>Stream Error</h3>
              <p>{error}</p>
              <button 
                onClick={() => {
                  if (event) {
                    let channelId: string;
                    if (event.source === 'ppv' && event.ppvUriName) {
                      channelId = event.ppvUriName;
                    } else if (event.source === 'dlhd' && event.channels && event.channels.length > 0) {
                      channelId = event.channels[0].channelId;
                    } else if (event.source === 'cdnlive' && event.channels && event.channels.length > 0) {
                      channelId = event.channels[0].channelId;
                    } else if (event.source === 'streamed' && event.streamedSources && event.streamedSources.length > 0) {
                      const src = event.streamedSources[0];
                      channelId = `${src.source}:${src.id}`;
                    } else {
                      channelId = event.id;
                    }
                    loadStream({
                      type: event.source as 'dlhd' | 'ppv' | 'cdnlive' | 'streamed',
                      channelId,
                      title: event.title,
                      poster: event.poster,
                    });
                  } else if (channel) {
                    loadStream({
                      type: 'dlhd',
                      channelId: channel.id,
                      title: channel.name,
                      poster: undefined,
                    });
                  }
                }}
                className={styles.retryButton}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div 
          className={`${styles.playerControls} ${!showControls ? styles.hidden : ''}`}
          onMouseMove={handleInteraction}
        >
          {/* Top Controls */}
          <div className={styles.topControls}>
            <div className={styles.eventInfo}>
              <h3 className={styles.eventTitle}>{displayTitle}</h3>
              <div>
                {displaySport && (
                  <span className={styles.eventSport}>
                    {getSportIcon(displaySport)} {displaySport}
                  </span>
                )}
                {isLive && (
                  <span className={styles.liveIndicator}>
                    <span className={styles.liveDot}></span>
                    LIVE
                  </span>
                )}
              </div>
            </div>
            
            <button onClick={onClose} className={styles.closeButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>


          {/* Bottom Controls */}
          <div className={styles.bottomControls}>
            <div className={styles.controlsRow}>
              {/* Play/Pause Button */}
              <button onClick={togglePlay} className={styles.playPauseButton}>
                {isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1"/>
                    <rect x="14" y="4" width="4" height="16" rx="1"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Volume Controls */}
              <div className={styles.volumeControls}>
                <button onClick={toggleMute} className={styles.muteButton}>
                  {isMuted || volume === 0 ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                    </svg>
                  )}
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
                  aria-label="Volume"
                />
              </div>

              <div className={styles.controlsSpacer}></div>

              {/* Source Badge */}
              {currentSource && (
                <span className={styles.sourceLabel}>
                  {currentSource.type.toUpperCase()}
                </span>
              )}

              {/* Fullscreen Button */}
              <button onClick={toggleFullscreen} className={styles.fullscreenButton}>
                {isFullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
