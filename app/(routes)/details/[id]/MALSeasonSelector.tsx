'use client';

import { motion } from 'framer-motion';
import type { MALSeason } from '@/lib/services/mal';
import styles from './SeasonSelector.module.css';

interface MALSeasonSelectorProps {
  seasons: MALSeason[];
  selectedSeasonIndex: number;
  onSeasonChange: (index: number) => void;
}

/**
 * MALSeasonSelector - Season selector using MAL data
 * Displays each MAL entry as a separate "season" with accurate episode counts
 */
export const MALSeasonSelector: React.FC<MALSeasonSelectorProps> = ({
  seasons,
  selectedSeasonIndex,
  onSeasonChange,
}) => {
  if (seasons.length === 0) {
    return null;
  }

  // If only one season, don't show selector
  if (seasons.length === 1) {
    return (
      <div className={styles.container}>
        <div className={styles.singleSeasonInfo}>
          <span className={styles.malBadge}>MAL</span>
          <span className={styles.seasonLabel}>{seasons[0].title}</span>
          <span className={styles.episodeCount}>
            {seasons[0].episodes || '?'} episodes • ⭐ {seasons[0].score?.toFixed(2) || 'N/A'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.malHeader}>
        <span className={styles.malBadge}>MAL</span>
        <span className={styles.malNote}>Seasons from MyAnimeList</span>
      </div>
      <div className={styles.seasonList} data-tv-group="seasons">
        {seasons.map((season, index) => {
          const isSelected = index === selectedSeasonIndex;
          
          return (
            <motion.button
              key={season.malId}
              className={`${styles.seasonButton} ${styles.malSeasonButton} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSeasonChange(index)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-pressed={isSelected}
              aria-label={season.titleEnglish || season.title}
              data-tv-focusable="true"
            >
              <div className={styles.malSeasonContent}>
                <span className={styles.seasonNumber}>Part {season.seasonOrder}</span>
                <span className={styles.malSeasonTitle}>
                  {season.titleEnglish || season.title}
                </span>
                <div className={styles.malSeasonMeta}>
                  <span className={styles.episodeCount}>
                    {season.episodes || '?'} eps
                  </span>
                  {season.score && (
                    <span className={styles.malScore}>
                      ⭐ {season.score.toFixed(2)}
                    </span>
                  )}
                  {season.members && (
                    <span className={styles.malMembers}>
                      👥 {(season.members / 1000).toFixed(0)}K
                    </span>
                  )}
                </div>
                <span className={styles.malAired}>{season.aired}</span>
              </div>
              
              {isSelected && (
                <motion.div
                  className={styles.selectedIndicator}
                  layoutId="selectedSeason"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
