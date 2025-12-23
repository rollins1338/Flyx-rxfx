/**
 * Anonymous Sync Module
 * Cross-device syncing without requiring email/password
 */

// Types
export type {
  SyncCode,
  SyncData,
  SyncStatus,
  SyncResponse,
  WatchProgressItem,
  WatchlistSyncItem,
  ProviderSettings,
  SubtitleSettings,
  PlayerSettings,
} from './types';

export { SYNC_SCHEMA_VERSION } from './types';

// Sync code utilities
export {
  generateSyncCode,
  isValidSyncCode,
  normalizeSyncCode,
  hashSyncCode,
  formatSyncCodeForDisplay,
  parseSyncCodeInput,
} from './sync-code';

// Client-side sync operations
export {
  getSyncStatus,
  createNewSyncCode,
  importSyncCode,
  disconnectSync,
  collectLocalSyncData,
  applyRemoteSyncData,
  mergeSyncData,
  // Provider settings
  getProviderSettings,
  saveProviderSettings,
  setProviderOrder,
  toggleProvider,
  recordSuccessfulProvider,
  getLastSuccessfulProvider,
  // Sync event
  SYNC_DATA_CHANGED_EVENT,
} from './sync-client';

// Auto-sync utilities
export {
  queueSync,
  queueImmediateSync,
  performSync,
  performFullSync,
  cancelPendingSync,
  isSyncInProgress,
} from './auto-sync';

// React hook
export { useSync } from './useSync';
