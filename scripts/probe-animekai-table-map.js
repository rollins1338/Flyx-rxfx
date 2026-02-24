#!/usr/bin/env node
/**
 * Figure out AnimeKai's current table-to-position mapping.
 * 
 * We know the plaintext starts with: {"url":"https://4spromax.site/e/...
 * We have the cipher bytes at each position.
 * We have 183 encrypt tables.
 * For each position, find which table maps the known plaintext char to the actual cipher byte.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };

function rustExec(url, mode) {
  return execFileSync(RUST, ['--url', url, '--mode', mode], { encoding: 'utf8', timeout: 5000 }).trim();
}

async function main() {
  // Get a real encrypted response
  const sr = await fetch('https://animekai.to/ajax/anime/search?keyword=bleach', KAI_HDRS);
  const sd = JSON.parse(sr.body);
  const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
  const wp = await fetch('https://animekai.to/watch/' + slug);
  const sync = JSON.parse(wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const animeId = sync.anime_id;
  
  const encId = rustExec(animeId, 'kai-encrypt');
  const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
  const epData = JSON.parse(epResp.body);
  const token = epData.result.match(/token="([^"]+)"/)[1];
  
  const encToken = rustExec(token, 'kai-encrypt');
  const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
  const srvData = JSON.parse(srvResp.body);
  
  // Get ALL lids (sub and dub)
  const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
  console.log('Found lids:', lids);

  // Get encrypted response for first lid
  const lid = lids[0];
  const encLid = rustExec(lid, 'kai-encrypt');
  const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
  const viewData = JSON.parse(viewResp.body);
  const encrypted = viewData.result;

  // Decode to bytes
  const b64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
  const data = buf.slice(21); // skip header

  // We know the output should be JSON like: {"url":"https://DOMAIN/e/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
  // From the Rust output we can see: 4spromax.site and the video path
  // The Rust output (with wrong tables) showed: |7B|22url|22|3A|22https|3A|5C|2F|5C|2F4spromax.site|5C|2Fe|5C...
  // This means the actual plaintext is: {"url":"https:\/\/4spromax.site\/e\/...","skip":{"intro":[0,100],"outro":[1300,1385]}}
  
  // But we need to figure out the EXACT plaintext. Let's use a different approach:
  // Load ALL 183 encrypt tables and for each cipher position, find which table(s) could produce the observed byte.
  
  // Load tables from the TS source
  const tablesFile = path.join(__dirname, '..', 'app', 'lib', 'animekai-crypto.ts');
  const fs = require('fs');
  const tsSource = fs.readFileSync(tablesFile, 'utf8');
  
  // Parse ENCRYPT_TABLES from TS source
  const tables = {};
  const tableRegex = /(\d+):\s*\{([^}]+)\}/g;
  let m;
  while ((m = tableRegex.exec(tsSource)) !== null) {
    const idx = parseInt(m[1]);
    if (idx > 200) continue; // skip non-table matches
    const entries = {};
    const entryRegex = /'([^']+)':(0x[0-9a-fA-F]+)/g;
    let em;
    while ((em = entryRegex.exec(m[2])) !== null) {
      entries[em[1]] = parseInt(em[2], 16);
    }
    if (Object.keys(entries).length > 10) {
      tables[idx] = entries;
    }
  }
  console.log('Loaded', Object.keys(tables).length, 'encrypt tables');

  // Build reverse tables: for each table, byte → char
  const reverseTables = {};
  for (const [idx, tbl] of Object.entries(tables)) {
    const rev = {};
    for (const [ch, byte] of Object.entries(tbl)) {
      rev[byte] = ch;
    }
    reverseTables[idx] = rev;
  }

  // cipher position mapping
  const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

  // For each plaintext position, find which table(s) can decrypt the cipher byte
  console.log('\n=== Table Mapping Discovery ===');
  console.log('For each plaintext position, which table decrypts the cipher byte?\n');

  const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
  console.log('Expected plaintext length:', ptLen);

  // We'll try to figure out the first ~30 chars
  // We know it starts with {"url":"https:\/\/
  const knownPrefix = '{"url":"https:\\/\\/';
  
  const tableMapping = {}; // position → table index

  for (let pos = 0; pos < Math.min(ptLen, 40); pos++) {
    const cp = cipherPos(pos);
    if (cp >= data.length) break;
    const cipherByte = data[cp];
    
    // Find all tables that have a reverse mapping for this byte
    const candidates = [];
    for (const [tableIdx, rev] of Object.entries(reverseTables)) {
      if (cipherByte in rev) {
        candidates.push({ table: parseInt(tableIdx), char: rev[cipherByte] });
      }
    }

    let knownChar = pos < knownPrefix.length ? knownPrefix[pos] : null;
    
    if (knownChar) {
      // Filter candidates to those that produce the known char
      const matching = candidates.filter(c => c.char === knownChar);
      if (matching.length > 0) {
        console.log(`  pos ${pos.toString().padStart(2)} (cp ${cp.toString().padStart(3)}) byte=0x${cipherByte.toString(16).padStart(2,'0')} → char '${knownChar}' → tables: [${matching.map(m => m.table).join(', ')}]`);
        tableMapping[pos] = matching.map(m => m.table);
      } else {
        console.log(`  pos ${pos.toString().padStart(2)} (cp ${cp.toString().padStart(3)}) byte=0x${cipherByte.toString(16).padStart(2,'0')} → expected '${knownChar}' → NO TABLE FOUND! candidates: ${candidates.map(c => `t${c.table}='${c.char}'`).slice(0, 5).join(', ')}`);
      }
    } else {
      // Unknown char - show all candidates
      const chars = [...new Set(candidates.map(c => c.char))];
      console.log(`  pos ${pos.toString().padStart(2)} (cp ${cp.toString().padStart(3)}) byte=0x${cipherByte.toString(16).padStart(2,'0')} → possible: ${candidates.map(c => `t${c.table}='${c.char}'`).slice(0, 8).join(', ')}`);
    }
  }

  // Now let's see if there's a pattern in the table mapping
  console.log('\n=== Table Mapping Pattern ===');
  console.log('Position → Table (old was position=table):');
  for (const [pos, tables] of Object.entries(tableMapping)) {
    if (tables.length === 1) {
      console.log(`  pos ${pos} → table ${tables[0]} (was table ${pos})`);
    } else {
      console.log(`  pos ${pos} → tables [${tables.join(', ')}] (was table ${pos})`);
    }
  }

  // Get a SECOND encrypted response to cross-reference
  console.log('\n=== Getting second sample for cross-reference ===');
  if (lids.length > 1) {
    const lid2 = lids[1];
    const encLid2 = rustExec(lid2, 'kai-encrypt');
    const viewResp2 = await fetch(`https://animekai.to/ajax/links/view?id=${lid2}&_=${encLid2}`, KAI_HDRS);
    const viewData2 = JSON.parse(viewResp2.body);
    const encrypted2 = viewData2.result;
    const buf2 = Buffer.from(encrypted2.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encrypted2.length % 4) % 4), 'base64');
    const data2 = buf2.slice(21);
    
    console.log('Second sample data length:', data2.length);
    
    // Both should start with {"url":"https:// 
    // Check if same tables work
    for (let pos = 0; pos < Math.min(18, knownPrefix.length); pos++) {
      const cp = cipherPos(pos);
      if (cp >= data2.length) break;
      const byte1 = data[cp];
      const byte2 = data2[cp];
      const knownChar = knownPrefix[pos];
      
      // Check if same table works for both
      const matching1 = [];
      const matching2 = [];
      for (const [tableIdx, rev] of Object.entries(reverseTables)) {
        if (byte1 in rev && rev[byte1] === knownChar) matching1.push(parseInt(tableIdx));
        if (byte2 in rev && rev[byte2] === knownChar) matching2.push(parseInt(tableIdx));
      }
      const common = matching1.filter(t => matching2.includes(t));
      console.log(`  pos ${pos}: byte1=0x${byte1.toString(16).padStart(2,'0')} byte2=0x${byte2.toString(16).padStart(2,'0')} → common tables: [${common.join(', ')}]`);
    }
  }
}

main().catch(e => console.error('Fatal:', e));
