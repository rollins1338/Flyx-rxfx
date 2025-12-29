/**
 * Video Player Component
 * Full-featured video player with controls and HLS support
 */

import { memo, useEffect, useState } from 'react';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { LiveEvent, DLHDChannel } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

// Sport icon mapping
const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'am. football': '🏈', 'nfl': '🏈', 'darts': '🎯', '24/7': '📺',
  'tv channel': '📺', 'sports': '⚽', 'entertainment': '🎬', 
  'movies': '🎥', 'news': '📰', 'kids': '🧸', 'documentary': '🌍',
};

function getSportIcon(sport: string): string {
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📺';
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
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Load stream when event or channel changes
  useEffect(() => {
    // Only load if player is open and we have something to play
    if (!isOpen) {
      stopStream();
      return;
    }
    
    if (event) {
      const source = {
        type: event.source,
        channelId: event.channels[0]?.channelId || event.ppvUriName || event.cdnliveEmbedId || event.id,
        title: event.title,
        poster: event.poster,
      };
      loadStream(source);
    } else if (channel) {
      // For DLHD channels, use the channel ID
      const source = {
        type: 'dlhd' as const,
        channelId: channel.id,
        title: channel.name,
        poster: undefined,
      };
      loadStream(source);
    } else {
      stopStream();
    }
  }, [event, channel, isOpen, loadStream, stopStream]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying && !isLoading) {
      if (controlsTimeout) clearTimeout(controlsTimeout);
      
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      
      setControlsTimeout(timeout);
      
      return () => clearTimeout(timeout);
    }
  }, [showControls, isPlaying, isLoading, controlsTimeout]);

  // Show controls on mouse move
  const handleMouseMove = () => {
    setShowControls(true);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
          if (isFullscreen) {
            toggleFullscreen();
          } else {
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
  }, [isOpen, togglePlay, toggleMute, toggleFullscreen, isFullscreen, onClose, volume, setVolume]);

  if (!isOpen || (!event && !channel)) {
    return null;
  }

  const displayTitle = event?.title || channel?.name || 'Unknown';
  const displaySport = event?.sport || (channel ? channel.category : undefined);
  const isLive = event?.isLive || (channel ? true : false);

  return (
    <div className={styles.playerModal}>
      <div className={styles.playerContainer} onMouseMove={handleMouseMove}>
        {/* Video Element */}
        <video
          ref={videoRef}
          className={styles.videoElement}
          playsInline
          autoPlay
          muted={isMuted}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading stream...</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className={styles.errorOverlay}>
            <div className={styles.errorContent}>
              <div className={styles.errorIcon}>⚠️</div>
              <h3>Stream Error</h3>
              <p>{error}</p>
              <button 
                onClick={() => {
                  if (event) {
                    loadStream({
                      type: event.source,
                      channelId: event.channels[0]?.channelId || event.ppvUriName || event.cdnliveEmbedId || event.id,
                      title: event.title,
                      poster: event.poster,
                    });
                  } else if (channel) {
                    loadStream({
                      type: 'dlhd' as const,
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

        {/* Controls - Always visible */}
        <div className={styles.playerControls}>
          {/* Top Bar */}
          <div className={styles.topControls}>
            <div className={styles.eventInfo}>
              <h3 className={styles.eventTitle}>{displayTitle}</h3>
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
            
            <button
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Close player"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Bottom Controls */}
          <div className={styles.bottomControls}>
            <div className={styles.controlsRow}>
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className={styles.playPauseButton}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="4" width="4" height="16" rx="1" fill="black"/>
                    <rect x="14" y="4" width="4" height="16" rx="1" fill="black"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5.14v13.72c0 1.04 1.13 1.69 2.03 1.17l10.84-6.86c.87-.55.87-1.79 0-2.34L10.03 3.97C9.13 3.45 8 4.1 8 5.14z" fill="black"/>
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className={styles.volumeControls}>
                <button
                  onClick={toggleMute}
                  className={styles.muteButton}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M23 9l-6 6M17 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="white"/>
                      <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
                  style={{ '--volume-percent': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
                  aria-label="Volume"
                />
              </div>

              {/* Spacer */}
              <div className={styles.controlsSpacer}></div>

              {/* Source Info */}
              {currentSource && (
                <div className={styles.sourceInfo}>
                  <span className={styles.sourceLabel}>
                    {currentSource.type.toUpperCase()}
                  </span>
                </div>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className={styles.fullscreenButton}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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