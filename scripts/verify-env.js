/**
 * Environment Verification Script
 * Checks that all required environment variables are set
 */

require('dotenv').config({ path: '.env.local' });

const REQUIRED_VARS = [
  'DATABASE_URL',
  'TMDB_API_KEY',
  'NEXT_PUBLIC_TMDB_API_KEY',
];

const OPTIONAL_VARS = [
  'IP_SALT',
  'DATABASE_URL_UNPOOLED',
];

console.log('🔍 Verifying environment configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('📋 Required Variables:');
REQUIRED_VARS.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`  ❌ ${varName}: NOT SET`);
    hasErrors = true;
  } else if (value.includes('your_') || value.includes('***')) {
    console.log(`  ⚠️  ${varName}: Set but appears to be placeholder`);
    hasWarnings = true;
  } else {
    const preview = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`  ✅ ${varName}: ${preview}`);
  }
});

console.log('\n📋 Optional Variables:');
OPTIONAL_VARS.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`  ℹ️  ${varName}: Not set (optional)`);
  } else {
    const preview = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`  ✅ ${varName}: ${preview}`);
  }
});

// Validate DATABASE_URL format
console.log('\n🔍 Validating DATABASE_URL format:');
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  if (dbUrl.includes('neon.tech')) {
    console.log('  ✅ Neon PostgreSQL detected');
    if (!dbUrl.includes('sslmode=require')) {
      console.log('  ⚠️  Warning: sslmode=require not found in connection string');
      hasWarnings = true;
    }
  } else if (dbUrl.includes('postgresql://') || dbUrl.includes('postgres://')) {
    console.log('  ✅ PostgreSQL connection string detected');
  } else {
    console.log('  ℹ️  Will use SQLite for local development');
  }
} else {
  console.log('  ℹ️  DATABASE_URL not set, will use SQLite for local development');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Configuration has errors. Please set required variables.');
  console.log('\nTo fix:');
  console.log('1. Copy .env.example to .env.local');
  console.log('2. Fill in your actual values');
  console.log('3. Run this script again to verify\n');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Configuration has warnings. Please review.');
  console.log('The app may work but some features might not function correctly.\n');
  process.exit(0);
} else {
  console.log('✅ All required environment variables are set!');
  console.log('You can now run: npm run dev\n');
  process.exit(0);
}
