#!/usr/bin/env node
/**
 * Add Missing Admin Columns
 * 
 * This script adds the role and permissions columns to the admin_users table
 */

require('dotenv').config({ path: '.env.local' });

async function addAdminColumns() {
  console.log('\n🔧 Adding Admin Columns Tool');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Check for Neon database
    const isNeon = !!process.env.DATABASE_URL;
    console.log(`📊 Database: ${isNeon ? 'Neon PostgreSQL' : 'SQLite'}`);

    if (isNeon) {
      // Use Neon
      const { neon } = require('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      
      console.log('🔍 Checking existing columns...');
      
      // Check if columns exist
      try {
        const columns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'admin_users' 
          AND column_name IN ('role', 'permissions', 'specific_permissions')
        `;
        
        const existingColumns = columns.map(c => c.column_name);
        console.log(`✓ Existing columns: ${existingColumns.join(', ') || 'none'}`);
        
        // Add role column if missing
        if (!existingColumns.includes('role')) {
          console.log('➕ Adding role column...');
          await sql`ALTER TABLE admin_users ADD COLUMN role VARCHAR(50) DEFAULT 'viewer'`;
          console.log('✅ Role column added');
        } else {
          console.log('✅ Role column already exists');
        }
        
        // Add permissions column if missing
        if (!existingColumns.includes('permissions')) {
          console.log('➕ Adding permissions column...');
          await sql`ALTER TABLE admin_users ADD COLUMN permissions TEXT DEFAULT '["read"]'`;
          console.log('✅ Permissions column added');
        } else {
          console.log('✅ Permissions column already exists');
        }
        
        // Add specific_permissions column if missing
        if (!existingColumns.includes('specific_permissions')) {
          console.log('➕ Adding specific_permissions column...');
          await sql`ALTER TABLE admin_users ADD COLUMN specific_permissions TEXT DEFAULT '["analytics_view"]'`;
          console.log('✅ Specific permissions column added');
        } else {
          console.log('✅ Specific permissions column already exists');
        }
        
      } catch (error) {
        console.error('❌ Error checking/adding columns:', error.message);
        throw error;
      }
      
    } else {
      console.log('SQLite database - columns should already exist from setup-security-tables.js');
    }
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Admin columns setup completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 Now run: node scripts/upgrade-admin.js vynx');
    console.log('');

  } catch (error) {
    console.error('❌ Error setting up admin columns:', error.message);
    process.exit(1);
  }
}

addAdminColumns();