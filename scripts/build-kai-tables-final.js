#!/usr/bin/env node
/**
 * Build AnimeKai NEW decrypt tables from collected samples.
 * Uses existing 82 samples from kai-bruteforce-result.json
 * plus collects more to fill gaps.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetchUrl(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs },
      timeout: 15000,
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], {
    encoding: 'utf8', timeout: 8000, windowsHide: true
  }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function b64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

function ptLen(dl) {
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


async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  ANIMEKAI TABLE BUILDER — FINAL                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Load existing samples
  const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
  const samples = existing.samples.map(s => ({
    ...s,
    cipherData: Buffer.from(s.cipherHex, 'hex'),
  }));
  console.log(`Loaded ${samples.length} existing samples`);

  // Collect MORE samples to get better coverage
  console.log('\nCollecting additional samples...\n');
  const queries = [
    'tokyo ghoul', 'one punch man', 'fairy tail', 'black clover',
    'spy x family', 'chainsaw man', 'mob psycho 100', 'vinland saga',
    'cowboy bebop', 'steins gate', 'code geass', 'gintama',
    'haikyuu', 'parasyte', 'psycho pass', 'erased',
    'toradora', 're zero', 'overlord', 'one piece',
    'solo leveling', 'blue lock', 'dandadan', 'frieren',
    'mashle', 'oshi no ko', 'bocchi the rock', 'dr stone',
    'fire force', 'noragami', 'akame ga kill', 'no game no life',
    'konosuba', 'shield hero', 'classroom of the elite',
    'bunny girl senpai', 'violet evergarden', 'made in abyss',
    'promised neverland', 'dororo', 'banana fish', 'given',
    'yuri on ice', 'sk8 the infinity', 'wonder egg priority',
    'odd taxi', 'sonny boy', 'ranking of kings', 'summertime render',
    'cyberpunk edgerunners', 'bocchi', 'trigun stampede',
    'hell paradise', 'undead unluck', 'zom 100', 'pluto',
  ];

  for (const query of queries) {
    if (samples.length >= 300) break;
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

      const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, 3);

      for (const token of tokens) {
        if (samples.length >= 300) break;
        const encToken = rustExec(token, 'kai-encrypt');
        const srvResp = await fetchUrl(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
        const srvData = JSON.parse(srvResp.body);
        if (!srvData.result) continue;

        const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
        for (const lid of lids.slice(0, 4)) {
          if (samples.length >= 300) break;
          try {
            const encLid = rustExec(lid, 'kai-encrypt');
            const viewResp = await fetchUrl(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
            const viewData = JSON.parse(viewResp.body);
            if (!viewData.result) continue;

            const raw = b64Decode(viewData.result);
            const cd = raw.slice(21);
            samples.push({ query, lid, ptLen: ptLen(cd.length), cipherData: cd, cipherHex: cd.toString('hex') });
            process.stdout.write(`  [${samples.length}] ${query.padEnd(30)} ptLen=${ptLen(cd.length)}\n`);
          } catch {}
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nTotal samples: ${samples.length}\n`);

  // ═══════════════════════════════════════════════════════
  // ANALYZE STRUCTURE
  // ═══════════════════════════════════════════════════════
  const minPtL = Math.min(...samples.map(s => s.ptLen));
  const maxPtL = Math.max(...samples.map(s => s.ptLen));
  console.log(`Plaintext lengths: ${minPtL} - ${maxPtL}`);

  // Find constant positions
  const constPos = new Map();
  for (let pos = 0; pos < minPtL; pos++) {
    const cp = cipherPos(pos);
    const bytes = new Set();
    for (const s of samples) {
      if (cp < s.cipherData.length) bytes.add(s.cipherData[cp]);
    }
    if (bytes.size === 1) constPos.set(pos, [...bytes][0]);
  }

  // Find constant runs
  const runs = [];
  let runStart = null;
  for (let pos = 0; pos <= minPtL; pos++) {
    if (constPos.has(pos)) {
      if (runStart === null) runStart = pos;
    } else {
      if (runStart !== null) {
        runs.push({ start: runStart, end: pos - 1, len: pos - runStart });
        runStart = null;
      }
    }
  }

  console.log(`\nConstant runs:`);
  for (const r of runs) console.log(`  ${r.start}-${r.end} (${r.len} chars)`);

  // Known structure
  const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
  const suffix1 = '","skip":{"intro":[';
  const suffix2 = '],"outro":[';
  const suffix3 = ']}}';

  // Verify prefix matches run 1
  if (runs[0]?.len !== prefix.length) {
    console.log(`\nWARNING: Run 1 length ${runs[0]?.len} != prefix length ${prefix.length}`);
    console.log('The domain might have changed. Let me check...');
    
    // Check how far the constant run goes
    console.log(`Run 1: positions ${runs[0]?.start}-${runs[0]?.end}`);
    
    // Try to figure out the actual prefix by checking what chars are constant
    // We know it starts with {"url":"https:\/\/
    const knownStart = '{"url":"https:\\/\\/';
    console.log(`Known start: ${knownStart.length} chars`);
  }

  const videoIdStart = prefix.length;
  const videoIdEnd = runs.length >= 2 ? runs[1].start - 1 : -1;
  const videoIdLen = videoIdEnd >= 0 ? videoIdEnd - videoIdStart + 1 : -1;

  console.log(`\nVideo ID: positions ${videoIdStart}-${videoIdEnd} (${videoIdLen} chars)`);
  if (runs.length >= 2) console.log(`Suffix1 run: ${runs[1].start}-${runs[1].end} (${runs[1].len} chars, expected ${suffix1.length})`);
  if (runs.length >= 3) console.log(`Suffix2 run: ${runs[2].start}-${runs[2].end} (${runs[2].len} chars, expected ${suffix2.length})`);

  // ═══════════════════════════════════════════════════════
  // BUILD TABLES
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  BUILDING DECRYPT TABLES');
  console.log('═══════════════════════════════════════════════════════\n');

  // tables[pos][byte] = char
  const tables = {};
  function addEntry(pos, byte, char) {
    if (!tables[pos]) tables[pos] = {};
    tables[pos][byte] = char;
  }

  // Add prefix entries
  for (let i = 0; i < prefix.length; i++) {
    const cp = cipherPos(i);
    for (const s of samples) {
      if (cp < s.cipherData.length) addEntry(i, s.cipherData[cp], prefix[i]);
    }
  }

  // Add suffix1 entries
  if (runs.length >= 2) {
    for (let i = 0; i < suffix1.length && i < runs[1].len; i++) {
      const pos = runs[1].start + i;
      const cp = cipherPos(pos);
      for (const s of samples) {
        if (cp < s.cipherData.length && pos < s.ptLen) addEntry(pos, s.cipherData[cp], suffix1[i]);
      }
    }
  }

  // Add suffix2 entries
  if (runs.length >= 3) {
    for (let i = 0; i < suffix2.length && i < runs[2].len; i++) {
      const pos = runs[2].start + i;
      const cp = cipherPos(pos);
      for (const s of samples) {
        if (cp < s.cipherData.length && pos < s.ptLen) addEntry(pos, s.cipherData[cp], suffix2[i]);
      }
    }
  }

  // Add suffix3 entries from END of each sample
  for (const s of samples) {
    const endChars = [']', '}', '}'];
    for (let offset = 0; offset < 3; offset++) {
      const pos = s.ptLen - 3 + offset;
      const cp = cipherPos(pos);
      if (cp < s.cipherData.length) addEntry(pos, s.cipherData[cp], endChars[offset]);
    }
  }

  // Also add the ] before ]}} — this is the outro closing bracket
  // And the [ before the outro numbers — but we need to know where that is
  // For samples where ptLen is known, the structure is:
  // ...suffix2...]}}
  // So position ptLen-4 should be a digit or comma (last outro number char)
  // And we can work backwards from ]}} to find the outro numbers

  // ═══════════════════════════════════════════════════════
  // RECOVER VIDEO IDs BY VERIFYING WITH MEGAUP
  // ═══════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RECOVERING VIDEO IDs');
  console.log('═══════════════════════════════════════════════════════\n');

  // For each sample, try to decode the video ID using what we have
  // Video IDs are alphanumeric chars
  // We have tables for positions 0-37 (prefix) and suffix positions
  // Video ID positions (38 to videoIdEnd) have NO entries yet
  // 
  // BUT: we can use the BYTE DIVERSITY at each video ID position
  // to figure out which chars map to which bytes.
  // 
  // Key insight: across all samples, the same byte at the same position
  // always maps to the same char. So if we see byte 0x42 at position 38
  // in multiple samples, it's always the same char.
  //
  // We can figure out WHICH char by:
  // 1. Grouping samples by their byte at each video ID position
  // 2. Samples with the same byte have the same char
  // 3. If we can verify ONE video ID, we learn all the chars for that sample
  //
  // To verify a video ID, we fetch https://megaup22.online/media/VIDEO_ID
  // A valid ID returns JSON with a "result" field.
  //
  // Strategy: For each unique combination of bytes at video ID positions,
  // we have a unique video ID. We need to figure out just ONE video ID
  // to bootstrap the process.
  //
  // We can try to figure out video IDs by:
  // - Looking at the byte values and guessing they might be sequential
  // - Using the fact that MegaUp video IDs follow a pattern
  // - Trying common video ID formats

  // First, let's see how many unique video IDs we have
  const videoIdBytes = {};  // sampleIdx → bytes at video ID positions
  for (let si = 0; si < samples.length; si++) {
    const s = samples[si];
    if (videoIdEnd < 0 || videoIdEnd >= s.ptLen) continue;
    const bytes = [];
    for (let pos = videoIdStart; pos <= videoIdEnd; pos++) {
      const cp = cipherPos(pos);
      if (cp < s.cipherData.length) bytes.push(s.cipherData[cp]);
    }
    videoIdBytes[si] = bytes;
  }

  // Group by video ID bytes (same bytes = same video ID)
  const groups = {};
  for (const [si, bytes] of Object.entries(videoIdBytes)) {
    const key = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    if (!groups[key]) groups[key] = [];
    groups[key].push(parseInt(si));
  }
  console.log(`Unique video IDs: ${Object.keys(groups).length}`);
  console.log(`Samples per video ID: ${Object.values(groups).map(g => g.length).join(', ')}`);

  // For each video ID position, count unique bytes
  console.log('\nByte diversity at video ID positions:');
  for (let pos = videoIdStart; pos <= Math.min(videoIdEnd, videoIdStart + 30); pos++) {
    const cp = cipherPos(pos);
    const bytes = new Set();
    for (const s of samples) {
      if (cp < s.cipherData.length && pos < s.ptLen) bytes.add(s.cipherData[cp]);
    }
    console.log(`  pos ${pos}: ${bytes.size} unique bytes`);
  }

  // ═══════════════════════════════════════════════════════
  // APPROACH: Use the intro/outro numbers to get more table entries
  // ═══════════════════════════════════════════════════════
  // The intro/outro numbers are digits (0-9) and comma.
  // These give us entries for positions in the number regions.
  // 
  // For samples with different ptLen, the number regions are at
  // different absolute positions, giving us entries at MORE positions.
  
  // For each sample, figure out where the numbers are
  // Structure: prefix + videoId + suffix1 + introNums + suffix2 + outroNums + suffix3
  // We know: prefix=38, suffix1=19, suffix2=11, suffix3=3
  // So: videoIdLen + introNumsLen + outroNumsLen = ptLen - 38 - 19 - 11 - 3 = ptLen - 71
  // And: videoIdLen is constant for all samples with the same ptLen? No — different video IDs
  // can have different lengths, and different intro/outro numbers have different lengths.
  
  // Actually, the video ID length is FIXED for a given server (MegaUp IDs are always the same length).
  // Let me check: do all samples have the same videoIdLen?
  // videoIdLen = runs[1].start - prefix.length
  // This is constant because runs[1].start is determined by the constant bytes.
  
  console.log(`\nVideo ID length: ${videoIdLen} (constant across all samples)`);
  console.log(`Intro numbers start at position: ${runs.length >= 2 ? runs[1].end + 1 : '?'}`);
  
  if (runs.length >= 3) {
    const introNumStart = runs[1].end + 1;
    const introNumEnd = runs[2].start - 1;
    const outroNumStart = runs[2].end + 1;
    
    console.log(`Intro numbers: positions ${introNumStart}-${introNumEnd} (${introNumEnd - introNumStart + 1} chars)`);
    console.log(`Outro numbers start: position ${outroNumStart}`);
    
    // For each sample, the outro numbers end at ptLen - 4 (before ]}})
    // So outroNumLen = ptLen - 4 - outroNumStart + 1 = ptLen - 3 - outroNumStart
    
    // The intro/outro numbers are like: 0,0 or 123,456 or 1300,1385
    // Digits: 0-9, comma
    // These are 11 possible chars at each number position
    
    // For each number position, collect the bytes from all samples
    // and try to figure out which byte maps to which digit
    
    // We can use the FREQUENCY of bytes to guess:
    // '0' is very common (many anime have 0,0 for intro/outro)
    // ',' appears exactly once per number pair
    
    // Let's look at the intro number bytes
    console.log('\nIntro number analysis:');
    for (let pos = introNumStart; pos <= introNumEnd; pos++) {
      const cp = cipherPos(pos);
      const byteCounts = {};
      for (const s of samples) {
        if (cp < s.cipherData.length && pos < s.ptLen) {
          const b = s.cipherData[cp];
          byteCounts[b] = (byteCounts[b] || 0) + 1;
        }
      }
      const sorted = Object.entries(byteCounts).sort((a, b) => b[1] - a[1]);
      console.log(`  pos ${pos}: ${sorted.length} unique bytes — top: ${sorted.slice(0, 5).map(([b, c]) => `0x${parseInt(b).toString(16).padStart(2, '0')}(${c})`).join(' ')}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // COVERAGE ANALYSIS
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  COVERAGE');
  console.log('═══════════════════════════════════════════════════════\n');

  let totalEntries = 0;
  for (let pos = 0; pos < 183; pos++) {
    const t = tables[pos] || {};
    const count = Object.keys(t).length;
    totalEntries += count;
    if (pos < 80 || count > 1) {
      const chars = [...new Set(Object.values(t))].sort().join('');
      const bar = '█'.repeat(Math.min(count, 40));
      if (pos < 80) console.log(`  pos ${pos.toString().padStart(3)}: ${count.toString().padStart(3)} entries [${chars.substring(0, 30)}] ${bar}`);
    }
  }
  console.log(`\nTotal entries: ${totalEntries}`);

  // Save tables
  const outFile = path.join(__dirname, 'kai-new-tables.json');
  const serializable = {};
  for (const [pos, entries] of Object.entries(tables)) {
    serializable[pos] = {};
    for (const [byte, char] of Object.entries(entries)) {
      serializable[pos][byte] = char;
    }
  }
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    numSamples: samples.length,
    totalEntries,
    videoIdLen,
    runs: runs.map(r => ({ start: r.start, end: r.end, len: r.len })),
    tables: serializable,
  }, null, 2));
  console.log(`\nSaved to ${outFile}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
