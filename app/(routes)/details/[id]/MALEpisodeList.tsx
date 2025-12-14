'use client';

import { motion } from 'framer-motion';
import type { MALSeason } from '@/lib/services/mal';
import styles from './EpisodeList.module.css';

interface MALEpisodeListProps {
  season: MALSeason;
  onEpisodeSelect: (episodeNumber: number, malId: number) => void;
  episodeProgress?: Record<number, number>;
}

/**
 * MALEpisodeList - Episode list for MAL-based anime
 * Generates episode entries based on MAL episode count
 */
export const MALEpisodeList: React.FC<MALEpisodeListProps> = ({
  season,
  onEpisodeSelect,
  episodeProgress = {},
}) => {
  const episodeCount = season.episodes || 0;

  if (episodeCount === 0) {
    return (
      <div className={styles.emptyState}>
        <p>Episode count not available</p>
        <p className={styles.malNote}>This anime may still be airing</p>
      </div>
    );
  }

  // Generate episode entries
  const episodes = Array.from({ length: episodeCount }, (_, i) => ({
    number: i + 1,
    title: `Episode ${i + 1}`,
  }));

  return (
    <div className={styles.container}>
      {/* MAL Season Info Header */}
      <div className={styles.malSeasonHeader}>
        <div className={styles.malSeasonInfo}>
          <h3 className={styles.malSeasonTitle}>
            {season.titleEnglish || season.title}
          </h3>
          <div className={styles.malSeasonStats}>
            {season.score && (
              <span className={styles.malStat}>
                ⭐ {season.score.toFixed(2)}
              </span>
            )}
            {season.members && (
              <span className={styles.malStat}>
                👥 {season.members.toLocaleString()} members
              </span>
            )}
            <span className={styles.malStat}>
              📅 {season.aired}
            </span>
            <span className={styles.malStat}>
              {season.status}
            </span>
          </div>
        </div>
        {season.imageUrl && (
          <img 
            src={season.imageUrl} 
            alt={season.title}
            className={styles.malSeasonPoster}
          />
        )}
      </div>

      {/* Synopsis */}
      {season.synopsis && (
        <p className={styles.malSynopsis}>{season.synopsis}</p>
      )}

      {/* Episode Grid */}
      <div className={styles.episodeGrid} data-tv-group="episodes">
        {episodes.map((episode, index) => (
          <motion.div
            key={episode.number}
            className={`${styles.episodeCard} ${styles.malEpisodeCard}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => onEpisodeSelect(episode.number, season.malId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEpisodeSelect(episode.number, season.malId);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Episode ${episode.number}`}
            data-tv-focusable="true"
          >
            {/* Episode Number Badge */}
            <div className={styles.malEpisodeNumber}>
              <span className={styles.epNumber}>{episode.number}</span>
            </div>

            {/* Play overlay */}
            <div className={styles.playOverlay}>
              <svg
                className={styles.playIcon}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>

            {/* Progress bar */}
            {episodeProgress[episode.number] !== undefined && episodeProgress[episode.number] > 0 && (
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBar} 
                  style={{ width: `${Math.min(episodeProgress[episode.number], 100)}%` }}
                />
              </div>
            )}

            {/* Episode Info */}
            <div className={styles.episodeInfo}>
              <span className={styles.episodeTitle}>Episode {episode.number}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
