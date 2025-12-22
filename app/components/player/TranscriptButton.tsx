'use client';

import { useState, useCallback, useEffect } from 'react';
import SubtitleTranscript from './SubtitleTranscript';
import styles from './TranscriptButton.module.css';

interface TranscriptButtonProps {
  currentTime: number;
  onSeek: (time: number) => void;
  subtitleData: {
    url: string;
    language?: string;
    isCustom?: boolean;
  } | null;
  disabled?: boolean;
  className?: string;
}

export default function TranscriptButton({
  currentTime,
  onSeek,
  subtitleData,
  disabled = false,
  className = '',
}: TranscriptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get the proxied subtitle URL
  const getSubtitleUrl = useCallback(() => {
    if (!subtitleData?.url) return null;
    
    if (subtitleData.isCustom) {
      return subtitleData.url;
    }
    
    // Use the subtitle proxy API
    return `/api/subtitle-proxy?url=${encodeURIComponent(subtitleData.url)}`;
  }, [subtitleData]);

  // Close transcript when subtitle changes
  useEffect(() => {
    if (!subtitleData) {
      setIsOpen(false);
    }
  }, [subtitleData]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const subtitleUrl = getSubtitleUrl();
  const isDisabled = disabled || !subtitleUrl;

  return (
    <>
      <button
        onClick={handleToggle}
        className={`${styles.button} ${isOpen ? styles.active : ''} ${isDisabled ? styles.disabled : ''} ${className}`}
        disabled={isDisabled}
        title={isDisabled ? 'Load subtitles to view transcript' : 'View transcript'}
        data-player-control="transcript"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      </button>

      {isOpen && subtitleUrl && (
        <SubtitleTranscript
          isOpen={isOpen}
          onClose={handleClose}
          currentTime={currentTime}
          onSeek={onSeek}
          subtitleUrl={subtitleUrl}
          subtitleLabel={subtitleData?.language}
        />
      )}
    </>
  );
}
