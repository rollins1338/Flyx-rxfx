#!/usr/bin/env node
/**
 * Crack AnimeKai tables v5 — The MegaUp Direct Approach
 * 
 * Strategy:
 * 1. For each AnimeKai lid, we get an encrypted response containing a MegaUp URL
 * 2. We can also get the MegaUp video ID by searching MegaUp directly
 * 3. If we find the video ID, we know the full plaintext and can build ALL tables
 * 
 * New approach: Use MegaUp's embed page to find video IDs.
 * The embed page at /e/VIDEO_ID shows the video title.
 * If we can match titles between AnimeKai episodes and MegaUp pages,
 * we can find the video IDs.
 * 
 * Even better: We know the AnimeKai response format. Let's figure out
 * the EXACT suffix by analyzing the 2-value positions.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
  } catch (err) {
    if (err.stdout?.trim()) return err.stdout.trim();
    return null;
  }
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

// Load existing samples
const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  data: Buffer.from(s.cipherHex, 'hex'),
}));
console.log(`Loaded ${samples.length} samples\n`);

// ═══════════════════════════════════════════════════════════
// STEP 1: Analyze the 2-value positions to determine suffix
// ═══════════════════════════════════════════════════════════

console.log('=== Analyzing 2-value positions (93-126) ===\n');

// Group samples by ptLen to find patterns
const byLen = {};
for (const s of samples) {
  if (!byLen[s.ptLen]) byLen[s.ptLen] = [];
  byLen[s.ptLen].push(s);
}

// For positions 93-126, each has exactly 2 cipher byte values
// This means the plaintext at those positions is one of 2 characters
// Let's see if the two groups correlate (same samples always pick the same "branch")

// Check: do all 2-value positions split the samples the same way?
const groups = {};
for (let pos = 93; pos <= 126; pos++) {
  const cp = cipherPos(pos);
  const vals = {};
  for (const s of samples) {
    if (cp < s.data.length) {
      const v = s.data[cp];
      if (!vals[v]) vals[v] = [];
      vals[v].push(s.lid);
    }
  }
  const keys = Object.keys(vals).sort();
  if (keys.length === 2) {
    groups[pos] = {
      byte0: parseInt(keys[0]),
      byte1: parseInt(keys[1]),
      group0: new Set(vals[keys[0]]),
      group1: new Set(vals[keys[1]]),
    };
  }
}

// Check if all positions split the same way
const pos93 = groups[93];
if (pos93) {
  console.log(`Position 93 splits into groups of ${pos93.group0.size} and ${pos93.group1.size}`);
  
  let allSame = true;
  for (let pos = 94; pos <= 126; pos++) {
    const g = groups[pos];
    if (!g) continue;
    
    // Check if group0 at this position matches group0 at pos 93
    const sameAsPos93 = [...g.group0].every(lid => pos93.group0.has(lid)) &&
                        [...g.group1].every(lid => pos93.group1.has(lid));
    const invertedFromPos93 = [...g.group0].every(lid => pos93.group1.has(lid)) &&
                              [...g.group1].every(lid => pos93.group0.has(lid));
    
    if (!sameAsPos93 && !invertedFromPos93) {
      allSame = false;
      console.log(`  Position ${pos}: DIFFERENT split pattern`);
    }
  }
  
  if (allSame) {
    console.log('All 2-value positions split samples the SAME way (or inverted)');
    console.log('This means the suffix has a binary choice at each position');
    console.log('Likely: the suffix contains a URL or ID that differs between sub/dub servers\n');
  }
}

// ═══════════════════════════════════════════════════════════
// STEP 2: Check if the split correlates with sub vs dub
// ═══════════════════════════════════════════════════════════

console.log('=== Checking sub/dub correlation ===\n');

// The lids might encode sub vs dub. Let's check the lid patterns
if (pos93) {
  console.log('Group 0 lids:', [...pos93.group0].slice(0, 10).join(', '));
  console.log('Group 1 lids:', [...pos93.group1].slice(0, 10).join(', '));
}

// ═══════════════════════════════════════════════════════════
// STEP 3: Try to decrypt using MegaUp directly
// ═══════════════════════════════════════════════════════════

console.log('\n=== Testing MegaUp megaup mode with known IDs ===\n');

// We know these old IDs work. Let's decrypt them to see the response format.
const testIds = ['jIrrLzj-WS2JcOLzF79O5xvpCQ', 'k5OoeWapWS2JcOLzF79O5xvpCQ'];

for (const id of testIds) {
  console.log(`Decrypting MegaUp /e/${id}...`);
  try {
    const result = rf(`https://megaup22.online/e/${id}`, 'megaup');
    if (result) {
      console.log(`  Result: ${result.substring(0, 300)}`);
      try {
        const parsed = JSON.parse(result);
        console.log(`  Keys: ${Object.keys(parsed).join(', ')}`);
        if (parsed.sources) console.log(`  Sources: ${JSON.stringify(parsed.sources).substring(0, 200)}`);
        if (parsed.tracks) console.log(`  Tracks: ${parsed.tracks.length} tracks`);
      } catch {}
    }
  } catch (e) {
    console.log(`  Error: ${e.message?.substring(0, 100)}`);
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════
// STEP 4: Figure out the video ID length
// ═══════════════════════════════════════════════════════════

console.log('=== Analyzing video ID length ===\n');

// The prefix is 38 chars: {"url":"https:\/\/megaup22.online\/e\/
// Position 92 is " (closing quote of the URL)
// So the video ID is at positions 38-91 = 54 chars
// 
// But old IDs are 26 chars. Maybe the URL includes query params?
// Like: https://megaup22.online/e/VIDEO_ID?k=1
// In JSON: https:\/\/megaup22.online\/e\/VIDEO_ID?k=1
// That would be: 26 (ID) + 4 (?k=1) = 30 chars for the ID+params
// But we see 54 chars. So maybe:
// - The ID format changed to be longer
// - Or there are more query params
// - Or the URL has additional path components

// Let's check: what if the video ID is actually shorter and the URL
// continues with something like ?k=1&...
// In that case, some positions in 38-91 would be constant (like '?' and '=')

// Check which positions in 38-91 have the fewest unique cipher bytes
console.log('Cipher byte diversity at video ID positions:');
for (let pos = 38; pos <= 91; pos++) {
  const cp = cipherPos(pos);
  const values = new Set();
  for (const s of samples) {
    if (cp < s.data.length) values.add(s.data[cp]);
  }
  const marker = values.size === 1 ? ' ★ CONSTANT' : values.size === 2 ? ' ◆ BINARY' : '';
  if (values.size <= 3 || pos <= 42 || pos >= 88) {
    console.log(`  pos ${pos}: ${values.size} unique values${marker} [${[...values].map(v => '0x'+v.toString(16).padStart(2,'0')).join(',')}]`);
  }
}

// ═══════════════════════════════════════════════════════════
// STEP 5: Try the MegaUp embed page approach
// ═══════════════════════════════════════════════════════════

console.log('\n=== Trying to find video IDs via MegaUp embed pages ===\n');

// For Bleach episode 1, we have lid=dIaz9KKh5Q
// The encrypted response contains the MegaUp URL
// Let's try to find the Bleach ep1 video on MegaUp by searching

// First, let's see what the MegaUp embed page looks like for a known ID
const embedHtml = rf('https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCQ', 'fetch', { 'Referer': 'https://animekai.to/' });
if (embedHtml) {
  // Look for any API calls or video ID references in the page
  const scriptMatches = embedHtml.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
  console.log(`Found ${scriptMatches.length} script tags in embed page`);
  
  // Look for video ID patterns
  const idPatterns = embedHtml.match(/[A-Za-z0-9_-]{20,}/g) || [];
  console.log(`Found ${idPatterns.length} potential IDs (20+ chars)`);
  for (const id of idPatterns.slice(0, 5)) {
    console.log(`  ${id.substring(0, 60)} (${id.length} chars)`);
  }
}

// ═══════════════════════════════════════════════════════════
// STEP 6: The ptLen analysis — figure out the suffix
// ═══════════════════════════════════════════════════════════

console.log('\n=== ptLen analysis for suffix determination ===\n');

// ptLen varies: 169-181. The video ID is 54 chars (positions 38-91).
// Prefix = 38 chars. So suffix = ptLen - 38 - 54 = ptLen - 92
// Suffix lengths: 77-89 chars

// The suffix starts at position 92 with "
// So the suffix is: " + JSON_CONTINUATION
// Suffix length 77 means: " + 76 chars of JSON
// Suffix length 89 means: " + 88 chars of JSON

// Common JSON patterns after a URL:
// ","skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// That's 63 chars + variable number digits

// Let's check: " + ,"skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}
// = 1 + 63 = 64 chars... but we need 77-89. So there's more.

// Maybe: ","skip":{"intro":{"start":NNN,"end":NNNN},"outro":{"start":NNNN,"end":NNNN}}}
// The numbers vary, explaining the different ptLen values!

// Let's verify: the suffix " + ,"skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}
// has length 1 + 1 + 6 + 2 + 7 + 2 + 7 + 1 + 5 + 1 + 5 + 2 + 7 + 2 + 7 + 1 + 5 + 1 + 5 + 3
// Let me just count: ","skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}
const testSuffix = '","skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}';
console.log(`Test suffix: ${testSuffix}`);
console.log(`Test suffix length: ${testSuffix.length}`);
console.log(`Total with prefix(38) + videoId(54) + suffix: ${38 + 54 + testSuffix.length}`);

// That gives 38 + 54 + 66 = 158. But our ptLen is 169-181.
// So the suffix is longer. Maybe there are more fields.

// Let's try: ","skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}},"sources":[...]}
// Or maybe the response has a different structure entirely.

// Actually, let's look at what the MegaUp decrypt gives us for known IDs
// to understand the FULL response structure
console.log('\nFull MegaUp response structure:');
for (const id of testIds) {
  try {
    const result = rf(`https://megaup22.online/e/${id}`, 'megaup');
    if (result) {
      const parsed = JSON.parse(result);
      console.log(`\nID: ${id}`);
      console.log(`Full response: ${JSON.stringify(parsed).substring(0, 500)}`);
      console.log(`Response length: ${JSON.stringify(parsed).length}`);
    }
  } catch (e) {
    console.log(`Error for ${id}: ${e.message?.substring(0, 100)}`);
  }
}

// ═══════════════════════════════════════════════════════════
// STEP 7: The AnimeKai response is NOT the MegaUp response!
// It's the AnimeKai wrapper around the MegaUp URL.
// The format is: {"url":"https://megaup22.online/e/VIDEO_ID","skip":...}
// Let's figure out the exact "skip" structure.
// ═══════════════════════════════════════════════════════════

console.log('\n=== Determining AnimeKai response structure ===\n');

// The AnimeKai /ajax/links/view response (after decryption) should be:
// {"url":"https:\/\/megaup22.online\/e\/VIDEO_ID","skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// 
// But wait — the old working decrypt gave us this format. Let me check
// what the old animekai-crypto.ts decrypt produced.

// Actually, let me look at the test-anime-multi-series.js to see how
// the decrypted response was parsed:
// let decrypted = kaiDecrypt(embedData.result);
// decrypted = decrypted.replace(/\}([0-9A-Fa-f]{2})/g, ...)
// const parsed = JSON.parse(decrypted);
// embedUrl = parsed.url || '';
// 
// So the response is JSON with a "url" field. The "skip" field is optional.

// The key question: what's the EXACT suffix after the video ID?
// Let's figure this out by looking at the ptLen distribution more carefully.

// If the suffix is: ","skip":{"intro":{"start":NNN,"end":NNN},"outro":{"start":NNN,"end":NNN}}}
// Then the variable part is the 8 numbers (4 start/end pairs × 2 intro/outro)
// Each number could be 1-4 digits (0-9999)
// 
// Fixed part of suffix: ","skip":{"intro":{"start":,"end":},"outro":{"start":,"end":}}}
// That's: 2+6+2+7+2+1+5+1+2+7+2+1+5+1+3 = let me count character by character

const fixedSuffix = '","skip":{"intro":{"start":,"end":},"outro":{"start":,"end":}}}';
console.log(`Fixed suffix template: ${fixedSuffix}`);
console.log(`Fixed suffix length: ${fixedSuffix.length}`);

// Fixed suffix = 63 chars. Variable = 8 numbers.
// Total suffix = 63 + sum of digit counts
// ptLen = 38 + 54 + suffix_len = 92 + suffix_len
// suffix_len = ptLen - 92
// So: 63 + digits = ptLen - 92
// digits = ptLen - 155

// For ptLen=169: digits = 14 (avg 1.75 digits per number)
// For ptLen=179: digits = 24 (avg 3 digits per number)
// For ptLen=181: digits = 26 (avg 3.25 digits per number)

// This makes sense! The intro/outro timestamps are typically 0-1500 seconds.

console.log('\nDigit count analysis:');
for (const [len, count] of Object.entries(byLen).sort((a, b) => a[0] - b[0])) {
  const suffixLen = parseInt(len) - 92;
  const digits = parseInt(len) - 155;
  console.log(`  ptLen=${len}: suffix=${suffixLen} chars, ${digits} total digits across 8 numbers (${count} samples)`);
}

// Now let's verify this theory by checking if the constant positions
// match the fixed characters in the suffix template
console.log('\n=== Verifying suffix template ===\n');

// The suffix starts at position 92
// Position 92: " (already confirmed constant)
// Position 93: , 
// Position 94: "
// Position 95: s
// Position 96: k
// Position 97: i
// Position 98: p
// Position 99: "
// Position 100: :
// Position 101: {
// Position 102: "
// Position 103: i
// Position 104: n
// Position 105: t
// Position 106: r
// Position 107: o
// Position 108: "
// Position 109: :
// Position 110: {
// Position 111: "
// Position 112: s
// Position 113: t
// Position 114: a
// Position 115: r
// Position 116: t
// Position 117: "
// Position 118: :
// Then a variable number (intro start)

// But wait — positions 93-126 have 2 unique values, not 1!
// This means the suffix is NOT always the same at those positions.
// There must be TWO different suffix patterns.

// Hypothesis: some responses have "skip" and some don't.
// Or: some have "intro"/"outro" and some have different keys.

// Let's check: do the two groups at position 93 correlate with ptLen?
if (pos93) {
  const lens0 = {};
  const lens1 = {};
  for (const s of samples) {
    if (pos93.group0.has(s.lid)) {
      lens0[s.ptLen] = (lens0[s.ptLen] || 0) + 1;
    } else if (pos93.group1.has(s.lid)) {
      lens1[s.ptLen] = (lens1[s.ptLen] || 0) + 1;
    }
  }
  console.log('Group 0 ptLen distribution:', JSON.stringify(lens0));
  console.log('Group 1 ptLen distribution:', JSON.stringify(lens1));
}
