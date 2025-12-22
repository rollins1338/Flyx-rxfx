'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SubtitleTranscript.module.css';

interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface SubtitleTranscriptProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  onSeek: (time: number) => void;
  subtitleUrl: string | null;
  subtitleLabel?: string;
}

// Parse VTT/SRT timestamp to seconds
function parseTimestamp(timestamp: string): number {
  // Handle both VTT (00:00:00.000) and SRT (00:00:00,000) formats
  const normalized = timestamp.replace(',', '.');
  const parts = normalized.split(':');
  
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  
  return parseFloat(normalized) || 0;
}

// Format seconds to display time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parse VTT content into cues
function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.split('\n');
  
  let i = 0;
  let cueIndex = 0;
  
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for timestamp line (contains -->)
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim().split(' ')[0]);
      const startTime = parseTimestamp(startStr);
      const endTime = parseTimestamp(endStr);
      
      // Collect text lines until empty line or next timestamp
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        // Skip numeric cue identifiers
        if (!/^\d+$/.test(lines[i].trim())) {
          textLines.push(lines[i].trim());
        }
        i++;
      }
      
      if (textLines.length > 0) {
        // Clean up VTT tags and HTML entities
        const text = textLines.join(' ')
          .replace(/<[^>]+>/g, '') // Remove HTML/VTT tags
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        
        if (text) {
          cues.push({
            id: `cue-${cueIndex++}`,
            startTime,
            endTime,
            text,
          });
        }
      }
    } else {
      i++;
    }
  }
  
  return cues;
}

export default function SubtitleTranscript({
  isOpen,
  onClose,
  currentTime,
  onSeek,
  subtitleUrl,
  subtitleLabel,
}: SubtitleTranscriptProps) {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const listRef = useRef<HTMLDivElement>(null);
  const activeCueRef = useRef<HTMLButtonElement>(null);
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch and parse subtitles
  useEffect(() => {
    if (!subtitleUrl || !isOpen) return;
    
    const fetchSubtitles = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(subtitleUrl);
        if (!response.ok) throw new Error('Failed to load subtitles');
        
        const content = await response.text();
        const parsedCues = parseVTT(content);
        
        if (parsedCues.length === 0) {
          throw new Error('No subtitles found in file');
        }
        
        setCues(parsedCues);
      } catch (err) {
        console.error('[SubtitleTranscript] Error loading subtitles:', err);
        setError(err instanceof Error ? err.message : 'Failed to load subtitles');
        setCues([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSubtitles();
  }, [subtitleUrl, isOpen]);

  // Find current active cue
  const activeCueIndex = cues.findIndex(
    cue => currentTime >= cue.startTime && currentTime < cue.endTime
  );

  // Auto-scroll to active cue
  useEffect(() => {
    if (!autoScroll || userScrollingRef.current || activeCueIndex === -1) return;
    
    activeCueRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeCueIndex, autoScroll]);

  // Handle user scroll - temporarily disable auto-scroll
  const handleScroll = useCallback(() => {
    userScrollingRef.current = true;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 2000);
  }, []);

  // Filter cues by search query
  const filteredCues = searchQuery
    ? cues.filter(cue => 
        cue.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cues;

  // Handle cue click
  const handleCueClick = useCallback((cue: SubtitleCue) => {
    onSeek(cue.startTime);
    setAutoScroll(true);
  }, [onSeek]);

  // Handle keyboard navigation - stop propagation to prevent video player hotkeys
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop all keyboard events from bubbling to video player
    e.stopPropagation();
    
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Stop keyboard events in search input from triggering video hotkeys
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg className={styles.headerIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M7 12h10M7 16h6" />
          </svg>
          <div className={styles.headerText}>
            <h3 className={styles.title}>Transcript</h3>
            {subtitleLabel && (
              <span className={styles.subtitle}>{subtitleLabel}</span>
            )}
          </div>
        </div>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close transcript">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        {searchQuery && (
          <button 
            className={styles.clearSearch}
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Auto-scroll toggle */}
      <div className={styles.controls}>
        <button
          className={`${styles.autoScrollToggle} ${autoScroll ? styles.active : ''}`}
          onClick={() => setAutoScroll(!autoScroll)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Auto-scroll
        </button>
        {searchQuery && (
          <span className={styles.resultCount}>
            {filteredCues.length} result{filteredCues.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Cue list */}
      <div 
        className={styles.cueList} 
        ref={listRef}
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading transcript...</span>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <span>{error}</span>
          </div>
        ) : filteredCues.length === 0 ? (
          <div className={styles.empty}>
            {searchQuery ? 'No matches found' : 'No subtitles available'}
          </div>
        ) : (
          filteredCues.map((cue) => {
            const isActive = cues.indexOf(cue) === activeCueIndex;
            const isPast = currentTime > cue.endTime;
            
            return (
              <button
                key={cue.id}
                ref={isActive ? activeCueRef : null}
                className={`${styles.cueItem} ${isActive ? styles.active : ''} ${isPast ? styles.past : ''}`}
                onClick={() => handleCueClick(cue)}
              >
                <span className={styles.cueTime}>{formatTime(cue.startTime)}</span>
                <span className={styles.cueText}>{cue.text}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className={styles.footer}>
        <span>Click any line to jump to that moment</span>
      </div>
    </div>
  );
}
