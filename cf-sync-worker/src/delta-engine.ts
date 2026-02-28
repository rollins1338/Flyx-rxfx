/**
 * DeltaEngine - Computes incremental deltas between channel states
 *
 * Maintains the last broadcast state per channel and computes deltas by
 * shallow comparison of top-level fields (using JSON serialization for
 * nested objects). Each channel has a monotonically increasing sequence
 * counter. Returns null when no changes are detected.
 *
 * Requirements: 7.1, 7.4
 */

export interface DeltaUpdate {
  channel: string;
  sequence: number;
  timestamp: number;
  changes: Record<string, unknown>;
}

export class DeltaEngine {
  private lastBroadcastState: Map<string, Record<string, unknown>> = new Map();
  private sequenceCounters: Map<string, number> = new Map();

  /**
   * Compute a delta between the current state and the last broadcast state
   * for the given channel. Returns null if no fields changed.
   *
   * Uses JSON serialization for value comparison so nested objects are
   * compared by structural equality rather than reference.
   */
  computeDelta(
    channel: string,
    currentState: Record<string, unknown>,
    now?: number
  ): DeltaUpdate | null {
    const previous = this.lastBroadcastState.get(channel);
    const changes: Record<string, unknown> = {};

    if (previous === undefined) {
      // First state for this channel — everything is a change
      for (const key of Object.keys(currentState)) {
        changes[key] = currentState[key];
      }
    } else {
      // Compare each top-level key
      const allKeys = new Set([
        ...Object.keys(previous),
        ...Object.keys(currentState),
      ]);

      for (const key of allKeys) {
        const prevVal = previous[key];
        const currVal = currentState[key];

        if (!valuesEqual(prevVal, currVal)) {
          changes[key] = currVal;
        }
      }
    }

    if (Object.keys(changes).length === 0) {
      return null;
    }

    // Increment sequence counter
    const prevSeq = this.sequenceCounters.get(channel) ?? 0;
    const nextSeq = prevSeq + 1;
    this.sequenceCounters.set(channel, nextSeq);

    // Store current state as last broadcast
    this.lastBroadcastState.set(channel, { ...currentState });

    return {
      channel,
      sequence: nextSeq,
      timestamp: now ?? Date.now(),
      changes,
    };
  }

  /**
   * Returns the full last-broadcast state for a channel,
   * or an empty object if no state has been broadcast yet.
   */
  getFullState(channel: string): Record<string, unknown> {
    return this.lastBroadcastState.get(channel) ?? {};
  }

  /**
   * Returns the current sequence number for a channel (0 if none).
   */
  getSequence(channel: string): number {
    return this.sequenceCounters.get(channel) ?? 0;
  }
}

/**
 * Compare two values for equality using JSON serialization.
 * Handles primitives, arrays, and plain objects.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === null) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;

  // For non-primitive types, compare via JSON
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}
