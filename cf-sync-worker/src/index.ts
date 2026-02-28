/**
 * Flyx Sync Worker
 *
 * Cloudflare Worker for anonymous cross-device sync + real-time admin panel.
 * Handles: watch progress, watchlist, provider settings, subtitle/player preferences,
 *          heartbeat buffering, SSE push, and admin stats.
 *
 * Endpoints:
 *   GET  /sync        - Pull sync data (requires X-Sync-Code header)
 *   POST /sync        - Push sync data (requires X-Sync-Code header)
 *   DELETE /sync      - Delete sync account (requires X-Sync-Code header)
 *   GET  /health      - Health check
 *   POST /heartbeat   - Record user heartbeat (buffered)
 *   GET  /admin/live  - Live activity stats
 *   GET  /admin/stats - Aggregated stats (reads from cache when available)
 *   GET  /admin/sse   - SSE real-time data stream (JWT required)
 */

import { HeartbeatBuffer, HeartbeatEntry } from './heartbeat-buffer';
import { DeltaEngine } from './delta-engine';
import { SSEManager, SSEChannel, VALID_CHANNELS } from './sse-manager';
import { CronAggregator } from './cron-aggregator';
import { handleConsolidatedStats } from './stats-api';

// ============================================================================
// Types
// ============================================================================

export interface Env {
  SYNC_ENCRYPTION_KEY?: string;
  ALLOWED_ORIGINS?: string;
  LOG_LEVEL?: string;
  ADMIN_JWT_SECRET?: string;
  SYNC_DB?: D1Database;
  SYNC_CACHE?: KVNamespace;
}

interface SyncData {
  watchProgress: Record<string, WatchProgressItem>;
  watchlist: WatchlistItem[];
  providerSettings: ProviderSettings;
  subtitleSettings: SubtitleSettings;
  playerSettings: PlayerSettings;
  lastSyncedAt: number;
  schemaVersion: number;
}

interface WatchProgressItem {
  contentId: string;
  contentType: 'movie' | 'tv';
  progress: number;
  duration: number;
  lastWatched: number;
  season?: number;
  episode?: number;
  title?: string;
}

interface WatchlistItem {
  id: number | string;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  addedAt: number;
}

interface ProviderSettings {
  providerOrder: string[];
  disabledProviders: string[];
  lastSuccessfulProviders: Record<string, string>;
  animeAudioPreference: 'sub' | 'dub';
  preferredAnimeKaiServer: string | null;
}

interface SubtitleSettings {
  enabled: boolean;
  languageCode: string;
  languageName: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  verticalPosition: number;
}

interface PlayerSettings {
  autoPlayNextEpisode: boolean;
  autoPlayCountdown: number;
  showNextEpisodeBeforeEnd: number;
  volume: number;
  isMuted: boolean;
}

// ============================================================================
// Worker-level singletons (persist across requests within same isolate)
// Requirements: 2.1, 2.2, 7.1, 7.4, 1.1
// ============================================================================

let heartbeatBuffer: HeartbeatBuffer | null = null;
let deltaEngine: DeltaEngine | null = null;
let sseManager: SSEManager | null = null;
let flushIntervalId: ReturnType<typeof setInterval> | null = null;

/** Flush interval in ms — triggers delta computation + SSE broadcast */
const FLUSH_INTERVAL_MS = 10_000;

function getHeartbeatBuffer(): HeartbeatBuffer {
  if (!heartbeatBuffer) {
    heartbeatBuffer = new HeartbeatBuffer();
  }
  return heartbeatBuffer;
}

function getDeltaEngine(): DeltaEngine {
  if (!deltaEngine) {
    deltaEngine = new DeltaEngine();
  }
  return deltaEngine;
}

function getSSEManager(env: Env): SSEManager {
  if (!sseManager) {
    sseManager = new SSEManager(getDeltaEngine(), createJWTValidator(env));
  }
  return sseManager;
}

/**
 * Create a JWT validator function for SSE authentication.
 * Uses HMAC-SHA256 with the ADMIN_JWT_SECRET env var.
 */
function createJWTValidator(env: Env): (token: string) => Promise<{ sub: string; exp: number; iat: number; role?: string } | null> {
  return async (token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadStr);

      // Check expiry
      if (!payload.exp || payload.exp * 1000 < Date.now()) return null;

      // If we have a secret, verify signature
      if (env.ADMIN_JWT_SECRET) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(env.ADMIN_JWT_SECRET),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        );

        const signatureInput = `${parts[0]}.${parts[1]}`;
        const signature = Uint8Array.from(
          atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        );

        const valid = await crypto.subtle.verify(
          'HMAC',
          key,
          signature,
          encoder.encode(signatureInput)
        );

        if (!valid) return null;
      }

      return {
        sub: payload.sub || '',
        exp: payload.exp,
        iat: payload.iat || 0,
        role: payload.role,
      };
    } catch {
      return null;
    }
  };
}

// ============================================================================
// Flush timer — triggers buffer flush → delta computation → SSE broadcast
// Requirements: 2.2, 2.3, 1.2, 7.1
// ============================================================================

/**
 * Start the periodic flush timer if not already running.
 * After each flush, computes deltas from current live data and broadcasts via SSE.
 */
function ensureFlushTimer(env: Env): void {
  if (flushIntervalId !== null) return;

  flushIntervalId = setInterval(async () => {
    try {
      await flushAndBroadcast(env);
    } catch (err) {
      console.error('[Sync Worker] Flush timer error:', err);
    }
  }, FLUSH_INTERVAL_MS);
}

/**
 * Core flush-and-broadcast pipeline:
 * 1. Flush heartbeat buffer to D1
 * 2. Query current live state from D1
 * 3. Compute deltas via DeltaEngine
 * 4. Broadcast deltas to SSE subscribers
 */
export async function flushAndBroadcast(env: Env): Promise<void> {
  if (!env.SYNC_DB) return;

  const buffer = getHeartbeatBuffer();
  const delta = getDeltaEngine();
  const sse = getSSEManager(env);

  // 1. Flush buffer to D1
  if (buffer.size > 0) {
    await buffer.flush(env.SYNC_DB);
  }

  // 2. Only compute deltas if there are SSE subscribers
  if (sse.getConnectionCount() === 0) return;

  // 3. Query current live state and compute deltas per channel
  const tenMinAgo = Date.now() - 10 * 60 * 1000;

  // Realtime channel: live user counts and activity breakdown
  try {
    const statsResult = await env.SYNC_DB.prepare(`
      SELECT activity_type, COUNT(*) as count
      FROM admin_heartbeats
      WHERE timestamp >= ?
      GROUP BY activity_type
    `).bind(tenMinAgo).all();

    const topContentResult = await env.SYNC_DB.prepare(`
      SELECT content_category, COUNT(*) as viewers
      FROM admin_heartbeats
      WHERE timestamp >= ? AND content_category IS NOT NULL
      GROUP BY content_category
      ORDER BY viewers DESC
      LIMIT 10
    `).bind(tenMinAgo).all();

    let watching = 0, browsing = 0, livetv = 0;
    for (const row of (statsResult.results || [])) {
      const count = row.count as number;
      switch (row.activity_type) {
        case 'watching': watching = count; break;
        case 'browsing': browsing = count; break;
        case 'livetv': livetv = count; break;
      }
    }

    const realtimeState: Record<string, unknown> = {
      liveUsers: watching + browsing + livetv,
      watching,
      browsing,
      livetv,
      topActiveContent: (topContentResult.results || []).map(r => ({
        title: r.content_category,
        viewers: r.viewers,
      })),
    };

    const realtimeDelta = delta.computeDelta('realtime', realtimeState);
    if (realtimeDelta) {
      sse.broadcastDelta('realtime' as SSEChannel, realtimeDelta);
    }
  } catch (err) {
    console.error('[Sync Worker] Realtime delta error:', err);
  }
}

// ============================================================================
// CORS helpers
// ============================================================================

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'];
  const isAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : '',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Code, X-Sync-Passphrase',
    'Access-Control-Max-Age': '86400',
  };
}

// ============================================================================
// Sync code helpers
// ============================================================================

export async function hashSyncCode(code: string): Promise<string> {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized + '_flyx_sync_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isValidSyncCode(code: string): boolean {
  if (!code) return false;
  const normalized = code.toUpperCase().replace(/\s/g, '');
  return /^FLYX-[A-Z0-9]{6}-[A-Z0-9]{6}$/.test(normalized);
}

function generateId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// IP hashing
// ============================================================================

export const VALID_ACTIVITY_TYPES = ['browsing', 'watching', 'livetv'] as const;

export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '_flyx_heartbeat_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const KNOWN_SCHEMA_VERSIONS = [1, 2];

// ============================================================================
// Main worker export
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      const sse = sseManager; // don't create if not initialized
      return Response.json({
        status: 'ok',
        service: 'flyx-sync',
        timestamp: Date.now(),
        hasD1: !!env.SYNC_DB,
        sseConnections: sse?.getConnectionCount() ?? 0,
        bufferSize: heartbeatBuffer?.size ?? 0,
      }, { headers: corsHeaders });
    }

    // SSE endpoint — Requirements: 1.1, 1.2, 9.1, 9.2
    if (url.pathname === '/admin/sse' && request.method === 'GET') {
      try {
        const sse = getSSEManager(env);
        ensureFlushTimer(env);
        const response = await sse.connect(request);
        // Add CORS headers to SSE response
        const headers = new Headers(response.headers);
        for (const [key, value] of Object.entries(corsHeaders)) {
          headers.set(key, value);
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch (error) {
        console.error('[Sync Worker] SSE connect error:', error);
        return Response.json(
          { success: false, error: 'SSE connection failed' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Sync endpoints — support both /sync and /analytics/sync paths
    const syncPath = url.pathname.replace(/^\/analytics/, '');
    if (syncPath === '/sync') {
      try {
        const syncCode = request.headers.get('X-Sync-Code');

        if (!syncCode || !isValidSyncCode(syncCode)) {
          return Response.json(
            { success: false, error: 'Invalid or missing sync code' },
            { status: 400, headers: corsHeaders }
          );
        }

        const codeHash = await hashSyncCode(syncCode);

        switch (request.method) {
          case 'GET':
            return await handleGet(codeHash, env, corsHeaders);
          case 'POST':
            return await handlePost(request, codeHash, env, corsHeaders);
          case 'DELETE':
            return await handleDelete(codeHash, env, corsHeaders);
          default:
            return Response.json(
              { success: false, error: 'Method not allowed' },
              { status: 405, headers: corsHeaders }
            );
        }
      } catch (error) {
        console.error('[Sync Worker] Error:', error);
        return Response.json(
          { success: false, error: 'Internal server error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Heartbeat endpoint — now uses buffer (Requirements: 2.1, 2.2, 2.3)
    if (url.pathname === '/heartbeat' && request.method === 'POST') {
      try {
        return await handleHeartbeat(request, env, corsHeaders);
      } catch (error) {
        console.error('[Sync Worker] Heartbeat error:', error);
        return Response.json(
          { success: false, error: 'Internal server error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Admin live endpoint
    if (url.pathname === '/admin/live' && request.method === 'GET') {
      try {
        return await handleAdminLive(env, corsHeaders);
      } catch (error) {
        console.error('[Sync Worker] Admin live error:', error);
        return Response.json(
          { success: false, error: 'Internal server error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Admin stats endpoint — now reads from aggregation_cache when available
    if (url.pathname === '/admin/stats' && request.method === 'GET') {
      try {
        return await handleAdminStats(request, env, corsHeaders);
      } catch (error) {
        console.error('[Sync Worker] Admin stats error:', error);
        return Response.json(
          { success: false, error: 'Internal server error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json(
      { success: false, error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  },

  // Scheduled handler — flush buffer, run aggregations based on cron trigger
  // Requirements: 2.6, 3.1, 3.2, 10.2
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.SYNC_DB) {
      console.error('[Sync Worker] Cron: D1 database not configured');
      return;
    }

    // Flush any pending heartbeats before aggregation
    const buffer = getHeartbeatBuffer();
    if (buffer.size > 0) {
      try {
        await buffer.flush(env.SYNC_DB);
      } catch (err) {
        console.error('[Sync Worker] Cron: buffer flush failed:', err);
      }
    }

    const aggregator = new CronAggregator();

    // Determine which cron triggered this: */15 (every 15 min) or 0 0 (midnight)
    // Every 15-minute trigger: run hourly aggregation
    try {
      await aggregator.runHourlyAggregation(env.SYNC_DB);
    } catch (err) {
      // Log and skip on D1 failure — retry on next scheduled run (Requirement 10.2)
      console.error('[Sync Worker] Cron: hourly aggregation failed:', err);
    }

    // Check if this is the midnight trigger (hour=0, minute=0)
    const triggerDate = new Date(event.scheduledTime);
    const isMidnight = triggerDate.getUTCHours() === 0 && triggerDate.getUTCMinutes() === 0;

    if (isMidnight) {
      // Daily aggregation
      try {
        await aggregator.runDailyAggregation(env.SYNC_DB);
      } catch (err) {
        console.error('[Sync Worker] Cron: daily aggregation failed:', err);
      }

      // Cleanup old aggregations and heartbeats
      try {
        await aggregator.cleanupOldAggregations(env.SYNC_DB);
      } catch (err) {
        console.error('[Sync Worker] Cron: aggregation cleanup failed:', err);
      }

      try {
        await cleanupOldHeartbeats(env.SYNC_DB);
      } catch (err) {
        console.error('[Sync Worker] Cron: heartbeat cleanup failed:', err);
      }

      // Legacy daily stats (backward compatibility)
      try {
        await aggregateDailyStats(env.SYNC_DB);
      } catch (err) {
        console.error('[Sync Worker] Cron: legacy daily stats failed:', err);
      }
    }
  },
};

// ============================================================================
// Sync handlers (unchanged from original)
// ============================================================================

async function handleGet(
  codeHash: string,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.SYNC_DB) {
    return Response.json(
      { success: false, error: 'D1 database not configured' },
      { status: 503, headers: corsHeaders }
    );
  }
  return await handleGetD1(codeHash, env.SYNC_DB, corsHeaders);
}

async function handleGetD1(
  codeHash: string,
  db: D1Database,
  corsHeaders: HeadersInit
): Promise<Response> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sync_accounts (
        id TEXT PRIMARY KEY,
        code_hash TEXT UNIQUE NOT NULL,
        sync_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_sync_at INTEGER NOT NULL,
        device_count INTEGER DEFAULT 1
      )
    `).run();
  } catch (e) {
    console.log('[Sync] Table creation:', e);
  }

  const result = await db.prepare(
    'SELECT sync_data, last_sync_at FROM sync_accounts WHERE code_hash = ?'
  ).bind(codeHash).first();

  if (!result) {
    return Response.json({
      success: true,
      data: null,
      message: 'No synced data found for this code',
      isNew: true,
    }, { headers: corsHeaders });
  }

  const syncData = JSON.parse(result.sync_data as string);

  return Response.json({
    success: true,
    data: syncData,
    lastSyncedAt: result.last_sync_at,
    isNew: false,
  }, { headers: corsHeaders });
}

async function handlePost(
  request: Request,
  codeHash: string,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const body = await request.json() as SyncData;

  if (!body || typeof body !== 'object') {
    return Response.json(
      { success: false, error: 'Invalid sync data' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (body.schemaVersion !== undefined && !KNOWN_SCHEMA_VERSIONS.includes(body.schemaVersion)) {
    return Response.json(
      { success: false, error: `Unknown schema version: ${body.schemaVersion}. Supported versions: ${KNOWN_SCHEMA_VERSIONS.join(', ')}` },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!env.SYNC_DB) {
    return Response.json(
      { success: false, error: 'D1 database not configured' },
      { status: 503, headers: corsHeaders }
    );
  }
  return await handlePostD1(codeHash, body, env.SYNC_DB, corsHeaders);
}

async function handlePostD1(
  codeHash: string,
  body: SyncData,
  db: D1Database,
  corsHeaders: HeadersInit
): Promise<Response> {
  const now = Date.now();
  const syncDataStr = JSON.stringify(body);

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sync_accounts (
        id TEXT PRIMARY KEY,
        code_hash TEXT UNIQUE NOT NULL,
        sync_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_sync_at INTEGER NOT NULL,
        device_count INTEGER DEFAULT 1
      )
    `).run();
  } catch (e) {
    console.log('[Sync] Table creation:', e);
  }

  const existing = await db.prepare(
    'SELECT id FROM sync_accounts WHERE code_hash = ?'
  ).bind(codeHash).first();

  if (!existing) {
    const id = generateId();
    await db.prepare(`
      INSERT INTO sync_accounts (id, code_hash, sync_data, created_at, updated_at, last_sync_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, codeHash, syncDataStr, now, now, now).run();

    return Response.json({
      success: true,
      message: 'Sync account created',
      lastSyncedAt: now,
      isNew: true,
    }, { headers: corsHeaders });
  }

  await db.prepare(`
    UPDATE sync_accounts
    SET sync_data = ?, updated_at = ?, last_sync_at = ?
    WHERE code_hash = ?
  `).bind(syncDataStr, now, now, codeHash).run();

  return Response.json({
    success: true,
    message: 'Sync data updated',
    lastSyncedAt: now,
    isNew: false,
  }, { headers: corsHeaders });
}

async function handleDelete(
  codeHash: string,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.SYNC_DB) {
    return Response.json(
      { success: false, error: 'D1 database not configured' },
      { status: 503, headers: corsHeaders }
    );
  }

  await env.SYNC_DB.prepare(
    'DELETE FROM sync_accounts WHERE code_hash = ?'
  ).bind(codeHash).run();

  return Response.json({
    success: true,
    message: 'Sync account deleted',
  }, { headers: corsHeaders });
}

// ============================================================================
// Heartbeat handler — now uses HeartbeatBuffer instead of direct D1 writes
// Requirements: 2.1, 2.2, 2.3
// ============================================================================

async function handleHeartbeat(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.SYNC_DB) {
    return Response.json(
      { success: false, error: 'D1 database not configured' },
      { status: 503, headers: corsHeaders }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!body || typeof body !== 'object') {
    return Response.json(
      { success: false, error: 'Invalid payload' },
      { status: 400, headers: corsHeaders }
    );
  }

  const payload = body as Record<string, unknown>;

  const allowedFields = ['activityType', 'contentCategory', 'timestamp'];
  const extraFields = Object.keys(payload).filter(k => !allowedFields.includes(k));
  if (extraFields.length > 0) {
    return Response.json(
      { success: false, error: `Unexpected fields: ${extraFields.join(', ')}` },
      { status: 400, headers: corsHeaders }
    );
  }

  const { activityType, contentCategory, timestamp } = payload as {
    activityType: unknown;
    contentCategory: unknown;
    timestamp: unknown;
  };

  if (!activityType || typeof activityType !== 'string' || !VALID_ACTIVITY_TYPES.includes(activityType as any)) {
    return Response.json(
      { success: false, error: 'Invalid activityType. Must be one of: browsing, watching, livetv' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (contentCategory !== undefined && contentCategory !== null && typeof contentCategory !== 'string') {
    return Response.json(
      { success: false, error: 'contentCategory must be a string or null' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!timestamp || typeof timestamp !== 'number') {
    return Response.json(
      { success: false, error: 'timestamp must be a number' },
      { status: 400, headers: corsHeaders }
    );
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
  const ipHash = await hashIP(ip);

  // Buffer the heartbeat instead of writing directly to D1
  const buffer = getHeartbeatBuffer();
  buffer.add({
    ipHash,
    activityType: activityType as HeartbeatEntry['activityType'],
    contentCategory: (contentCategory as string) || null,
    timestamp: timestamp as number,
  });

  // Start the flush timer if not already running
  ensureFlushTimer(env);

  // Immediate flush if buffer threshold reached (Requirements: 2.3)
  if (buffer.shouldFlush()) {
    await flushAndBroadcast(env);
  }

  return Response.json({ success: true }, { headers: corsHeaders });
}

// ============================================================================
// Admin endpoints
// ============================================================================

async function handleAdminLive(
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.SYNC_DB) {
    return Response.json(
      { success: false, error: 'D1 database not configured' },
      { status: 503, headers: corsHeaders }
    );
  }

  const tenMinAgo = Date.now() - 10 * 60 * 1000;

  const statsResult = await env.SYNC_DB.prepare(`
    SELECT activity_type, COUNT(*) as count
    FROM admin_heartbeats
    WHERE timestamp >= ?
    GROUP BY activity_type
  `).bind(tenMinAgo).all();

  const topContentResult = await env.SYNC_DB.prepare(`
    SELECT content_category, COUNT(*) as viewers
    FROM admin_heartbeats
    WHERE timestamp >= ? AND content_category IS NOT NULL
    GROUP BY content_category
    ORDER BY viewers DESC
    LIMIT 10
  `).bind(tenMinAgo).all();

  return Response.json({
    success: true,
    stats: statsResult.results || [],
    topContent: topContentResult.results || [],
  }, { headers: corsHeaders });
}

/**
 * Admin stats endpoint — consolidated slice-based queries with cache routing.
 * Reads from aggregation_cache for completed periods, combines with delta
 * query for current incomplete period.
 * Requirements: 3.3, 3.4, 5.2, 5.3, 5.4
 */
async function handleAdminStats(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  if (!env.SYNC_DB) {
    return Response.json(
      { success: false, error: 'D1 database not configured' },
      { status: 503, headers: corsHeaders }
    );
  }

  const result = await handleConsolidatedStats(request, env.SYNC_DB);
  return Response.json(result, { headers: corsHeaders });
}

// ============================================================================
// Cron: aggregate daily stats & cleanup
// ============================================================================

export async function aggregateDailyStats(db: D1Database): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();

  const activityCounts = await db.prepare(`
    SELECT activity_type, COUNT(DISTINCT ip_hash) as count
    FROM admin_heartbeats
    GROUP BY activity_type
  `).all();

  let watching = 0, browsing = 0, livetv = 0;
  for (const row of (activityCounts.results || [])) {
    const count = row.count as number;
    switch (row.activity_type) {
      case 'watching': watching = count; break;
      case 'browsing': browsing = count; break;
      case 'livetv': livetv = count; break;
    }
  }

  const uniqueResult = await db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as total FROM admin_heartbeats
  `).first();
  const totalUnique = (uniqueResult?.total as number) || 0;

  const peakResult = await db.prepare(`
    SELECT COUNT(*) as peak FROM admin_heartbeats
  `).first();
  const peakActive = (peakResult?.peak as number) || 0;

  const topCats = await db.prepare(`
    SELECT content_category, COUNT(*) as count
    FROM admin_heartbeats
    WHERE content_category IS NOT NULL
    GROUP BY content_category
    ORDER BY count DESC
    LIMIT 10
  `).all();
  const topCategories = JSON.stringify(
    (topCats.results || []).map(r => ({ category: r.content_category, count: r.count }))
  );

  await db.prepare(`
    INSERT INTO admin_daily_stats (date, peak_active, total_unique_sessions, watching_sessions, browsing_sessions, livetv_sessions, top_categories, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      peak_active = MAX(admin_daily_stats.peak_active, excluded.peak_active),
      total_unique_sessions = excluded.total_unique_sessions,
      watching_sessions = excluded.watching_sessions,
      browsing_sessions = excluded.browsing_sessions,
      livetv_sessions = excluded.livetv_sessions,
      top_categories = excluded.top_categories,
      updated_at = excluded.updated_at
  `).bind(today, peakActive, totalUnique, watching, browsing, livetv, topCategories, now, now).run();
}

export async function cleanupOldHeartbeats(db: D1Database): Promise<void> {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  await db.prepare(`
    DELETE FROM admin_heartbeats WHERE timestamp < ?
  `).bind(twentyFourHoursAgo).run();
}
