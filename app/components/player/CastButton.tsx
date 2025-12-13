'use client';

import React from 'react';
import { useCast, CastMedia } from '@/hooks/useCast';
import styles from './CastButton.module.css';

interface CastButtonProps {
  media?: CastMedia;
  onCastStart?: () => void;
  onCastEnd?: () => void;
  className?: string;
  showLabel?: boolean;
}

export function CastButton({ 
  media, 
  onCastStart, 
  onCastEnd, 
  className = '',
  showLabel = false,
}: CastButtonProps) {
  const {
    isAvailable,
    isConnected,
    isCasting,
    requestSession,
    loadMedia,
    disconnect,
  } = useCast({
    onConnect: () => {
      // Auto-load media when connected if provided
      if (media) {
        loadMedia(media).then(success => {
          if (success) onCastStart?.();
        });
      }
    },
    onDisconnect: () => {
      onCastEnd?.();
    },
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isCasting || isConnected) {
      disconnect();
      onCastEnd?.();
    } else {
      const connected = await requestSession();
      if (connected && media) {
        const success = await loadMedia(media);
        if (success) onCastStart?.();
      }
    }
  };

  // Don't render if Cast is not available
  if (!isAvailable) return null;

  return (
    <button
      onClick={handleClick}
      className={`${styles.castButton} ${isConnected ? styles.connected : ''} ${isCasting ? styles.casting : ''} ${className}`}
      title={isCasting ? 'Stop casting' : isConnected ? 'Cast to TV' : 'Cast to TV'}
      type="button"
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={styles.castIcon}
      >
        {isCasting ? (
          // Casting active icon (filled)
          <>
            <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
            <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
            <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
            <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
            <path d="M5 7v2h12v8h-4v2h6V7z" opacity="0.3" />
          </>
        ) : (
          // Cast available icon (outline)
          <>
            <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
            <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
            <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
            <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
          </>
        )}
      </svg>
      {showLabel && (
        <span className={styles.label}>
          {isCasting ? 'Casting' : 'Cast'}
        </span>
      )}
    </button>
  );
}

// Cast overlay shown when casting
interface CastOverlayProps {
  title: string;
  subtitle?: string;
  posterUrl?: string;
  onStopCasting: () => void;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
}

export function CastOverlay({
  title,
  subtitle,
  posterUrl,
  onStopCasting,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onPlayPause,
  onSeek,
}: CastOverlayProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.castOverlay}>
      <div className={styles.castOverlayContent}>
        {posterUrl && (
          <div className={styles.posterContainer}>
            <img src={posterUrl} alt={title} className={styles.poster} />
          </div>
        )}
        
        <div className={styles.castInfo}>
          <div className={styles.castingTo}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
              <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
              <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
              <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
            </svg>
            <span>Casting to TV</span>
          </div>
          
          <h2 className={styles.castTitle}>{title}</h2>
          {subtitle && <p className={styles.castSubtitle}>{subtitle}</p>}
          
          {duration > 0 && (
            <div className={styles.castProgress}>
              <div 
                className={styles.castProgressBar}
                onClick={(e) => {
                  if (!onSeek) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  onSeek(pos * duration);
                }}
              >
                <div 
                  className={styles.castProgressFill} 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <div className={styles.castTime}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}
          
          <div className={styles.castControls}>
            {onPlayPause && (
              <button 
                className={styles.castControlBtn}
                onClick={onPlayPause}
                type="button"
              >
                {isPlaying ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            )}
            
            <button 
              className={styles.stopCastBtn}
              onClick={onStopCasting}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
              Stop Casting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CastButton;
