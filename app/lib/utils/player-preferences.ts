/**
 * Player Preferences - LocalStorage management for video player settings
 */

export interface PlayerPreferences {
  autoPlayNextEpisode: boolean;
  autoPlayCountdown: number; // seconds for countdown timer before auto-playing (5-30)
  showNextEpisodeBeforeEnd: number; // seconds before video ends to show "Up Next" button (30-180)
}

const STORAGE_KEY = 'flyx_player_preferences';
const DEFAULT_PREFERENCES: PlayerPreferences = {
  autoPlayNextEpisode: true,
  autoPlayCountdown: 10,
  showNextEpisodeBeforeEnd: 90, // Show 90 seconds before end by default
};

/**
 * Get player preferences from localStorage
 */
export function getPlayerPreferences(): PlayerPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new properties
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (error) {
    console.error('[PlayerPreferences] Error reading from localStorage:', error);
  }

  return DEFAULT_PREFERENCES;
}

/**
 * Save player preferences to localStorage
 */
export function savePlayerPreferences(preferences: PlayerPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    console.log('[PlayerPreferences] Saved:', preferences);
  } catch (error) {
    console.error('[PlayerPreferences] Error writing to localStorage:', error);
  }
}

/**
 * Update auto-play next episode setting
 */
export function setAutoPlayNextEpisode(enabled: boolean): void {
  const preferences = getPlayerPreferences();
  preferences.autoPlayNextEpisode = enabled;
  savePlayerPreferences(preferences);
}

/**
 * Update auto-play countdown duration
 */
export function setAutoPlayCountdown(seconds: number): void {
  const preferences = getPlayerPreferences();
  // Clamp between 5 and 30 seconds
  preferences.autoPlayCountdown = Math.max(5, Math.min(30, seconds));
  savePlayerPreferences(preferences);
}

/**
 * Update show next episode before end time
 */
export function setShowNextEpisodeBeforeEnd(seconds: number): void {
  const preferences = getPlayerPreferences();
  // Clamp between 30 and 180 seconds (30s to 3 minutes)
  preferences.showNextEpisodeBeforeEnd = Math.max(30, Math.min(180, seconds));
  savePlayerPreferences(preferences);
}

/**
 * Get auto-play next episode setting
 */
export function getAutoPlayNextEpisode(): boolean {
  return getPlayerPreferences().autoPlayNextEpisode;
}

/**
 * Get auto-play countdown duration
 */
export function getAutoPlayCountdown(): number {
  return getPlayerPreferences().autoPlayCountdown;
}

/**
 * Clear player preferences (reset to defaults)
 */
export function clearPlayerPreferences(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[PlayerPreferences] Cleared');
  } catch (error) {
    console.error('[PlayerPreferences] Error clearing localStorage:', error);
  }
}
