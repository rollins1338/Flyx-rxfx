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
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

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

        {/* Controls */}
        <div className={`${styles.playerControls} ${showControls ? styles.visible : ''}`}>
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
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
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
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
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
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
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
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
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