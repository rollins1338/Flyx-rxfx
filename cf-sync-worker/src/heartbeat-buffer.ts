/**
 * HeartbeatBuffer - Write-behind batching for heartbeat data
 *
 * Accumulates heartbeats in memory and flushes to D1 in batches to minimize
 * write operations. Keyed by ipHash for deduplication within a flush window.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.4
 */

export interface HeartbeatEntry {
  ipHash: string;
  activityType: 'browsing' | 'watching' | 'livetv';
  contentCategory: string | null;
  timestamp: number;
}

/** Threshold: flush when buffer reaches this many entries */
const FLUSH_SIZE_THRESHOLD = 50;

/** Threshold: flush when this many ms have elapsed since last flush */
const FLUSH_TIME_THRESHOLD_MS = 10_000;

/** Max consecutive flush failures before overflow cap kicks in */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Max buffer size after overflow cap is active */
const OVERFLOW_CAP = 500;

export class HeartbeatBuffer {
  private entries: Map<string, HeartbeatEntry> = new Map();
  private lastFlushTime: number;
  private consecutiveFailures: number = 0;

  constructor(now?: number) {
    this.lastFlushTime = now ?? Date.now();
  }

  /**
   * Add a heartbeat entry to the buffer. Deduplicates by ipHash —
   * a newer heartbeat for the same ipHash overwrites the previous one.
   */
  add(entry: HeartbeatEntry): void {
    this.entries.set(entry.ipHash, entry);
  }

  /**
   * Returns the current number of entries in the buffer.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Determine whether the buffer should be flushed.
   * Returns true when the buffer is non-empty AND either:
   *   - size >= FLUSH_SIZE_THRESHOLD (50)
   *   - elapsed time since last flush >= FLUSH_TIME_THRESHOLD_MS (10s)
   */
  shouldFlush(now?: number): boolean {
    if (this.entries.size === 0) return false;
    if (this.entries.size >= FLUSH_SIZE_THRESHOLD) return true;
    const elapsed = (now ?? Date.now()) - this.lastFlushTime;
    return elapsed >= FLUSH_TIME_THRESHOLD_MS;
  }

  /**
   * Flush all buffered entries to D1 using the batch API.
   * On success: clears the buffer and resets failure counter.
   * On failure: retains all entries, increments failure counter,
   *   and enforces overflow cap after MAX_CONSECUTIVE_FAILURES.
   */
  async flush(db: D1Database, now?: number): Promise<void> {
    if (this.entries.size === 0) {
      this.lastFlushTime = now ?? Date.now();
      return;
    }

    const snapshot = this.getSnapshot();

    try {
      const statements = snapshot.map((entry) =>
        db.prepare(
          `INSERT INTO admin_heartbeats (ip_hash, activity_type, content_category, timestamp)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(ip_hash) DO UPDATE SET
             activity_type = excluded.activity_type,
             content_category = excluded.content_category,
             timestamp = excluded.timestamp`
        ).bind(entry.ipHash, entry.activityType, entry.contentCategory, entry.timestamp)
      );

      await db.batch(statements);

      // Success — clear buffer and reset counters
      this.entries.clear();
      this.consecutiveFailures = 0;
      this.lastFlushTime = now ?? Date.now();
    } catch {
      // Failure — retain entries, increment failure counter
      this.consecutiveFailures++;
      this.lastFlushTime = now ?? Date.now();

      // Enforce overflow cap after repeated failures
      if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && this.entries.size > OVERFLOW_CAP) {
        this.enforceOverflowCap();
      }
    }
  }

  /**
   * Returns a snapshot of all buffered entries as an array,
   * sorted by timestamp ascending.
   */
  getSnapshot(): HeartbeatEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Returns the number of consecutive flush failures.
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Returns the timestamp of the last flush attempt.
   */
  getLastFlushTime(): number {
    return this.lastFlushTime;
  }

  /**
   * Discard oldest entries (by timestamp) to bring buffer size down to OVERFLOW_CAP.
   */
  private enforceOverflowCap(): void {
    if (this.entries.size <= OVERFLOW_CAP) return;

    const sorted = this.getSnapshot();
    const toRemove = sorted.slice(0, sorted.length - OVERFLOW_CAP);
    for (const entry of toRemove) {
      this.entries.delete(entry.ipHash);
    }
  }
}
