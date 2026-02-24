#!/usr/bin/env node
/**
 * Use the browser to decrypt AnimeKai responses.
 * 
 * Strategy: Load the AnimeKai page, intercept the AJAX calls,
 * and capture both the encrypted response AND the decrypted result.
 * This gives us plaintext-ciphertext pairs to build full tables.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', 'fetch', '--timeout', '15',
    '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, {
      encoding: 'utf8', timeout: 25000,
      maxBuffer: 10*1024*1024, windowsHide: true
    }).trim();
  } catch(e) { return e.stdout?.trim() || ''; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

function b64decode(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - std.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

function cipherPos(i) {
  if (i === 0) return 0;
  if (i === 1) return 7;
  if (i === 2) return 11;
  if (i === 3) return 13;
  if (i === 4) return 15;
  if (i === 5) return 17;
  if (i === 6) return 19;
  return 20 + (i - 7);
}

const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

async function main() {
  // Strategy: We know the encrypted responses. We need the plaintext.
  // The plaintext is a JSON like {"url":"https://DOMAIN/path?params"}
  // 
  // Instead of using the browser, let me try a different approach:
  // The embed URLs follow known patterns. If I can figure out which
  // embed server each lid corresponds to, I can narrow down the URL.
  //
  // Actually, let me try the simplest approach first:
  // Use the EXISTING encrypt function to build a FULL table.
  // For each position and each ASCII char, encrypt it and record the cipher byte.
  
  console.log('=== Building full encryption tables from Rust encrypt ===\n');
  
  // For each position (0-182), encrypt a string where that position has each possible char
  // We need strings of the right length to test each position
  
  const tables = {};
  const maxPos = 100; // Test first 100 positions
  
  for (let pos = 0; pos < maxPos; pos++) {
    tables[pos] = {};
    
    // Build a test string of length pos+1
    // Fill with 'a' for all positions except the target
    const baseChars = new Array(pos + 1).fill('a'.charCodeAt(0));
    
    // For each possible ASCII char at this position
    for (let ch = 32; ch < 127; ch++) {
      baseChars[pos] = ch;
      const testStr = String.fromCharCode(...baseChars);
      
      try {
        const enc = kaiEncrypt(testStr);
        const buf = b64decode(enc);
        const data = buf.subarray(21);
        const cp = cipherPos(pos);
        
        if (cp < data.length) {
          tables[pos][ch] = data[cp];
        }
      } catch(e) {
        // Skip errors
      }
    }
    
    const mappings = Object.keys(tables[pos]).length;
    if (pos < 20 || pos % 10 === 0) {
      // Check if it's a bijection (one-to-one)
      const values = Object.values(tables[pos]);
      const uniqueValues = new Set(values);
      const isBijection = values.length === uniqueValues.size;
      console.log(`Position ${pos}: ${mappings} mappings, bijection: ${isBijection}`);
      
      if (!isBijection) {
        // Find collisions
        const byValue = {};
        for (const [ch, val] of Object.entries(tables[pos])) {
          if (!byValue[val]) byValue[val] = [];
          byValue[val].push(Number(ch));
        }
        for (const [val, chars] of Object.entries(byValue)) {
          if (chars.length > 1) {
            console.log(`  Collision: cipher ${val} <- chars ${chars.map(c => String.fromCharCode(c)).join(',')}`);
          }
        }
      }
    }
  }
  
  // Now we have the FULL encrypt tables from our Rust code
  // Let's verify against the server's encrypted responses
  console.log('\n=== Verifying against server responses ===\n');
  
  const data = JSON.parse(fs.readFileSync('scripts/kai-server-tables.json', 'utf8'));
  
  // For each sample, check if our tables match the server's cipher bytes
  // at the known plaintext positions (0-15 = '{"url":"https://')
  const knownPrefix = '{"url":"https://';
  
  let matchCount = 0;
  let mismatchCount = 0;
  
  for (const sample of data.samples.slice(0, 5)) {
    const buf = b64decode(sample.encrypted);
    const sdata = buf.subarray(21);
    
    console.log(`Sample: ${sample.keyword} (lid=${sample.lid})`);
    
    for (let i = 0; i < knownPrefix.length; i++) {
      const ch = knownPrefix.charCodeAt(i);
      const cp = cipherPos(i);
      const serverByte = sdata[cp];
      const ourByte = tables[i]?.[ch];
      
      const match = serverByte === ourByte;
      if (!match) {
        console.log(`  pos ${i}: char '${knownPrefix[i]}' (${ch}) -> server=${serverByte} our=${ourByte} MISMATCH`);
        mismatchCount++;
      } else {
        matchCount++;
      }
    }
  }
  
  console.log(`\nMatches: ${matchCount}, Mismatches: ${mismatchCount}`);
  
  if (mismatchCount === 0) {
    console.log('\nOur encryption tables MATCH the server! The server uses the SAME cipher.');
    console.log('This means we can build decrypt tables by inverting our encrypt tables.');
    
    // Build and save the full tables
    console.log('\n=== Building full decrypt tables ===');
    
    // Check if all positions have bijective mappings
    let allBijective = true;
    for (let pos = 0; pos < maxPos; pos++) {
      const values = Object.values(tables[pos]);
      const uniqueValues = new Set(values);
      if (values.length !== uniqueValues.size) {
        console.log(`Position ${pos} is NOT bijective!`);
        allBijective = false;
      }
    }
    
    if (allBijective) {
      console.log('All positions are bijective! Building inverse tables...');
      
      // Save the tables
      fs.writeFileSync('scripts/kai-full-tables.json', JSON.stringify(tables, null, 2));
      console.log('Saved full tables to kai-full-tables.json');
    }
  } else {
    console.log('\nTables DO NOT match. Server uses different encryption.');
    console.log('Need to figure out the server\'s actual cipher.');
  }
}

main().catch(e => console.error('Fatal:', e));
