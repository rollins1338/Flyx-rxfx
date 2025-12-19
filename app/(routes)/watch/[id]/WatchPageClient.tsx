'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './WatchPage.module.css';

// Desktop video player
const DesktopVideoPlayer = dynamic(
  () => import('../../../components/player/VideoPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading player...</p>
      </div>
    )
  }
);

// Mobile-optimized video player
const MobileVideoPlayer = dynamic(
  () => import('../../../components/player/MobileVideoPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading player...</p>
      </div>
    )
  }
);

interface NextEpisodeInfo {
  season: number;
  episode: number;
  title?: string;
  isNextSeason?: boolean;
  isLastEpisode?: boolean;
}

interface SeasonInfo {
  seasonNumber: number;
  episodeCount: number;
  episodes: Array<{
    episodeNumber: number;
    title: string;
    airDate: string;
  }>;
}

interface ShowInfo {
  seasons: Array<{
    seasonNumber: number;
    episodeCount: number;
  }>;
}

function WatchContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mobileInfo = useIsMobile();

  const contentId = params.id as string;
  const mediaType = searchParams.get('type') as 'movie' | 'tv';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  const titleParam = searchParams.get('title') || searchParams.get('name');
  const shouldAutoplay = searchParams.get('autoplay') === 'true';
  
  // MAL-specific parameters for anime
  const malId = searchParams.get('malId');
  const malTitleParam = searchParams.get('malTitle');

  // Decode title if it exists
  const title = titleParam ? decodeURIComponent(titleParam) : 'Loading...';
  const malTitle = malTitleParam ? decodeURIComponent(malTitleParam) : undefined;

  const seasonId = season ? parseInt(season) : undefined;
  const episodeId = episode ? parseInt(episode) : undefined;

  // Determine if we should use mobile player (mobile device OR small screen)
  const useMobilePlayer = mobileInfo.isMobile || mobileInfo.screenWidth < 768;
  
  // Debug log for mobile detection
  useEffect(() => {
    console.log('[WatchPage] Mobile detection:', {
      isMobile: mobileInfo.isMobile,
      isIOS: mobileInfo.isIOS,
      isAndroid: mobileInfo.isAndroid,
      screenWidth: mobileInfo.screenWidth,
      useMobilePlayer,
    });
  }, [mobileInfo, useMobilePlayer]);

  const [nextEpisode, setNextEpisode] = useState<NextEpisodeInfo | null>(null);
  const [, setIsLoadingNextEpisode] = useState(false);
  
  // Mobile player state
  const [mobileStreamUrl, setMobileStreamUrl] = useState<string | null>(null);
  const [mobileSources, setMobileSources] = useState<Array<{ title: string; url: string; quality?: string }>>([]);
  const [mobileSourceIndex, setMobileSourceIndex] = useState(0);
  const [mobileLoading, setMobileLoading] = useState(true);
  const [mobileError, setMobileError] = useState<string | null>(null);

  // Fetch season data to determine next episode
  const fetchNextEpisodeInfo = useCallback(async () => {
    if (mediaType !== 'tv' || !seasonId || !episodeId) {
      setNextEpisode(null);
      return;
    }

    setIsLoadingNextEpisode(true);

    try {
      // Fetch current season data
      const seasonResponse = await fetch(
        `/api/content/season?tvId=${contentId}&seasonNumber=${seasonId}`
      );
      
      if (!seasonResponse.ok) {
        console.error('[WatchPage] Failed to fetch season data');
        setNextEpisode(null);
        return;
      }

      const seasonData: SeasonInfo = await seasonResponse.json();
      console.log('[WatchPage] Season data received:', { 
        seasonNumber: seasonData.seasonNumber, 
        episodeCount: seasonData.episodeCount,
        episodes: seasonData.episodes?.map(e => ({ num: e.episodeNumber, title: e.title }))
      });
      
      const currentEpisodeIndex = seasonData.episodes.findIndex(
        ep => ep.episodeNumber === episodeId
      );
      const isLastEpisodeInSeason = currentEpisodeIndex === seasonData.episodes.length - 1;
      console.log('[WatchPage] Current episode:', { 
        index: currentEpisodeIndex, 
        total: seasonData.episodes.length,
        episodeId,
        isLastEpisodeInSeason
      });

      // Check if there's a next episode in the current season
      if (currentEpisodeIndex !== -1 && currentEpisodeIndex < seasonData.episodes.length - 1) {
        const nextEp = seasonData.episodes[currentEpisodeIndex + 1];
        
        // Check if the next episode has aired (air date is in the past or today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const airDate = nextEp.airDate ? new Date(nextEp.airDate) : null;
        
        if (!airDate || airDate <= today) {
          setNextEpisode({
            season: seasonId,
            episode: nextEp.episodeNumber,
            title: nextEp.title || `Episode ${nextEp.episodeNumber}`,
            isNextSeason: false,
            isLastEpisode: false,
          });
          return;
        }
      }

      // Current episode is the last in the season, check for next season
      console.log('[WatchPage] Checking for next season (current is last in season or next ep not aired)');
      
      const detailsResponse = await fetch(
        `/api/content/details?id=${contentId}&mediaType=tv`
      );

      if (!detailsResponse.ok) {
        console.error('[WatchPage] Failed to fetch show details:', detailsResponse.status);
        // No next episode available
        setNextEpisode({
          season: seasonId,
          episode: episodeId,
          isLastEpisode: true,
        });
        return;
      }

      const detailsData = await detailsResponse.json();
      // API returns { success, data: { seasons, ... } }
      const showDetails: ShowInfo = detailsData.data || detailsData;
      console.log('[WatchPage] Show details received:', { 
        totalSeasons: showDetails.seasons?.length,
        seasons: showDetails.seasons?.map(s => ({ num: s.seasonNumber, eps: s.episodeCount }))
      });
      
      // Filter out season 0 (specials) and find the next season
      const regularSeasons = showDetails.seasons
        .filter(s => s.seasonNumber > 0)
        .sort((a, b) => a.seasonNumber - b.seasonNumber);
      
      const currentSeasonIndex = regularSeasons.findIndex(
        s => s.seasonNumber === seasonId
      );

      console.log('[WatchPage] Checking for next season. Current season index:', currentSeasonIndex, 'Total seasons:', regularSeasons.length);
      
      if (currentSeasonIndex !== -1 && currentSeasonIndex < regularSeasons.length - 1) {
        const nextSeasonNum = regularSeasons[currentSeasonIndex + 1].seasonNumber;
        console.log('[WatchPage] Found next season:', nextSeasonNum);
        
        // Fetch next season data to get first episode info
        const nextSeasonResponse = await fetch(
          `/api/content/season?tvId=${contentId}&seasonNumber=${nextSeasonNum}`
        );

        if (nextSeasonResponse.ok) {
          const nextSeasonData: SeasonInfo = await nextSeasonResponse.json();
          console.log('[WatchPage] Next season data:', { 
            seasonNumber: nextSeasonData.seasonNumber, 
            episodeCount: nextSeasonData.episodeCount,
            episodes: nextSeasonData.episodes?.map(e => ({ num: e.episodeNumber, title: e.title, airDate: e.airDate }))
          });
          
          if (nextSeasonData.episodes && nextSeasonData.episodes.length > 0) {
            const firstEp = nextSeasonData.episodes[0];
            
            // Check if the first episode of next season has aired
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const airDate = firstEp.airDate ? new Date(firstEp.airDate) : null;
            
            console.log('[WatchPage] Next season first episode:', { 
              episode: firstEp.episodeNumber, 
              title: firstEp.title, 
              airDate: firstEp.airDate,
              parsedAirDate: airDate?.toISOString(),
              today: today.toISOString(),
              hasAired: !airDate || airDate <= today
            });
            
            // Show next episode if it has aired OR if no air date is set (assume available)
            if (!airDate || airDate <= today) {
              setNextEpisode({
                season: nextSeasonNum,
                episode: firstEp.episodeNumber,
                title: firstEp.title || `S${nextSeasonNum} E${firstEp.episodeNumber}`,
                isNextSeason: true,
                isLastEpisode: false,
              });
              return;
            } else {
              console.log('[WatchPage] Next season episode not yet aired - air date:', firstEp.airDate);
            }
          } else {
            console.log('[WatchPage] Next season has no episodes data');
          }
        } else {
          console.log('[WatchPage] Failed to fetch next season data:', nextSeasonResponse.status);
        }
      } else {
        console.log('[WatchPage] No more seasons available');
      }

      // No more episodes available
      setNextEpisode({
        season: seasonId,
        episode: episodeId,
        isLastEpisode: true,
      });
    } catch (error) {
      console.error('[WatchPage] Error fetching next episode info:', error);
      // On error, mark as last episode to be safe (don't assume next episode exists)
      setNextEpisode({
        season: seasonId,
        episode: episodeId,
        isLastEpisode: true,
      });
    } finally {
      setIsLoadingNextEpisode(false);
    }
  }, [contentId, mediaType, seasonId, episodeId]);

  // Fetch next episode info when component mounts or episode changes
  useEffect(() => {
    // Reset nextEpisode immediately to prevent stale data from showing
    setNextEpisode(null);
    console.log('[WatchPage] Fetching next episode info for:', { contentId, mediaType, seasonId, episodeId });
    fetchNextEpisodeInfo();
  }, [fetchNextEpisodeInfo]);

  // Fetch stream URL for mobile player
  const fetchMobileStream = useCallback(async () => {
    if (!useMobilePlayer || !contentId || !mediaType) return;
    
    setMobileLoading(true);
    setMobileError(null);
    
    try {
      // Build provider order
      const providerOrder = ['videasy', '1movies'];
      
      for (const provider of providerOrder) {
        const params = new URLSearchParams({
          tmdbId: contentId,
          type: mediaType,
          provider,
        });

        if (mediaType === 'tv' && seasonId && episodeId) {
          params.append('season', seasonId.toString());
          params.append('episode', episodeId.toString());
        }
        
        if (malId) params.append('malId', malId);
        if (malTitle) params.append('malTitle', malTitle);

        try {
          const response = await fetch(`/api/stream/extract?${params}`, { cache: 'no-store' });
          const data = await response.json();

          if (data.sources && data.sources.length > 0) {
            const sources = data.sources.map((s: any) => ({
              title: s.title || s.quality || 'Source',
              url: s.url,
              quality: s.quality,
            }));
            
            setMobileSources(sources);
            setMobileStreamUrl(sources[0].url);
            setMobileSourceIndex(0);
            setMobileLoading(false);
            console.log('[WatchPage] Mobile stream loaded:', sources[0].url?.substring(0, 50));
            return;
          }
        } catch (e) {
          console.warn(`[WatchPage] ${provider} failed:`, e);
        }
      }

      setMobileError('No streams available');
      setMobileLoading(false);
    } catch (e) {
      console.error('[WatchPage] Error fetching mobile stream:', e);
      setMobileError('Failed to load video');
      setMobileLoading(false);
    }
  }, [useMobilePlayer, contentId, mediaType, seasonId, episodeId, malId, malTitle]);

  // Fetch mobile stream when needed
  useEffect(() => {
    if (useMobilePlayer) {
      fetchMobileStream();
    }
  }, [useMobilePlayer, fetchMobileStream]);

  // Handle mobile source change
  const handleMobileSourceChange = useCallback((index: number) => {
    if (index >= 0 && index < mobileSources.length) {
      setMobileSourceIndex(index);
      setMobileStreamUrl(mobileSources[index].url);
    }
  }, [mobileSources]);

  // Debug: Log when nextEpisode changes
  useEffect(() => {
    console.log('[WatchPage] nextEpisode state updated:', nextEpisode);
  }, [nextEpisode]);

  const handleBack = () => {
    // Navigate back to details page with the current season preserved
    if (mediaType === 'tv' && seasonId) {
      router.push(`/details/${contentId}?type=tv&season=${seasonId}`);
    } else {
      router.push(`/details/${contentId}?type=${mediaType}`);
    }
  };

  const handleNextEpisode = useCallback(() => {
    console.log('[WatchPage] handleNextEpisode called!', { nextEpisode, contentId, title, malId, malTitle });
    
    if (!nextEpisode || nextEpisode.isLastEpisode) {
      console.log('[WatchPage] Cannot navigate - no next episode or is last episode');
      return;
    }

    const navigateToNextEpisode = () => {
      // Build URL with MAL info preserved for anime
      let url = `/watch/${contentId}?type=tv&season=${nextEpisode.season}&episode=${nextEpisode.episode}&title=${encodeURIComponent(title)}&autoplay=true`;
      
      // Preserve MAL info for anime - this is critical for multi-part anime like Bleach TYBW
      if (malId) {
        url += `&malId=${malId}`;
      }
      if (malTitle) {
        url += `&malTitle=${encodeURIComponent(malTitle)}`;
      }
      
      console.log('[WatchPage] NAVIGATING NOW to:', url);
      // Use Next.js router for client-side navigation (preserves autoplay capability)
      router.push(url);
    };

    // Exit fullscreen first if in fullscreen mode
    if (document.fullscreenElement) {
      console.log('[WatchPage] Exiting fullscreen before navigation...');
      document.exitFullscreen().then(() => {
        navigateToNextEpisode();
      }).catch((err) => {
        console.log('[WatchPage] exitFullscreen failed:', err);
        // If exitFullscreen fails, navigate anyway
        navigateToNextEpisode();
      });
    } else {
      navigateToNextEpisode();
    }
  }, [contentId, nextEpisode, title, router, malId, malTitle]);

  if (!contentId || !mediaType) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Invalid Content</h2>
          <p>Missing content ID or media type.</p>
          <button onClick={handleBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (mediaType === 'tv' && (!seasonId || !episodeId)) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Invalid Episode</h2>
          <p>Missing season or episode information.</p>
          <button onClick={handleBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Prepare next episode prop for VideoPlayer
  const nextEpisodeProp = nextEpisode && !nextEpisode.isLastEpisode ? {
    season: nextEpisode.season,
    episode: nextEpisode.episode,
    title: nextEpisode.title,
    isNextSeason: nextEpisode.isNextSeason,
  } : null;

  // Mobile player rendering
  if (useMobilePlayer) {
    // Show loading state for mobile
    if (mobileLoading) {
      return (
        <div className={styles.container} data-tv-skip-navigation="true">
          <div className={styles.playerWrapper}>
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Finding best source...</p>
            </div>
          </div>
        </div>
      );
    }

    // Show error state for mobile
    if (mobileError || !mobileStreamUrl) {
      return (
        <div className={styles.container} data-tv-skip-navigation="true">
          <div className={styles.playerWrapper}>
            <div className={styles.error}>
              <h2>Playback Error</h2>
              <p>{mobileError || 'Failed to load video'}</p>
              <button onClick={fetchMobileStream} className={styles.backButton}>
                Retry
              </button>
              <button onClick={handleBack} className={styles.backButton}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.container} data-tv-skip-navigation="true">
        <div className={styles.playerWrapper}>
          <MobileVideoPlayer
            key={`mobile-${contentId}-${seasonId}-${episodeId}`}
            tmdbId={contentId}
            mediaType={mediaType}
            season={seasonId}
            episode={episodeId}
            title={title}
            streamUrl={mobileStreamUrl}
            onBack={handleBack}
            onError={(err) => setMobileError(err)}
            onSourceChange={handleMobileSourceChange}
            availableSources={mobileSources}
            currentSourceIndex={mobileSourceIndex}
            nextEpisode={nextEpisodeProp}
            onNextEpisode={handleNextEpisode}
          />
        </div>
      </div>
    );
  }

  // Desktop player rendering
  return (
    <div className={styles.container} data-tv-skip-navigation="true">
      <div className={styles.playerWrapper}>
        <button onClick={handleBack} className={styles.backButtonOverlay} data-player-back="true">
          ← Back
        </button>

        <DesktopVideoPlayer
          key={`${contentId}-${seasonId}-${episodeId}`}
          tmdbId={contentId}
          mediaType={mediaType}
          season={seasonId}
          episode={episodeId}
          title={title}
          nextEpisode={nextEpisodeProp}
          onNextEpisode={handleNextEpisode}
          onBack={handleBack}
          autoplay={shouldAutoplay}
          malId={malId ? parseInt(malId) : undefined}
          malTitle={malTitle}
        />
      </div>
    </div>
  );
}

export default function WatchPageClient() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    }>
      <WatchContent />
    </Suspense>
  );
}
