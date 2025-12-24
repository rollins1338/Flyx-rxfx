#!/usr/bin/env node
/**
 * Extract AnimeKai decrypt tables from the TypeScript file
 * and save as JSON for the RPI proxy
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'rpi-proxy', 'animekai-tables.json');

// Use tsx to extract and write the tables directly
execSync(`npx tsx -e "
const { DECRYPT_TABLES } = require('./app/lib/animekai-crypto.ts');
const fs = require('fs');
fs.writeFileSync('${outputPath.replace(/\\/g, '\\\\')}', JSON.stringify(DECRYPT_TABLES));
console.log('Tables written');
"`, {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
  stdio: 'inherit',
});

// Verify the file was created
if (fs.existsSync(outputPath)) {
  const tables = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  console.log(`Extracted ${Object.keys(tables).length} decrypt tables to ${outputPath}`);
} else {
  console.error('Failed to create tables file');
}
