/**
 * Admin Channel Mappings API
 * GET /api/admin/channel-mappings - Get channel mappings
 * POST /api/admin/channel-mappings - Create/update/delete channel mappings
 * 
 * Implements standardized response format per Requirements 16.2, 16.3, 16.4, 16.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { getDB, initializeDB } from '@/app/lib/db/neon-connection';
import { v4 as uuidv4 } from 'uuid';
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/app/lib/utils/api-response';

// Initialize channel mappings table if it doesn't exist
async function ensureMappingsTables() {
  await initializeDB();
  const db = getDB().getAdapter();
  const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
  
  if (isNeon) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS channel_mappings (
        id TEXT PRIMARY KEY,
        our_channel_id TEXT NOT NULL,
        our_channel_name TEXT NOT NULL,
        stalker_account_id TEXT NOT NULL,
        stalker_channel_id TEXT NOT NULL,
        stalker_channel_name TEXT NOT NULL,
        stalker_channel_cmd TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_used BIGINT,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at BIGINT,
        updated_at BIGINT
      )
    `);
  } else {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS channel_mappings (
        id TEXT PRIMARY KEY,
        our_channel_id TEXT NOT NULL,
        our_channel_name TEXT NOT NULL,
        stalker_account_id TEXT NOT NULL,
        stalker_channel_id TEXT NOT NULL,
        stalker_channel_name TEXT NOT NULL,
        stalker_channel_cmd TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        last_used INTEGER,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT(strftime('%s', 'now')),
        updated_at INTEGER DEFAULT(strftime('%s', 'now'))
      )
    `);
  }
  
  // Create indexes
  await db.execute('CREATE INDEX IF NOT EXISTS idx_channel_mappings_our_channel ON channel_mappings(our_channel_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_channel_mappings_account ON channel_mappings(stalker_account_id)');
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication - Requirements 16.3
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error || 'Authentication required');
    }

    await ensureMappingsTables();
    const db = getDB().getAdapter();
    
    const searchParams = request.nextUrl.searchParams;
    const ourChannelId = searchParams.get('ourChannelId');
    const accountId = searchParams.get('accountId');
    
    let query = `
      SELECT m.*, a.portal_url, a.mac_address, a.name as account_name, a.status as account_status
      FROM channel_mappings m
      LEFT JOIN iptv_accounts a ON m.stalker_account_id = a.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];
    const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
    let paramIndex = 1;
    
    if (ourChannelId) {
      conditions.push(`m.our_channel_id = ${isNeon ? `$${paramIndex}` : '?'}`);
      params.push(ourChannelId);
      paramIndex++;
    }
    
    if (accountId) {
      conditions.push(`m.stalker_account_id = ${isNeon ? `$${paramIndex}` : '?'}`);
      params.push(accountId);
      paramIndex++;
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ' ORDER BY m.our_channel_name ASC, m.priority DESC';
    
    const mappings = await db.query(query, params);
    
    return successResponse({ mappings, total: mappings.length });
  } catch (error: any) {
    console.error('Failed to fetch channel mappings:', error);
    return internalErrorResponse('Failed to fetch channel mappings', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication - Requirements 16.3
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error || 'Authentication required');
    }

    await ensureMappingsTables();
    const db = getDB().getAdapter();
    const body = await request.json();
    const { action } = body;
    const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

    switch (action) {
      case 'add': {
        const { 
          our_channel_id, 
          our_channel_name, 
          stalker_account_id, 
          stalker_channel_id, 
          stalker_channel_name, 
          stalker_channel_cmd,
          priority 
        } = body;
        
        if (!our_channel_id || !stalker_account_id || !stalker_channel_id || !stalker_channel_cmd) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const id = uuidv4();
        const now = Date.now();

        if (isNeon) {
          await db.execute(`
            INSERT INTO channel_mappings 
            (id, our_channel_id, our_channel_name, stalker_account_id, stalker_channel_id, stalker_channel_name, stalker_channel_cmd, priority, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [id, our_channel_id, our_channel_name || '', stalker_account_id, stalker_channel_id, stalker_channel_name || '', stalker_channel_cmd, priority || 0, now, now]);
        } else {
          await db.execute(`
            INSERT INTO channel_mappings 
            (id, our_channel_id, our_channel_name, stalker_account_id, stalker_channel_id, stalker_channel_name, stalker_channel_cmd, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [id, our_channel_id, our_channel_name || '', stalker_account_id, stalker_channel_id, stalker_channel_name || '', stalker_channel_cmd, priority || 0, now, now]);
        }

        return NextResponse.json({ success: true, id });
      }

      case 'update': {
        const { id, ...updates } = body;
        
        if (!id) {
          return NextResponse.json({ error: 'Mapping ID required' }, { status: 400 });
        }

        const allowedFields = ['priority', 'is_active', 'stalker_channel_cmd'];
        const setClause: string[] = [];
        const values: any[] = [];
        
        let paramIndex = 1;
        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            setClause.push(`${key} = ${isNeon ? `$${paramIndex}` : '?'}`);
            values.push(value);
            paramIndex++;
          }
        }

        if (setClause.length === 0) {
          return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        setClause.push(`updated_at = ${isNeon ? `$${paramIndex}` : '?'}`);
        values.push(Date.now());
        paramIndex++;
        
        values.push(id);

        await db.execute(
          `UPDATE channel_mappings SET ${setClause.join(', ')} WHERE id = ${isNeon ? `$${paramIndex}` : '?'}`,
          values
        );

        return NextResponse.json({ success: true });
      }

      case 'delete': {
        const { id } = body;
        
        if (!id) {
          return NextResponse.json({ error: 'Mapping ID required' }, { status: 400 });
        }

        await db.execute(
          `DELETE FROM channel_mappings WHERE id = ${isNeon ? '$1' : '?'}`,
          [id]
        );

        return NextResponse.json({ success: true });
      }

      case 'bulk_delete': {
        const { ids } = body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
          return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        const placeholders = isNeon 
          ? ids.map((_, i) => `$${i + 1}`).join(', ')
          : ids.map(() => '?').join(', ');
          
        await db.execute(
          `DELETE FROM channel_mappings WHERE id IN (${placeholders})`,
          ids
        );

        return NextResponse.json({ success: true, deleted: ids.length });
      }

      case 'deleteAll': {
        await db.execute('DELETE FROM channel_mappings');
        return NextResponse.json({ success: true });
      }

      case 'auto-map-all': {
        // Auto-map all Xfinity channels using our static mapping
        const { stalker_account_id } = body;
        
        if (!stalker_account_id) {
          return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
        }
        
        // Import the static mapping
        const { STALKER_CHANNEL_MAPPING } = await import('@/app/lib/data/stalker-channel-mapping');
        
        const now = Date.now();
        let mapped = 0;
        let skipped = 0;
        
        // Get existing mappings for this account
        const existingMappings = await db.query(
          isNeon 
            ? `SELECT our_channel_id FROM channel_mappings WHERE stalker_account_id = $1`
            : `SELECT our_channel_id FROM channel_mappings WHERE stalker_account_id = ?`,
          [stalker_account_id]
        ) as { our_channel_id: string }[];
        
        const existingChannelIds = new Set(existingMappings.map(m => m.our_channel_id));
        
        // Create mappings for each channel in our static mapping
        for (const [channelId, mapping] of Object.entries(STALKER_CHANNEL_MAPPING)) {
          // Skip if already mapped
          if (existingChannelIds.has(channelId)) {
            skipped++;
            continue;
          }
          
          // Use east coast by default, fall back to west
          const stalkerInfo = mapping.east || mapping.west;
          if (!stalkerInfo) {
            skipped++;
            continue;
          }
          
          const id = uuidv4();
          const cmd = `ffrt http://localhost/ch/${stalkerInfo.id}`;
          
          try {
            if (isNeon) {
              await db.execute(`
                INSERT INTO channel_mappings 
                (id, our_channel_id, our_channel_name, stalker_account_id, stalker_channel_id, stalker_channel_name, stalker_channel_cmd, priority, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              `, [id, channelId, mapping.name, stalker_account_id, stalkerInfo.id, stalkerInfo.name, cmd, 0, now, now]);
            } else {
              await db.execute(`
                INSERT INTO channel_mappings 
                (id, our_channel_id, our_channel_name, stalker_account_id, stalker_channel_id, stalker_channel_name, stalker_channel_cmd, priority, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [id, channelId, mapping.name, stalker_account_id, stalkerInfo.id, stalkerInfo.name, cmd, 0, now, now]);
            }
            mapped++;
          } catch (e) {
            console.error(`Failed to map ${channelId}:`, e);
            skipped++;
          }
        }
        
        return NextResponse.json({ success: true, mapped, skipped });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Channel mappings error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
