/**
 * Presence Deduplication Utility
 * 
 * Prevents duplicate presence tracking by:
 * 1. Tracking recent heartbeats with fingerprints
 * 2. Rate limiting per user/session
 * 3. Detecting and merging duplicate sessions
 */

// In-memory cache for recent heartbeats (server-side)
// In production, this would be Redis or similar
const recentHeartbeats = new Map<string, {
  lastHeartbeat: number;
  heartbeatCount: number;
  fingerprint: string;
  activityType: string;
  contentId?: string;
}>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const HEARTBEAT_EXPIRY = 2 * 60 * 1000; // 2 minutes

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of recentHeartbeats.entries()) {
      if (now - data.lastHeartbeat > HEARTBEAT_EXPIRY) {
        recentHeartbeats.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  shouldTrack: boolean;
  reason?: string;
  mergedSessionId?: string;
}

export interface HeartbeatData {
  userId: string;
  sessionId: string;
  fingerprint?: string;
  activityType: string;
  contentId?: string;
  timestamp: number;
}

/**
 * Check if a heartbeat should be tracked or is a duplicate
 */
export function checkHeartbeatDuplication(data: HeartbeatData): DeduplicationResult {
  startCleanup();
  
  const now = Date.now();
  const userKey = `user_${data.userId}`;
  const sessionKey = `session_${data.sessionId}`;
  
  // Check for recent heartbeat from same user
  const userHeartbeat = recentHeartbeats.get(userKey);
  const sessionHeartbeat = recentHeartbeats.get(sessionKey);
  
  // Rate limit: minimum 5 seconds between heartbeats from same session
  if (sessionHeartbeat && now - sessionHeartbeat.lastHeartbeat < 5000) {
    return {
      isDuplicate: true,
      shouldTrack: false,
      reason: 'rate_limited',
    };
  }
  
  // Check for duplicate sessions (same user, different session IDs, same fingerprint)
  if (userHeartbeat && data.fingerprint && userHeartbeat.fingerprint === data.fingerprint) {
    if (userHeartbeat.activityType === data.activityType && 
        userHeartbeat.contentId === data.contentId) {
      // Same activity, likely duplicate tab or reconnection
      // Merge into existing session
      return {
        isDuplicate: true,
        shouldTrack: true, // Still track but merge
        reason: 'merged_session',
        mergedSessionId: sessionHeartbeat?.fingerprint ? data.sessionId : undefined,
      };
    }
  }
  
  // Check for rapid session switching (potential bot behavior)
  if (userHeartbeat && now - userHeartbeat.lastHeartbeat < 1000) {
    userHeartbeat.heartbeatCount++;
    if (userHeartbeat.heartbeatCount > 10) {
      return {
        isDuplicate: false,
        shouldTrack: false,
        reason: 'suspicious_activity',
      };
    }
  }
  
  // Update tracking
  recentHeartbeats.set(userKey, {
    lastHeartbeat: now,
    heartbeatCount: userHeartbeat ? userHeartbeat.heartbeatCount + 1 : 1,
    fingerprint: data.fingerprint || '',
    activityType: data.activityType,
    contentId: data.contentId,
  });
  
  recentHeartbeats.set(sessionKey, {
    lastHeartbeat: now,
    heartbeatCount: sessionHeartbeat ? sessionHeartbeat.heartbeatCount + 1 : 1,
    fingerprint: data.fingerprint || '',
    activityType: data.activityType,
    contentId: data.contentId,
  });
  
  return {
    isDuplicate: false,
    shouldTrack: true,
  };
}

/**
 * Generate a composite fingerprint for deduplication
 */
export function generateDeduplicationFingerprint(data: {
  userId: string;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}): string {
  const components = [
    data.userId,
    data.userAgent.substring(0, 100),
    data.screenResolution || '',
    data.timezone || '',
    data.language || '',
  ];
  
  // Simple hash
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Check if two sessions should be merged (same user, different tabs)
 */
export function shouldMergeSessions(
  session1: { userId: string; fingerprint: string; activityType: string },
  session2: { userId: string; fingerprint: string; activityType: string }
): boolean {
  // Same user and fingerprint = same browser, different tabs
  if (session1.userId === session2.userId && 
      session1.fingerprint === session2.fingerprint) {
    return true;
  }
  
  return false;
}

/**
 * Get active session count for a user (for detecting multi-tab)
 */
export function getUserActiveSessions(userId: string): number {
  let count = 0;
  const now = Date.now();
  
  for (const [key, data] of recentHeartbeats.entries()) {
    if (key.startsWith('session_') && 
        now - data.lastHeartbeat < HEARTBEAT_EXPIRY) {
      // Check if this session belongs to the user
      const userKey = `user_${userId}`;
      const userData = recentHeartbeats.get(userKey);
      if (userData && userData.fingerprint === data.fingerprint) {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Clear all tracking data (for testing)
 */
export function clearDeduplicationCache(): void {
  recentHeartbeats.clear();
}
