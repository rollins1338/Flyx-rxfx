#!/usr/bin/env node
/**
 * Crack AnimeKai's table permutation.
 * 
 * The bundle.js contains p_mLjDq(129, 39, [129]) which generates a permutation.
 * This permutation likely determines which table is used at which position.
 * 
 * We also need to figure out if the server uses a DIFFERENT permutation than the client.
 */

const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

// ═══════════════════════════════════════════════════════════
// p_mLjDq — the shuffle function from the bundle
// ═══════════════════════════════════════════════════════════

function p_mLjDq(h, r, e) {
  var K = [];
  var b, k, n;
  var c, t, i;
  var v, s;

  // Create h empty arrays
  for (b = 0; b < h; b++) K[b] = [];

  // Main loop
  for (k = 0; k < h; k++) {
    n = h - 1; // 128
    // while n >= 0
    while (n >= 0) {
      c = 0;
      t = 0;
      i = t; // i = 0
      t = e[c]; // t = 129
      c++;      // c = 1
      // while n >= t
      while (n >= t) {
        i = t;
        t = e[c];
        c++;
      }
      // Now: i = lower bound, t = upper bound (or e[c-1])
      // But e only has one element [129], so after first iteration:
      // i = 0, t = 129, c = 1
      // n >= t? 128 >= 129? NO → exit inner while
      
      v = t - i; // v = 129 - 0 = 129
      s = i + (n - i + r * k) % v;
      // s = 0 + (n - 0 + 39 * k) % 129
      // s = (n + 39*k) % 129
      
      K[k][s] = K[n]; // Wait, K[n] is an array... this assigns the array reference
      // Actually no — looking more carefully, K[k] is an array and K[k][s] sets element at index s
      // But K[n] is also an array... so K[k][s] = K[n] means K[k][s] gets the array K[n]
      // This doesn't make sense for a simple permutation...
      
      // Wait, let me re-read the original code more carefully
      // case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; break;
      // Hmm, K[k][s] = K[n] — this is setting position s in row k to the VALUE at row n
      // But initially all rows are empty arrays...
      // 
      // Actually I think this is building a PERMUTATION MATRIX.
      // K[k][s] = K[n] means: in row k, position s gets whatever was in row n
      // But since K[n] starts as [], this would just be setting K[k][s] = []
      // That can't be right...
      
      // Let me re-read the ORIGINAL deobfuscated code:
      // case 22: s=i+(n-i+r*k)%v; K[k][s]=K[n]; G=35; break;
      // case 35: n-=1; G=18; break;
      // 
      // So after setting K[k][s] = K[n], it decrements n and loops back.
      // This means for each k, it iterates n from h-1 down to 0,
      // placing K[n] at position s = (n + 39*k) % 129 in K[k].
      //
      // But K[n] is the ARRAY at index n, not a scalar.
      // So K[k] becomes an array of arrays.
      // K[k][(n + 39*k) % 129] = K[n] for n = 128, 127, ..., 0
      //
      // Wait, but K[n] was initialized as [] and never modified before being read...
      // Unless the assignment K[k][s] = K[n] is modifying K[n] through reference?
      // No, it's just storing a reference.
      //
      // Actually, I think the function is meant to be called differently.
      // Let me look at how it's USED in the bundle.
      
      n -= 1;
    }
  }
  
  return K;
}

// Let's just run it and see what we get
console.log('=== Running p_mLjDq(129, 39, [129]) ===\n');
const result = p_mLjDq(129, 39, [129]);
console.log('Result: array of', result.length, 'elements');
console.log('First element length:', result[0].length);
console.log('First element:', JSON.stringify(result[0].slice(0, 10)));

// Each K[k] should have 129 entries (one for each n from 0 to 128)
// K[k][(n + 39*k) % 129] = K[n]
// Since K[n] = [] initially, every entry is []
// This means the function just creates a structure of empty arrays...
// Unless it's meant to be used as a permutation INDEX generator

// Let me think about this differently.
// Maybe the function is used to generate a permutation of INDICES.
// The key formula is: s = (n + 39*k) % 129
// For k=0: s = n % 129 = n (identity)
// For k=1: s = (n + 39) % 129
// For k=2: s = (n + 78) % 129
// etc.

// So for each "row" k, the permutation is a rotation by 39*k positions.
// This is a simple cyclic permutation!

console.log('\n=== Permutation analysis ===');
for (let k = 0; k < 5; k++) {
  const perm = [];
  for (let n = 128; n >= 0; n--) {
    const s = (n + 39 * k) % 129;
    perm.push({ from: n, to: s });
  }
  // Show where 0,1,2,3,4 map to
  console.log(`k=${k}: 0→${(0 + 39*k) % 129}, 1→${(1 + 39*k) % 129}, 2→${(2 + 39*k) % 129}, 3→${(3 + 39*k) % 129}`);
}

// Now the question is: HOW is this permutation used?
// The bundle calls _.G3v() and _.K76() which are wrappers for p_mLjDq.
// These are called with different arguments each time.

// Let me search the bundle for how G3v/K76 are called
console.log('\n=== Searching bundle for G3v/K76 usage ===');
const bundlePath = path.join(__dirname, 'animekai-crypto-bundle-1771726946134.js');
if (fs.existsSync(bundlePath)) {
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  
  // Find all calls to G3v and K76
  const g3vCalls = [...bundle.matchAll(/\.G3v\(([^)]+)\)/g)];
  const k76Calls = [...bundle.matchAll(/\.K76\(([^)]+)\)/g)];
  
  console.log(`Found ${g3vCalls.length} G3v calls, ${k76Calls.length} K76 calls`);
  
  // Show the arguments
  for (const m of g3vCalls.slice(0, 20)) {
    console.log(`  G3v(${m[1]})`);
  }
  for (const m of k76Calls.slice(0, 20)) {
    console.log(`  K76(${m[1]})`);
  }
  
  // Also search for the encrypt/decrypt function patterns
  // Look for base64 encode/decode patterns near the crypto code
  const b64Patterns = [...bundle.matchAll(/btoa|atob|base64|fromCharCode/g)];
  console.log(`\nFound ${b64Patterns.length} base64-related patterns`);
  
  // Search for the actual encrypt function
  // It should take a string, apply substitution tables, and return base64
  // Look for patterns like: charCodeAt, fromCharCode near table lookups
  
  // Find the section that handles the _ parameter encryption
  const encPatterns = [...bundle.matchAll(/[_a-zA-Z]\[(\d+)\]\[([^[\]]+)\.charCodeAt/g)];
  console.log(`Found ${encPatterns.length} charCodeAt table lookup patterns`);
  for (const m of encPatterns.slice(0, 10)) {
    console.log(`  Table[${m[1]}][...charCodeAt]: ${m[0].substring(0, 80)}`);
  }
  
  // Search for the decrypt pattern (reverse lookup)
  const decPatterns = [...bundle.matchAll(/indexOf|findIndex|reverse/g)];
  console.log(`Found ${decPatterns.length} reverse lookup patterns`);
  
} else {
  console.log('Bundle not found at:', bundlePath);
}

// ═══════════════════════════════════════════════════════════
// EMPIRICAL APPROACH: Collect samples and build tables
// ═══════════════════════════════════════════════════════════

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    mod.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

function rustFetch(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '15', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function urlSafeB64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

async function collectSamples() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  COLLECTING ENCRYPTED SAMPLES WITH KNOWN PLAINTEXT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const pairs = []; // { plaintext, cipherData, encrypted }
  
  // For each anime, get link/view responses AND independently get the actual embed URLs
  const queries = [
    'bleach', 'naruto', 'one piece', 'dragon ball z', 'jujutsu kaisen',
    'death note', 'attack on titan', 'demon slayer', 'fullmetal alchemist',
    'hunter x hunter', 'my hero academia', 'sword art online',
    'tokyo ghoul', 'one punch man', 'mob psycho 100',
  ];
  
  for (const query of queries) {
    console.log(`\nProcessing: ${query}`);
    try {
      // Search
      const sr = await fetch(`https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent(query)}`, KAI_HDRS);
      if (sr.status !== 200) { console.log('  Search failed:', sr.status); continue; }
      const sd = JSON.parse(sr.body);
      const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
      if (!slug) { console.log('  No slug found'); continue; }
      
      // Get anime_id
      const wp = await fetch('https://animekai.to/watch/' + slug);
      const syncMatch = wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
      if (!syncMatch) { console.log('  No syncData'); continue; }
      const sync = JSON.parse(syncMatch[1]);
      const animeId = sync.anime_id;
      
      // Get episodes
      const encId = rustExec(animeId, 'kai-encrypt');
      const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
      const epData = JSON.parse(epResp.body);
      if (!epData.result) { console.log('  No episodes'); continue; }
      
      // Get first 2 episode tokens
      const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, 2);
      
      for (const token of tokens) {
        const encToken = rustExec(token, 'kai-encrypt');
        const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
        const srvData = JSON.parse(srvResp.body);
        if (!srvData.result) continue;
        
        const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
        
        for (const lid of lids.slice(0, 3)) {
          try {
            const encLid = rustExec(lid, 'kai-encrypt');
            const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
            const viewData = JSON.parse(viewResp.body);
            if (!viewData.result) continue;
            
            const encrypted = viewData.result;
            const cipherData = urlSafeB64Decode(encrypted).slice(21);
            
            // Now try to get the ACTUAL embed URL by fetching the MegaUp page
            // We know the response format: {"url":"https://DOMAIN/e/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
            // We can try to decrypt with megaup mode to get the actual URL
            
            pairs.push({ encrypted, cipherData, query, lid });
            console.log(`  Got sample: lid=${lid} cipherLen=${cipherData.length}`);
          } catch (e) {
            // Skip errors
          }
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
    
    if (pairs.length >= 40) break;
  }
  
  console.log(`\nTotal samples: ${pairs.length}`);
  return pairs;
}

async function buildTablesFromSamples(pairs) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BUILDING TABLES FROM KNOWN PLAINTEXT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // We know the plaintext starts with: {"url":"https:\/\/
  // After that comes the domain (e.g., 4spromax.site) then /e/ then video ID
  // Then: ","skip":{"intro":[N,N],"outro":[N,N]}}
  
  // First, let's check if all samples have the same bytes at the known prefix positions
  const prefix = '{"url":"https:\\/\\/';
  console.log(`Known prefix (${prefix.length} chars): ${prefix}`);
  
  // Check consistency at prefix positions
  for (let pos = 0; pos < prefix.length; pos++) {
    const cp = cipherPos(pos);
    const bytes = pairs.map(p => cp < p.cipherData.length ? p.cipherData[cp] : -1).filter(b => b >= 0);
    const unique = [...new Set(bytes)];
    const expected = prefix.charCodeAt(pos);
    console.log(`  pos ${pos.toString().padStart(2)} char='${prefix[pos]}' (0x${expected.toString(16).padStart(2,'0')}) → cipher bytes: [${unique.map(b => '0x' + b.toString(16).padStart(2,'0')).join(', ')}] (${unique.length === 1 ? 'CONSISTENT' : 'VARIES!'})`);
  }
  
  // Find where the domain starts varying
  // After "https:\/\/" (positions 0-17), the domain follows
  // Let's check positions 18+ for consistency
  console.log('\nChecking positions beyond prefix:');
  const maxPtLen = Math.min(...pairs.map(p => p.cipherData.length > 20 ? 7 + (p.cipherData.length - 20) : 1));
  
  let firstVaryPos = -1;
  for (let pos = prefix.length; pos < Math.min(maxPtLen, 80); pos++) {
    const cp = cipherPos(pos);
    const bytes = pairs.map(p => cp < p.cipherData.length ? p.cipherData[cp] : -1).filter(b => b >= 0);
    const unique = [...new Set(bytes)];
    if (unique.length === 1) {
      console.log(`  pos ${pos.toString().padStart(2)} → 0x${unique[0].toString(16).padStart(2,'0')} (same in all ${bytes.length} samples)`);
    } else {
      if (firstVaryPos === -1) firstVaryPos = pos;
      console.log(`  pos ${pos.toString().padStart(2)} → ${unique.length} unique values (VARIES)`);
      if (pos > firstVaryPos + 5) break; // Stop after a few varying positions
    }
  }
  
  // The constant positions after the prefix tell us the domain
  // e.g., "4spromax.site\/e\/" 
  // Let's figure out the full constant prefix
  
  // Now load the OLD tables and check which old table maps each known char to the observed byte
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
    if (Object.keys(entries).length > 10) oldTables[idx] = entries;
  }
  console.log('\nLoaded', Object.keys(oldTables).length, 'old tables');
  
  // For each known position, find which old table produces the observed cipher byte
  console.log('\n=== Table mapping (position → old table index) ===');
  const newMapping = {}; // position → old table index
  
  for (let pos = 0; pos < prefix.length; pos++) {
    const expectedChar = prefix[pos];
    const cp = cipherPos(pos);
    const cipherByte = pairs[0].cipherData[cp];
    
    // Find which old table maps this char to this byte
    const matching = [];
    for (const [tableIdx, tbl] of Object.entries(oldTables)) {
      if (tbl[expectedChar] === cipherByte) {
        matching.push(parseInt(tableIdx));
      }
    }
    
    // Verify with multiple samples
    const allSame = pairs.every(p => cp < p.cipherData.length && p.cipherData[cp] === cipherByte);
    
    if (matching.length === 1) {
      newMapping[pos] = matching[0];
      console.log(`  pos ${pos.toString().padStart(2)} → table ${matching[0].toString().padStart(3)} (was ${pos}) ${allSame ? '✓' : '⚠'}`);
    } else if (matching.length > 1) {
      console.log(`  pos ${pos.toString().padStart(2)} → AMBIGUOUS: [${matching.join(', ')}] (was ${pos})`);
    } else {
      console.log(`  pos ${pos.toString().padStart(2)} → NO MATCH! char='${expectedChar}' byte=0x${cipherByte.toString(16).padStart(2,'0')} (was ${pos})`);
    }
  }
  
  // Check if there's a pattern in the mapping
  const definite = Object.entries(newMapping).filter(([_, v]) => typeof v === 'number');
  if (definite.length > 0) {
    console.log('\n=== Pattern analysis ===');
    const offsets = definite.map(([pos, table]) => ({ pos: parseInt(pos), table, offset: table - parseInt(pos) }));
    offsets.forEach(o => console.log(`  pos ${o.pos} → table ${o.table} (offset: ${o.offset >= 0 ? '+' : ''}${o.offset})`));
    
    const uniqueOffsets = [...new Set(offsets.map(o => o.offset))];
    if (uniqueOffsets.length === 1) {
      console.log(`\n*** SIMPLE ROTATION: all tables shifted by ${uniqueOffsets[0]} ***`);
    } else {
      // Check if it's a permutation based on p_mLjDq
      console.log('\nNot a simple rotation. Checking permutation pattern...');
      
      // The p_mLjDq formula: s = (n + 39*k) % 129
      // If the server uses a different k value, the permutation would be:
      // new_table_for_pos_n = old_table_at_pos_(n + 39*k) % 129
      // Or: old_table_at_pos_n is now used at pos (n - 39*k) % 129
      
      // Let's check: for each definite mapping, what k would produce it?
      for (const { pos, table } of offsets) {
        // table = (pos + 39*k) % 129 → 39*k = (table - pos) % 129 → k = ((table - pos) % 129) / 39
        const diff = ((table - pos) % 129 + 129) % 129;
        // diff = 39*k mod 129
        // We need to find k such that 39*k ≡ diff (mod 129)
        // 129 = 3*43, 39 = 3*13
        // gcd(39, 129) = 3
        // So 39*k ≡ diff (mod 129) has a solution only if diff % 3 === 0
        // If so, divide by 3: 13*k ≡ diff/3 (mod 43)
        // 13^(-1) mod 43: 13*10 = 130 = 3*43 + 1, so 13^(-1) = 10 mod 43
        // k = 10 * (diff/3) mod 43
        
        if (diff % 3 === 0) {
          const k = (10 * (diff / 3)) % 43;
          console.log(`  pos ${pos} → table ${table}: diff=${diff}, k=${k}`);
        } else {
          console.log(`  pos ${pos} → table ${table}: diff=${diff}, NOT divisible by 3!`);
        }
      }
    }
  }
  
  return { pairs, newMapping, oldTables };
}

async function main() {
  // First, analyze the shuffle function
  // (Already done above)
  
  // Then collect samples and build tables
  const pairs = await collectSamples();
  if (pairs.length === 0) {
    console.log('No samples collected! Check network.');
    return;
  }
  
  await buildTablesFromSamples(pairs);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
