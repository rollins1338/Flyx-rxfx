/**
 * Anonymous Sync System Types
 * Cross-device syncing without requiring email/password
 */

// Sync code format: FLYX-XXXXXX-XXXXXX (16 chars total identifier)
export type SyncCode = string;

// 6-word passphrase for protecting sync codes
export type Passphrase = string;

// Account profile for personalization
export interface AccountProfile {
  name: string;
  icon: AccountIcon;
  color: AccountColor;
  createdAt: number;
}

// Available icons for account
export type AccountIcon = 
  | 'user'
  | 'star'
  | 'heart'
  | 'bolt'
  | 'flame'
  | 'moon'
  | 'sun'
  | 'ghost'
  | 'rocket'
  | 'gamepad'
  | 'music'
  | 'film';

// Available colors for account
export type AccountColor =
  | 'cyan'
  | 'purple'
  | 'pink'
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'yellow';

// Color hex values
export const ACCOUNT_COLORS: Record<AccountColor, string> = {
  cyan: '#00f5ff',
  purple: '#8b5cf6',
  pink: '#f471b5',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
};

// What gets synced to the server
export interface SyncData {
  // Account profile
  profile?: AccountProfile;
  // Watch progress for movies and episodes
  watchProgress: Record<string, WatchProgressItem>;
  // Watchlist items
  watchlist: WatchlistSyncItem[];
  // Provider preferences
  providerSettings: ProviderSettings;
  // Subtitle preferences
  subtitleSettings: SubtitleSettings;
  // Player preferences
  playerSettings: PlayerSettings;
  // Last sync timestamp
  lastSyncedAt: number;
  // Schema version for migrations
  schemaVersion: number;
}

export interface WatchProgressItem {
  contentId: string;
  contentType: 'movie' | 'tv';
  title?: string;
  poster?: string;
  progress: number; // 0-100 percentage
  currentTime: number; // seconds
  duration: number; // seconds
  seasonNumber?: number;
  episodeNumber?: number;
  lastWatched: number; // timestamp
}

export interface WatchlistSyncItem {
  id: number | string;
  title: string;
  posterPath: string;
  backdropPath?: string;
  mediaType: 'movie' | 'tv';
  releaseDate?: string;
  rating?: number;
  addedAt: number;
}

export interface ProviderSettings {
  // Provider priority order (first = highest priority)
  providerOrder: string[];
  // Disabled providers
  disabledProviders: string[];
  // Remember last successful provider per content
  lastSuccessfulProviders: Record<string, string>;
  // Anime-specific
  animeAudioPreference: 'sub' | 'dub';
  preferredAnimeKaiServer: string | null;
}

export interface SubtitleSettings {
  enabled: boolean;
  languageCode: string;
  languageName: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  verticalPosition: number;
}

export interface PlayerSettings {
  autoPlayNextEpisode: boolean;
  autoPlayCountdown: number;
  showNextEpisodeBeforeEnd: number;
  volume: number;
  isMuted: boolean;
}

// Server response types
export interface SyncResponse {
  success: boolean;
  message?: string;
  data?: SyncData;
  syncCode?: SyncCode;
  lastSyncedAt?: number;
}

export interface SyncStatus {
  isLinked: boolean;
  syncCode: SyncCode | null;
  passphrase: Passphrase | null;
  profile: AccountProfile | null;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  error: string | null;
}

// Current schema version - increment when changing SyncData structure
export const SYNC_SCHEMA_VERSION = 2;

// Default account profile
export const DEFAULT_PROFILE: AccountProfile = {
  name: 'My Account',
  icon: 'user',
  color: 'cyan',
  createdAt: Date.now(),
};
