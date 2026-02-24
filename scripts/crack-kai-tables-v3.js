#!/usr/bin/env node
/**
 * Crack AnimeKai decrypt tables v3.
 * 
 * NEW APPROACH: Get the same episode from BOTH AnimeKai (encrypted) and
 * directly from MegaUp (by finding the embed URL through other means).
 * 
 * The MegaUp embed page at /e/VIDEO_ID contains a script that calls
 * /media/VIDEO_ID to get the actual stream. If we can find the video ID
 * by any means, we can build the tables.
 * 
 * Strategy:
 * 1. Get encrypted response from AnimeKai for a specific episode
 * 2. Try to access the MegaUp embed page to find the video ID
 * 3. Use the known video ID to build table entries
 * 
 * Alternative: Use the fact that MegaUp video IDs are base64url-encoded
 * and try to decode the cipher bytes using frequency analysis.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
}

function rfSafe(url, mode = 'fetch', extra = {}) {
  try { return rf(url, mode, extra); }
  catch (err) { if (err.stdout?.trim()) return err.stdout.trim(); throw err; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'], {
    encoding: 'utf8', timeout: 5000, windowsHide: true
  }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function b64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

function ptLen(dl) {
  if (dl > 20) return 7 + (dl - 20);
  if (dl > 19) return 7; if (dl > 17) return 6; if (dl > 15) return 5;
  if (dl > 13) return 4; if (dl > 11) return 3; if (dl > 7) return 2;
  if (dl > 0) return 1; return 0;
}

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rfSafe(`${domain}${urlPath}`, 'fetch', { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}


async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  CRACK ANIMEKAI TABLES v3 — MEGAUP DIRECT ACCESS     ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Step 1: Get a fresh encrypted sample
  console.log('Step 1: Getting encrypted sample from AnimeKai...');
  
  const searchData = kaiFetch('/ajax/anime/search?keyword=bleach');
  const slug = searchData.result.html.match(/href="\/watch\/([^"]+)"/)?.[1];
  
  let contentId = null;
  for (const domain of KAI_DOMAINS) {
    try {
      const watchHtml = rfSafe(`${domain}/watch/${slug}`, 'fetch', { 'Referer': `${domain}/` });
      const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
      if (syncMatch) { contentId = JSON.parse(syncMatch[1]).anime_id; break; }
    } catch {}
  }
  console.log(`  Content ID: ${contentId}`);

  const encId = kaiEncrypt(contentId);
  const epData = kaiFetch(`/ajax/episodes/list?ani_id=${contentId}&_=${encId}`);
  const token = epData.result.match(/num="1"[^>]*token="([^"]+)"/)?.[1] || epData.result.match(/token="([^"]+)"/)?.[1];
  
  const encToken = kaiEncrypt(token);
  const srvData = kaiFetch(`/ajax/links/list?token=${token}&_=${encToken}`);
  
  // Get the first sub server lid
  const subSection = srvData.result.match(/data-id="sub"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const firstLid = subSection.match(/data-lid="([^"]+)"/)?.[1];
  console.log(`  First sub lid: ${firstLid}`);
  
  const encLid = kaiEncrypt(firstLid);
  const viewResp = kaiFetch(`/ajax/links/view?id=${firstLid}&_=${encLid}`);
  const encrypted = viewResp.result;
  
  const raw = b64Decode(encrypted);
  const cipherData = raw.slice(21);
  const pl = ptLen(cipherData.length);
  console.log(`  Encrypted length: ${encrypted.length}, cipherData: ${cipherData.length}, ptLen: ${pl}`);
  console.log(`  Cipher hex: ${cipherData.toString('hex').substring(0, 80)}...`);

  // Step 2: Try to access MegaUp directly
  // The encrypted response decrypts to: {"url":"https://megaup22.online/e/VIDEO_ID","skip":{...}}
  // Let's try to find the video ID by accessing MegaUp's search/listing API
  
  console.log('\nStep 2: Trying to find MegaUp video ID...');
  
  // Try fetching the MegaUp homepage or API
  try {
    const megaupHome = rfSafe('https://megaup22.online/', 'fetch', { 'Referer': 'https://animekai.to/' });
    console.log(`  MegaUp home: ${megaupHome.substring(0, 200)}...`);
  } catch (e) {
    console.log(`  MegaUp home error: ${e.message?.substring(0, 100)}`);
  }

  // Step 3: Alternative approach — use the OLD encrypt tables to figure out the mapping
  // The OLD encrypt tables map: plaintext char → cipher byte (for encryption)
  // The NEW server response uses DIFFERENT tables
  // But maybe we can figure out the relationship
  
  // Actually, let's try something clever:
  // We know the prefix maps to specific cipher bytes.
  // For position 0: plaintext '{' → cipher byte 0xd4
  // This means the NEW decrypt table for position 0 maps: 0xd4 → '{'
  // And the OLD encrypt table for position 0 maps: '{' → 0xd4
  // So for position 0, the OLD and NEW tables AGREE!
  
  // Let's check: do the OLD encrypt tables match the NEW cipher bytes for the prefix?
  console.log('\nStep 3: Comparing OLD encrypt tables with NEW cipher bytes...');
  
  const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
  const oldTables = loadOldEncryptTables();
  
  let matches = 0, mismatches = 0;
  for (let i = 0; i < prefix.length; i++) {
    const cp = cipherPos(i);
    const actualByte = cipherData[cp];
    const expectedByte = oldTables[i]?.[prefix[i]];
    const match = actualByte === expectedByte;
    if (match) matches++; else mismatches++;
    if (!match && expectedByte !== undefined) {
      console.log(`  pos ${i}: char '${prefix[i]}' → actual 0x${actualByte.toString(16)} vs old 0x${expectedByte.toString(16)} ${match ? '✓' : '✗'}`);
    }
  }
  console.log(`  Prefix: ${matches} matches, ${mismatches} mismatches out of ${prefix.length}`);
  
  if (mismatches === 0) {
    console.log('\n  ★★★ OLD ENCRYPT TABLES MATCH NEW CIPHER BYTES! ★★★');
    console.log('  This means the ENCRYPT direction hasn\'t changed!');
    console.log('  The DECRYPT tables should be the INVERSE of the encrypt tables!');
    
    // If encrypt tables haven't changed, then decrypt = inverse of encrypt
    // Let's verify by trying to decrypt using inverse of old encrypt tables
    console.log('\n  Trying to decrypt using inverse of old encrypt tables...');
    
    let decrypted = '';
    for (let i = 0; i < pl; i++) {
      const cp = cipherPos(i);
      if (cp >= cipherData.length) break;
      const byte = cipherData[cp];
      
      // Find the char that maps to this byte in the old encrypt table
      let found = false;
      if (oldTables[i]) {
        for (const [char, encByte] of Object.entries(oldTables[i])) {
          if (encByte === byte) {
            decrypted += char;
            found = true;
            break;
          }
        }
      }
      if (!found) decrypted += '?';
    }
    
    console.log(`  Decrypted: ${decrypted.substring(0, 100)}...`);
    console.log(`  Full: ${decrypted}`);
    
    // Check if it looks like valid JSON
    if (decrypted.startsWith('{"url"')) {
      console.log('\n  ★★★ DECRYPTION SUCCESSFUL! ★★★');
      console.log('  The old encrypt tables ARE the correct tables!');
      console.log('  The decrypt tables are just the inverse!');
    }
  } else {
    console.log('\n  Old encrypt tables do NOT match. Tables have changed.');
    console.log('  Need to figure out the new tables from scratch.');
  }
}

function loadOldEncryptTables() {
  // Load the old encrypt tables from the TS file
  // These are in app/lib/animekai-crypto.ts as ENCRYPT_TABLES
  const content = fs.readFileSync('app/lib/animekai-crypto.ts', 'utf8');
  
  // Parse the tables - they're in format: N: {'char': 0xHH, ...}
  const tables = {};
  const tableRe = /(\d+):\s*\{([^}]+)\}/g;
  let m;
  while ((m = tableRe.exec(content)) !== null) {
    const pos = parseInt(m[1]);
    const entries = m[2];
    tables[pos] = {};
    
    // Parse entries like 'char':0xHH
    const entryRe = /'([^'\\]|\\.)':0x([0-9a-f]+)/g;
    let em;
    while ((em = entryRe.exec(entries)) !== null) {
      let char = em[1];
      if (char === '\\\\') char = '\\';
      else if (char === "\\'") char = "'";
      const byte = parseInt(em[2], 16);
      tables[pos][char] = byte;
    }
  }
  
  console.log(`  Loaded ${Object.keys(tables).length} old encrypt tables`);
  return tables;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
