#!/usr/bin/env node
/**
 * Crack AnimeKai's NEW server-side encryption tables.
 * 
 * Approach: Collect many encrypted responses where we know the plaintext,
 * then build the substitution tables empirically.
 * 
 * Key insight: The response format is always:
 *   {"url":"https:\/\/DOMAIN\/e\/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
 * 
 * We know the prefix, suffix structure, and can figure out the domain + video IDs
 * by checking which old tables produce valid characters.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetchUrl(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs }
    };
    https.get(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], {
    encoding: 'utf8', timeout: 5000, windowsHide: true
  }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };

const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function b64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

// Load OLD tables
function loadOldTables() {
  const tsSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'lib', 'animekai-crypto.ts'), 'utf8');
  const tables = {};
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
    if (Object.keys(entries).length > 10) tables[idx] = entries;
  }
  return tables;
}

// Build reverse tables: for each table, byte → char
function buildReverseTables(tables) {
  const rev = {};
  for (const [idx, tbl] of Object.entries(tables)) {
    rev[idx] = {};
    for (const [ch, byte] of Object.entries(tbl)) {
      rev[idx][byte] = ch;
    }
  }
  return rev;
}

async function main() {
  const oldTables = loadOldTables();
  const oldReverse = buildReverseTables(oldTables);
  const numTables = Object.keys(oldTables).length;
  console.log(`Loaded ${numTables} old tables\n`);

  // ═══════════════════════════════════════════════════════
  // STEP 1: Collect encrypted samples
  // ═══════════════════════════════════════════════════════
  console.log('STEP 1: Collecting encrypted samples...\n');

  const samples = []; // { encrypted, cipherData, query }
  const queries = [
    'bleach', 'naruto', 'dragon ball z', 'jujutsu kaisen',
    'death note', 'demon slayer',
  ];

  for (const query of queries) {
    if (samples.length >= 30) break;
    try {
      const sr = await fetchUrl(`https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent(query)}`, KAI_HDRS);
      if (sr.status !== 200) continue;
      const sd = JSON.parse(sr.body);
      const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
      if (!slug) continue;

      const wp = await fetchUrl('https://animekai.to/watch/' + slug);
      const syncMatch = wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
      if (!syncMatch) continue;
      const sync = JSON.parse(syncMatch[1]);
      const animeId = sync.anime_id;

      const encId = rustExec(animeId, 'kai-encrypt');
      const epResp = await fetchUrl(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
      const epData = JSON.parse(epResp.body);
      if (!epData.result) continue;

      const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, 2);

      for (const token of tokens) {
        const encToken = rustExec(token, 'kai-encrypt');
        const srvResp = await fetchUrl(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
        const srvData = JSON.parse(srvResp.body);
        if (!srvData.result) continue;

        const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);

        for (const lid of lids.slice(0, 4)) {
          try {
            const encLid = rustExec(lid, 'kai-encrypt');
            const viewResp = await fetchUrl(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
            const viewData = JSON.parse(viewResp.body);
            if (!viewData.result) continue;

            const encrypted = viewData.result;
            const raw = b64Decode(encrypted);
            const cipherData = raw.slice(21);

            samples.push({ encrypted, cipherData, query, lid });
            process.stdout.write(`  [${samples.length}] ${query} lid=${lid} len=${cipherData.length}\n`);
          } catch {}
        }
      }
    } catch (e) {
      console.log(`  ${query}: ${e.message?.substring(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nCollected ${samples.length} samples\n`);
  if (samples.length === 0) { console.log('No samples!'); return; }

  // ═══════════════════════════════════════════════════════
  // STEP 2: Determine known plaintext at each position
  // ═══════════════════════════════════════════════════════
  console.log('STEP 2: Analyzing cipher bytes at each position...\n');

  // Known prefix: {"url":"https:\/\/
  const prefix = '{"url":"https:\\/\\/';

  // Check which positions have consistent bytes across all samples
  const maxPtLen = Math.min(...samples.map(s => s.cipherData.length > 20 ? 7 + (s.cipherData.length - 20) : 1));
  console.log(`Min plaintext length across samples: ${maxPtLen}`);

  const positionBytes = {}; // pos → Set of observed bytes
  for (let pos = 0; pos < maxPtLen; pos++) {
    const cp = cipherPos(pos);
    const bytes = new Set();
    for (const s of samples) {
      if (cp < s.cipherData.length) bytes.add(s.cipherData[cp]);
    }
    positionBytes[pos] = bytes;
  }

  // Positions with only 1 unique byte = same plaintext char in all samples
  const constantPositions = [];
  const varyingPositions = [];
  for (let pos = 0; pos < maxPtLen; pos++) {
    if (positionBytes[pos].size === 1) {
      constantPositions.push(pos);
    } else {
      varyingPositions.push(pos);
    }
  }
  console.log(`Constant positions: ${constantPositions.length}`);
  console.log(`Varying positions: ${varyingPositions.length}`);

  // ═══════════════════════════════════════════════════════
  // STEP 3: For each position, find which OLD table maps the known char to the observed byte
  // ═══════════════════════════════════════════════════════
  console.log('\nSTEP 3: Finding table mapping...\n');

  const newTableMap = {}; // position → old table index

  // First, handle the known prefix
  for (let pos = 0; pos < prefix.length; pos++) {
    const expectedChar = prefix[pos];
    const cp = cipherPos(pos);
    const observedByte = [...positionBytes[pos]][0]; // Should be consistent

    if (positionBytes[pos].size !== 1) {
      console.log(`  pos ${pos}: VARIES at prefix position! Expected '${expectedChar}'`);
      continue;
    }

    // Find which old table maps expectedChar → observedByte
    const matching = [];
    for (const [tableIdx, tbl] of Object.entries(oldTables)) {
      if (tbl[expectedChar] === observedByte) {
        matching.push(parseInt(tableIdx));
      }
    }

    if (matching.length === 1) {
      newTableMap[pos] = matching[0];
      console.log(`  pos ${pos.toString().padStart(3)} char='${expectedChar}' byte=0x${observedByte.toString(16).padStart(2,'0')} → table ${matching[0]} ✓`);
    } else if (matching.length > 1) {
      console.log(`  pos ${pos.toString().padStart(3)} char='${expectedChar}' byte=0x${observedByte.toString(16).padStart(2,'0')} → AMBIGUOUS: [${matching.join(',')}]`);
      newTableMap[pos] = matching; // Store all candidates
    } else {
      console.log(`  pos ${pos.toString().padStart(3)} char='${expectedChar}' byte=0x${observedByte.toString(16).padStart(2,'0')} → NO MATCH IN OLD TABLES!`);
    }
  }

  // For constant positions beyond the prefix, try to figure out the char
  // by checking which old tables produce a valid ASCII char for the observed byte
  console.log('\nExtending known plaintext beyond prefix...');

  // The domain after "https:\/\/" is likely "4spromax.site" or similar
  // Let's try common domains
  const possibleDomains = ['4spromax.site', 'megaup22.online', 'megacloud.blog'];

  for (const domain of possibleDomains) {
    const fullPrefix = `{"url":"https:\\/\\/${domain}\\/e\\/`;
    console.log(`\nTrying domain: ${domain} (prefix length: ${fullPrefix.length})`);

    let allMatch = true;
    for (let pos = prefix.length; pos < Math.min(fullPrefix.length, maxPtLen); pos++) {
      if (positionBytes[pos].size !== 1) {
        // This position varies — if we're still in the domain, it's wrong
        if (pos < prefix.length + domain.length + 4) { // +4 for \/e\/
          allMatch = false;
          break;
        }
        continue;
      }

      const expectedChar = fullPrefix[pos];
      const observedByte = [...positionBytes[pos]][0];

      // Check if ANY old table maps this char to this byte
      let found = false;
      for (const [tableIdx, tbl] of Object.entries(oldTables)) {
        if (tbl[expectedChar] === observedByte) {
          found = true;
          if (!newTableMap[pos]) {
            newTableMap[pos] = parseInt(tableIdx);
          }
          break;
        }
      }

      if (!found) {
        allMatch = false;
        console.log(`  pos ${pos}: char '${expectedChar}' byte 0x${observedByte.toString(16).padStart(2,'0')} → NO MATCH`);
        break;
      }
    }

    if (allMatch) {
      console.log(`  ✓ Domain "${domain}" matches!`);

      // Now extend with the suffix pattern
      // After the video ID (which varies), we have: ","skip":{"intro":[
      // And at the end: ],"outro":[N,N]}}

      // Work backwards from the end
      const suffix = '}}';
      for (let offset = 1; offset <= suffix.length; offset++) {
        for (const s of samples) {
          const ptLen = s.cipherData.length > 20 ? 7 + (s.cipherData.length - 20) : 1;
          const pos = ptLen - offset;
          const cp = cipherPos(pos);
          if (cp >= s.cipherData.length) continue;
          const observedByte = s.cipherData[cp];
          const expectedChar = suffix[suffix.length - offset];

          for (const [tableIdx, tbl] of Object.entries(oldTables)) {
            if (tbl[expectedChar] === observedByte) {
              if (!newTableMap[pos]) {
                newTableMap[pos] = parseInt(tableIdx);
                console.log(`  pos ${pos} (end-${offset}) char='${expectedChar}' → table ${tableIdx}`);
              }
              break;
            }
          }
        }
      }

      break; // Found the domain
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: Analyze the permutation pattern
  // ═══════════════════════════════════════════════════════
  console.log('\n\nSTEP 4: Analyzing permutation pattern...\n');

  const definite = Object.entries(newTableMap)
    .filter(([_, v]) => typeof v === 'number')
    .map(([pos, table]) => ({ pos: parseInt(pos), table }));

  console.log(`Definite mappings: ${definite.length}`);

  if (definite.length > 0) {
    // Check for patterns
    const offsets = definite.map(d => ({
      ...d,
      offset: ((d.table - d.pos) % numTables + numTables) % numTables
    }));

    // Group by offset
    const offsetCounts = {};
    for (const o of offsets) {
      offsetCounts[o.offset] = (offsetCounts[o.offset] || 0) + 1;
    }

    console.log('Offset distribution:');
    const sorted = Object.entries(offsetCounts).sort((a, b) => b[1] - a[1]);
    for (const [offset, count] of sorted.slice(0, 10)) {
      console.log(`  offset ${offset}: ${count} positions`);
    }

    // If there's a dominant offset, it's likely a simple rotation
    if (sorted[0][1] > definite.length * 0.8) {
      const dominantOffset = parseInt(sorted[0][0]);
      console.log(`\n*** DOMINANT OFFSET: ${dominantOffset} (${sorted[0][1]}/${definite.length} positions) ***`);
      console.log(`This means: new_table[pos] = old_table[(pos + ${dominantOffset}) % ${numTables}]`);

      // Verify with all definite mappings
      let matches = 0;
      for (const d of definite) {
        const expected = (d.pos + dominantOffset) % numTables;
        if (d.table === expected) matches++;
        else console.log(`  MISMATCH: pos ${d.pos} → table ${d.table}, expected ${expected}`);
      }
      console.log(`Verification: ${matches}/${definite.length} match`);
    }

    // Also check if it's a more complex permutation
    // Print all mappings for manual inspection
    console.log('\nAll definite mappings:');
    for (const d of definite.sort((a, b) => a.pos - b.pos)) {
      const offset = ((d.table - d.pos) % numTables + numTables) % numTables;
      console.log(`  pos ${d.pos.toString().padStart(3)} → table ${d.table.toString().padStart(3)} (offset ${offset})`);
    }
  }

  // Save results
  const resultFile = path.join(__dirname, 'kai-table-mapping-result.json');
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    numSamples: samples.length,
    numOldTables: numTables,
    definiteMapping: Object.fromEntries(definite.map(d => [d.pos, d.table])),
    ambiguousMapping: Object.fromEntries(
      Object.entries(newTableMap).filter(([_, v]) => Array.isArray(v))
    ),
  }, null, 2));
  console.log(`\nResults saved to ${resultFile}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
