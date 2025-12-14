'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import type { MediaItem, Season } from '@/types/media';
import type { MALAnimeDetails } from '@/lib/services/mal';
import { ParallaxContainer } from '@/components/ui/ParallaxContainer';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { FluidButton } from '@/components/ui/FluidButton';
import { SeasonSelector } from './SeasonSelector';
import { EpisodeList } from './EpisodeList';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import type { Episode } from '@/types/media';

/**
 * Helper function to get TMDB episodes for a specific MAL part
 * Splits TMDB episodes based on MAL episode counts
 */
function getEpisodesForMALPart(
  mapping: { malParts: any[]; tmdbEpisodes: Episode[] },
  partIndex: number
): Episode[] {
  if (!mapping || partIndex < 0 || partIndex >= mapping.malParts.length) {
    return [];
  }
  
  // Calculate start index by summing episodes of previous parts
  let startIndex = 0;
  for (let i = 0; i < partIndex; i++) {
    startIndex += mapping.malParts[i].episodes || 0;
  }
  
  // Get episode count for this part
  const partEpisodeCount = mapping.malParts[partIndex].episodes || 0;
  const endIndex = startIndex + partEpisodeCount;
  
  // Slice TMDB episodes for this part
  // Adjust episode numbers to be 1-based within the part
  const partEpisodes = mapping.tmdbEpisodes.slice(startIndex, endIndex).map((ep, idx) => ({
    ...ep,
    // Keep original episode number for playback, but could show part-relative number in UI
    _partEpisodeNumber: idx + 1,
  }));
  
  console.log(`[getEpisodesForMALPart] Part ${partIndex + 1}: episodes ${startIndex + 1}-${endIndex} (${partEpisodes.length} eps)`);
  
  return partEpisodes;
}
import styles from './DetailsPage.module.css';

// Related Content Section with horizontal scroll and navigation buttons
function RelatedContentSection({
  items,
  onItemSelect
}: {
  items: MediaItem[];
  onItemSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 600;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-12 px-6">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <span>You May Also Like</span>
            </h2>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => scroll('left')}
                className="w-16 h-16 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
                data-tv-skip="true"
                tabIndex={-1}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => scroll('right')}
                className="w-16 h-16 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
                data-tv-skip="true"
                tabIndex={-1}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </motion.button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-8 pt-4 px-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            data-tv-scroll-container="true"
            data-tv-group="related-content"
          >
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onItemSelect(String(item.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onItemSelect(String(item.id));
                  }
                }}
                className="flex-shrink-0 w-48 md:w-56 cursor-pointer group p-2"
                data-tv-focusable="true"
                tabIndex={0}
                role="button"
                aria-label={`${item.title || item.name}`}
              >
                <motion.div
                  whileHover={{ scale: 1.05, y: -8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="relative rounded-xl bg-gray-800 shadow-2xl overflow-hidden"
                >
                  <div className="overflow-hidden rounded-xl">
                    <img
                      src={item.posterPath || `https://image.tmdb.org/t/p/w500${item.poster_path || ''}`}
                      alt={item.title || item.name || 'Content'}
                      className="w-full h-72 md:h-80 object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/20">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white" strokeWidth="0">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>

                  {/* Rating Badge */}
                  <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-md rounded-full text-white text-xs font-bold flex items-center gap-1 shadow-lg border border-white/20">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {(item.vote_average || item.rating || 0).toFixed(1)}
                  </div>
                </motion.div>

                <div className="p-3">
                  <h3 className="text-white font-semibold text-base mb-1 line-clamp-2">
                    {item.title || item.name || 'Untitled'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {new Date(item.release_date || item.first_air_date || item.releaseDate || '').getFullYear() || ''}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Note: Removed prefetch to avoid duplicate requests
// SimpleVideoPlayer will handle stream extraction when user clicks "Watch Now"

interface DetailsPageClientProps {
  content: MediaItem | null;
  relatedContent: MediaItem[];
  error: string | null;
}

/**
 * DetailsPageClient - Client-side details page component
 * Features:
 * - Parallax hero section with backdrop
 * - Metadata display (title, description, ratings, cast, genres)
 * - Season and episode selection for TV shows
 * - Related content recommendations
 * - Watch Now button with smooth transition
 */
export default function DetailsPageClient({
  content,
  relatedContent,
  error,
}: DetailsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presenceContext = usePresenceContext();
  
  // Get season from URL params (for returning from watch page)
  const seasonFromUrl = searchParams.get('season');
  const initialSeason = seasonFromUrl ? parseInt(seasonFromUrl) : 1;
  
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<Record<number, number>>({});
  
  // MAL-specific state for anime - used to split TMDB seasons into MAL parts
  const [isAnime, setIsAnime] = useState<boolean>(false);
  const [malData, setMalData] = useState<MALAnimeDetails | null>(null);
  const [selectedMALPartIndex, setSelectedMALPartIndex] = useState<number>(0);
  const [loadingMAL, setLoadingMAL] = useState<boolean>(false);
  
  // For anime: maps TMDB season to MAL parts (e.g., TMDB S2 -> MAL Part 1, 2, 3)
  // Structure: { tmdbSeason: number, malParts: MALSeason[], tmdbEpisodes: Episode[] }
  const [animeSeasonMapping, setAnimeSeasonMapping] = useState<{
    tmdbSeason: number;
    malParts: any[];
    tmdbEpisodes: any[];
  } | null>(null);
  
  // Track browsing activity with content title - only when content changes
  useEffect(() => {
    if (content && presenceContext?.setBrowsingContext) {
      const title = content.title || content.name || 'Unknown';
      presenceContext.setBrowsingContext(
        `Viewing: ${title}`,
        title,
        String(content.id),
        content.mediaType as 'movie' | 'tv'
      );
    }
  }, [content?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if content is anime and fetch MAL data
  useEffect(() => {
    if (content?.mediaType === 'tv') {
      checkAndLoadMALData();
    }
  }, [content?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAndLoadMALData = async () => {
    if (!content) return;
    
    setLoadingMAL(true);
    try {
      // First check if it's anime
      const checkResponse = await fetch(
        `/api/content/check-anime?tmdbId=${content.id}&type=${content.mediaType}`
      );
      const checkData = await checkResponse.json();
      
      if (checkData.isAnime) {
        setIsAnime(true);
        
        // Fetch MAL data
        const title = content.title || content.name || '';
        const malResponse = await fetch(
          `/api/content/mal-info?tmdbId=${content.id}&type=${content.mediaType}&title=${encodeURIComponent(title)}`
        );
        const malResult = await malResponse.json();
        
        if (malResult.success && malResult.data && malResult.data.allSeasons.length > 1) {
          // Only use MAL splitting if there are multiple MAL entries for this anime
          console.log('[DetailsPage] MAL data loaded with multiple parts:', malResult.data);
          setMalData(malResult.data);
        } else {
          console.log('[DetailsPage] Single MAL entry or no match, using standard TMDB display');
          // Still mark as anime for UI purposes, but don't use MAL splitting
          setMalData(null);
        }
      } else {
        setIsAnime(false);
        setMalData(null);
      }
    } catch (err) {
      console.error('[DetailsPage] Error checking anime/MAL:', err);
      setIsAnime(false);
      setMalData(null);
    } finally {
      setLoadingMAL(false);
    }
  };

  // Load episodes when season changes for TV shows
  // For anime with MAL data: load TMDB episodes then split by MAL parts
  // For non-anime or anime without MAL split: use standard TMDB display
  useEffect(() => {
    if (content?.mediaType === 'tv' && content.seasons && content.seasons.length > 0) {
      // Always load TMDB episodes - we need them for thumbnails/titles
      loadSeasonEpisodes(selectedSeason);
      loadEpisodeProgress(selectedSeason);
    }
  }, [selectedSeason, content]);
  
  // When we have both TMDB episodes and MAL data, create the mapping
  useEffect(() => {
    if (isAnime && malData && seasonData && malData.allSeasons.length > 1) {
      // Create mapping of TMDB episodes to MAL parts
      // MAL parts are ordered chronologically, so we split TMDB episodes accordingly
      const totalMALEpisodes = malData.allSeasons.reduce((sum, s) => sum + (s.episodes || 0), 0);
      const tmdbEpisodeCount = seasonData.episodes.length;
      
      console.log('[DetailsPage] Creating MAL mapping:', {
        tmdbEpisodes: tmdbEpisodeCount,
        malParts: malData.allSeasons.length,
        totalMALEpisodes,
        malBreakdown: malData.allSeasons.map(s => ({ title: s.title, eps: s.episodes }))
      });
      
      // Only apply MAL splitting if episode counts roughly match
      // (within 5 episodes tolerance for ongoing series)
      if (Math.abs(totalMALEpisodes - tmdbEpisodeCount) <= 5 || tmdbEpisodeCount >= totalMALEpisodes) {
        setAnimeSeasonMapping({
          tmdbSeason: selectedSeason,
          malParts: malData.allSeasons,
          tmdbEpisodes: seasonData.episodes
        });
      } else {
        console.log('[DetailsPage] Episode count mismatch, not applying MAL split');
        setAnimeSeasonMapping(null);
      }
    } else {
      setAnimeSeasonMapping(null);
    }
  }, [isAnime, malData, seasonData, selectedSeason]);

  // Load episode watch progress from localStorage and API
  const loadEpisodeProgress = async (seasonNumber: number) => {
    if (!content) return;
    
    const progressMap: Record<number, number> = {};
    
    try {
      // First, try to load from localStorage (multiple possible keys)
      const localStorageKeys = ['flyx_watch_progress', 'flyx_preferences'];
      
      for (const storageKey of localStorageKeys) {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
          console.log(`[DetailsPage] No data in ${storageKey}`);
          continue;
        }
        
        const data = JSON.parse(stored);
        // Handle both direct watchProgress and nested in preferences
        const watchProgress = storageKey === 'flyx_preferences' 
          ? (data.watchProgress || {}) 
          : data;
        
        console.log(`[DetailsPage] Found ${Object.keys(watchProgress).length} entries in ${storageKey}`);
        
        // Look for progress entries for this show and season
        // Key format: contentId_s{season}_e{episode}
        Object.entries(watchProgress).forEach(([key, value]: [string, any]) => {
          const pattern = `${content.id}_s${seasonNumber}_e`;
          if (key.startsWith(pattern)) {
            const episodeNum = parseInt(key.replace(pattern, ''));
            if (!isNaN(episodeNum)) {
              // Handle different data formats
              let progress = 0;
              if (value.completionPercentage !== undefined) {
                progress = value.completionPercentage;
              } else if (value.currentTime && value.duration && value.duration > 0) {
                progress = (value.currentTime / value.duration) * 100;
              }
              console.log(`[DetailsPage] localStorage progress for S${seasonNumber}E${episodeNum}: ${progress}%`);
              if (progress > 0) {
                progressMap[episodeNum] = Math.max(progressMap[episodeNum] || 0, progress);
              }
            }
          }
        });
      }
      
      // Also check flyx_viewing_history for completed episodes
      const historyStored = localStorage.getItem('flyx_viewing_history');
      if (historyStored) {
        const history = JSON.parse(historyStored);
        history.forEach((item: any) => {
          if (item.contentId === content.id && item.completed) {
            // Mark completed episodes as 100%
            // Note: viewing history doesn't store episode numbers directly
          }
        });
      }
      
      // Try to fetch from API for more accurate server-side data
      try {
        const userId = localStorage.getItem('flyx_user_id');
        console.log('[DetailsPage] Fetching watch sessions for userId:', userId?.substring(0, 8), 'contentId:', content.id);
        if (userId) {
          const response = await fetch(
            `/api/analytics/watch-session?userId=${userId}&contentId=${content.id}&limit=100`
          );
          if (response.ok) {
            const data = await response.json();
            console.log('[DetailsPage] Watch sessions response:', data);
            if (data.sessions && Array.isArray(data.sessions)) {
              data.sessions.forEach((session: any) => {
                // Check if this session is for the current season
                if (session.season_number === seasonNumber && session.episode_number) {
                  const episodeNum = session.episode_number;
                  const progress = session.completion_percentage || 0;
                  console.log(`[DetailsPage] Found progress for S${seasonNumber}E${episodeNum}: ${progress}%`);
                  // Use the higher progress value (local or server)
                  progressMap[episodeNum] = Math.max(progressMap[episodeNum] || 0, progress);
                }
              });
            }
          }
        }
      } catch (apiErr) {
        // API fetch failed, use localStorage data only
        console.log('Using localStorage progress only:', apiErr);
      }
      
      console.log('[DetailsPage] Final progress map:', progressMap);
      setEpisodeProgress(progressMap);
    } catch (err) {
      console.error('Error loading episode progress:', err);
    }
  };

  const loadSeasonEpisodes = async (seasonNumber: number) => {
    if (!content) return;
    
    setLoadingEpisodes(true);
    try {
      const response = await fetch(
        `/api/content/season?tvId=${content.id}&seasonNumber=${seasonNumber}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSeasonData(data);
      }
    } catch (err) {
      console.error('Error loading episodes:', err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleWatchNow = () => {
    if (!content) return;
    
    const title = encodeURIComponent(content.title || content.name || 'Unknown');
    
    if (content.mediaType === 'movie') {
      router.push(`/watch/${content.id}?type=movie&title=${title}`);
    } else if (animeSeasonMapping && animeSeasonMapping.malParts.length > 1) {
      // For anime with MAL split, get first episode of selected part
      const partEpisodes = getEpisodesForMALPart(animeSeasonMapping, selectedMALPartIndex);
      if (partEpisodes.length > 0) {
        const malPart = animeSeasonMapping.malParts[selectedMALPartIndex];
        router.push(
          `/watch/${content.id}?type=tv&season=${selectedSeason}&episode=${partEpisodes[0].episodeNumber}&title=${title}&malId=${malPart.malId}&malTitle=${encodeURIComponent(malPart.titleEnglish || malPart.title)}`
        );
      }
    } else {
      // For TV shows, watch first episode of selected season
      const episode = seasonData?.episodes[0];
      if (episode) {
        router.push(
          `/watch/${content.id}?type=tv&season=${selectedSeason}&episode=${episode.episodeNumber}&title=${title}`
        );
      }
    }
  };

  const handleEpisodeSelect = (episodeNumber: number) => {
    if (!content) return;
    const title = encodeURIComponent(content.title || content.name || 'Unknown');
    
    // If we have MAL mapping, include MAL info for the current part
    if (animeSeasonMapping && animeSeasonMapping.malParts.length > 1) {
      const malPart = animeSeasonMapping.malParts[selectedMALPartIndex];
      router.push(
        `/watch/${content.id}?type=tv&season=${selectedSeason}&episode=${episodeNumber}&title=${title}&malId=${malPart.malId}&malTitle=${encodeURIComponent(malPart.titleEnglish || malPart.title)}`
      );
    } else {
      router.push(
        `/watch/${content.id}?type=tv&season=${selectedSeason}&episode=${episodeNumber}&title=${title}`
      );
    }
  };

  const handleRelatedSelect = (id: string) => {
    // Navigate to the related content's details page
    const relatedItem = relatedContent.find(item => item.id === id);
    if (relatedItem) {
      router.push(`/details/${id}?type=${relatedItem.mediaType}`);
    }
  };

  if (error && !content) {
    return (
      <div className={styles.errorContainer}>
        <GlassPanel className={styles.errorPanel}>
          <h2 className={styles.errorTitle}>Oops! Something went wrong</h2>
          <p className={styles.errorMessage}>{error}</p>
          <FluidButton onClick={() => router.push('/')} variant="primary">
            Go Home
          </FluidButton>
        </GlassPanel>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  const formattedRating = (content.rating || content.vote_average || 0).toFixed(1);
  const releaseYear = content.releaseDate
    ? new Date(content.releaseDate).getFullYear()
    : 'N/A';

  const handleGoBack = () => {
    if (typeof window === 'undefined') {
      router.push('/');
      return;
    }
    
    // Check for stored navigation origin (set by search page or homepage)
    const navigationOrigin = sessionStorage.getItem('flyx_navigation_origin');
    
    if (navigationOrigin) {
      try {
        const origin = JSON.parse(navigationOrigin);
        
        // If came from search, go back to search with the same query
        if (origin.type === 'search' && origin.query) {
          router.push(`/search?q=${encodeURIComponent(origin.query)}`);
          return;
        }
        
        // If came from homepage with scroll position, go back and restore
        if (origin.type === 'home' && origin.scrollY !== undefined) {
          router.push('/');
          // Restore scroll position after navigation
          setTimeout(() => {
            window.scrollTo(0, origin.scrollY);
          }, 100);
          return;
        }
      } catch (e) {
        console.error('Failed to parse navigation origin:', e);
      }
    }
    
    // Fallback: use browser history if available
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className={styles.container}>
      {/* Back Navigation */}
      <div className={styles.backNavigation}>
        <motion.button
          onClick={handleGoBack}
          className={styles.backButton}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          data-tv-focusable="true"
          data-tv-group="details-nav"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={styles.backIcon}>
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
          <span>Back</span>
        </motion.button>
      </div>

      {/* Hero Section with Parallax Backdrop */}
      <ParallaxContainer className={styles.heroSection}>
        {/* Backdrop Image */}
        {content.backdropPath && (
          <div className={styles.backdrop}>
            <img
              src={content.backdropPath}
              alt={content.title}
              className={styles.backdropImage}
            />
            {/* Gradient overlays */}
            <div className={styles.backdropGradientTop} />
            <div className={styles.backdropGradientBottom} />
          </div>
        )}

        {/* Hero Content */}
        <div className={styles.heroContent}>
          <motion.div
            className={styles.heroInner}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Poster */}
            <div className={styles.posterContainer}>
              {content.posterPath ? (
                <img
                  src={content.posterPath}
                  alt={content.title}
                  className={styles.poster}
                />
              ) : (
                <div className={styles.posterPlaceholder}>
                  <span className={styles.posterIcon}>
                    {content.mediaType === 'movie' ? '🎬' : '📺'}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className={styles.metadata}>
              <h1 className={styles.title}>{content.title}</h1>

              {/* Info Row */}
              <div className={styles.infoRow}>
                {/* Show MAL rating for anime, TMDB rating otherwise */}
                {isAnime && malData?.mainEntry?.score ? (
                  <span className={styles.rating} title="MyAnimeList Score">
                    ⭐ {malData.mainEntry.score.toFixed(2)} <span className={styles.malBadgeSmall}>MAL</span>
                  </span>
                ) : (
                  <span className={styles.rating}>⭐ {formattedRating}</span>
                )}
                <span className={styles.separator}>•</span>
                <span className={styles.year}>{releaseYear}</span>
                {content.runtime && (
                  <>
                    <span className={styles.separator}>•</span>
                    <span className={styles.runtime}>{content.runtime} min</span>
                  </>
                )}
                <span className={styles.separator}>•</span>
                <span className={styles.mediaType}>
                  {isAnime ? 'Anime' : content.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                </span>
                {isAnime && malData && (
                  <>
                    <span className={styles.separator}>•</span>
                    <span className={styles.totalEpisodes}>
                      {malData.totalEpisodes} total episodes
                    </span>
                  </>
                )}
              </div>

              {/* Genres */}
              {content.genres && content.genres.length > 0 && (
                <div className={styles.genres}>
                  {content.genres.map((genre) => (
                    <span key={genre.id} className={styles.genreTag}>
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              <p className={styles.overview}>{content.overview}</p>

              {/* Watch Now Button */}
              <div className={styles.actions}>
                <FluidButton
                  onClick={handleWatchNow}
                  variant="primary"
                  size="lg"
                  className={styles.watchButton}
                  tvGroup="details-actions"
                >
                  <svg
                    className={styles.playIcon}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch Now
                </FluidButton>
              </div>
            </div>
          </motion.div>
        </div>
      </ParallaxContainer>

      {/* TV Show Season/Episode Selection */}
      {content.mediaType === 'tv' && content.seasons && content.seasons.length > 0 && (
        <section className={styles.seasonsSection}>
          <GlassPanel className={styles.seasonsPanel}>
            <h2 className={styles.sectionTitle}>Episodes</h2>
            
            {/* TMDB Season Selector - always show for TV */}
            <SeasonSelector
              seasons={content.seasons}
              selectedSeason={selectedSeason}
              onSeasonChange={(s) => {
                setSelectedSeason(s);
                setSelectedMALPartIndex(0); // Reset MAL part when changing TMDB season
              }}
            />
            
            {/* Loading indicator */}
            {(loadingEpisodes || loadingMAL) && (
              <div className={styles.loadingEpisodes}>
                <div className={styles.spinner} />
                <p>{loadingMAL ? 'Checking anime database...' : 'Loading episodes...'}</p>
              </div>
            )}
            
            {/* For anime with MAL split: show MAL part selector + TMDB episodes for that part */}
            {!loadingEpisodes && !loadingMAL && animeSeasonMapping && animeSeasonMapping.malParts.length > 1 && (
              <>
                {/* MAL Part Selector */}
                <div className={styles.malPartSelector}>
                  <div className={styles.malPartHeader}>
                    <span className={styles.malBadgeSmall}>MAL</span>
                    <span className={styles.malPartNote}>This season has {animeSeasonMapping.malParts.length} parts on MyAnimeList</span>
                  </div>
                  <div className={styles.malPartButtons}>
                    {animeSeasonMapping.malParts.map((part, index) => {
                      const isSelected = index === selectedMALPartIndex;
                      return (
                        <button
                          key={part.malId}
                          className={`${styles.malPartButton} ${isSelected ? styles.malPartButtonSelected : ''}`}
                          onClick={() => setSelectedMALPartIndex(index)}
                        >
                          <span className={styles.malPartName}>
                            Part {index + 1}: {part.titleEnglish || part.title}
                          </span>
                          <span className={styles.malPartMeta}>
                            {part.episodes} eps • ⭐ {part.score?.toFixed(2) || 'N/A'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Show TMDB episodes for the selected MAL part */}
                <EpisodeList
                  episodes={getEpisodesForMALPart(animeSeasonMapping, selectedMALPartIndex)}
                  onEpisodeSelect={handleEpisodeSelect}
                  episodeProgress={episodeProgress}
                />
              </>
            )}
            
            {/* Standard TMDB display (non-anime or anime without MAL split) */}
            {!loadingEpisodes && !loadingMAL && !animeSeasonMapping && seasonData && (
              <EpisodeList
                episodes={seasonData.episodes}
                onEpisodeSelect={handleEpisodeSelect}
                episodeProgress={episodeProgress}
              />
            )}
          </GlassPanel>
        </section>
      )}

      {/* Related Content - Horizontal Scroll Row */}
      {relatedContent.length > 0 && (
        <RelatedContentSection 
          items={relatedContent} 
          onItemSelect={handleRelatedSelect} 
        />
      )}
    </div>
  );
}
