/**
 * Simple Migration Script: Neon → D1 Sync Data
 * 
 * Uses the Cloudflare API directly (no wrangler CLI needed).
 * 
 * Usage:
 *   npx tsx scripts/migrate-sync-simple.ts
 * 
 * Requirements:
 *   - DATABASE_URL in .env.local (Neon connection string)
 *   - CF_API_TOKEN environment variable (Cloudflare API token with D1 write access)
 *   - CF_ACCOUNT_ID environment variable (your Cloudflare account ID)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const D1_DATABASE_ID = '20081e14-6b25-40a2-9427-eea26d35bca5';

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
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not found in .env.local');
  }

  console.log('📥 Fetching sync accounts from Neon...');
  
  const url = new URL(DATABASE_URL.replace('postgresql://', 'https://').replace('postgres://', 'https://'));
  const host = url.hostname;
  const password = url.password;

  const response = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${password}`,
    },
    body: JSON.stringify({
      query: 'SELECT * FROM sync_accounts',
      params: [],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (text.includes('does not exist')) {
      console.log('ℹ️  No sync_accounts table in Neon (no data to migrate)');
      return [];
    }
    throw new Error(`Failed to fetch from Neon: ${response.status} - ${text}`);
  }

  const data = await response.json() as { rows: SyncAccount[] };
  console.log(`✅ Found ${data.rows?.length || 0} sync accounts in Neon`);
  
  return data.rows || [];
}

async function executeD1Query(sql: string, params: any[] = []): Promise<any> {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    throw new Error('CF_API_TOKEN and CF_ACCOUNT_ID required for D1 API access');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors || data)}`);
  }

  return data;
}

async function migrateToD1(accounts: SyncAccount[]): Promise<void> {
  if (accounts.length === 0) {
    console.log('ℹ️  No accounts to migrate');
    return;
  }

  console.log(`\n📤 Migrating ${accounts.length} accounts to D1...`);
  
  // Ensure table exists
  await executeD1Query(`
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

  let migrated = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const syncDataStr = typeof account.sync_data === 'string' 
        ? account.sync_data 
        : JSON.stringify(account.sync_data);

      await executeD1Query(
        `INSERT OR REPLACE INTO sync_accounts (id, code_hash, sync_data, created_at, updated_at, last_sync_at, device_count) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          account.id,
          account.code_hash,
          syncDataStr,
          account.created_at,
          account.updated_at,
          account.last_sync_at,
          account.device_count || 1,
        ]
      );
      
      migrated++;
      console.log(`  ✅ Migrated: ${account.id.substring(0, 25)}...`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ Failed: ${account.id.substring(0, 25)}...`, error.message);
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ❌ Failed:   ${failed}`);
}

async function main() {
  console.log('🚀 Neon → D1 Sync Migration (API Method)\n');
  console.log('━'.repeat(50));

  // Check requirements
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    console.log('\n⚠️  CF_API_TOKEN and CF_ACCOUNT_ID not set.');
    console.log('   Using wrangler CLI method instead...\n');
    
    // Fall back to wrangler method
    const accounts = await fetchFromNeon();
    if (accounts.length === 0) return;
    
    console.log('\nTo migrate using wrangler CLI, run:');
    console.log('  npx tsx scripts/migrate-sync-neon-to-d1.ts');
    console.log('\nOr set these env vars for API method:');
    console.log('  CF_API_TOKEN=your-cloudflare-api-token');
    console.log('  CF_ACCOUNT_ID=your-cloudflare-account-id');
    return;
  }

  try {
    const accounts = await fetchFromNeon();
    await migrateToD1(accounts);
    
    console.log('\n━'.repeat(50));
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
