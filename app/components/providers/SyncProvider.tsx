'use client';

/**
 * SyncProvider - Global sync provider that auto-syncs on page load
 * 
 * This component should be placed high in the component tree (e.g., in layout.tsx)
 * to ensure sync happens on every page load when the user has sync enabled.
 */

import { useEffect, useRef } from 'react';
import { getSyncStatus, collectLocalSyncData, applyRemoteSyncData, mergeSyncData } from '@/lib/sync/sync-client';
import { getSyncEndpoint, isUsingCloudflareSyncWorker } from '@/lib/utils/sync-endpoints';

// Minimum time between syncs (prevent spam on rapid navigation)
const MIN_SYNC_INTERVAL_MS = 30000; // 30 seconds

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    const performAutoSync = async () => {
      if (typeof window === 'undefined') return;
      
      const status = getSyncStatus();
      
      // Only sync if user has sync enabled
      if (!status.isLinked || !status.syncCode) {
        return;
      }

      // Check if enough time has passed since last sync
      const now = Date.now();
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) {
        console.log('[SyncProvider] Skipping sync - too soon since last sync');
        return;
      }

      // Prevent concurrent syncs
      if (isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;
      lastSyncRef.current = now;

      try {
        const endpoint = getSyncEndpoint();
        const headers: Record<string, string> = {
          'X-Sync-Code': status.syncCode,
        };
        
        if (status.passphrase) {
          headers['X-Sync-Passphrase'] = status.passphrase;
        }

        console.log(`[SyncProvider] Auto-syncing via ${isUsingCloudflareSyncWorker() ? 'Cloudflare' : 'Vercel'}...`);

        // Pull remote data first
        const pullResponse = await fetch(endpoint, {
          method: 'GET',
          headers,
        });

        const pullResult = await pullResponse.json();

        if (pullResult.success && pullResult.data) {
          // Merge remote data with local data (remote wins for conflicts)
          const localData = collectLocalSyncData();
          const merged = mergeSyncData(localData, pullResult.data, 'newest');
          applyRemoteSyncData(merged);
          console.log('[SyncProvider] Pulled and merged remote data');
        }

        // Push local data to server
        const localData = collectLocalSyncData();
        const pushResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(localData),
        });

        const pushResult = await pushResponse.json();

        if (pushResult.success) {
          localStorage.setItem('flyx_last_sync', pushResult.lastSyncedAt.toString());
          console.log('[SyncProvider] Auto-sync completed successfully');
        }

      } catch (error) {
        console.error('[SyncProvider] Auto-sync failed:', error);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Run sync on mount
    performAutoSync();

    // Also sync when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performAutoSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <>{children}</>;
}

export default SyncProvider;
