#!/usr/bin/env node
/**
 * Build AnimeKai decrypt tables from known plaintext-ciphertext pairs.
 * 
 * We collect many encrypted responses and use known plaintext patterns to
 * build a mapping of (position, cipher_byte) → plaintext_char.
 * 
 * Known patterns:
 * - All responses start with: {"url":"https:\/\/
 * - All responses end with patterns like: ","skip":{"intro":[N,N],"outro":[N,N]}}
 * - URLs contain /e/ path
 * - Domain is consistent within a batch
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

async function getLinks(query, maxEps = 5) {
  const sr = await fetch(`https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent(query)}`, KAI_HDRS);
  const sd = JSON.parse(sr.body);
  const slugs = [...(sd.result?.html || '').matchAll(/href="\/watch\/([^"]+)"/g)].map(m => m[1]);
  if (!slugs.length) return [];
  
  const results = [];
  for (const slug of slugs.slice(0, 2)) {
    try {
      const wp = await fetch('https://animekai.to/watch/' + slug);
      const syncMatch = wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
      if (!syncMatch) continue;
      const sync = JSON.parse(syncMatch[1]);
      const animeId = sync.anime_id;
      
      const encId = rustExec(animeId, 'kai-encrypt');
      const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
      const epData = JSON.parse(epResp.body);
      if (!epData.result) continue;
      
      const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, maxEps);
      
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
            if (viewData.result) results.push(viewData.result);
          } catch {}
        }
      }
    } catch {}
  }
  return results;
}

const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function decodeToData(encrypted) {
  const b64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
  return buf.slice(21);
}

async function main() {
  console.log('Collecting encrypted samples from multiple anime...');
  
  const queries = ['bleach', 'naruto', 'one piece', 'dragon ball z', 'jujutsu kaisen', 'black butler', 'death note', 'attack on titan', 'demon slayer', 'spy x family'];
  const allEncrypted = [];
  
  for (const q of queries) {
    process.stdout.write(`  ${q}...`);
    try {
      const links = await getLinks(q, 1);
      console.log(` ${links.length} links`);
      allEncrypted.push(...links);
    } catch (e) {
      console.log(` error: ${e.message}`);
    }
    if (allEncrypted.length >= 20) break;
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\nTotal samples: ${allEncrypted.length}`);
  
  // Decode all to data bytes
  const samples = allEncrypted.map(enc => decodeToData(enc));
  
  // Known prefix: {"url":"https:\/\/
  const prefix = '{"url":"https:\\/\\/';
  
  // Build decrypt table entries from known prefix
  // decTable[position][cipherByte] = plainChar
  const decTable = {};
  
  for (let pos = 0; pos < prefix.length; pos++) {
    if (!decTable[pos]) decTable[pos] = {};
    const ch = prefix[pos];
    const cp = cipherPos(pos);
    for (const data of samples) {
      if (cp < data.length) {
        decTable[pos][data[cp]] = ch;
      }
    }
  }
  
  // Now figure out the domain. Positions 18+ should be the domain.
  // All samples from the same server should have the same domain.
  // Let's group samples by their bytes at positions 18-37 (constant region)
  const groups = {};
  for (let si = 0; si < samples.length; si++) {
    const data = samples[si];
    const key = [];
    for (let pos = 18; pos < 38; pos++) {
      const cp = cipherPos(pos);
      key.push(cp < data.length ? data[cp] : -1);
    }
    const keyStr = key.join(',');
    if (!groups[keyStr]) groups[keyStr] = [];
    groups[keyStr].push(si);
  }
  
  console.log('\nDomain groups:', Object.keys(groups).length);
  for (const [key, indices] of Object.entries(groups)) {
    console.log(`  Group (${indices.length} samples): indices ${indices.slice(0, 5).join(',')}`);
  }
  
  // Since all samples seem to have the same domain bytes (from previous test),
  // we need to figure out what domain it is.
  // From the Rust output we saw: 4spromax.site
  // Let's verify: the domain after https:// would be at positions 18+
  const domain = '4spromax.site';
  const afterPrefix = domain + '\\/e\\/';
  
  console.log('\nTesting domain:', domain);
  for (let i = 0; i < afterPrefix.length; i++) {
    const pos = prefix.length + i;
    const ch = afterPrefix[i];
    const cp = cipherPos(pos);
    
    if (!decTable[pos]) decTable[pos] = {};
    
    // Check if this char is consistent across all samples
    const bytes = samples.map(s => cp < s.length ? s[cp] : -1).filter(b => b >= 0);
    const unique = [...new Set(bytes)];
    
    if (unique.length === 1) {
      decTable[pos][unique[0]] = ch;
      console.log(`  pos ${pos}: byte=0x${unique[0].toString(16).padStart(2,'0')} → '${ch}' ✓ (all ${bytes.length} match)`);
    } else {
      console.log(`  pos ${pos}: ${unique.length} unique bytes → '${ch}' varies (expected for video ID part)`);
      // Still add the mapping for each byte
      // But we don't know which byte maps to which char here
      break;
    }
  }
  
  // After the video ID, we know the suffix pattern
  // ","skip":{"intro":[N,N],"outro":[N,N]}}
  // Let's find the suffix by looking at the end of samples
  
  // The suffix before the closing }} should be consistent in structure
  // Let's look at the last ~40 positions
  console.log('\n=== Analyzing suffix pattern ===');
  for (const data of samples.slice(0, 3)) {
    const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
    console.log(`  Sample: ${ptLen} plaintext chars, data ${data.length} bytes`);
    
    // Show last 50 cipher bytes at their positions
    const lastBytes = [];
    for (let pos = Math.max(0, ptLen - 50); pos < ptLen; pos++) {
      const cp = cipherPos(pos);
      if (cp < data.length) {
        lastBytes.push({ pos, byte: data[cp] });
      }
    }
    console.log(`  Last bytes: ${lastBytes.map(b => `${b.pos}:${b.byte.toString(16).padStart(2,'0')}`).join(' ')}`);
  }
  
  // The suffix ","skip":{"intro":[0,100],"outro":[1300,1385]}} has known chars
  // But the numbers vary. Let's look for the pattern "}}" at the end
  // The last 2 chars should be "}}" 
  
  // Actually, let's try a different approach: use the ENCRYPT tables we know work
  // to encrypt various characters and see which cipher bytes they produce.
  // Then match those against the server's cipher bytes.
  
  // Wait - our encrypt tables are ALSO wrong for the server's perspective.
  // The server accepted our encrypted tokens, but that's because the server
  // uses the SAME tables for validation that we use for encryption.
  // The server's RESPONSE encryption uses DIFFERENT tables.
  
  // So we need to build the server's encrypt tables from scratch.
  // We have: known_plaintext[pos] → cipher_byte[pos]
  // This gives us: server_encrypt_table[pos][known_char] = cipher_byte
  
  console.log('\n=== Building server encrypt tables ===');
  const serverEncrypt = {}; // pos → { char → byte }
  
  // From known prefix
  for (let pos = 0; pos < prefix.length; pos++) {
    if (!serverEncrypt[pos]) serverEncrypt[pos] = {};
    const ch = prefix[pos];
    const cp = cipherPos(pos);
    const byte = samples[0][cp]; // all samples have same byte for prefix
    serverEncrypt[pos][ch] = byte;
  }
  
  // From known domain
  for (let i = 0; i < afterPrefix.length; i++) {
    const pos = prefix.length + i;
    const ch = afterPrefix[i];
    const cp = cipherPos(pos);
    const bytes = samples.map(s => cp < s.length ? s[cp] : -1).filter(b => b >= 0);
    const unique = [...new Set(bytes)];
    if (unique.length === 1) {
      if (!serverEncrypt[pos]) serverEncrypt[pos] = {};
      serverEncrypt[pos][ch] = unique[0];
    }
  }
  
  // Now we need MORE known plaintext-ciphertext pairs at each position
  // to fill out the tables. We need samples where we know the exact plaintext.
  
  // Key insight: the video ID part varies between samples.
  // If we can figure out the video IDs, we get more table entries.
  // The video IDs are the embed IDs from MegaUp.
  
  // Actually, let's try yet another approach: 
  // We can ENCRYPT known strings using our working Rust encrypt,
  // send them to the server, and see if the server's response
  // gives us the same encrypted form back.
  
  // No wait - the simplest approach: we have 12+ samples where positions 0-37 are constant.
  // After position 37, the bytes vary (video ID). 
  // We need to figure out the video IDs to get more table entries.
  
  // The video IDs are the ones from the embed URLs.
  // We can get the embed URLs by... decrypting the responses. Chicken and egg.
  
  // BUT: we can partially decrypt! We know positions 0-37 decode to:
  // {"url":"https:\/\/4spromax.site\/e\/
  // That's 38 known chars. After that comes the video ID (varies per sample).
  // After the video ID comes: ","skip":{"intro":[...
  
  // For the varying part, we need to find where the video ID ends.
  // Video IDs are typically alphanumeric. After the ID, we expect: "
  // So we need to find the position where the byte maps to "
  
  // We know from position 1 that " maps to 0x6b (using table 95).
  // But at different positions, " maps to different bytes.
  // We need to find which positions have the byte that maps to " in their table.
  
  // This is getting complex. Let me just output what we have and build partial tables.
  
  console.log('\n=== Summary of known mappings ===');
  let totalEntries = 0;
  for (const [pos, entries] of Object.entries(serverEncrypt)) {
    totalEntries += Object.keys(entries).length;
  }
  console.log(`Known: ${Object.keys(serverEncrypt).length} positions, ${totalEntries} total entries`);
  
  // Save what we have
  const output = {
    knownPrefix: prefix,
    knownDomain: domain,
    serverEncrypt,
    decTable,
    sampleCount: samples.length,
    sampleLengths: samples.map(s => s.length),
  };
  
  fs.writeFileSync('scripts/kai-server-tables-partial.json', JSON.stringify(output, null, 2));
  console.log('Saved to scripts/kai-server-tables-partial.json');
  
  // Now let's try to fully decrypt one sample using what we know
  console.log('\n=== Attempting partial decrypt of first sample ===');
  const data = samples[0];
  const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
  let decrypted = '';
  
  for (let pos = 0; pos < ptLen; pos++) {
    const cp = cipherPos(pos);
    if (cp >= data.length) { decrypted += '?'; continue; }
    const byte = data[cp];
    
    if (decTable[pos] && decTable[pos][byte]) {
      decrypted += decTable[pos][byte];
    } else {
      decrypted += `[${byte.toString(16).padStart(2,'0')}]`;
    }
  }
  
  console.log('Partial decrypt:', decrypted);
}

main().catch(e => console.error('Fatal:', e));
