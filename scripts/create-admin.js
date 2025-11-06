/**
 * Create Admin User Script
 * Run with: node scripts/create-admin.js <username> <password>
 */

const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { Database } = require('bun:sqlite');

// Generate a simple ID function instead of nanoid
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Database setup
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'analytics.db');

async function createAdmin(username, password) {
  if (!username || !password) {
    console.error('Usage: node scripts/create-admin.js <username> <password>');
    process.exit(1);
  }

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);

  try {
    // Create admin users table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_login INTEGER
      );
    `);

    // Check if admin already exists
    const existingAdmin = db.query('SELECT * FROM admin_users WHERE username = ?').get(username);
    
    if (existingAdmin) {
      console.log(`Admin user '${username}' already exists. Updating password...`);
      
      const passwordHash = bcrypt.hashSync(password, 10);
      const updateStmt = db.query('UPDATE admin_users SET password_hash = ? WHERE username = ?');
      updateStmt.run(passwordHash, username);
      
      console.log(`✅ Password updated for admin user '${username}'`);
    } else {
      // Create new admin user
      const passwordHash = bcrypt.hashSync(password, 10);
      const insertStmt = db.query(`
        INSERT INTO admin_users (id, username, password_hash, created_at)
        VALUES (?, ?, ?, ?)
      `);
      
      insertStmt.run(generateId(), username, passwordHash, Date.now());
      console.log(`✅ Admin user '${username}' created successfully`);
    }

    console.log('\n📊 Admin panel will be available at: /admin');
    console.log(`👤 Username: ${username}`);
    console.log(`🔑 Password: ${password}`);
    console.log('\n⚠️  Make sure to change the default password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Get command line arguments
const [,, username, password] = process.argv;
createAdmin(username, password);