'use client';

import { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { useWatchProgress } from '@/lib/hooks/useWatchProgress';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
}

export default function VideoPlayer({ tmdbId, mediaType, season, episode, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Analytics and progress tracking
  const { trackEvent } = useAnalytics();
  const contentType = mediaType === 'tv' ? 'episode' : 'movie';
  const { handleProgress, loadProgress } = useWatchProgress({
    contentId: tmdbId,
    contentType,
    onProgress: (_time, _duration) => {
      // This will be called by the hook when progress is updated
    },
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [qualities, setQualities] = useState<string[]>(['auto']);

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch stream URL
  useEffect(() => {
    const fetchStream = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams({
          tmdbId,
          mediaType: mediaType,
        });
        
        if (mediaType === 'tv' && season && episode) {
          params.append('season', season.toString());
          params.append('episode', episode.toString());
        }

        const response = await fetch(`/api/stream/extract?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to load stream');
        }

        if (data.data?.sources && data.data.sources.length > 0) {
          setStreamUrl(data.data.sources[0].url);
        } else {
          throw new Error('No stream sources available');
        }
      } catch (err) {
        console.error('Stream fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStream();
  }, [tmdbId, mediaType, season, episode]);

  // Initialize HLS
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (streamUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          console.log('HLS manifest loaded, found ' + data.levels.length + ' quality levels');
          const levels = data.levels.map((level, index) => 
            level.height ? `${level.height}p` : `Level ${index}`
          );
          setQualities(['auto', ...levels]);
          
          // Auto-play after manifest is loaded
          video.play().catch(e => console.log('Autoplay prevented:', e));
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                setError('Fatal error loading video');
                break;
            }
          }
        });

        hlsRef.current = hls;

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('Autoplay prevented:', e));
        });
      }
    } else {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
    }
  }, [streamUrl]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      trackEvent('video_play', {
        content_id: tmdbId,
        content_type: mediaType,
        season,
        episode,
        title,
        current_time: video.currentTime,
      });
    };

    const handlePause = () => {
      setIsPlaying(false);
      trackEvent('video_pause', {
        content_id: tmdbId,
        content_type: mediaType,
        season,
        episode,
        title,
        current_time: video.currentTime,
        duration: video.duration,
      });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
      
      // Track watch progress
      if (video.duration > 0) {
        handleProgress(video.currentTime, video.duration);
      }
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
      // Load saved progress when duration is available
      const savedTime = loadProgress();
      if (savedTime > 0 && savedTime < video.duration - 30) {
        video.currentTime = savedTime;
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleLoadedData = () => {
      setIsLoading(false);
      trackEvent('content_view', {
        content_id: tmdbId,
        content_type: mediaType,
        season,
        episode,
        title,
        quality,
      });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          seek(currentTime - 10);
          break;
        case 'arrowright':
          e.preventDefault();
          seek(currentTime + 10);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(volume * 100 + 10, 100));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(volume * 100 - 10, 0));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTime, volume]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleVolumeChange = (value: number) => {
    if (!videoRef.current) return;
    const newVolume = value / 100;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const changeQuality = (qualityIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = qualityIndex - 1; // -1 for auto
    setQuality(qualities[qualityIndex]);
    setShowSettings(false);
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSettings(false);
      }, 3000);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorContent}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Unable to load video</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={styles.playerContainer}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
    >
      {(isLoading || isBuffering) && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{isLoading ? 'Loading video...' : 'Buffering...'}</p>
        </div>
      )}

      <video
        ref={videoRef}
        className={styles.video}
        playsInline
      />

      {/* Controls */}
      <div className={`${styles.controls} ${showControls || !isPlaying ? styles.visible : ''}`}>
        {/* Progress bar */}
        <div className={styles.progressContainer} onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          seek(pos * duration);
        }}>
          <div className={styles.progressBuffered} style={{ width: `${buffered}%` }} />
          <div className={styles.progressFilled} style={{ width: `${(currentTime / duration) * 100}%` }} />
          <div className={styles.progressThumb} style={{ left: `${(currentTime / duration) * 100}%` }} />
        </div>

        {/* Control buttons */}
        <div className={styles.controlsRow}>
          <div className={styles.leftControls}>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className={styles.btn}>
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            <button onClick={(e) => { e.stopPropagation(); seek(currentTime - 10); }} className={styles.btn}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                <text x="9" y="15" fontSize="8" fill="white" fontWeight="bold">10</text>
              </svg>
            </button>

            <button onClick={(e) => { e.stopPropagation(); seek(currentTime + 10); }} className={styles.btn}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                <text x="9" y="15" fontSize="8" fill="white" fontWeight="bold">10</text>
              </svg>
            </button>

            <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className={styles.btn}>
              {isMuted || volume === 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              )}
            </button>

            <div className={styles.volumeContainer} onClick={(e) => e.stopPropagation()}>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume * 100}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className={styles.volumeSlider}
              />
            </div>

            <span className={styles.time}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.rightControls}>
            <div className={styles.settingsContainer}>
              <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} className={styles.btn}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                </svg>
              </button>
              
              {showSettings && (
                <div className={styles.settingsMenu} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsLabel}>Playback Speed</div>
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                      <button
                        key={rate}
                        className={`${styles.settingsOption} ${playbackRate === rate ? styles.active : ''}`}
                        onClick={() => changePlaybackRate(rate)}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                  
                  {qualities.length > 1 && (
                    <div className={styles.settingsSection}>
                      <div className={styles.settingsLabel}>Quality</div>
                      {qualities.map((q, index) => (
                        <button
                          key={q}
                          className={`${styles.settingsOption} ${quality === q ? styles.active : ''}`}
                          onClick={() => changeQuality(index)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className={styles.btn}>
              {isFullscreen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Title overlay */}
      {title && (showControls || !isPlaying) && (
        <div className={styles.titleOverlay}>
          <h2>{title}</h2>
        </div>
      )}

      {/* Center play button */}
      {!isPlaying && !isLoading && (
        <button className={styles.centerPlayButton} onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      )}
    </div>
  );
}
