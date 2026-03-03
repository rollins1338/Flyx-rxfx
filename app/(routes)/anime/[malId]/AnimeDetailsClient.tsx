'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import type { MALAnime, MALSeason } from '@/lib/services/mal';
import type { MediaItem } from '@/types/media';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { FluidButton } from '@/components/ui/FluidButton';
import { WatchlistButton } from '@/components/ui/WatchlistButton';
import styles from './AnimeDetails.module.css';

/** Convert MALAnime to a MediaItem so the WatchlistButton can consume it. */
function malToMediaItem(anime: MALAnime): MediaItem {
  return {
    id: `mal-${anime.mal_id}`,
    title: anime.title_english || anime.title,
    name: anime.title,
    overview: anime.synopsis || undefined,
    posterPath: anime.images.jpg.large_image_url,
    backdropPath: anime.images.jpg.large_image_url,
    vote_average: anime.score ?? undefined,
    mediaType: anime.type === 'Movie' ? 'movie' : 'tv',
    genres: anime.genres?.map(g => ({ id: g.mal_id, name: g.name })),
    releaseDate: anime.aired?.from ?? undefined,
  };
}

interface EpisodeData {
  number: number;
  title: string;
  titleJapanese: string | null;
  aired: string | null;
  score: number | null;
  filler: boolean;
  recap: boolean;
}

interface Props {
  anime: MALAnime;
  allSeasons: MALSeason[];
  totalEpisodes: number;
}

export default function AnimeDetailsClient({ anime, allSeasons, totalEpisodes }: Props) {
  const router = useRouter();
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [episodes, setEpisodes] = useState<EpisodeData[]>([]);
  
  const currentSeason = allSeasons[selectedSeason] || allSeasons[0];
  const isMovie = anime.type === 'Movie';

  // Generate episodes directly from the season's episode count — no API call needed.
  // We already have the count from MAL data passed as server props.
  // Then try to enhance with Jikan episode details (titles, air dates, filler flags) in the background.
  useEffect(() => {
    if (!currentSeason || isMovie) return;
    
    const epCount = currentSeason.episodes || 0;
    if (epCount === 0) {
      setEpisodes([]);
      return;
    }

    // Immediately generate episode list from count
    const generated: EpisodeData[] = Array.from({ length: epCount }, (_, i) => ({
      number: i + 1,
      title: `Episode ${i + 1}`,
      titleJapanese: null,
      aired: null,
      score: null,
      filler: false,
      recap: false,
    }));
    setEpisodes(generated);

    // Try to enhance with Jikan details in the background (non-blocking)
    let cancelled = false;
    (async () => {
      try {
        // Fetch all pages of episode details
        let allJikanEps: EpisodeData[] = [];
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage && !cancelled) {
          const response = await fetch(`/api/content/mal-episodes?malId=${currentSeason.malId}&page=${page}`);
          if (!response.ok || cancelled) break;
          const data = await response.json();
          if (cancelled || !data.success || !data.data?.episodes?.length) break;

          allJikanEps = allJikanEps.concat(data.data.episodes);
          hasNextPage = data.data.hasNextPage;
          page++;

          // Merge what we have so far for progressive updates
          const merged = generated.map(ep => {
            const detail = allJikanEps.find((j: EpisodeData) => j.number === ep.number);
            return detail ? { ...ep, ...detail } : ep;
          });
          if (!cancelled) setEpisodes(merged);
        }
      } catch {
        // Jikan enhancement failed — that's fine, we already have the basic list
      }
    })();

    return () => { cancelled = true; };
  }, [currentSeason, isMovie]);

  const handleBack = () => {
    router.push('/anime');
  };

  const handleWatchNow = () => {
    if (isMovie) {
      router.push(`/anime/${anime.mal_id}/watch`);
    } else if (currentSeason) {
      router.push(`/anime/${currentSeason.malId}/watch?episode=1`);
    }
  };

  const handleEpisodeSelect = (episodeNumber: number) => {
    if (currentSeason) {
      router.push(`/anime/${currentSeason.malId}/watch?episode=${episodeNumber}`);
    }
  };

  const formatAirDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const getSeasonThumbnail = () => {
    if (currentSeason?.imageUrl) return currentSeason.imageUrl;
    return anime.images.jpg.large_image_url;
  };

  const seasonThumbnail = getSeasonThumbnail();

  return (
    <div className={styles.container}>
      {/* Back Button */}
      <button onClick={handleBack} className={styles.backButton}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Anime
      </button>

      {/* Hero Section */}
      <div className={styles.hero} style={{ backgroundImage: `url(${anime.images.jpg.large_image_url})` }}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.posterContainer}>
            <img src={anime.images.jpg.large_image_url} alt={anime.title} className={styles.poster} />
          </div>
          
          <div className={styles.info}>
            <h1 className={styles.title}>{anime.title}</h1>
            {anime.title_english && anime.title_english !== anime.title && (
              <p className={styles.englishTitle}>{anime.title_english}</p>
            )}
            
            <div className={styles.metadata}>
              <span className={styles.rating}>⭐ {anime.score?.toFixed(2) || 'N/A'}</span>
              <span className={styles.separator}>•</span>
              <span className={styles.type}>{anime.type}</span>
              <span className={styles.separator}>•</span>
              <span className={styles.status}>{anime.status}</span>
              {!isMovie && allSeasons.length > 1 && (
                <>
                  <span className={styles.separator}>•</span>
                  <span className={styles.seasons}>{allSeasons.length} Seasons</span>
                </>
              )}
              {!isMovie && (currentSeason?.episodes || totalEpisodes > 0) && (
                <>
                  <span className={styles.separator}>•</span>
                  <span className={styles.episodes}>
                    {currentSeason?.episodes || totalEpisodes}+ Episodes
                  </span>
                </>
              )}
            </div>

            {anime.genres && anime.genres.length > 0 && (
              <div className={styles.genres}>
                {anime.genres.map((genre) => (
                  <span key={genre.mal_id} className={styles.genreTag}>
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            <p className={styles.synopsis}>{anime.synopsis}</p>

            <div className={styles.actions}>
              <FluidButton onClick={handleWatchNow} variant="primary" size="lg">
                <svg className={styles.playIcon} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {isMovie ? 'Watch Movie' : 'Watch Now'}
              </FluidButton>
              <WatchlistButton item={malToMediaItem(anime)} variant="full" />
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Section */}
      {!isMovie && (
        <section className={styles.episodesSection}>
          <GlassPanel className={styles.episodesPanel}>
            <h2 className={styles.sectionTitle}>Episodes</h2>
            
            {/* Season Selector */}
            {allSeasons.length > 1 && (
              <div className={styles.seasonSelector}>
                {allSeasons.map((season, index) => (
                  <button
                    key={season.malId}
                    onClick={() => setSelectedSeason(index)}
                    className={`${styles.seasonButton} ${selectedSeason === index ? styles.active : ''}`}
                  >
                    {season.titleEnglish || season.title}
                    <span className={styles.episodeCount}>
                      {season.episodes ? `${season.episodes} eps` : 'Ongoing'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Current Season Info */}
            {currentSeason && (
              <div className={styles.seasonInfo}>
                <h3>{currentSeason.titleEnglish || currentSeason.title}</h3>
                <p className={styles.seasonMeta}>
                  ⭐ {currentSeason.score?.toFixed(2) || 'N/A'} • {currentSeason.episodes ? `${currentSeason.episodes} Episodes` : 'Ongoing'} • {currentSeason.status}
                </p>
              </div>
            )}

            {/* Episode Grid */}
            <div className={styles.episodeGrid}>
                {episodes.map((ep) => {
                  const airDate = formatAirDate(ep.aired);
                  const isFuture = ep.aired ? new Date(ep.aired) > new Date() : false;
                  
                  return (
                    <motion.div
                      key={ep.number}
                      className={`${styles.episodeCard} ${isFuture ? styles.futureEpisode : ''}`}
                      whileHover={!isFuture ? { scale: 1.02 } : undefined}
                      onClick={() => !isFuture && handleEpisodeSelect(ep.number)}
                    >
                      <div className={styles.episodeThumbnail}>
                        <img 
                          src={seasonThumbnail} 
                          alt={`Episode ${ep.number}`}
                          className={styles.thumbnailImage}
                          loading="lazy"
                        />
                        <div className={styles.thumbnailOverlay}>
                          <span className={styles.episodeNumberBadge}>{ep.number}</span>
                        </div>
                        {!isFuture && (
                          <div className={styles.playOverlay}>
                            <svg fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        )}
                        {ep.filler && <span className={styles.fillerBadge}>Filler</span>}
                        {ep.recap && <span className={styles.recapBadge}>Recap</span>}
                      </div>
                      <div className={styles.episodeInfo}>
                        <h4 className={styles.episodeTitle}>
                          {ep.title || `Episode ${ep.number}`}
                        </h4>
                        {airDate && (
                          <p className={styles.episodeAirDate}>
                            {isFuture ? `Airs: ${airDate}` : airDate}
                          </p>
                        )}
                        {ep.score && ep.score > 0 && (
                          <p className={styles.episodeScore}>⭐ {ep.score.toFixed(2)}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
          </GlassPanel>
        </section>
      )}
    </div>
  );
}
