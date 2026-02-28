/**
 * Local_Store — client-side storage for all user data.
 *
 * Primary backend: localStorage (key prefix `flyx_v2_`)
 * Fallback: IndexedDB when localStorage quota is exceeded.
 */

import type {
  ILocalStore,
  LocalStoreData,
  WatchProgressEntry,
  WatchlistEntry,
  ViewingStats,
} from './types';
import { SCHEMA_VERSION } from './types';

// ---------------------------------------------------------------------------
// localStorage key constants
// ---------------------------------------------------------------------------
const PREFIX = 'flyx_v2_';
const KEYS = {
  watchProgress: `${PREFIX}watch_progress`,
  watchlist: `${PREFIX}watchlist`,
  viewingStats: `${PREFIX}viewing_stats`,
  settings: `${PREFIX}settings`,
  schemaVersion: `${PREFIX}schema_version`,
  lastModified: `${PREFIX}last_modified`,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the composite key used to index watch-progress entries. */
export function progressKey(
  contentId: string,
  season?: number,
  episode?: number,
): string {
  if (season != null && episode != null) return `${contentId}_${season}_${episode}`;
  return contentId;
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Safe JSON helpers — corrupt data never crashes the store
// ---------------------------------------------------------------------------

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB fallback helpers
// ---------------------------------------------------------------------------

const IDB_NAME = 'flyx_local_store';
const IDB_STORE = 'kv';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// LocalStore implementation
// ---------------------------------------------------------------------------

export class LocalStore implements ILocalStore {
  private useIDB = false;

  // ---- low-level read/write with quota fallback ----

  private read<T>(key: string, fallback: T): T {
    if (this.useIDB) return fallback; // sync path returns fallback; async path below
    return safeJsonParse(localStorage.getItem(key), fallback);
  }

  /** Async read — tries localStorage first, falls back to IndexedDB. */
  async readAsync<T>(key: string, fallback: T): Promise<T> {
    const local = safeJsonParse<T | null>(localStorage.getItem(key), null);
    if (local != null) return local;
    return idbGet<T>(key, fallback);
  }

  private write(key: string, value: unknown): void {
    const json = JSON.stringify(value);
    try {
      localStorage.setItem(key, json);
    } catch (err: unknown) {
      if (
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22)
      ) {
        this.useIDB = true;
        // fire-and-forget async write to IndexedDB
        void idbSet(key, value);
      }
    }
  }

  private touch(): void {
    this.write(KEYS.lastModified, now());
  }

  // ---- Watch progress ----

  private readProgress(): Record<string, WatchProgressEntry> {
    return this.read<Record<string, WatchProgressEntry>>(KEYS.watchProgress, {});
  }

  private writeProgress(data: Record<string, WatchProgressEntry>): void {
    this.write(KEYS.watchProgress, data);
    this.touch();
  }

  getWatchProgress(
    contentId: string,
    season?: number,
    episode?: number,
  ): WatchProgressEntry | null {
    const key = progressKey(contentId, season, episode);
    return this.readProgress()[key] ?? null;
  }

  getAllWatchProgress(): WatchProgressEntry[] {
    return Object.values(this.readProgress());
  }

  setWatchProgress(entry: WatchProgressEntry): void {
    const key = progressKey(entry.contentId, entry.seasonNumber, entry.episodeNumber);
    const all = this.readProgress();
    all[key] = { ...entry, lastWatched: entry.lastWatched || now() };
    this.writeProgress(all);
  }

  getInProgress(): WatchProgressEntry[] {
    return this.getAllWatchProgress()
      .filter((e) => {
        if (e.duration <= 0) return false;
        const pct = e.position / e.duration;
        return pct > 0.05 && pct < 0.95;
      })
      .sort((a, b) => b.lastWatched - a.lastWatched);
  }

  getWatchHistory(
    page: number,
    pageSize: number,
  ): { items: WatchProgressEntry[]; total: number } {
    const all = this.getAllWatchProgress().sort(
      (a, b) => b.lastWatched - a.lastWatched,
    );
    const start = (page - 1) * pageSize;
    return { items: all.slice(start, start + pageSize), total: all.length };
  }

  // ---- Watchlist ----

  private readWatchlist(): WatchlistEntry[] {
    return this.read<WatchlistEntry[]>(KEYS.watchlist, []);
  }

  private writeWatchlist(data: WatchlistEntry[]): void {
    this.write(KEYS.watchlist, data);
    this.touch();
  }

  getWatchlist(): WatchlistEntry[] {
    return this.readWatchlist();
  }

  addToWatchlist(entry: WatchlistEntry): void {
    const list = this.readWatchlist().filter((e) => String(e.id) !== String(entry.id));
    list.push({ ...entry, addedAt: entry.addedAt || now() });
    this.writeWatchlist(list);
  }

  removeFromWatchlist(id: string | number): void {
    this.writeWatchlist(this.readWatchlist().filter((e) => String(e.id) !== String(id)));
  }

  isInWatchlist(id: string | number): boolean {
    return this.readWatchlist().some((e) => String(e.id) === String(id));
  }

  // ---- Viewing stats (computed from watch progress) ----

  getViewingStats(): ViewingStats {
    const entries = this.getAllWatchProgress();
    const totalWatchTimeSeconds = entries.reduce((sum, e) => sum + e.position, 0);
    return {
      totalWatchTimeSeconds,
      sessionsCount: entries.length,
      lastUpdated: now(),
    };
  }

  // ---- Bulk / sync operations ----

  exportAll(): LocalStoreData {
    return {
      watchProgress: this.readProgress(),
      watchlist: this.readWatchlist(),
      viewingStats: this.getViewingStats(),
      settings: this.read(KEYS.settings, {
        provider: {},
        subtitle: {},
        player: {},
      }),
      schemaVersion: this.read<number>(KEYS.schemaVersion, SCHEMA_VERSION),
      lastModified: this.read<number>(KEYS.lastModified, now()),
    };
  }

  importAll(data: LocalStoreData): void {
    this.writeProgress(data.watchProgress ?? {});
    this.writeWatchlist(data.watchlist ?? []);
    this.write(KEYS.settings, data.settings ?? { provider: {}, subtitle: {}, player: {} });
    this.write(KEYS.schemaVersion, data.schemaVersion ?? SCHEMA_VERSION);
    this.touch();
  }

  mergeRemote(remote: LocalStoreData): void {
    // --- watch progress: last-write-wins per key ---
    const local = this.readProgress();
    const merged = { ...local };
    for (const [key, remoteEntry] of Object.entries(remote.watchProgress ?? {})) {
      const localEntry = local[key];
      if (!localEntry || remoteEntry.lastWatched > localEntry.lastWatched) {
        merged[key] = remoteEntry;
      }
    }
    this.writeProgress(merged);

    // --- watchlist: merge by id, keep entry with latest addedAt ---
    const localList = this.readWatchlist();
    const byId = new Map<string, WatchlistEntry>();
    for (const e of localList) byId.set(String(e.id), e);
    for (const e of remote.watchlist ?? []) {
      const existing = byId.get(String(e.id));
      if (!existing || e.addedAt > existing.addedAt) {
        byId.set(String(e.id), e);
      }
    }
    this.writeWatchlist(Array.from(byId.values()));

    // --- settings: remote wins if remote.lastModified is newer ---
    const localMod = this.read<number>(KEYS.lastModified, 0);
    if ((remote.lastModified ?? 0) > localMod) {
      this.write(KEYS.settings, remote.settings ?? { provider: {}, subtitle: {}, player: {} });
    }

    this.touch();
  }

  // ---- Serialization ----

  serialize(): string {
    return JSON.stringify(this.exportAll());
  }

  deserialize(json: string): LocalStoreData {
    const data = JSON.parse(json) as LocalStoreData;
    return data;
  }
}
