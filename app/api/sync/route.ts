/**
 * Sync API - Anonymous cross-device sync
 * POST: Push local data to server
 * GET: Pull data from server
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { hashSyncCode, isValidSyncCode } from '@/lib/sync/sync-code';
import type { SyncData } from '@/lib/sync/types';

// Initialize sync tables on first request
let tablesInitialized = false;

async function ensureSyncTables() {
  if (tablesInitialized) return;
  
  await initializeDB();
  const db = getDB().getAdapter();
  
  // Check if we're using PostgreSQL (Neon) or SQLite
  const isPostgres = process.env.DATABASE_URL?.includes('neon.tech');
  
  if (isPostgres) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_accounts (
        id TEXT PRIMARY KEY,
        code_hash TEXT UNIQUE NOT NULL,
        sync_data JSONB NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        last_sync_at BIGINT NOT NULL,
        device_count INTEGER DEFAULT 1
      )
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_sync_accounts_hash ON sync_accounts(code_hash)
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_sync_accounts_updated ON sync_accounts(updated_at DESC)
    `);
  } else {
    // SQLite version
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sync_accounts (
        id TEXT PRIMARY KEY,
        code_hash TEXT UNIQUE NOT NULL,
        sync_data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_sync_at INTEGER NOT NULL,
        device_count INTEGER DEFAULT 1
      )
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_sync_accounts_hash ON sync_accounts(code_hash)
    `);
  }
  
  tablesInitialized = true;
}

/**
 * GET /api/sync - Pull data from server
 * Header: X-Sync-Code: FLYX-XXXXXX-XXXXXX
 */
export async function GET(request: NextRequest) {
  try {
    const syncCode = request.headers.get('X-Sync-Code');
    
    if (!syncCode || !isValidSyncCode(syncCode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing sync code' },
        { status: 400 }
      );
    }
    
    await ensureSyncTables();
    const db = getDB().getAdapter();
    const isPostgres = process.env.DATABASE_URL?.includes('neon.tech');
    const codeHash = await hashSyncCode(syncCode);
    
    const results = await db.query(
      isPostgres 
        ? 'SELECT sync_data, last_sync_at FROM sync_accounts WHERE code_hash = $1'
        : 'SELECT sync_data, last_sync_at FROM sync_accounts WHERE code_hash = ?',
      [codeHash]
    );
    
    if (results.length === 0) {
      // No data found - this is a new sync code
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No synced data found for this code',
        isNew: true,
      });
    }
    
    const row = results[0];
    const syncData = typeof row.sync_data === 'string' 
      ? JSON.parse(row.sync_data) 
      : row.sync_data;
    
    return NextResponse.json({
      success: true,
      data: syncData,
      lastSyncedAt: row.last_sync_at,
      isNew: false,
    });
    
  } catch (error) {
    console.error('[Sync API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sync data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync - Push data to server
 * Header: X-Sync-Code: FLYX-XXXXXX-XXXXXX
 * Body: SyncData
 */
export async function POST(request: NextRequest) {
  try {
    const syncCode = request.headers.get('X-Sync-Code');
    
    if (!syncCode || !isValidSyncCode(syncCode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing sync code' },
        { status: 400 }
      );
    }
    
    const body = await request.json() as SyncData;
    
    // Validate body has required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid sync data' },
        { status: 400 }
      );
    }
    
    await ensureSyncTables();
    const db = getDB().getAdapter();
    const isPostgres = process.env.DATABASE_URL?.includes('neon.tech');
    const codeHash = await hashSyncCode(syncCode);
    const now = Date.now();
    
    // Check if account exists
    const existing = await db.query(
      isPostgres
        ? 'SELECT id, sync_data FROM sync_accounts WHERE code_hash = $1'
        : 'SELECT id, sync_data FROM sync_accounts WHERE code_hash = ?',
      [codeHash]
    );
    
    const syncDataStr = JSON.stringify(body);
    
    if (existing.length === 0) {
      // Create new account
      const id = generateId();
      
      if (isPostgres) {
        await db.execute(
          `INSERT INTO sync_accounts (id, code_hash, sync_data, created_at, updated_at, last_sync_at)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
          [id, codeHash, syncDataStr, now, now, now]
        );
      } else {
        await db.execute(
          `INSERT INTO sync_accounts (id, code_hash, sync_data, created_at, updated_at, last_sync_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, codeHash, syncDataStr, now, now, now]
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Sync account created',
        lastSyncedAt: now,
        isNew: true,
      });
    }
    
    // Update existing account
    if (isPostgres) {
      await db.execute(
        `UPDATE sync_accounts 
         SET sync_data = $1::jsonb, updated_at = $2, last_sync_at = $3
         WHERE code_hash = $4`,
        [syncDataStr, now, now, codeHash]
      );
    } else {
      await db.execute(
        `UPDATE sync_accounts 
         SET sync_data = ?, updated_at = ?, last_sync_at = ?
         WHERE code_hash = ?`,
        [syncDataStr, now, now, codeHash]
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Sync data updated',
      lastSyncedAt: now,
      isNew: false,
    });
    
  } catch (error) {
    console.error('[Sync API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save sync data' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync - Delete sync account
 * Header: X-Sync-Code: FLYX-XXXXXX-XXXXXX
 */
export async function DELETE(request: NextRequest) {
  try {
    const syncCode = request.headers.get('X-Sync-Code');
    
    if (!syncCode || !isValidSyncCode(syncCode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing sync code' },
        { status: 400 }
      );
    }
    
    await ensureSyncTables();
    const db = getDB().getAdapter();
    const isPostgres = process.env.DATABASE_URL?.includes('neon.tech');
    const codeHash = await hashSyncCode(syncCode);
    
    await db.execute(
      isPostgres
        ? 'DELETE FROM sync_accounts WHERE code_hash = $1'
        : 'DELETE FROM sync_accounts WHERE code_hash = ?',
      [codeHash]
    );
    
    return NextResponse.json({
      success: true,
      message: 'Sync account deleted',
    });
    
  } catch (error) {
    console.error('[Sync API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete sync account' },
      { status: 500 }
    );
  }
}

function generateId(): string {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
