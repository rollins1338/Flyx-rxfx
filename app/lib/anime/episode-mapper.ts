/**
 * Episode Mapper — Pure function module for MAL series episode resolution.
 *
 * A MAL "series" is an ordered list of entries (seasons/parts), each with its
 * own MAL ID and episode count.  Given a series definition and an absolute
 * episode number, the mapper resolves which MAL entry the episode belongs to
 * and what the relative episode number is within that entry.
 *
 * No TMDB, no network calls, no side effects — fully unit-testable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry (season/part) in a MAL series */
export interface SeriesEntry {
  malId: number;
  episodes: number;
  title: string;
}

/** Result of mapping an episode to a specific MAL entry */
export interface EpisodeMapping {
  malId: number;
  malTitle: string;
  relativeEpisode: number;
}

/** Pure interface for episode mapping operations */
export interface EpisodeMapperInterface {
  /** Map an absolute episode number within a series to a specific MAL entry */
  mapAbsoluteEpisode(seriesEntries: SeriesEntry[], absoluteEpisode: number): EpisodeMapping | null;

  /** Map a season + episode pair to a specific MAL entry */
  mapSeasonEpisode(seriesEntries: SeriesEntry[], season: number, episode: number): EpisodeMapping | null;

  /** Get total episode count across all entries in a series */
  getTotalEpisodes(seriesEntries: SeriesEntry[]): number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Map an absolute episode number to the correct MAL entry + relative episode.
 *
 * Episodes are 1-indexed.  Entry order matters — the first entry covers
 * episodes 1..entries[0].episodes, the second covers the next range, etc.
 *
 * If the absolute episode exceeds the total known episodes, the episode is
 * mapped to the last entry with a calculated relative offset (requirement 3.2).
 *
 * Returns null for invalid inputs (empty entries, episode < 1).
 */
export function mapAbsoluteEpisode(
  seriesEntries: SeriesEntry[],
  absoluteEpisode: number,
): EpisodeMapping | null {
  if (!seriesEntries || seriesEntries.length === 0) return null;
  if (absoluteEpisode < 1) return null;

  let offset = 0;
  for (const entry of seriesEntries) {
    if (absoluteEpisode <= offset + entry.episodes) {
      return {
        malId: entry.malId,
        malTitle: entry.title,
        relativeEpisode: absoluteEpisode - offset,
      };
    }
    offset += entry.episodes;
  }

  // Beyond known range — map to last entry with overflow offset (req 3.2)
  const lastEntry = seriesEntries[seriesEntries.length - 1];
  return {
    malId: lastEntry.malId,
    malTitle: lastEntry.title,
    relativeEpisode: absoluteEpisode - offset + lastEntry.episodes,
  };
}

/**
 * Map a season + episode pair to the correct MAL entry.
 *
 * Season is 1-indexed and maps directly to the index in seriesEntries.
 * Returns null if the season is out of range or episode < 1.
 */
export function mapSeasonEpisode(
  seriesEntries: SeriesEntry[],
  season: number,
  episode: number,
): EpisodeMapping | null {
  if (!seriesEntries || seriesEntries.length === 0) return null;
  if (season < 1 || season > seriesEntries.length) return null;
  if (episode < 1) return null;

  const entry = seriesEntries[season - 1];
  return {
    malId: entry.malId,
    malTitle: entry.title,
    relativeEpisode: episode,
  };
}

/**
 * Get total episode count across all entries in a series.
 */
export function getTotalEpisodes(seriesEntries: SeriesEntry[]): number {
  if (!seriesEntries || seriesEntries.length === 0) return 0;
  return seriesEntries.reduce((sum, e) => sum + e.episodes, 0);
}

// ---------------------------------------------------------------------------
// Concrete implementation of the interface (for DI)
// ---------------------------------------------------------------------------

export const episodeMapper: EpisodeMapperInterface = {
  mapAbsoluteEpisode,
  mapSeasonEpisode,
  getTotalEpisodes,
};
