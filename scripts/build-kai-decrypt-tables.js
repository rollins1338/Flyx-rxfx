#!/usr/bin/env node
/**
 * Build AnimeKai NEW decrypt tables by brute-force from collected samples.
 * 
 * Strategy:
 * 1. Collect MANY encrypted link/view responses (ciphertext)
 * 2. Use known plaintext structure to map cipher bytes → plaintext chars
 * 3. For unknown positions (video IDs), use the fact that video IDs are
 *    alphanumeric and we can verify them by fetching MegaUp /media/ endpoint
 * 4. Build complete 256-entry tables for all 183 positions
 * 5. Output in Rust format for animekai_tables.rs
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
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs },
      timeout: 15000,
    };
    https.get(opts, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej).on('timeout', () => rej(new Error('timeout')));
  });
}

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], {
    encoding: 'utf8', timeout: 8000, windowsHide: true
  }).trim();
}

function rustFetch(url, hdrs = {}) {
  const allHdrs = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs };
  return execFileSync(RUST, ['--url', url, '--mode', 'fetch', '--timeout', '15', '--headers', JSON.stringify(allHdrs)], {
    encoding: 'utf8', timeout: 20000, maxBuffer: 10*1024*1024, windowsHide: true
  }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };

// Cipher position mapping (plaintext pos → cipher data offset)
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function b64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

function ptLen(cipherData) {
  const dl = cipherData.length;
  if (dl > 20) return 7 + (dl - 20);
  if (dl > 19) return 7;
  if (dl > 17) return 6;
  if (dl > 15) return 5;
  if (dl > 13) return 4;
  if (dl > 11) return 3;
  if (dl > 7) return 2;
  if (dl > 0) return 1;
  return 0;
}


// ═══════════════════════════════════════════════════════
// STEP 1: Collect samples with KNOWN full plaintext
// ═══════════════════════════════════════════════════════
// 
// Key insight: We can get the ACTUAL embed URL by:
// 1. Getting the encrypted response from link/view
// 2. Getting the server name from the server list HTML
// 3. For MegaUp servers, trying to verify the video ID
//    by fetching the MegaUp /media/ endpoint
//
// But EVEN BETTER: We can use the ENCRYPT function as an oracle!
// If we encrypt a known string and look at the output bytes,
// we learn the encrypt table for each position.
// The SERVER uses DIFFERENT tables to encrypt its responses.
// But we can build the server's encrypt tables (= our decrypt tables)
// from the known plaintext-ciphertext pairs.
//
// The approach:
// 1. For each sample, we know positions 0-37 (prefix) exactly
// 2. We know the suffix structure (","skip":{"intro":[...], etc.)
// 3. We need to figure out WHERE the suffix starts (= video ID length)
// 4. Then we know the full plaintext for suffix positions too
// 5. For video ID positions, we collect multiple samples and use
//    the constraint that video IDs are alphanumeric

async function collectSamples() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  COLLECTING ENCRYPTED SAMPLES');
  console.log('═══════════════════════════════════════════════════════\n');

  const samples = []; // { cipherData, ptLength, query, lid, serverName }

  const queries = [
    'bleach', 'naruto', 'dragon ball z', 'jujutsu kaisen',
    'death note', 'demon slayer', 'attack on titan',
    'fullmetal alchemist', 'hunter x hunter', 'my hero academia',
    'sword art online', 'tokyo ghoul', 'one punch man',
    'fairy tail', 'black clover', 'spy x family',
    'chainsaw man', 'mob psycho', 'vinland saga', 'cowboy bebop',
    'steins gate', 'code geass', 'gintama', 'haikyuu',
    'parasyte', 'psycho pass', 'erased', 'toradora',
    're zero', 'overlord', 'one piece', 'solo leveling',
    'blue lock', 'dandadan', 'frieren', 'mashle',
    'oshi no ko', 'bocchi the rock', 'ranking of kings',
    'mob psycho 100', 'dr stone', 'fire force',
  ];

  for (const query of queries) {
    if (samples.length >= 200) break;
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

      // Get first 4 episode tokens
      const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, 4);

      for (const token of tokens) {
        if (samples.length >= 200) break;
        const encToken = rustExec(token, 'kai-encrypt');
        const srvResp = await fetchUrl(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
        const srvData = JSON.parse(srvResp.body);
        if (!srvData.result) continue;

        // Extract server names and lids
        const serverEntries = [...srvData.result.matchAll(/data-lid="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/g)]
          .map(m => ({ lid: m[1], serverName: m[2].trim() }));

        for (const { lid, serverName } of serverEntries.slice(0, 6)) {
          if (samples.length >= 200) break;
          try {
            const encLid = rustExec(lid, 'kai-encrypt');
            const viewResp = await fetchUrl(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
            const viewData = JSON.parse(viewResp.body);
            if (!viewData.result) continue;

            const encrypted = viewData.result;
            const raw = b64Decode(encrypted);
            const cipherData = raw.slice(21);
            const pl = ptLen(cipherData);

            samples.push({ cipherData, ptLength: pl, query, lid, serverName, encrypted });
            process.stdout.write(`  [${samples.length}] ${query.padEnd(25)} server=${serverName.padEnd(15)} lid=${lid} ptLen=${pl}\n`);
          } catch {}
        }
      }
    } catch (e) {
      // skip
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nCollected ${samples.length} samples\n`);
  return samples;
}


// ═══════════════════════════════════════════════════════
// STEP 2: Analyze structure and find constant runs
// ═══════════════════════════════════════════════════════

function analyzeStructure(samples) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ANALYZING CIPHER STRUCTURE');
  console.log('═══════════════════════════════════════════════════════\n');

  const minPtLen = Math.min(...samples.map(s => s.ptLength));
  const maxPtLen = Math.max(...samples.map(s => s.ptLength));
  console.log(`Plaintext lengths: min=${minPtLen}, max=${maxPtLen}`);

  // Find constant positions (same byte across ALL samples at that position)
  const constPositions = new Map(); // pos → byte value
  for (let pos = 0; pos < minPtLen; pos++) {
    const cp = cipherPos(pos);
    const bytes = new Set();
    for (const s of samples) {
      if (cp < s.cipherData.length) bytes.add(s.cipherData[cp]);
    }
    if (bytes.size === 1) {
      constPositions.set(pos, [...bytes][0]);
    }
  }

  console.log(`Constant positions (across all ${samples.length} samples): ${constPositions.size}`);

  // Find constant runs
  const runs = [];
  let runStart = null;
  for (let pos = 0; pos <= minPtLen; pos++) {
    if (constPositions.has(pos)) {
      if (runStart === null) runStart = pos;
    } else {
      if (runStart !== null) {
        runs.push({ start: runStart, end: pos - 1, len: pos - runStart });
        runStart = null;
      }
    }
  }

  console.log(`\nConstant runs:`);
  for (const run of runs) {
    console.log(`  positions ${run.start}-${run.end} (${run.len} chars)`);
  }

  // The expected structure:
  // Run 1: {"url":"https:\/\/megaup22.online\/e\/  (38 chars, positions 0-37)
  // [varying: video ID]
  // Run 2: ","skip":{"intro":[  (19 chars)
  // [varying: intro numbers like 0,0 or 1234,5678]
  // Run 3: ],"outro":[  (11 chars)
  // [varying: outro numbers]
  // Run 4: ]}}  (3 chars)

  return { constPositions, runs, minPtLen, maxPtLen };
}

// ═══════════════════════════════════════════════════════
// STEP 3: Build decrypt tables from known plaintext
// ═══════════════════════════════════════════════════════

function buildTablesFromKnownPlaintext(samples, structure) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  BUILDING DECRYPT TABLES');
  console.log('═══════════════════════════════════════════════════════\n');

  const { runs, minPtLen } = structure;

  // Known plaintext segments
  const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
  const suffixPart1 = '","skip":{"intro":[';
  const suffixPart2 = '],"outro":[';
  const suffixPart3 = ']}}';

  // Verify runs match expected structure
  if (runs.length < 2) {
    console.log('ERROR: Not enough constant runs found. Expected at least 4.');
    console.log('This might mean the domain or JSON structure has changed.');
    return null;
  }

  console.log(`Run 1 (prefix): positions ${runs[0].start}-${runs[0].end} (${runs[0].len} chars, expected ${prefix.length})`);
  
  // The video ID is between the prefix and the first suffix part
  const videoIdStart = prefix.length; // position 38
  const videoIdEnd = runs.length >= 2 ? runs[1].start - 1 : -1;
  const videoIdLen = videoIdEnd >= 0 ? videoIdEnd - videoIdStart + 1 : -1;
  
  if (runs.length >= 2) {
    console.log(`Video ID: positions ${videoIdStart}-${videoIdEnd} (${videoIdLen} chars)`);
    console.log(`Run 2 (suffix1): positions ${runs[1].start}-${runs[1].end} (${runs[1].len} chars, expected ${suffixPart1.length})`);
  }
  if (runs.length >= 3) {
    console.log(`Run 3 (suffix2): positions ${runs[2].start}-${runs[2].end} (${runs[2].len} chars, expected ${suffixPart2.length})`);
  }

  // Build tables: position → { cipherByte → plaintextChar }
  const tables = {}; // tables[pos][byte] = char

  function addEntry(pos, byte, char) {
    if (!tables[pos]) tables[pos] = {};
    if (tables[pos][byte] && tables[pos][byte] !== char) {
      console.log(`  CONFLICT at pos ${pos}: byte 0x${byte.toString(16)} maps to both '${tables[pos][byte]}' and '${char}'`);
    }
    tables[pos][byte] = char;
  }

  // Add prefix entries (positions 0-37)
  for (let i = 0; i < prefix.length; i++) {
    const cp = cipherPos(i);
    for (const s of samples) {
      if (cp < s.cipherData.length) {
        addEntry(i, s.cipherData[cp], prefix[i]);
      }
    }
  }

  // Add suffix part 1 entries
  if (runs.length >= 2) {
    for (let i = 0; i < suffixPart1.length && i < runs[1].len; i++) {
      const pos = runs[1].start + i;
      const cp = cipherPos(pos);
      for (const s of samples) {
        if (cp < s.cipherData.length && pos < s.ptLength) {
          addEntry(pos, s.cipherData[cp], suffixPart1[i]);
        }
      }
    }
  }

  // Add suffix part 2 entries
  if (runs.length >= 3) {
    for (let i = 0; i < suffixPart2.length && i < runs[2].len; i++) {
      const pos = runs[2].start + i;
      const cp = cipherPos(pos);
      for (const s of samples) {
        if (cp < s.cipherData.length && pos < s.ptLength) {
          addEntry(pos, s.cipherData[cp], suffixPart2[i]);
        }
      }
    }
  }

  // Add suffix part 3 entries from the END of each sample
  // The last 3 chars are always ]}}
  for (const s of samples) {
    const endChars = [']', '}', '}'];
    for (let offset = 0; offset < 3; offset++) {
      const pos = s.ptLength - 3 + offset;
      const cp = cipherPos(pos);
      if (cp < s.cipherData.length) {
        addEntry(pos, s.cipherData[cp], endChars[offset]);
      }
    }
    // Also the ] before ]} at position ptLen-4 could be the outro closing ]
    // And ]} at ptLen-2, ptLen-1
  }

  // Count entries per position
  let totalEntries = 0;
  let positionsWithEntries = 0;
  for (const [pos, entries] of Object.entries(tables)) {
    const count = Object.keys(entries).length;
    if (count > 0) {
      positionsWithEntries++;
      totalEntries += count;
    }
  }
  console.log(`\nPositions with entries: ${positionsWithEntries}`);
  console.log(`Total entries: ${totalEntries}`);

  return { tables, videoIdStart, videoIdEnd, videoIdLen };
}


// ═══════════════════════════════════════════════════════
// STEP 4: Recover video IDs using partial tables + MegaUp verification
// ═══════════════════════════════════════════════════════

async function recoverVideoIds(samples, tableData) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RECOVERING VIDEO IDs');
  console.log('═══════════════════════════════════════════════════════\n');

  const { tables, videoIdStart, videoIdEnd, videoIdLen } = tableData;
  if (videoIdLen <= 0) {
    console.log('Cannot determine video ID boundaries');
    return [];
  }

  // For each sample, try to figure out the video ID
  // Video IDs are alphanumeric (a-z, A-Z, 0-9)
  // We can try to verify by fetching https://megaup22.online/media/CANDIDATE_ID
  
  const recovered = [];
  const uniqueVideoIds = new Set();

  for (let si = 0; si < samples.length; si++) {
    const s = samples[si];
    let videoId = '';
    let allKnown = true;

    for (let pos = videoIdStart; pos <= videoIdEnd && pos < s.ptLength; pos++) {
      const cp = cipherPos(pos);
      if (cp >= s.cipherData.length) { allKnown = false; break; }
      const byte = s.cipherData[cp];
      
      if (tables[pos] && tables[pos][byte]) {
        videoId += tables[pos][byte];
      } else {
        videoId += '?';
        allKnown = false;
      }
    }

    if (allKnown && videoId.length > 0 && !videoId.includes('?')) {
      // Verify by fetching MegaUp /media/ endpoint
      try {
        const mediaUrl = `https://megaup22.online/media/${videoId}`;
        const resp = await fetchUrl(mediaUrl);
        if (resp.status === 200) {
          const data = JSON.parse(resp.body);
          if (data.result) {
            console.log(`  [${si}] ✓ VERIFIED: ${videoId} (${s.query})`);
            recovered.push({ sampleIdx: si, videoId, verified: true });
            uniqueVideoIds.add(videoId);
            
            // Now we have the FULL plaintext for this sample!
            // Add video ID chars to the tables
            for (let i = 0; i < videoId.length; i++) {
              const pos = videoIdStart + i;
              const cp = cipherPos(pos);
              if (cp < s.cipherData.length) {
                if (!tables[pos]) tables[pos] = {};
                tables[pos][s.cipherData[cp]] = videoId[i];
              }
            }
          } else {
            console.log(`  [${si}] ✗ Invalid response for ${videoId}`);
          }
        } else {
          console.log(`  [${si}] ✗ HTTP ${resp.status} for ${videoId}`);
        }
      } catch (e) {
        console.log(`  [${si}] ✗ Error: ${e.message?.substring(0, 50)}`);
      }
      await new Promise(r => setTimeout(r, 100));
    } else {
      // Partial video ID — log what we have
      if (si < 10) {
        console.log(`  [${si}] Partial: ${videoId} (${videoId.split('?').length - 1} unknown chars)`);
      }
    }
  }

  console.log(`\nRecovered ${recovered.length} verified video IDs (${uniqueVideoIds.size} unique)`);
  return recovered;
}

// ═══════════════════════════════════════════════════════
// STEP 5: Recover intro/outro numbers
// ═══════════════════════════════════════════════════════

function recoverNumbers(samples, tableData, structure) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RECOVERING INTRO/OUTRO NUMBERS');
  console.log('═══════════════════════════════════════════════════════\n');

  const { tables } = tableData;
  const { runs } = structure;

  if (runs.length < 3) return;

  // Intro numbers are between run 2 end and run 3 start
  const introStart = runs[1].end + 1;
  const introEnd = runs[2].start - 1;
  
  // Outro numbers are between run 3 end and the end (]}} at the end)
  const outroStart = runs[2].end + 1;

  console.log(`Intro number positions: ${introStart}-${introEnd}`);
  console.log(`Outro number positions: ${outroStart}-end`);

  // The intro/outro numbers are digits and commas
  // Format: N,N where N is a number (could be 0, or multi-digit)
  // Common patterns: 0,0  or  1234,5678

  // For each sample, try to decode the number positions
  let numbersRecovered = 0;
  for (const s of samples) {
    // Try intro numbers
    let introStr = '';
    let introOk = true;
    for (let pos = introStart; pos <= introEnd && pos < s.ptLength; pos++) {
      const cp = cipherPos(pos);
      if (cp >= s.cipherData.length) { introOk = false; break; }
      const byte = s.cipherData[cp];
      if (tables[pos] && tables[pos][byte]) {
        introStr += tables[pos][byte];
      } else {
        introOk = false;
        break;
      }
    }

    if (introOk && introStr.length > 0) {
      // Validate: should be digits and comma
      if (/^[\d,]+$/.test(introStr)) {
        // Add these entries to tables
        for (let i = 0; i < introStr.length; i++) {
          const pos = introStart + i;
          const cp = cipherPos(pos);
          if (cp < s.cipherData.length) {
            if (!tables[pos]) tables[pos] = {};
            tables[pos][s.cipherData[cp]] = introStr[i];
          }
        }
        numbersRecovered++;
      }
    }

    // Try outro numbers (from outroStart to ptLength - 3)
    let outroStr = '';
    let outroOk = true;
    const outroEnd = s.ptLength - 4; // -3 for ]}} and -1 for the ] before it
    for (let pos = outroStart; pos <= outroEnd && pos < s.ptLength; pos++) {
      const cp = cipherPos(pos);
      if (cp >= s.cipherData.length) { outroOk = false; break; }
      const byte = s.cipherData[cp];
      if (tables[pos] && tables[pos][byte]) {
        outroStr += tables[pos][byte];
      } else {
        outroOk = false;
        break;
      }
    }

    if (outroOk && outroStr.length > 0 && /^[\d,]+$/.test(outroStr)) {
      for (let i = 0; i < outroStr.length; i++) {
        const pos = outroStart + i;
        const cp = cipherPos(pos);
        if (cp < s.cipherData.length) {
          if (!tables[pos]) tables[pos] = {};
          tables[pos][s.cipherData[cp]] = outroStr[i];
        }
      }
    }
  }

  console.log(`Recovered numbers from ${numbersRecovered} samples`);
}


// ═══════════════════════════════════════════════════════
// STEP 6: Build FULL tables using encrypt oracle
// ═══════════════════════════════════════════════════════
// 
// Key insight: We can use the Rust kai-encrypt to encrypt
// arbitrary strings. The encrypt function uses the SAME tables
// that the server uses to DECRYPT our requests.
// 
// But we need the INVERSE: the tables the server uses to ENCRYPT
// its responses. These are DIFFERENT tables.
//
// However, we can build these tables from the collected
// plaintext-ciphertext pairs. Each pair gives us one entry
// in the table for that position.
//
// To get ALL 95 printable ASCII entries per position, we need
// 95 different plaintext chars at each position. With enough
// diverse samples (different video IDs, different numbers),
// we should get good coverage.
//
// For positions where we don't have enough coverage, we can
// try to GENERATE more samples by searching for specific anime
// whose video IDs contain the missing chars.

function analyzeTableCoverage(tables) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TABLE COVERAGE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  const printableAscii = [];
  for (let i = 32; i < 127; i++) printableAscii.push(String.fromCharCode(i));

  let fullPositions = 0;
  let partialPositions = 0;
  let emptyPositions = 0;
  const missingByPos = {};

  for (let pos = 0; pos < 183; pos++) {
    const entries = tables[pos] || {};
    const knownChars = new Set(Object.values(entries));
    const count = knownChars.size;

    if (count >= 95) {
      fullPositions++;
    } else if (count > 0) {
      partialPositions++;
      const missing = printableAscii.filter(c => !knownChars.has(c));
      missingByPos[pos] = { count, missing: missing.length, chars: missing.join('') };
    } else {
      emptyPositions++;
    }
  }

  console.log(`Full positions (95+ chars): ${fullPositions}`);
  console.log(`Partial positions: ${partialPositions}`);
  console.log(`Empty positions: ${emptyPositions}`);

  // Show coverage for first 50 positions
  console.log('\nCoverage by position (first 80):');
  for (let pos = 0; pos < 80; pos++) {
    const entries = tables[pos] || {};
    const knownChars = new Set(Object.values(entries));
    const bar = '█'.repeat(Math.min(knownChars.size, 50));
    console.log(`  pos ${pos.toString().padStart(3)}: ${knownChars.size.toString().padStart(3)} chars ${bar}`);
  }

  return { fullPositions, partialPositions, emptyPositions, missingByPos };
}

// ═══════════════════════════════════════════════════════
// STEP 7: Generate Rust tables
// ═══════════════════════════════════════════════════════

function generateRustTables(tables) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GENERATING RUST TABLES');
  console.log('═══════════════════════════════════════════════════════\n');

  // Build ENCRYPT tables (server's encrypt = our decrypt direction)
  // Format: ENCRYPT[position][ascii_char] = cipher_byte
  // We have: tables[position][cipher_byte] = plaintext_char
  // So we need to INVERT: for each (pos, byte→char), store ENCRYPT[pos][char] = byte

  const encryptTables = []; // encryptTables[pos][ascii] = byte

  for (let pos = 0; pos < 183; pos++) {
    const enc = new Uint8Array(128).fill(0xFF);
    const entries = tables[pos] || {};
    
    for (const [byteStr, char] of Object.entries(entries)) {
      const byte = parseInt(byteStr);
      const ascii = char.charCodeAt(0);
      if (ascii < 128) {
        enc[ascii] = byte;
      }
    }
    
    encryptTables.push(enc);
  }

  // Generate Rust source
  let rust = `//! AnimeKai substitution tables (auto-generated)
//! Generated: ${new Date().toISOString()}
//! 
//! These are the SERVER's encrypt tables.
//! To decrypt: for each position, look up cipher_byte in the reverse table.
//! To encrypt: ENCRYPT[position][ascii_char] = cipher_byte

pub const NUM_TABLES: usize = 183;

/// ENCRYPT[position][ascii_char] = cipher_byte
/// 0xFF means unmapped
pub const ENCRYPT: [[u8; 128]; ${183}] = [\n`;

  for (let pos = 0; pos < 183; pos++) {
    const enc = encryptTables[pos];
    const entries = tables[pos] || {};
    const knownCount = Object.keys(entries).length;
    
    rust += `    // Position ${pos} (${knownCount} known mappings)\n    [`;
    
    for (let i = 0; i < 128; i++) {
      if (i % 16 === 0 && i > 0) rust += '\n     ';
      rust += `0x${enc[i].toString(16).padStart(2, '0')}`;
      if (i < 127) rust += ',';
    }
    
    rust += `],\n`;
  }

  rust += `];\n`;

  return rust;
}


// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  ANIMEKAI DECRYPT TABLE BUILDER                      ║');
  console.log('║  Brute-force from known plaintext-ciphertext pairs   ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Check if we have cached samples
  const cacheFile = path.join(__dirname, 'kai-samples-cache.json');
  let samples;
  
  if (fs.existsSync(cacheFile)) {
    console.log('Loading cached samples...');
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    samples = cached.map(s => ({
      ...s,
      cipherData: Buffer.from(s.cipherHex, 'hex'),
    }));
    console.log(`Loaded ${samples.length} cached samples\n`);
  } else {
    samples = await collectSamples();
    
    // Cache samples
    const toCache = samples.map(s => ({
      query: s.query, lid: s.lid, serverName: s.serverName,
      ptLength: s.ptLength, cipherHex: s.cipherData.toString('hex'),
      encrypted: s.encrypted,
    }));
    fs.writeFileSync(cacheFile, JSON.stringify(toCache, null, 2));
    console.log(`Cached ${samples.length} samples to ${cacheFile}\n`);
  }

  if (samples.length === 0) {
    console.log('No samples collected!');
    return;
  }

  // Step 2: Analyze structure
  const structure = analyzeStructure(samples);

  // Step 3: Build initial tables from known plaintext
  const tableData = buildTablesFromKnownPlaintext(samples, structure);
  if (!tableData) return;

  // Step 4: Try to recover video IDs
  const recovered = await recoverVideoIds(samples, tableData);

  // Step 5: Recover intro/outro numbers
  recoverNumbers(samples, tableData, structure);

  // Step 6: Analyze coverage
  const coverage = analyzeTableCoverage(tableData.tables);

  // Step 7: If we have enough coverage, generate Rust tables
  const totalKnown = Object.values(tableData.tables).reduce((sum, t) => sum + Object.keys(t).length, 0);
  console.log(`\nTotal known mappings: ${totalKnown}`);

  // Save intermediate results
  const resultFile = path.join(__dirname, 'kai-new-tables.json');
  const serializable = {};
  for (const [pos, entries] of Object.entries(tableData.tables)) {
    serializable[pos] = {};
    for (const [byte, char] of Object.entries(entries)) {
      serializable[pos][byte] = char;
    }
  }
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    numSamples: samples.length,
    totalMappings: totalKnown,
    coverage: {
      full: coverage.fullPositions,
      partial: coverage.partialPositions,
      empty: coverage.emptyPositions,
    },
    tables: serializable,
  }, null, 2));
  console.log(`Saved tables to ${resultFile}`);

  // Generate Rust source if we have reasonable coverage
  if (coverage.fullPositions + coverage.partialPositions > 50) {
    const rustSrc = generateRustTables(tableData.tables);
    const rustFile = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'src', 'animekai_tables.rs');
    fs.writeFileSync(rustFile, rustSrc);
    console.log(`\nWrote Rust tables to ${rustFile}`);
    console.log(`Full positions: ${coverage.fullPositions}/183`);
    console.log(`Partial positions: ${coverage.partialPositions}/183`);
  }

  // Print summary of what we need
  if (coverage.emptyPositions > 0 || coverage.partialPositions > 0) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  NEXT STEPS');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Need more samples to fill ${coverage.emptyPositions} empty positions`);
    console.log(`and complete ${coverage.partialPositions} partial positions`);
    console.log('Run this script again with --no-cache to collect fresh samples');
    console.log('Or add more anime queries to get diverse video IDs');
  }
}

// Handle --no-cache flag
if (process.argv.includes('--no-cache')) {
  const cacheFile = path.join(__dirname, 'kai-samples-cache.json');
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
    console.log('Cache cleared\n');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
