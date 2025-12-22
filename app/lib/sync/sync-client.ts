/**
 * Sync Client - Handles client-side sync operations
 * Collects local data and syncs with server
 */

import type { 
  SyncData, 
  SyncCode, 
  SyncStatus, 
  ProviderSettings, 
  AccountProfile,
  AccountIcon,
  AccountColor,
  Passphrase 
} from './types';
import { DEFAULT_PROFILE, SYNC_SCHEMA_VERSION } from './types';
import { 
  generateSyncCode, 
  generatePassphrase,
  isValidSyncCode, 
  isValidPassphrase,
  parseSyncCodeInput,
  parsePassphraseInput 
} from './sync-code';

const SYNC_CODE_STORAGE_KEY = 'flyx_sync_code';
const PASSPHRASE_STORAGE_KEY = 'flyx_sync_passphrase';
const PROFILE_STORAGE_KEY = 'flyx_account_profile';
const LAST_SYNC_STORAGE_KEY = 'flyx_last_sync';
const SYNC_ENABLED_KEY = 'flyx_sync_enabled';

// Default provider settings
const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  providerOrder: ['vidsrc', 'flixer', '1movies', 'videasy', 'animekai'],
  disabledProviders: [],
  lastSuccessfulProviders: {},
  animeAudioPreference: 'sub',
  preferredAnimeKaiServer: null,
};

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  if (typeof window === 'undefined') {
    return { 
      isLinked: false, 
      syncCode: null, 
      passphrase: null,
      profile: null,
      lastSyncedAt: null, 
      isSyncing: false, 
      error: null 
    };
  }
  
  const syncCode = localStorage.getItem(SYNC_CODE_STORAGE_KEY);
  const passphrase = localStorage.getItem(PASSPHRASE_STORAGE_KEY);
  const profileRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
  const lastSyncedAt = localStorage.getItem(LAST_SYNC_STORAGE_KEY);
  const isEnabled = localStorage.getItem(SYNC_ENABLED_KEY) === 'true';
  
  let profile: AccountProfile | null = null;
  if (profileRaw) {
    try {
      profile = JSON.parse(profileRaw);
    } catch {
      profile = null;
    }
  }
  
  const isValidCode = syncCode && isValidSyncCode(syncCode);
  const isValidPass = passphrase && isValidPassphrase(passphrase);
  
  return {
    isLinked: isEnabled && !!isValidCode && !!isValidPass,
    syncCode: isValidCode ? syncCode : null,
    passphrase: isValidPass ? passphrase : null,
    profile,
    lastSyncedAt: lastSyncedAt ? parseInt(lastSyncedAt, 10) : null,
    isSyncing: false,
    error: null,
  };
}

/**
 * Get account profile
 */
export function getAccountProfile(): AccountProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  
  const profileRaw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (profileRaw) {
    try {
      return { ...DEFAULT_PROFILE, ...JSON.parse(profileRaw) };
    } catch {
      return DEFAULT_PROFILE;
    }
  }
  return DEFAULT_PROFILE;
}

/**
 * Save account profile
 */
export function saveAccountProfile(profile: Partial<AccountProfile>): AccountProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  
  const current = getAccountProfile();
  const updated = { ...current, ...profile };
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Update profile name
 */
export function setProfileName(name: string): void {
  saveAccountProfile({ name: name.trim() || 'My Account' });
}

/**
 * Update profile icon
 */
export function setProfileIcon(icon: AccountIcon): void {
  saveAccountProfile({ icon });
}

/**
 * Update profile color
 */
export function setProfileColor(color: AccountColor): void {
  saveAccountProfile({ color });
}

/**
 * Generate a new sync code and passphrase, save locally
 */
export function createNewSyncAccount(profile?: Partial<AccountProfile>): { 
  code: SyncCode; 
  passphrase: Passphrase;
  profile: AccountProfile;
} {
  const code = generateSyncCode();
  const passphrase = generatePassphrase();
  const accountProfile: AccountProfile = {
    ...DEFAULT_PROFILE,
    ...profile,
    createdAt: Date.now(),
  };
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, code);
    localStorage.setItem(PASSPHRASE_STORAGE_KEY, passphrase);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(accountProfile));
    localStorage.setItem(SYNC_ENABLED_KEY, 'true');
  }
  
  return { code, passphrase, profile: accountProfile };
}

/**
 * Legacy: Generate just a sync code (for backward compatibility)
 */
export function createNewSyncCode(): SyncCode {
  const { code } = createNewSyncAccount();
  return code;
}

/**
 * Import an existing sync code with passphrase
 */
export function importSyncAccount(
  codeInput: string, 
  passphraseInput: string
): { success: boolean; code?: SyncCode; passphrase?: Passphrase; error?: string } {
  const parsedCode = parseSyncCodeInput(codeInput);
  const parsedPassphrase = parsePassphraseInput(passphraseInput);
  
  if (!parsedCode) {
    return { success: false, error: 'Invalid sync code format' };
  }
  
  if (!parsedPassphrase) {
    return { success: false, error: 'Invalid passphrase format' };
  }
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, parsedCode);
    localStorage.setItem(PASSPHRASE_STORAGE_KEY, parsedPassphrase);
    localStorage.setItem(SYNC_ENABLED_KEY, 'true');
  }
  
  return { success: true, code: parsedCode, passphrase: parsedPassphrase };
}

/**
 * Legacy: Import just a sync code (for backward compatibility)
 */
export function importSyncCode(input: string): { success: boolean; code?: SyncCode; error?: string } {
  const parsed = parseSyncCodeInput(input);
  
  if (!parsed) {
    return { success: false, error: 'Invalid sync code format' };
  }
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, parsed);
    localStorage.setItem(SYNC_ENABLED_KEY, 'true');
  }
  
  return { success: true, code: parsed };
}

/**
 * Disconnect sync (removes local sync code but keeps data)
 */
export function disconnectSync(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
    localStorage.removeItem(PASSPHRASE_STORAGE_KEY);
    localStorage.removeItem(LAST_SYNC_STORAGE_KEY);
    localStorage.setItem(SYNC_ENABLED_KEY, 'false');
    // Keep profile for if they reconnect
  }
}

/**
 * Collect all local data for syncing
 */
export function collectLocalSyncData(): SyncData {
  if (typeof window === 'undefined') {
    return getEmptySyncData();
  }
  
  // Collect profile
  const profile = getAccountProfile();
  
  // Collect watch progress
  const watchProgressRaw = localStorage.getItem('flyx_watch_progress');
  const watchProgress = watchProgressRaw ? JSON.parse(watchProgressRaw) : {};
  
  // Collect watchlist
  const watchlistRaw = localStorage.getItem('flyx_watchlist');
  const watchlist = watchlistRaw ? JSON.parse(watchlistRaw) : [];
  
  // Collect subtitle preferences
  const subtitleRaw = localStorage.getItem('vynx_subtitle_preferences');
  const subtitleSettings = subtitleRaw ? JSON.parse(subtitleRaw) : {
    enabled: true,
    languageCode: 'eng',
    languageName: 'English',
    fontSize: 100,
    textColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backgroundOpacity: 80,
    verticalPosition: 90,
  };
  
  // Collect player preferences
  const playerRaw = localStorage.getItem('flyx_player_preferences');
  const playerPrefs = playerRaw ? JSON.parse(playerRaw) : {};
  const playerSettings = {
    autoPlayNextEpisode: playerPrefs.autoPlayNextEpisode ?? true,
    autoPlayCountdown: playerPrefs.autoPlayCountdown ?? 10,
    showNextEpisodeBeforeEnd: playerPrefs.showNextEpisodeBeforeEnd ?? 90,
    volume: playerPrefs.volume ?? 1,
    isMuted: playerPrefs.isMuted ?? false,
  };
  
  // Collect provider settings
  const providerRaw = localStorage.getItem('flyx_provider_settings');
  const providerSettings: ProviderSettings = providerRaw 
    ? { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(providerRaw) }
    : {
        ...DEFAULT_PROVIDER_SETTINGS,
        animeAudioPreference: playerPrefs.animeAudioPreference ?? 'sub',
        preferredAnimeKaiServer: playerPrefs.preferredAnimeKaiServer ?? null,
      };
  
  return {
    profile,
    watchProgress,
    watchlist,
    providerSettings,
    subtitleSettings,
    playerSettings,
    lastSyncedAt: Date.now(),
    schemaVersion: SYNC_SCHEMA_VERSION,
  };
}

/**
 * Apply synced data to local storage
 */
export function applyRemoteSyncData(data: SyncData): void {
  if (typeof window === 'undefined') return;
  
  // Apply profile (merge with local, prefer remote name/icon/color if set)
  if (data.profile) {
    const localProfile = getAccountProfile();
    const mergedProfile = {
      ...localProfile,
      name: data.profile.name || localProfile.name,
      icon: data.profile.icon || localProfile.icon,
      color: data.profile.color || localProfile.color,
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(mergedProfile));
  }
  
  // Apply watch progress
  if (data.watchProgress) {
    localStorage.setItem('flyx_watch_progress', JSON.stringify(data.watchProgress));
  }
  
  // Apply watchlist
  if (data.watchlist) {
    localStorage.setItem('flyx_watchlist', JSON.stringify(data.watchlist));
  }
  
  // Apply subtitle settings
  if (data.subtitleSettings) {
    localStorage.setItem('vynx_subtitle_preferences', JSON.stringify({
      enabled: data.subtitleSettings.enabled,
      languageCode: data.subtitleSettings.languageCode,
      languageName: data.subtitleSettings.languageName,
      style: {
        fontSize: data.subtitleSettings.fontSize,
        textColor: data.subtitleSettings.textColor,
        backgroundColor: data.subtitleSettings.backgroundColor,
        backgroundOpacity: data.subtitleSettings.backgroundOpacity,
        verticalPosition: data.subtitleSettings.verticalPosition,
      },
    }));
  }
  
  // Apply player settings
  if (data.playerSettings) {
    const existingPlayer = localStorage.getItem('flyx_player_preferences');
    const existing = existingPlayer ? JSON.parse(existingPlayer) : {};
    localStorage.setItem('flyx_player_preferences', JSON.stringify({
      ...existing,
      ...data.playerSettings,
    }));
  }
  
  // Apply provider settings
  if (data.providerSettings) {
    localStorage.setItem('flyx_provider_settings', JSON.stringify(data.providerSettings));
    
    // Also update anime preferences in player settings for backward compatibility
    const playerRaw = localStorage.getItem('flyx_player_preferences');
    const playerPrefs = playerRaw ? JSON.parse(playerRaw) : {};
    playerPrefs.animeAudioPreference = data.providerSettings.animeAudioPreference;
    playerPrefs.preferredAnimeKaiServer = data.providerSettings.preferredAnimeKaiServer;
    localStorage.setItem('flyx_player_preferences', JSON.stringify(playerPrefs));
  }
  
  // Update last sync timestamp
  localStorage.setItem(LAST_SYNC_STORAGE_KEY, data.lastSyncedAt.toString());
}

/**
 * Merge local and remote data (local wins for conflicts by default)
 */
export function mergeSyncData(local: SyncData, remote: SyncData, strategy: 'local' | 'remote' | 'newest' = 'newest'): SyncData {
  const merged: SyncData = {
    profile: local.profile || remote.profile,
    watchProgress: {},
    watchlist: [],
    providerSettings: { ...DEFAULT_PROVIDER_SETTINGS },
    subtitleSettings: local.subtitleSettings,
    playerSettings: local.playerSettings,
    lastSyncedAt: Date.now(),
    schemaVersion: SYNC_SCHEMA_VERSION,
  };
  
  // Merge watch progress (keep newest per item)
  const allProgressKeys = new Set([
    ...Object.keys(local.watchProgress || {}),
    ...Object.keys(remote.watchProgress || {}),
  ]);
  
  for (const key of allProgressKeys) {
    const localItem = local.watchProgress?.[key];
    const remoteItem = remote.watchProgress?.[key];
    
    if (!localItem) {
      merged.watchProgress[key] = remoteItem!;
    } else if (!remoteItem) {
      merged.watchProgress[key] = localItem;
    } else {
      if (strategy === 'local') {
        merged.watchProgress[key] = localItem;
      } else if (strategy === 'remote') {
        merged.watchProgress[key] = remoteItem;
      } else {
        merged.watchProgress[key] = localItem.lastWatched > remoteItem.lastWatched ? localItem : remoteItem;
      }
    }
  }
  
  // Merge watchlist (union, dedupe by id)
  const watchlistMap = new Map<string | number, typeof merged.watchlist[0]>();
  
  for (const item of remote.watchlist || []) {
    watchlistMap.set(item.id, item);
  }
  for (const item of local.watchlist || []) {
    watchlistMap.set(item.id, item);
  }
  
  merged.watchlist = Array.from(watchlistMap.values())
    .sort((a, b) => b.addedAt - a.addedAt);
  
  // Provider settings - use local (user's current device preference)
  merged.providerSettings = local.providerSettings || remote.providerSettings || DEFAULT_PROVIDER_SETTINGS;
  
  // Subtitle/player settings - use local
  merged.subtitleSettings = local.subtitleSettings || remote.subtitleSettings;
  merged.playerSettings = local.playerSettings || remote.playerSettings;
  
  return merged;
}

/**
 * Get empty sync data structure
 */
function getEmptySyncData(): SyncData {
  return {
    profile: DEFAULT_PROFILE,
    watchProgress: {},
    watchlist: [],
    providerSettings: DEFAULT_PROVIDER_SETTINGS,
    subtitleSettings: {
      enabled: true,
      languageCode: 'eng',
      languageName: 'English',
      fontSize: 100,
      textColor: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backgroundOpacity: 80,
      verticalPosition: 90,
    },
    playerSettings: {
      autoPlayNextEpisode: true,
      autoPlayCountdown: 10,
      showNextEpisodeBeforeEnd: 90,
      volume: 1,
      isMuted: false,
    },
    lastSyncedAt: 0,
    schemaVersion: SYNC_SCHEMA_VERSION,
  };
}

// ============================================================================
// Provider Settings Management
// ============================================================================

const PROVIDER_SETTINGS_KEY = 'flyx_provider_settings';

export function getProviderSettings(): ProviderSettings {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER_SETTINGS;
  
  try {
    const stored = localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[ProviderSettings] Error reading:', e);
  }
  
  return DEFAULT_PROVIDER_SETTINGS;
}

export function saveProviderSettings(settings: Partial<ProviderSettings>): void {
  if (typeof window === 'undefined') return;
  
  const current = getProviderSettings();
  const updated = { ...current, ...settings };
  
  try {
    localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[ProviderSettings] Error saving:', e);
  }
}

export function setProviderOrder(order: string[]): void {
  saveProviderSettings({ providerOrder: order });
}

export function toggleProvider(provider: string, enabled: boolean): void {
  const settings = getProviderSettings();
  const disabled = new Set(settings.disabledProviders);
  
  if (enabled) {
    disabled.delete(provider);
  } else {
    disabled.add(provider);
  }
  
  saveProviderSettings({ disabledProviders: Array.from(disabled) });
}

export function recordSuccessfulProvider(contentId: string, provider: string): void {
  const settings = getProviderSettings();
  saveProviderSettings({
    lastSuccessfulProviders: {
      ...settings.lastSuccessfulProviders,
      [contentId]: provider,
    },
  });
}

export function getLastSuccessfulProvider(contentId: string): string | null {
  const settings = getProviderSettings();
  return settings.lastSuccessfulProviders[contentId] || null;
}
