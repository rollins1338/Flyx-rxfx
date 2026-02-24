#!/usr/bin/env node
/**
 * Brute-force build AnimeKai's NEW server-side decrypt tables.
 * 
 * We collect MANY encrypted link/view responses. We know the plaintext format:
 *   {"url":"https:\/\/DOMAIN\/e\/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
 * 
 * For each position, we collect (cipherByte, plaintextChar) pairs.
 * With enough samples covering all 95 printable ASCII chars at each position,
 * we can build complete substitution tables.
 * 
 * The trick: we figure out the FULL plaintext for each sample by:
 * 1. Known prefix: {"url":"https:\/\/
 * 2. Domain: determined by checking which bytes are constant across all samples
 * 3. Video ID: varies, but we can get it from the embed URL pattern
 * 4. Suffix: ","skip":{"intro":[N,N],"outro":[N,N]}}
 * 
 * We also independently fetch the actual embed URL for each lid to get the
 * EXACT plaintext, giving us ground truth.
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
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs },
      timeout: 15000,
    };
    https.get(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d, headers: r.headers }));
    }).on('error', rej).on('timeout', () => rej(new Error('timeout')));
  });
}

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], {
    encoding: 'utf8', timeout: 8000, windowsHide: true
  }).trim();
}

function rustFetch(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '15', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 20000, maxBuffer: 10*1024*1024, windowsHide: true }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function b64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

/**
 * For a given lid, get the encrypted response AND try to figure out the
 * actual embed URL by fetching the MegaUp page independently.
 */
async function getEmbedUrlForLid(lid, encLid) {
  // Get encrypted response
  const viewResp = await fetchUrl(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
  const viewData = JSON.parse(viewResp.body);
  if (!viewData.result) return null;
  
  return { encrypted: viewData.result };
}

async function collectFullPairs() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  COLLECTING ENCRYPTED RESPONSES');
  console.log('═══════════════════════════════════════════════════════\n');

  const samples = [];
  const queries = [
    'bleach', 'naruto', 'dragon ball z', 'jujutsu kaisen',
    'death note', 'demon slayer', 'attack on titan',
    'fullmetal alchemist', 'hunter x hunter', 'my hero academia',
    'sword art online', 'tokyo ghoul', 'one punch man',
    'fairy tail', 'black clover', 'spy x family',
    'chainsaw man', 'mob psycho', 'vinland saga', 'cowboy bebop',
    'steins gate', 'code geass', 'neon genesis evangelion',
    'gintama', 'haikyuu', 'kuroko no basket',
    'parasyte', 'psycho pass', 'erased', 'toradora',
  ];

  for (const query of queries) {
    if (samples.length >= 80) break;
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

      // Get multiple episode tokens for diversity
      const tokens = [...epData.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]).slice(0, 3);

      for (const token of tokens) {
        const encToken = rustExec(token, 'kai-encrypt');
        const srvResp = await fetchUrl(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
        const srvData = JSON.parse(srvResp.body);
        if (!srvData.result) continue;

        const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);

        for (const lid of lids.slice(0, 4)) {
          try {
            const encLid = rustExec(lid, 'kai-encrypt');
            const result = await getEmbedUrlForLid(lid, encLid);
            if (!result) continue;

            const raw = b64Decode(result.encrypted);
            const cipherData = raw.slice(21);
            const ptLen = cipherData.length > 20 ? 7 + (cipherData.length - 20) : 1;

            samples.push({
              encrypted: result.encrypted,
              cipherData,
              ptLen,
              query,
              lid,
            });
            process.stdout.write(`  [${samples.length}] ${query.padEnd(25)} lid=${lid} ptLen=${ptLen}\n`);
          } catch {}
        }
        if (samples.length >= 80) break;
      }
    } catch (e) {
      // skip
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nCollected ${samples.length} samples\n`);
  return samples;
}

function analyzeAndBuildTables(samples) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  BUILDING DECRYPT TABLES FROM KNOWN PLAINTEXT');
  console.log('═══════════════════════════════════════════════════════\n');

  // STEP 1: Figure out the full known plaintext structure
  // Check which positions have identical bytes across ALL samples
  const minPtLen = Math.min(...samples.map(s => s.ptLen));
  console.log(`Min plaintext length: ${minPtLen}`);
  console.log(`Sample count: ${samples.length}\n`);

  // For each position, collect all observed cipher bytes
  const posByteSets = {};
  for (let pos = 0; pos < minPtLen; pos++) {
    const cp = cipherPos(pos);
    const bytes = new Set();
    for (const s of samples) {
      if (cp < s.cipherData.length) bytes.add(s.cipherData[cp]);
    }
    posByteSets[pos] = bytes;
  }

  // Identify constant positions (same byte in ALL samples = same plaintext char)
  const constantPositions = [];
  for (let pos = 0; pos < minPtLen; pos++) {
    if (posByteSets[pos].size === 1) constantPositions.push(pos);
  }

  console.log(`Constant positions (same char in all samples): ${constantPositions.length}`);
  console.log(`Varying positions: ${minPtLen - constantPositions.length}\n`);

  // STEP 2: Determine the known plaintext
  // We know it starts with: {"url":"https:\/\/
  const knownPrefix = '{"url":"https:\\/\\/';
  
  // The constant positions after the prefix tell us the domain
  // Let's figure out the domain by looking at how many constant positions
  // follow the prefix
  let lastConstant = knownPrefix.length - 1;
  for (let pos = knownPrefix.length; pos < minPtLen; pos++) {
    if (posByteSets[pos].size === 1) {
      lastConstant = pos;
    } else {
      break; // First varying position = start of video ID
    }
  }
  
  console.log(`Last constant position before first varying: ${lastConstant}`);
  console.log(`Domain + path prefix length: ${lastConstant + 1 - knownPrefix.length} chars after "https:\\/\\/"\n`);

  // STEP 3: Build the encrypt table (byte→char) for each position
  // For known prefix positions, we know the exact char
  const encryptTable = {}; // pos → { byte → char }
  
  // Add known prefix
  for (let pos = 0; pos < knownPrefix.length; pos++) {
    const cp = cipherPos(pos);
    const byte = [...posByteSets[pos]][0];
    if (!encryptTable[pos]) encryptTable[pos] = {};
    encryptTable[pos][byte] = knownPrefix[pos];
  }

  // STEP 4: Figure out the domain
  // We need to determine what chars are at positions knownPrefix.length to lastConstant
  // These are constant across all samples, so they're part of the domain/path
  
  // Strategy: try common domains and see which one produces consistent mappings
  const testDomains = [
    '4spromax.site\\/e\\/',
    'megaup22.online\\/e\\/',
    'megacloud.blog\\/embed-2\\/v3\\/e-1\\/',
    'rapid-cloud.co\\/embed-6\\/v2\\/',
    'megacloud.club\\/e\\/',
    'megaup.biz\\/e\\/',
    'vidplay.online\\/e\\/',
    'vidplay.site\\/e\\/',
    'mcloud.bz\\/e\\/',
    'rabbitstream.net\\/v2\\/embed-4\\/',
  ];

  let bestDomain = null;
  let bestDomainScore = 0;

  for (const domain of testDomains) {
    const fullPrefix = knownPrefix + domain;
    let score = 0;
    let valid = true;
    
    for (let pos = knownPrefix.length; pos < Math.min(fullPrefix.length, minPtLen); pos++) {
      if (posByteSets[pos].size !== 1) {
        // This position varies — if we're still in the domain, it's wrong
        valid = false;
        break;
      }
      score++;
    }
    
    if (valid && score > bestDomainScore) {
      bestDomainScore = score;
      bestDomain = domain;
    }
  }

  if (bestDomain) {
    console.log(`Best domain match: ${bestDomain} (score: ${bestDomainScore})`);
    const fullPrefix = knownPrefix + bestDomain;
    
    // Add domain chars to the encrypt table
    for (let pos = knownPrefix.length; pos < Math.min(fullPrefix.length, minPtLen); pos++) {
      if (posByteSets[pos].size === 1) {
        const cp = cipherPos(pos);
        const byte = [...posByteSets[pos]][0];
        if (!encryptTable[pos]) encryptTable[pos] = {};
        encryptTable[pos][byte] = fullPrefix[pos];
      }
    }
  } else {
    console.log('No domain matched! Trying to figure it out from constant bytes...');
    // We'll figure out the domain chars later using the suffix
  }

  // STEP 5: Add suffix chars
  // The suffix is: ","skip":{"intro":[N,N],"outro":[N,N]}}
  // Working backwards from the end:
  // pos[-1] = '}'
  // pos[-2] = '}'
  // pos[-3] = ']'
  // Then digits and comma (variable)
  // Then '['
  // Then ':'
  // Then '"outro"' = " o u t r o "
  // Then ','
  // Then ']'
  // Then digits and comma (variable)
  // Then '['
  // Then ':'
  // Then '"intro"' = " i n t r o "
  // Then ':'
  // Then '{'
  // Then '"skip"' = " s k i p "
  // Then ':'
  // Then ','
  // Then '"' (end of URL value)

  // The fixed suffix chars (from end):
  const suffixFromEnd = [
    { offset: 1, char: '}' },
    { offset: 2, char: '}' },
    { offset: 3, char: ']' },
    // Then variable digits... skip
  ];

  // For each sample, we know the last 3 chars
  for (const s of samples) {
    for (const { offset, char } of suffixFromEnd) {
      const pos = s.ptLen - offset;
      const cp = cipherPos(pos);
      if (cp >= s.cipherData.length) continue;
      const byte = s.cipherData[cp];
      if (!encryptTable[pos]) encryptTable[pos] = {};
      encryptTable[pos][byte] = char;
    }
  }

  // STEP 6: For the varying positions (video ID, numbers), we need multiple samples
  // with different chars at the same position to build the full table.
  // 
  // But we can also use the STRUCTURE to figure out more chars.
  // After the video ID, the next char is always '"' (end of URL)
  // Then ',' then '"' then 's' then 'k' then 'i' then 'p' then '"' then ':' then '{'
  // Then '"' then 'i' then 'n' then 't' then 'r' then 'o' then '"' then ':' then '['
  
  // Let's find where the video ID ends by looking for the first varying position
  // after the domain prefix, then find where it becomes constant again
  
  const fullPrefix = bestDomain ? knownPrefix + bestDomain : knownPrefix;
  let videoIdStart = fullPrefix.length;
  let videoIdEnd = videoIdStart;
  
  // Find where varying positions end (= end of video ID)
  for (let pos = videoIdStart; pos < minPtLen; pos++) {
    if (posByteSets[pos].size > 1) {
      videoIdEnd = pos + 1;
    } else {
      // Check if this is the start of the suffix
      // After video ID, we should see constant chars for ","skip":{"intro":[
      let suffixLen = 0;
      for (let p = pos; p < minPtLen && posByteSets[p].size === 1; p++) {
        suffixLen++;
      }
      if (suffixLen >= 5) {
        // This looks like the start of the suffix
        videoIdEnd = pos;
        break;
      }
    }
  }
  
  console.log(`\nVideo ID range: positions ${videoIdStart} to ${videoIdEnd - 1}`);
  
  // The suffix after the video ID is: ","skip":{"intro":[
  const suffixAfterVideoId = '","skip":{"intro":[';
  
  // Add suffix chars to the table
  for (let i = 0; i < suffixAfterVideoId.length; i++) {
    const pos = videoIdEnd + i;
    if (pos >= minPtLen) break;
    if (posByteSets[pos].size !== 1) continue; // Should be constant
    
    const cp = cipherPos(pos);
    const byte = [...posByteSets[pos]][0];
    if (!encryptTable[pos]) encryptTable[pos] = {};
    encryptTable[pos][byte] = suffixAfterVideoId[i];
  }

  // After the intro numbers: ],"outro":[
  // We need to find where the intro numbers end
  // The intro numbers are digits and comma, then ']'
  // Let's find the ']' after the intro numbers
  
  const introStart = videoIdEnd + suffixAfterVideoId.length;
  // Intro numbers are at introStart, introStart+1, etc.
  // They vary (digits), then we hit ']'
  // Then: ,"outro":[
  // Then outro numbers (vary)
  // Then: ]}}
  
  // Let's find the constant region after the intro numbers
  let afterIntroStart = introStart;
  for (let pos = introStart; pos < minPtLen; pos++) {
    if (posByteSets[pos].size === 1) {
      // Check if this starts a long constant region
      let constLen = 0;
      for (let p = pos; p < minPtLen && posByteSets[p].size === 1; p++) constLen++;
      if (constLen >= 5) {
        afterIntroStart = pos;
        break;
      }
    }
  }
  
  const afterIntroSuffix = '],"outro":[';
  for (let i = 0; i < afterIntroSuffix.length; i++) {
    const pos = afterIntroStart + i;
    if (pos >= minPtLen) break;
    if (posByteSets[pos].size !== 1) continue;
    
    const cp = cipherPos(pos);
    const byte = [...posByteSets[pos]][0];
    if (!encryptTable[pos]) encryptTable[pos] = {};
    encryptTable[pos][byte] = afterIntroSuffix[i];
  }

  // STEP 7: Now we have char→byte mappings for many positions.
  // But we need FULL tables (all 95 printable ASCII chars per position).
  // For positions where we only have 1 char, we need more samples.
  // 
  // However, for the VIDEO ID positions, we have MANY different chars
  // across our samples (a-z, A-Z, 0-9, etc.)
  // Let's build tables from those.
  
  // For video ID positions, each sample has a different char
  // We need to figure out what char each sample has at each position
  // We can do this by looking at the embed URL pattern
  
  // Actually, let's take a different approach for video ID chars:
  // We know video IDs are alphanumeric. For each sample, the video ID
  // is a specific string. If we can figure out ONE sample's video ID,
  // we can map all the bytes.
  
  // But we don't know the video IDs... unless we can get them independently.
  // The video ID is in the MegaUp embed URL. We can try to fetch the
  // MegaUp page to get it, but that requires knowing the URL first (chicken-and-egg).
  
  // ALTERNATIVE: Use the DIGIT positions (intro/outro numbers) to build
  // tables for digits. The intro/outro numbers are small integers (0-9999).
  // Each sample has different numbers, giving us different digit chars.
  
  // For now, let's output what we have and see how many positions we've covered.
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TABLE COVERAGE SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  let coveredPositions = 0;
  let totalEntries = 0;
  
  for (let pos = 0; pos < minPtLen; pos++) {
    const entries = encryptTable[pos] ? Object.keys(encryptTable[pos]).length : 0;
    if (entries > 0) {
      coveredPositions++;
      totalEntries += entries;
    }
  }
  
  console.log(`Positions with at least 1 entry: ${coveredPositions}/${minPtLen}`);
  console.log(`Total byte→char entries: ${totalEntries}`);
  console.log(`Average entries per covered position: ${(totalEntries / coveredPositions).toFixed(1)}`);
  
  // Print the known plaintext reconstruction
  console.log('\nReconstructed plaintext (first sample):');
  const s0 = samples[0];
  let reconstructed = '';
  for (let pos = 0; pos < s0.ptLen; pos++) {
    const cp = cipherPos(pos);
    if (cp >= s0.cipherData.length) { reconstructed += '?'; continue; }
    const byte = s0.cipherData[cp];
    const char = encryptTable[pos]?.[byte];
    reconstructed += char || '·';
  }
  console.log(`  ${reconstructed}`);
  
  // Now build the FULL decrypt tables
  // For each position, we need: for every possible byte (0-255), what char does it map to?
  // We only have a few entries per position from our samples.
  // 
  // KEY INSIGHT: The substitution tables are BIJECTIVE for printable ASCII.
  // Each table maps 95 printable chars (32-126) to 95 unique bytes.
  // Non-printable chars map to a "default" byte.
  // 
  // With enough samples, we can build the full table.
  // But we need ~95 different chars at each position.
  // With 80 samples, we might have enough for some positions.
  
  // Let's count how many unique chars we have at each varying position
  console.log('\nVarying position coverage:');
  for (let pos = videoIdStart; pos < Math.min(videoIdEnd + 30, minPtLen); pos++) {
    const cp = cipherPos(pos);
    const uniqueBytes = posByteSets[pos].size;
    const knownEntries = encryptTable[pos] ? Object.keys(encryptTable[pos]).length : 0;
    if (uniqueBytes > 1) {
      console.log(`  pos ${pos}: ${uniqueBytes} unique bytes, ${knownEntries} known entries`);
    }
  }
  
  return { encryptTable, samples, minPtLen, videoIdStart, videoIdEnd, fullPrefix };
}

async function main() {
  const samples = await collectFullPairs();
  if (samples.length < 5) {
    console.log('Not enough samples!');
    return;
  }
  
  const result = analyzeAndBuildTables(samples);
  
  // Save intermediate results
  const outFile = path.join(__dirname, 'kai-bruteforce-result.json');
  const serializable = {
    timestamp: new Date().toISOString(),
    numSamples: result.samples.length,
    minPtLen: result.minPtLen,
    videoIdStart: result.videoIdStart,
    videoIdEnd: result.videoIdEnd,
    fullPrefix: result.fullPrefix,
    // Save encrypt table entries
    encryptTable: Object.fromEntries(
      Object.entries(result.encryptTable).map(([pos, entries]) => [
        pos,
        Object.fromEntries(Object.entries(entries).map(([byte, char]) => [byte, char]))
      ])
    ),
    // Save raw cipher data for each sample
    samples: result.samples.map(s => ({
      query: s.query,
      lid: s.lid,
      ptLen: s.ptLen,
      cipherHex: s.cipherData.toString('hex'),
    })),
  };
  fs.writeFileSync(outFile, JSON.stringify(serializable, null, 2));
  console.log(`\nResults saved to ${outFile}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
