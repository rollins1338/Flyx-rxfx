/**
 * Migration Script: Neon → D1 Sync Data
 * 
 * Migrates all sync accounts from Neon PostgreSQL to Cloudflare D1.
 * 
 * Usage:
 *   npx tsx scripts/migrate-sync-neon-to-d1.ts
 * 
 * Requirements:
 *   - DATABASE_URL in .env.local (Neon connection string)
 *   - wrangler CLI authenticated with Cloudflare
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
const D1_DATABASE_ID = '20081e14-6b25-40a2-9427-eea26d35bca5';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

interface SyncAccount {
  id: string;
  code_hash: string;
  sync_data: any;
  created_at: number;
  updated_at: number;
  last_sync_at: number;
  device_count: number;
}

async function fetchFromNeon(): Promise<SyncAccount[]> {
  console.log('📥 Fetching sync accounts from Neon...');
  
  // Use @neondatabase/serverless for proper connection
  const { neon } = await import('@neondatabase/serverless');
  
  try {
    const sql = neon(DATABASE_URL!);
    const rows = await sql`SELECT * FROM sync_accounts`;
    
    console.log(`✅ Found ${rows?.length || 0} sync accounts in Neon`);
    return rows as SyncAccount[];
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      console.log('ℹ️  No sync_accounts table in Neon (no data to migrate)');
      return [];
    }
    throw error;
  }
}

async function migrateToD1(accounts: SyncAccount[]): Promise<void> {
  if (accounts.length === 0) {
    console.log('ℹ️  No accounts to migrate');
    return;
  }

  console.log(`\n📤 Migrating ${accounts.length} accounts to D1...`);
  
  // Use wrangler d1 execute to insert data
  const { execSync } = await import('child_process');
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      // Prepare sync_data as JSON string
      const syncDataStr = typeof account.sync_data === 'string' 
        ? account.sync_data 
        : JSON.stringify(account.sync_data);
      
      // Escape single quotes for SQL
      const escapedSyncData = syncDataStr.replace(/'/g, "''");
      
      const sql = `INSERT OR REPLACE INTO sync_accounts (id, code_hash, sync_data, created_at, updated_at, last_sync_at, device_count) VALUES ('${account.id}', '${account.code_hash}', '${escapedSyncData}', ${account.created_at}, ${account.updated_at}, ${account.last_sync_at}, ${account.device_count || 1})`;
      
      // Execute via wrangler
      execSync(`npx wrangler d1 execute flyx-sync-db --command="${sql.replace(/"/g, '\\"')}"`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      
      migrated++;
      console.log(`  ✅ Migrated account ${account.id.substring(0, 20)}...`);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        skipped++;
        console.log(`  ⏭️  Skipped ${account.id.substring(0, 20)}... (already exists)`);
      } else {
        failed++;
        console.error(`  ❌ Failed ${account.id.substring(0, 20)}...`, error.message);
      }
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped:  ${skipped}`);
  console.log(`   ❌ Failed:   ${failed}`);
}

async function verifyD1(): Promise<void> {
  console.log('\n🔍 Verifying D1 data...');
  
  const { execSync } = await import('child_process');
  
  try {
    const result = execSync(
      `npx wrangler d1 execute flyx-sync-db --command="SELECT COUNT(*) as count FROM sync_accounts"`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    );
    console.log('D1 verification result:', result);
  } catch (error: any) {
    console.log('⚠️  Could not verify D1 (table may not exist yet)');
  }
}

async function main() {
  console.log('🚀 Neon → D1 Sync Migration\n');
  console.log('━'.repeat(50));
  
  try {
    // First, ensure D1 table exists
    console.log('📋 Ensuring D1 table exists...');
    const { execSync } = await import('child_process');
    
    try {
      execSync(
        `npx wrangler d1 execute flyx-sync-db --command="CREATE TABLE IF NOT EXISTS sync_accounts (id TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, sync_data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_sync_at INTEGER NOT NULL, device_count INTEGER DEFAULT 1)"`,
        { cwd: process.cwd(), stdio: 'pipe' }
      );
      console.log('✅ D1 table ready\n');
    } catch (e) {
      console.log('✅ D1 table already exists\n');
    }

    // Fetch from Neon
    const accounts = await fetchFromNeon();
    
    // Migrate to D1
    await migrateToD1(accounts);
    
    // Verify
    await verifyD1();
    
    console.log('\n━'.repeat(50));
    console.log('✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Verify your sync works on both devices');
    console.log('2. Once confirmed, you can remove sync data from Neon if desired');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
