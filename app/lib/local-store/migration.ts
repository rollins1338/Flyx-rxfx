/**
 * Legacy Data Migration
 *
 * Reads data from legacy localStorage keys and transforms it
 * into the new LocalStoreData structure under `flyx_v2_` keys.
 *
 * Legacy keys:
 *   flyx_watch_progress   → flyx_v2_watch_progress
 *   flyx_watchlist         → flyx_v2_watchlist
 *   flyx_viewing_history   → flyx_v2_watch_progress (merged)
 *   flyx_player_preferences → flyx_v2_settings.player
 *   flyx_provider_settings  → flyx_v2_settings.provider
 *
 * Requirements: 6.1, 6.2
 */

import type {
  WatchProgressEntry,
  WatchlistEntry,
  PlayerSettings,
  ProviderSettings,
} from './types';
import { SCHEMA_VERSION } from './types';

// ---------------------------------------------------------------------------
// Key constants
// ---------------------------------------------------------------------------

const MIGRATED_FLAG = 'flyx_v2_migrated';

const LEGACY_KEYS = {
  watchProgress: 'flyx_watch_progress',
  watchlist: 'flyx_watchlist',
  viewingHistory: 'flyx_viewing_history',
  playerPreferences: 'flyx_player_preferences',
  providerSettings: 'flyx_provider_settings',
} as const;

const V2_KEYS = {
  watchProgress: 'flyx_v2_watch_progress',
  watchlist: 'flyx_v2_watchlist',
  settings: 'flyx_v2_settings',
  schemaVersion: 'flyx_v2_schema_version',
  lastModified: 'flyx_v2_last_modified',
} as const;

// ---------------------------------------------------------------------------
// Safe JSON parse
// ---------------------------------------------------------------------------

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Legacy → v2 transformers
// ---------------------------------------------------------------------------

/**
 * Transform legacy watch progress entries.
 *
 * Legacy format (from user-tracking.ts):
 *   key: `${contentId}` or `${contentId}_s${season}_e${episode}`
 *   value: { contentId, contentType, seasonNumber?, episodeNumber?,
 *            currentTime, duration, completionPercentage, lastWatched, completed }
 *
 * Also seen in sync-client.ts:
 *   value: { contentId, contentType, title, poster, progress,
 *            currentTime, duration, seasonNumber, episodeNumber, lastWatched }
 */
export function migrateLegacyWatchProgress(
  raw: Record<string, any>,
): Record<string, WatchProgressEntry> {
  const result: Record<string, WatchProgressEntry> = {};

  for (const [key, item] of Object.entries(raw)) {
    if (!item || typeof item !== 'object') continue;

    const contentId: string = item.contentId || key.split('_s')[0] || key;
    const contentType = (['movie', 'tv', 'livetv'].includes(item.contentType)
      ? item.contentType
      : 'movie') as 'movie' | 'tv' | 'livetv';

    const season: number | undefined =
      item.seasonNumber != null ? Number(item.seasonNumber) : undefined;
    const episode: number | undefined =
      item.episodeNumber != null ? Number(item.episodeNumber) : undefined;

    // Build the v2 key
    const v2Key =
      season != null && episode != null
        ? `${contentId}_${season}_${episode}`
        : contentId;

    const position = Number(item.currentTime ?? item.position ?? 0);
    const duration = Number(item.duration ?? 0);
    const lastWatched = Number(item.lastWatched ?? Date.now());

    result[v2Key] = {
      contentId,
      contentType,
      title: item.title || '',
      seasonNumber: season,
      episodeNumber: episode,
      position,
      duration,
      lastWatched,
      posterPath: item.posterPath || item.poster || undefined,
    };
  }

  return result;
}

/**
 * Transform legacy viewing history entries and merge into watch progress.
 *
 * Legacy format (from user-tracking.ts):
 *   Array of { contentId, contentType, title, watchedAt, watchTime, completed }
 */
export function migrateLegacyViewingHistory(
  history: any[],
  existing: Record<string, WatchProgressEntry>,
): Record<string, WatchProgressEntry> {
  const merged = { ...existing };

  for (const item of history) {
    if (!item || typeof item !== 'object') continue;

    const contentId: string = item.contentId || '';
    if (!contentId) continue;

    const contentType = (['movie', 'tv', 'livetv'].includes(item.contentType)
      ? item.contentType
      : 'movie') as 'movie' | 'tv' | 'livetv';

    const v2Key = contentId;
    const lastWatched = Number(item.watchedAt ?? Date.now());

    // Only overwrite if this history entry is newer
    const existingEntry = merged[v2Key];
    if (existingEntry && existingEntry.lastWatched >= lastWatched) continue;

    merged[v2Key] = {
      contentId,
      contentType,
      title: item.title || existingEntry?.title || '',
      position: Number(item.watchTime ?? existingEntry?.position ?? 0),
      duration: existingEntry?.duration ?? 0,
      lastWatched,
      posterPath: existingEntry?.posterPath,
    };
  }

  return merged;
}

/**
 * Transform legacy watchlist entries.
 *
 * Legacy format (from useWatchlist.tsx):
 *   Array of { id, title, posterPath, backdropPath?, mediaType, releaseDate?,
 *              rating?, overview?, genres?, addedAt }
 */
export function migrateLegacyWatchlist(raw: any[]): WatchlistEntry[] {
  const result: WatchlistEntry[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const id = item.id;
    if (id == null) continue;

    const idStr = String(id);
    if (seen.has(idStr)) continue;
    seen.add(idStr);

    const mediaType = (['movie', 'tv'].includes(item.mediaType)
      ? item.mediaType
      : 'movie') as 'movie' | 'tv';

    result.push({
      id,
      mediaType,
      title: item.title || '',
      posterPath: item.posterPath || undefined,
      addedAt: Number(item.addedAt ?? Date.now()),
    });
  }

  return result;
}

/**
 * Transform legacy player preferences.
 *
 * Legacy format (from player-preferences.ts):
 *   { autoPlayNextEpisode, autoPlayCountdown, showNextEpisodeBeforeEnd,
 *     volume, isMuted, animeAudioPreference, preferredAnimeKaiServer }
 */
export function migrateLegacyPlayerSettings(raw: any): PlayerSettings {
  if (!raw || typeof raw !== 'object') return {};
  return {
    autoplay: raw.autoPlayNextEpisode ?? undefined,
    defaultQuality: undefined,
    volume: raw.volume != null ? Number(raw.volume) : undefined,
    muted: raw.isMuted ?? undefined,
    playbackSpeed: undefined,
  };
}

/**
 * Transform legacy provider settings.
 *
 * Legacy format (from sync-client.ts):
 *   { providerOrder, disabledProviders, lastSuccessfulProviders,
 *     animeAudioPreference, preferredAnimeKaiServer }
 */
export function migrateLegacyProviderSettings(raw: any): ProviderSettings {
  if (!raw || typeof raw !== 'object') return {};
  return {
    preferredProvider: Array.isArray(raw.providerOrder) ? raw.providerOrder[0] : undefined,
    autoSelectProvider: raw.autoSelectProvider ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

/**
 * Run the full legacy → v2 migration.
 *
 * Idempotent: skips if `flyx_v2_migrated` flag is already set.
 * Sets the flag on completion to prevent re-migration.
 */
export function migrateFromLegacy(): void {
  // Idempotence check
  if (localStorage.getItem(MIGRATED_FLAG) === 'true') return;

  try {
    // 1. Watch progress
    const legacyProgress = safeParse<Record<string, any>>(
      localStorage.getItem(LEGACY_KEYS.watchProgress),
      {},
    );
    let watchProgress = migrateLegacyWatchProgress(legacyProgress);

    // 2. Viewing history → merge into watch progress
    const legacyHistory = safeParse<any[]>(
      localStorage.getItem(LEGACY_KEYS.viewingHistory),
      [],
    );
    watchProgress = migrateLegacyViewingHistory(legacyHistory, watchProgress);

    // 3. Watchlist
    const legacyWatchlist = safeParse<any[]>(
      localStorage.getItem(LEGACY_KEYS.watchlist),
      [],
    );
    const watchlist = migrateLegacyWatchlist(legacyWatchlist);

    // 4. Player preferences
    const legacyPlayer = safeParse<any>(
      localStorage.getItem(LEGACY_KEYS.playerPreferences),
      {},
    );
    const playerSettings = migrateLegacyPlayerSettings(legacyPlayer);

    // 5. Provider settings
    const legacyProvider = safeParse<any>(
      localStorage.getItem(LEGACY_KEYS.providerSettings),
      {},
    );
    const providerSettings = migrateLegacyProviderSettings(legacyProvider);

    // Write to v2 keys
    const now = Date.now();
    localStorage.setItem(V2_KEYS.watchProgress, JSON.stringify(watchProgress));
    localStorage.setItem(V2_KEYS.watchlist, JSON.stringify(watchlist));
    localStorage.setItem(
      V2_KEYS.settings,
      JSON.stringify({
        provider: providerSettings,
        subtitle: {},
        player: playerSettings,
      }),
    );
    localStorage.setItem(V2_KEYS.schemaVersion, JSON.stringify(SCHEMA_VERSION));
    localStorage.setItem(V2_KEYS.lastModified, JSON.stringify(now));

    // Mark migration complete
    localStorage.setItem(MIGRATED_FLAG, 'true');
  } catch {
    // On failure, set flag to prevent retry loop (per error handling strategy)
    localStorage.setItem(MIGRATED_FLAG, 'true');
  }
}
