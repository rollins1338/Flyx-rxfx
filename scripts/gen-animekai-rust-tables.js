#!/usr/bin/env node
/**
 * Generate Rust source for AnimeKai substitution tables.
 * Reads the TS crypto module and outputs a Rust file with all 183 encrypt tables
 * as compact byte arrays (256-entry lookup per position).
 * For decryption, we build reverse tables at compile time.
 */
const fs = require('fs');
const ts = fs.readFileSync('app/lib/animekai-crypto.ts', 'utf8');

// Extract the ENCRYPT_TABLES object by evaluating the relevant portion
// Each table maps char -> byte. We need to convert to byte[256] arrays for Rust.

// Parse tables from the TS source
const tableRegex = /(\d+):\s*\{([^}]+)\}/g;
const encryptSection = ts.substring(ts.indexOf('ENCRYPT_TABLES'), ts.indexOf('DECRYPT_TABLES'));

const tables = {};
let m;
while ((m = tableRegex.exec(encryptSection)) !== null) {
  const pos = parseInt(m[1]);
  const entries = m[2];
  tables[pos] = {};
  
  // Parse 'char':0xNN pairs
  const pairRegex = /'((?:\\.|[^']))':\s*0x([0-9a-fA-F]+)/g;
  let pm;
  while ((pm = pairRegex.exec(entries)) !== null) {
    let ch = pm[1];
    if (ch === '\\\\') ch = '\\';
    else if (ch === "\\'") ch = "'";
    tables[pos][ch] = parseInt(pm[2], 16);
  }
}

const numTables = Object.keys(tables).length;
console.error(`Parsed ${numTables} encrypt tables`);

// Generate Rust: for each table position, create a 128-entry array (ASCII 0-127)
// mapping input byte -> output byte. 0xFF means unmapped.
let rust = `// Auto-generated AnimeKai substitution tables (${numTables} positions)
// Each table is 128 bytes: index = input ASCII byte, value = encrypted byte (0xFF = unmapped)

pub const NUM_TABLES: usize = ${numTables};

pub const ENCRYPT: [[u8; 128]; ${numTables}] = [\n`;

for (let pos = 0; pos < numTables; pos++) {
  const tbl = tables[pos];
  if (!tbl) {
    console.error(`WARNING: missing table for position ${pos}`);
    rust += `    [0xFF; 128],\n`;
    continue;
  }
  
  const arr = new Uint8Array(128).fill(0xFF);
  for (const [ch, byte] of Object.entries(tbl)) {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      arr[code] = byte;
    }
  }
  
  // Write as hex array
  const hex = Array.from(arr).map(b => '0x' + b.toString(16).padStart(2, '0'));
  // Split into rows of 16
  let lines = [];
  for (let i = 0; i < 128; i += 16) {
    lines.push('        ' + hex.slice(i, i + 16).join(','));
  }
  rust += `    [\n${lines.join(',\n')}\n    ],\n`;
}

rust += `];\n`;

fs.writeFileSync('rpi-proxy/rust-fetch/src/animekai_tables.rs', rust);
console.error(`Wrote rpi-proxy/rust-fetch/src/animekai_tables.rs`);
