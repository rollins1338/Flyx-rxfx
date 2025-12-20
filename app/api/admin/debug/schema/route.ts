/**
 * Debug Schema API - Check database table columns
 * GET /api/admin/debug/schema
 * 
 * Returns the schema of all analytics-related tables to verify columns exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const tables = ['user_activity', 'live_activity', 'watch_sessions', 'analytics_events', 'page_views'];
    const schema: Record<string, any> = {};
    const rowCounts: Record<string, number> = {};

    for (const table of tables) {
      try {
        if (isNeon) {
          // PostgreSQL - get column info
          const columns = await adapter.query(`
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position
          `, [table]);
          schema[table] = columns;

          // Get row count
          const countResult = await adapter.query(`SELECT COUNT(*) as count FROM ${table}`);
          rowCounts[table] = parseInt(countResult[0]?.count) || 0;
        } else {
          // SQLite - get column info
          const columns = await adapter.query(`PRAGMA table_info(${table})`);
          schema[table] = columns.map((col: any) => ({
            column_name: col.name,
            data_type: col.type,
            column_default: col.dflt_value,
            is_nullable: col.notnull === 0 ? 'YES' : 'NO'
          }));

          // Get row count
          const countResult = await adapter.query(`SELECT COUNT(*) as count FROM ${table}`);
          rowCounts[table] = parseInt(countResult[0]?.count) || 0;
        }
      } catch (e) {
        schema[table] = { error: String(e) };
        rowCounts[table] = 0;
      }
    }

    // Check for required columns
    const requiredColumns = {
      user_activity: ['user_id', 'session_id', 'first_seen', 'last_seen', 'country', 'city', 'region', 
                      'mouse_entropy_avg', 'total_mouse_samples', 'human_score'],
      live_activity: ['user_id', 'session_id', 'activity_type', 'last_heartbeat', 'is_active', 'country', 'city'],
      watch_sessions: ['user_id', 'content_id', 'started_at', 'total_watch_time', 'completion_percentage'],
      analytics_events: ['session_id', 'timestamp', 'event_type', 'metadata'],
    };

    const missingColumns: Record<string, string[]> = {};
    
    for (const [table, required] of Object.entries(requiredColumns)) {
      const tableSchema = schema[table];
      if (Array.isArray(tableSchema)) {
        const existingColumns = tableSchema.map((col: any) => col.column_name);
        const missing = required.filter(col => !existingColumns.includes(col));
        if (missing.length > 0) {
          missingColumns[table] = missing;
        }
      }
    }

    // Get sample data from each table
    const sampleData: Record<string, any> = {};
    for (const table of tables) {
      try {
        const sample = await adapter.query(`SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 3`);
        sampleData[table] = sample;
      } catch (e) {
        sampleData[table] = { error: String(e) };
      }
    }

    return NextResponse.json({
      success: true,
      databaseType: isNeon ? 'PostgreSQL (Neon)' : 'SQLite',
      schema,
      rowCounts,
      missingColumns: Object.keys(missingColumns).length > 0 ? missingColumns : null,
      sampleData,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug schema API error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
