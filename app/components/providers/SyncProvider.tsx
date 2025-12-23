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
const MIN_SYNC_INTERVAL_MS = 10000; // 10 seconds (reduced from 30s for faster sync)

// Periodic sync interval
const PERIODIC_SYNC_INTERVAL_MS = 30000; // 30 seconds

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const lastSyncRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    const performAutoSync = async (forcePull = false) => {
      if (typeof window === 'undefined') return;
      
      const status = getSyncStatus();
      
      // Only sync if user has sync enabled
      if (!status.isLinked || !status.syncCode) {
        return;
      }

      // Check if enough time has passed since last sync
      const now = Date.now();
      if (!forcePull && now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) {
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
          // Merge remote data with local data
          // Use 'remote' strategy - remote wins for watchlist deletions
          const localData = collectLocalSyncData();
          const merged = mergeSyncData(localData, pullResult.data, 'remote');
          applyRemoteSyncData(merged);
          console.log('[SyncProvider] Pulled and merged remote data (remote wins)');
        }

        // Push local data to server (after merge, so we push the merged state)
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

    // Sync on page unload to save watch progress before leaving
    // Use both beforeunload and pagehide for better mobile support
    const handlePageHide = () => {
      const status = getSyncStatus();
      if (!status.isLinked || !status.syncCode) return;

      const endpoint = getSyncEndpoint();
      const localData = collectLocalSyncData();
      
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Sync-Code': status.syncCode,
        };
        if (status.passphrase) {
          headers['X-Sync-Passphrase'] = status.passphrase;
        }

        // Use fetch with keepalive for reliable sync on page close
        fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(localData),
          keepalive: true,
        });
        console.log('[SyncProvider] Sync on page hide');
      } catch {
        // Ignore errors on unload
      }
    };

    const handleBeforeUnload = handlePageHide;

    // Run sync on mount
    performAutoSync(true);

    // Also sync when tab becomes visible again (force pull to get latest)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performAutoSync(true);
      }
    };

    // Periodic sync every 30 seconds to catch changes from other devices
    const periodicSyncInterval = setInterval(() => {
      performAutoSync(false);
    }, PERIODIC_SYNC_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide); // Better mobile support

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      clearInterval(periodicSyncInterval);
    };
  }, []);

  return <>{children}</>;
}

export default SyncProvider;
