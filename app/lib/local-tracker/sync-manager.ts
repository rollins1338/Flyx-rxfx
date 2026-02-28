/**
 * SyncManager — handles opt-in cross-device sync via Sync_Worker.
 *
 * pushSync: collect Local_Store data via exportAll(), POST to Sync_Worker
 * pullSync: GET from Sync_Worker, call Local_Store.mergeRemote()
 * Only makes network requests when a Sync_Code exists.
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */

import { LocalStore } from '../local-store/local-store';
import type { LocalStoreData } from '../local-store/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYNC_CODE_KEY = 'flyx_v2_sync_code';

// ---------------------------------------------------------------------------
// SyncManager
// ---------------------------------------------------------------------------

export class SyncManager {
  private store: LocalStore;
  private syncWorkerUrl: string | null;

  constructor(store: LocalStore, syncWorkerUrl?: string) {
    this.store = store;
    this.syncWorkerUrl = syncWorkerUrl ?? this.getDefaultUrl();
  }

  // ---- Sync code management ----

  getSyncCode(): string | null {
    try {
      return localStorage.getItem(SYNC_CODE_KEY);
    } catch {
      return null;
    }
  }

  setSyncCode(code: string): void {
    localStorage.setItem(SYNC_CODE_KEY, code);
  }

  clearSyncCode(): void {
    localStorage.removeItem(SYNC_CODE_KEY);
  }

  // ---- Push sync ----

  async pushSync(): Promise<SyncResult> {
    const code = this.getSyncCode();
    if (!code) {
      return { success: false, error: 'No sync code configured' };
    }

    if (!this.syncWorkerUrl) {
      return { success: false, error: 'No sync worker URL configured' };
    }

    try {
      const data = this.store.exportAll();
      const response = await fetch(`${this.syncWorkerUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Code': code,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, error: `Sync push failed: ${response.status} ${body}` };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: `Sync push error: ${message}` };
    }
  }

  // ---- Pull sync ----

  async pullSync(): Promise<SyncResult> {
    const code = this.getSyncCode();
    if (!code) {
      return { success: false, error: 'No sync code configured' };
    }

    if (!this.syncWorkerUrl) {
      return { success: false, error: 'No sync worker URL configured' };
    }

    try {
      const response = await fetch(`${this.syncWorkerUrl}/sync`, {
        method: 'GET',
        headers: {
          'X-Sync-Code': code,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, error: `Sync pull failed: ${response.status} ${body}` };
      }

      const remoteData: LocalStoreData = await response.json();
      this.store.mergeRemote(remoteData);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: `Sync pull error: ${message}` };
    }
  }

  // ---- Internal ----

  private getDefaultUrl(): string | null {
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SYNC_WORKER_URL) {
      return process.env.NEXT_PUBLIC_SYNC_WORKER_URL;
    }
    return null;
  }
}
