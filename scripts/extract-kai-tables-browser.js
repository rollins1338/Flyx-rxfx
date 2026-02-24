#!/usr/bin/env node
/**
 * Extract AnimeKai's current encryption tables by brute-forcing through the API.
 * 
 * Strategy: We know the server accepts our Rust-encrypted tokens (encrypt works).
 * The server's RESPONSE is encrypted with potentially different tables.
 * 
 * To extract the server's encrypt tables, we need known plaintext-ciphertext pairs.
 * We can get these by:
 * 1. Getting multiple link/view responses (we know they contain URLs)
 * 2. The URLs follow a pattern: {"url":"https://DOMAIN/e/VIDEO_ID","skip":{...}}
 * 3. The first chars are always: {"url":"https:\/\/
 * 
 * With enough samples, we can determine the exact table for each position.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

function rustExec(url, mode) {
  return execFileSync(RUST, ['--url', url, '--mode', mode], { encoding: 'utf8', timeout: 5000 }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };

async function getEncryptedLinks(query) {
  const sr = await fetch(`https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent(query)}`, KAI_HDRS);
  const sd = JSON.parse(sr.body);
  const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
  if (!slug) return [];
  
  const wp = await fetch('https://animekai.to/watch/' + slug);
  const sync = JSON.parse(wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const animeId = sync.anime_id;
  
  const encId = rustExec(animeId, 'kai-encrypt');
  const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
  const epData = JSON.parse(epResp.body);
  
  // Get first 3 episode tokens
  const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, 3);
  
  const results = [];
  for (const token of tokens) {
    const encToken = rustExec(token, 'kai-encrypt');
    const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
    const srvData = JSON.parse(srvResp.body);
    if (!srvData.result) continue;
    
    const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
    for (const lid of lids) {
      try {
        const encLid = rustExec(lid, 'kai-encrypt');
        const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
        const viewData = JSON.parse(viewResp.body);
        if (viewData.result) {
          results.push(viewData.result);
        }
      } catch {}
    }
    if (results.length >= 6) break;
  }
  return results;
}

async function main() {
  console.log('Collecting encrypted link responses...');
  
  // Collect from multiple anime to get diverse samples
  const queries = ['bleach', 'naruto', 'one piece'];
  const allEncrypted = [];
  
  for (const q of queries) {
    console.log(`  Searching: ${q}`);
    try {
      const links = await getEncryptedLinks(q);
      console.log(`    Got ${links.length} encrypted responses`);
      allEncrypted.push(...links);
    } catch (e) {
      console.log(`    Error: ${e.message}`);
    }
    if (allEncrypted.length >= 10) break;
  }
  
  console.log(`\nTotal samples: ${allEncrypted.length}`);
  
  // Decode all samples to raw bytes
  const samples = allEncrypted.map(enc => {
    const b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
    return buf.slice(21); // skip header
  });
  
  const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);
  
  // Known plaintext prefix: {"url":"https:\/\/
  // All responses should start with this
  const knownPrefix = '{"url":"https:\\/\\/';
  
  // Build partial decrypt table from known prefix
  console.log('\n=== Building decrypt tables from known plaintext ===');
  const decryptTables = {}; // position → { cipherByte → plainChar }
  
  for (let pos = 0; pos < knownPrefix.length; pos++) {
    const expectedChar = knownPrefix[pos];
    decryptTables[pos] = {};
    
    for (const data of samples) {
      const cp = cipherPos(pos);
      if (cp >= data.length) continue;
      const cipherByte = data[cp];
      decryptTables[pos][cipherByte] = expectedChar;
    }
  }
  
  // For positions beyond the known prefix, we need to figure out the domain
  // All samples should have the same domain structure
  // Let's see what bytes appear at each position across samples
  console.log('\n=== Analyzing byte patterns across samples ===');
  const maxPos = Math.min(...samples.map(s => s.length > 20 ? 7 + (s.length - 20) : 1));
  
  for (let pos = 0; pos < Math.min(maxPos, 50); pos++) {
    const cp = cipherPos(pos);
    const bytes = samples.map(s => cp < s.length ? s[cp] : -1).filter(b => b >= 0);
    const unique = [...new Set(bytes)];
    
    if (unique.length === 1) {
      // Same byte in all samples = same plaintext char at this position
      const byte = unique[0];
      const known = decryptTables[pos]?.[byte];
      console.log(`  pos ${pos.toString().padStart(2)}: byte=0x${byte.toString(16).padStart(2,'0')} (same in all ${bytes.length} samples)${known ? ` = '${known}'` : ''}`);
    } else {
      // Different bytes = different plaintext chars (e.g., different video IDs)
      console.log(`  pos ${pos.toString().padStart(2)}: ${unique.length} unique bytes across ${bytes.length} samples (varies)`);
    }
  }
  
  // Now the key insight: positions where ALL samples have the SAME byte
  // correspond to the SAME plaintext character.
  // The known prefix gives us: {"url":"https:\/\/
  // After that, the domain varies per server but might be consistent within a batch
  
  // Let's try to decrypt using the pattern:
  // The response format is: {"url":"https:\/\/DOMAIN\/e\/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
  // After the domain+path, we know: ","skip":{"intro":[
  
  // Let me find where the domain ends by looking for varying bytes
  let domainEnd = knownPrefix.length;
  for (let pos = knownPrefix.length; pos < maxPos; pos++) {
    const cp = cipherPos(pos);
    const bytes = samples.map(s => cp < s.length ? s[cp] : -1).filter(b => b >= 0);
    const unique = [...new Set(bytes)];
    if (unique.length > 1) {
      // This position varies - could be start of video ID or domain difference
      domainEnd = pos;
      break;
    }
  }
  console.log('\nFirst varying position:', domainEnd);
  
  // All constant positions from prefix to domainEnd give us more known plaintext
  // Let's figure out what the constant bytes decode to
  // We need the actual tables for this...
  
  // NEW APPROACH: Since we have the old tables and they're wrong,
  // let's figure out the PERMUTATION.
  // Maybe the tables are the same but the position→table mapping changed.
  // Or maybe there's a key-based permutation.
  
  // Load old tables
  const tsSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'lib', 'animekai-crypto.ts'), 'utf8');
  const oldTables = {};
  const tableRegex = /(\d+):\s*\{([^}]+)\}/g;
  let m;
  while ((m = tableRegex.exec(tsSource)) !== null) {
    const idx = parseInt(m[1]);
    if (idx > 200) continue;
    const entries = {};
    const entryRegex = /'([^']+)':(0x[0-9a-fA-F]+)/g;
    let em;
    while ((em = entryRegex.exec(m[2])) !== null) {
      entries[em[1]] = parseInt(em[2], 16);
    }
    if (Object.keys(entries).length > 10) {
      oldTables[idx] = entries;
    }
  }
  console.log('Loaded', Object.keys(oldTables).length, 'old tables');
  
  // Build reverse old tables
  const oldReverse = {};
  for (const [idx, tbl] of Object.entries(oldTables)) {
    const rev = {};
    for (const [ch, byte] of Object.entries(tbl)) {
      rev[byte] = ch;
    }
    oldReverse[idx] = rev;
  }
  
  // For each known position, find which old table maps the cipher byte to the known char
  console.log('\n=== Finding table permutation ===');
  const tableMap = {}; // position → old table index
  
  for (let pos = 0; pos < knownPrefix.length; pos++) {
    const expectedChar = knownPrefix[pos];
    const cp = cipherPos(pos);
    
    // Get cipher byte from first sample
    const cipherByte = samples[0][cp];
    
    // Find which old table has this mapping
    const matching = [];
    for (const [tableIdx, tbl] of Object.entries(oldTables)) {
      if (tbl[expectedChar] === cipherByte) {
        matching.push(parseInt(tableIdx));
      }
    }
    
    // Verify with other samples (all should have same byte for known prefix)
    const allMatch = samples.every(s => cp < s.length && s[cp] === cipherByte);
    
    console.log(`  pos ${pos.toString().padStart(2)} char='${expectedChar}' byte=0x${cipherByte.toString(16).padStart(2,'0')} → old tables: [${matching.join(',')}] (all samples match: ${allMatch})`);
    
    if (matching.length === 1) {
      tableMap[pos] = matching[0];
    } else if (matching.length > 1) {
      tableMap[pos] = matching; // ambiguous, need more data
    }
  }
  
  console.log('\n=== Determined table mapping ===');
  for (const [pos, table] of Object.entries(tableMap)) {
    if (Array.isArray(table)) {
      console.log(`  pos ${pos} → tables [${table.join(',')}] (ambiguous)`);
    } else {
      console.log(`  pos ${pos} → table ${table} (was table ${pos})`);
    }
  }
  
  // Check if there's a pattern (e.g., rotation, permutation based on key)
  const definite = Object.entries(tableMap).filter(([_, v]) => !Array.isArray(v));
  if (definite.length > 0) {
    console.log('\nDefinite mappings:');
    const offsets = definite.map(([pos, table]) => ({ pos: parseInt(pos), table, offset: table - parseInt(pos) }));
    offsets.forEach(o => console.log(`  pos ${o.pos} → table ${o.table} (offset: ${o.offset >= 0 ? '+' : ''}${o.offset})`));
    
    // Check if all offsets are the same (simple rotation)
    const uniqueOffsets = [...new Set(offsets.map(o => o.offset))];
    if (uniqueOffsets.length === 1) {
      console.log(`\n*** SIMPLE ROTATION: all tables shifted by ${uniqueOffsets[0]} ***`);
    } else {
      console.log('\nNo simple rotation pattern. Offsets vary.');
    }
  }
}

main().catch(e => console.error('Fatal:', e));
