/**
 * Local-First Analytics — Type Definitions
 *
 * All data interfaces for the Local_Store, plus the ILocalStore contract
 * and the Sync_Payload type used for cross-device sync.
 */

// ---------------------------------------------------------------------------
// Schema version — bump when LocalStoreData shape changes
// ---------------------------------------------------------------------------
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Core data types
// ---------------------------------------------------------------------------

export interface WatchProgressEntry {
  contentId: string;
  contentType: 'movie' | 'tv' | 'livetv';
  title: string;
  seasonNumber?: number;
  episodeNumber?: number;
  position: number;       // seconds
  duration: number;       // seconds
  lastWatched: number;    // unix timestamp ms
  posterPath?: string;
}

export interface WatchlistEntry {
  id: string | number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  addedAt: number;        // unix timestamp ms
}

export interface ViewingStats {
  totalWatchTimeSeconds: number;
  sessionsCount: number;
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Settings types
// ---------------------------------------------------------------------------

export interface ProviderSettings {
  preferredProvider?: string;
  preferredServer?: string;
  autoSelectProvider?: boolean;
}

export interface SubtitleSettings {
  enabled?: boolean;
  language?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

export interface PlayerSettings {
  autoplay?: boolean;
  defaultQuality?: string;
  volume?: number;
  muted?: boolean;
  playbackSpeed?: number;
}

// ---------------------------------------------------------------------------
// Composite data model — everything the Local_Store persists
// ---------------------------------------------------------------------------

export interface LocalStoreData {
  watchProgress: Record<string, WatchProgressEntry>;  // keyed by contentId_season_episode
  watchlist: WatchlistEntry[];
  viewingStats: ViewingStats;
  settings: {
    provider: ProviderSettings;
    subtitle: SubtitleSettings;
    player: PlayerSettings;
  };
  schemaVersion: number;
  lastModified: number;   // unix timestamp ms
}

// ---------------------------------------------------------------------------
// Sync_Payload — the subset of LocalStoreData sent over the wire
// ---------------------------------------------------------------------------

export type SyncPayload = Pick<
  LocalStoreData,
  'watchProgress' | 'watchlist' | 'settings' | 'schemaVersion' | 'lastModified'
>;

// ---------------------------------------------------------------------------
// ILocalStore — the contract every store implementation must satisfy
// ---------------------------------------------------------------------------

export interface ILocalStore {
  // Watch progress
  getWatchProgress(contentId: string, season?: number, episode?: number): WatchProgressEntry | null;
  getAllWatchProgress(): WatchProgressEntry[];
  setWatchProgress(entry: WatchProgressEntry): void;
  getInProgress(): WatchProgressEntry[];
  getWatchHistory(page: number, pageSize: number): { items: WatchProgressEntry[]; total: number };

  // Watchlist
  getWatchlist(): WatchlistEntry[];
  addToWatchlist(entry: WatchlistEntry): void;
  removeFromWatchlist(id: string | number): void;
  isInWatchlist(id: string | number): boolean;

  // Viewing stats
  getViewingStats(): ViewingStats;

  // Bulk operations (for sync)
  exportAll(): LocalStoreData;
  importAll(data: LocalStoreData): void;
  mergeRemote(remote: LocalStoreData): void;

  // Serialization
  serialize(): string;
  deserialize(json: string): LocalStoreData;
}
