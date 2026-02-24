#!/usr/bin/env node
/**
 * Crack AnimeKai tables v11 — Collect MASSIVE samples + build complete tables
 * 
 * Strategy:
 * 1. Collect 200+ samples from many different anime (varied skip values)
 * 2. For each position, determine if it's constant or variable
 * 3. For constant positions, we know the plaintext → build table entry
 * 4. For variable positions (digits in skip values, video ID chars),
 *    cross-reference with known data to determine mappings
 * 5. Output complete tables for Rust
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];

function rf(url, extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', 'fetch', '--timeout', '20',
    '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, {
      encoding: 'utf8', timeout: 30000,
      maxBuffer: 10*1024*1024, windowsHide: true
    }).trim();
  } catch(e) { return e.stdout?.trim() || ''; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'],
    { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01'
};

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rf(`${domain}${urlPath}`,
        { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
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

function decodeSample(b64str) {
  const b64 = b64str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
  const full = Buffer.from(padded, 'base64');
  // Full cipher = 21-byte header + encrypted block
  // The encrypted block starts at offset 21
  const enc = full.slice(21);
  const dataLen = enc.length;
  const ptLen = dataLen > 20 ? 7 + (dataLen - 20) : 0;
  return { enc, ptLen, full };
}

function getEncByte(enc, plainPos) {
  const cp = cipherPos(plainPos);
  return cp < enc.length ? enc[cp] : undefined;
}

// Load existing samples
const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));

// Check if existing samples include header or not
const s0hex = existing.samples[0].cipherHex;
const s0buf = Buffer.from(s0hex, 'hex');
const HEADER = Buffer.from([0xc5,0x09,0xbd,0xb4,0x97,0xcb,0xc0,0x68,0x73,0xff,
  0x41,0x2a,0xf1,0x2f,0xd8,0x00,0x76,0x24,0xc2,0x9f,0xaa]);
const startsWithHeader = s0buf.slice(0, 21).equals(HEADER);

let samples = existing.samples.map(s => {
  const buf = Buffer.from(s.cipherHex, 'hex');
  let enc;
  if (startsWithHeader) {
    enc = buf.slice(21);
  } else {
    enc = buf; // already just the encrypted block
  }
  return { ...s, enc, ptLen: s.ptLen };
});

console.log(`Loaded ${samples.length} existing samples (header=${startsWithHeader})`);
console.log(`Sample 0: ptLen=${samples[0].ptLen}, enc.length=${samples[0].enc.length}`);
console.log(`  enc[cipherPos(0)] = 0x${samples[0].enc[cipherPos(0)]?.toString(16)} (expect 0xd4 for '{')`);

// Verify: from v7.json, pos 0 byte 212 (0xd4) -> '{'
// If enc[0] = 0xd4, then enc is the encrypted block without header
if (samples[0].enc[0] === 0xd4) {
  console.log('  ✓ Confirmed: enc data is encrypted block (no header)');
} else {
  console.log('  ✗ Unexpected byte at pos 0, checking with header offset...');
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: Collect fresh samples from many anime
// ═══════════════════════════════════════════════════════════

const ANIME_LIST = [
  'one piece', 'attack on titan', 'demon slayer', 'my hero academia',
  'spy x family', 'chainsaw man', 'solo leveling', 'blue lock',
  'tokyo ghoul', 'sword art online', 'hunter x hunter', 'fairy tail',
  'fullmetal alchemist', 'mob psycho 100', 'vinland saga',
  'mushoku tensei', 'overlord', 'shield hero', 'black clover',
  'fire force', 'dr stone', 'promised neverland', 'death parade',
  'steins gate', 'code geass', 'cowboy bebop', 'samurai champloo',
  'trigun', 'inuyasha', 'yu yu hakusho',
];

console.log(`\nCollecting samples from ${ANIME_LIST.length} anime...`);

const freshSamples = [];

for (const query of ANIME_LIST) {
  try {
    const searchData = kaiFetch(`/ajax/anime/search?keyword=${encodeURIComponent(query)}`);
    if (!searchData?.result?.html) continue;

    const slugRe = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
    const results = [];
    let m;
    while ((m = slugRe.exec(searchData.result.html)) !== null)
      results.push({ slug: m[1], title: m[2].trim() });
    if (!results.length) continue;

    let contentId = null;
    for (const domain of KAI_DOMAINS) {
      try {
        const html = rf(`${domain}/watch/${results[0].slug}`,
          { 'Referer': `${domain}/` });
        const sync = html.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
        if (sync) { contentId = JSON.parse(sync[1]).anime_id; break; }
      } catch {}
    }
    if (!contentId) continue;

    const encId = kaiEncrypt(contentId);
    const epData = kaiFetch(`/ajax/episodes/list?ani_id=${contentId}&_=${encId}`);
    if (!epData?.result) continue;

    const episodes = {};
    const epRe = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"/gi;
    while ((m = epRe.exec(epData.result)) !== null) episodes[m[1]] = m[2];
    const epRe2 = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"/gi;
    while ((m = epRe2.exec(epData.result)) !== null) { if (!episodes[m[2]]) episodes[m[2]] = m[1]; }

    for (const epNum of ['1', '2', '5', '12', '24']) {
      const token = episodes[epNum];
      if (!token) continue;

      const encToken = kaiEncrypt(token);
      const srvData = kaiFetch(`/ajax/links/list?token=${token}&_=${encToken}`);
      if (!srvData?.result) continue;

      const lidRe = /data-lid="([^"]+)"/g;
      const lids = new Set();
      while ((m = lidRe.exec(srvData.result)) !== null) lids.add(m[1]);

      for (const lid of lids) {
        try {
          const encLid = kaiEncrypt(lid);
          const embedData = kaiFetch(`/ajax/links/view?id=${lid}&_=${encLid}`);
          if (!embedData?.result || typeof embedData.result !== 'string') continue;

          const { enc, ptLen } = decodeSample(embedData.result);
          if (ptLen < 100) continue;

          freshSamples.push({
            query, lid, ptLen, epNum: parseInt(epNum),
            enc, cipherHex: Buffer.concat([HEADER, enc]).toString('hex'),
          });
        } catch {}
      }
    }
    process.stdout.write(`  ${query.padEnd(25)} → ${freshSamples.length} samples\n`);
  } catch (e) {
    process.stdout.write(`  ${query.padEnd(25)} → error: ${e.message?.substring(0,50)}\n`);
  }
}

console.log(`\nFresh samples: ${freshSamples.length}`);

// Merge all samples, deduplicate by lid
const allByLid = {};
for (const s of [...samples, ...freshSamples]) {
  if (!allByLid[s.lid]) allByLid[s.lid] = s;
}
const allSamples = Object.values(allByLid);
console.log(`Total unique samples: ${allSamples.length}`);

// Split into groups
const cp93val = cipherPos(93);
const groups = {};
for (const s of allSamples) {
  const b = s.enc[cp93val];
  if (b === undefined) continue;
  if (!groups[b]) groups[b] = [];
  groups[b].push(s);
}
const sortedGroups = Object.entries(groups).sort((a, b) => {
  const avgA = a[1].reduce((s, x) => s + x.ptLen, 0) / a[1].length;
  const avgB = b[1].reduce((s, x) => s + x.ptLen, 0) / b[1].length;
  return avgA - avgB;
});
const g0 = sortedGroups[0][1];
const g1 = sortedGroups[1][1];
console.log(`Groups: g0=${g0.length} (byte 0x${sortedGroups[0][0]}), g1=${g1.length} (byte 0x${sortedGroups[1][0]})`);

// ═══════════════════════════════════════════════════════════
// PHASE 2: Build tables from known constant positions
// ═══════════════════════════════════════════════════════════

const PREFIX = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
// pos 0-37 = PREFIX (38 chars)
// pos 92 = " (closing quote of URL)
// pos 93+ = suffix starting with ,"skip":{"intro":{"start":

const tables = {}; // tables[pos][cipherByte] = plainChar

function addEntry(pos, cipherByte, plainChar) {
  if (cipherByte === undefined) return;
  if (!tables[pos]) tables[pos] = {};
  const existing = tables[pos][cipherByte];
  if (existing && existing !== plainChar) {
    console.error(`CONFLICT at pos ${pos}: byte 0x${cipherByte.toString(16)} -> '${existing}' vs '${plainChar}'`);
    return;
  }
  tables[pos][cipherByte] = plainChar;
}

// Add prefix entries (pos 0-37)
for (let i = 0; i < PREFIX.length; i++) {
  // All samples should have the same byte here
  const byte = allSamples[0].enc[cipherPos(i)];
  addEntry(i, byte, PREFIX[i]);
}

// Add pos 92 = " (ALL_CONST across both groups)
{
  const byte = allSamples[0].enc[cipherPos(92)];
  addEntry(92, byte, '"');
}

// For the suffix, we need to figure out the EXACT plaintext at each position.
// The suffix format is: ,"skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// 
// Constant chars in the suffix template:
const SUFFIX_TEMPLATE = ',"skip":{"intro":{"start":';
// pos 93-118 = SUFFIX_TEMPLATE (26 chars)

for (let i = 0; i < SUFFIX_TEMPLATE.length; i++) {
  const pos = 93 + i;
  // These are GROUP_CONST — same within each group but potentially different between groups.
  // Actually from v10 output, pos 93-126 are GROUP_CONST.
  // For g0, add the g0 byte. For g1, add the g1 byte.
  // Both map to the same plaintext char (the suffix is the same structure for both groups,
  // just shifted by 2 positions).
  
  // For g0: suffix starts at pos 93
  const g0byte = g0[0].enc[cipherPos(pos)];
  addEntry(pos, g0byte, SUFFIX_TEMPLATE[i]);
  
  // For g1: suffix starts at pos 95 (2 positions later)
  const g1pos = pos + 2;
  const g1byte = g1[0].enc[cipherPos(g1pos)];
  addEntry(g1pos, g1byte, SUFFIX_TEMPLATE[i]);
}

// Now we need to figure out what's at positions 119-126 (g0) / 121-128 (g1)
// These are constant within each group.
// The suffix after "start": is a NUMBER, then ,"end":NUMBER},"outro":{"start":NUMBER,"end":NUMBER}}}
//
// From v10: pos 119-126 are CONSTANT for g0 (all 41 samples).
// This means the intro_start value is the SAME for all g0 samples.
// And positions 119-126 contain: intro_start_digits + ,"end": + possibly intro_end_digits
//
// Let me figure out what number makes positions 119-126 constant.
// If intro_start = 0 (1 digit):
//   pos 119 = '0'
//   pos 120-125 = ,"end": (6 chars)
//   pos 126 = first digit of intro_end
//   But pos 126 is CONSTANT, so intro_end's first digit is the same for all.
//   pos 127 is VARIABLE (5 vals for full g0), so intro_end has varying digits.
//
// This makes sense! intro_start is always 0 for all episodes.
// intro_end varies (different anime have different intro lengths).
// The first digit of intro_end is constant (e.g., always starts with '1' for 100-199 range).

// Let me verify by checking what plaintext chars the constant bytes map to.
// We can cross-reference: pos 120 should be ',' if intro_start = 0.
// From the v7.json tables, pos 93 byte 0x01 -> ','
// So we know the table for pos 93 maps 0x01 to ','.
// For pos 120, the byte is 0x94 (from v10 output).
// If pos 120 = ',', then we'd expect a different byte than pos 93's ','
// because each position has its own substitution table.

// Let me just assume intro_start = 0 and verify the structure.
// g0 suffix starting at pos 93:
// pos 93-118: ,"skip":{"intro":{"start": (26 chars)
// pos 119: 0
// pos 120: ,
// pos 121: "
// pos 122: e
// pos 123: n
// pos 124: d
// pos 125: "
// pos 126: :
// pos 127+: intro_end digits (VARIABLE)

// After intro_end digits: },"outro":{"start":
// Then outro_start digits
// Then ,"end":
// Then outro_end digits
// Then }}}

// Let me add entries for pos 119-126 assuming intro_start = 0:
const AFTER_INTRO_START = '0,"end":';
console.log(`\nAssuming intro_start=0, pos 119-126 = "${AFTER_INTRO_START}"`);

for (let i = 0; i < AFTER_INTRO_START.length; i++) {
  const pos = 119 + i;
  const g0byte = g0[0].enc[cipherPos(pos)];
  addEntry(pos, g0byte, AFTER_INTRO_START[i]);
  
  // g1 equivalent: pos + 2
  const g1pos = pos + 2;
  if (g1[0].enc[cipherPos(g1pos)] !== undefined) {
    addEntry(g1pos, g1[0].enc[cipherPos(g1pos)], AFTER_INTRO_START[i]);
  }
}

// Now for the variable positions (intro_end digits starting at pos 127 for g0):
// We need to figure out what digits map to what cipher bytes.
// 
// The intro_end value varies per anime. For g0 ptLen=179 (5 samples):
// pos 127: 2 vals [0x14, 0x6f]
// pos 128: 3 vals [0xce, 0x19, 0x4e]
// pos 129: 4 vals [0xfe, 0x2e, 0x3e, 0x1e]
// pos 130: CONST [0xf9]
//
// If pos 130 is constant, it's the next fixed char after intro_end.
// For ptLen=179 samples, intro_end has 3 digits (pos 127-129).
// pos 130 = '}' (closing the intro object)
//
// Then pos 131+ = ,"outro":{"start":
// pos 130: }
// pos 131: ,
// pos 132: "
// pos 133: o — but pos 133 has 2 vals! So it's NOT constant.
//
// Hmm, that means pos 130 is NOT always }. Let me reconsider.
// For ptLen=179 with 5 samples, pos 130 is CONST.
// But for ALL g0 samples (41 samples, mixed ptLen), pos 130 has 3 vals.
// This means different ptLen values have different chars at pos 130.
//
// This makes sense! If intro_end has different numbers of digits:
// - 2-digit intro_end (e.g., 90): pos 127-128 = digits, pos 129 = }
// - 3-digit intro_end (e.g., 100): pos 127-129 = digits, pos 130 = }
// - 4-digit intro_end (e.g., 1340): pos 127-130 = digits, pos 131 = }
//
// So the position of } shifts based on the number of digits.
// This means we can't assign fixed plaintext to positions 127+
// without knowing the exact intro_end value for each sample.
//
// BUT we can still extract digit mappings!
// For each sample, we know:
// - ptLen tells us the total suffix length
// - The suffix structure is fixed: ,"skip":{"intro":{"start":0,"end":X},"outro":{"start":Y,"end":Z}}}
// - suffixLen = ptLen - 93 (for g0)
// - fixedChars = 26 + 1 + 6 + 1 + 17 + 6 + 3 = 60 chars
//   Wait: 0,"end":X},"outro":{"start":Y,"end":Z}}}
//   Fixed: 0 + , + " + e + n + d + " + : + } + , + " + o + u + t + r + o + " + : + { + " + s + t + a + r + t + " + : + , + " + e + n + d + " + : + } + } + }
//   Hmm let me count the fixed suffix chars properly:
//
// Full suffix: ,"skip":{"intro":{"start":0,"end":X},"outro":{"start":Y,"end":Z}}}
// Fixed chars (excluding the 4 numbers 0, X, Y, Z):
// ,"skip":{"intro":{"start":  = 26
// ,                            = 1  (between 0 and "end")
// "end":                       = 5
// },"outro":{"start":          = 17
// ,"end":                      = 6
// }}}                          = 3
// Total fixed = 26 + 1 + 5 + 17 + 6 + 3 = 58
// Plus the '0' for intro_start = 59 fixed chars
// Plus digits of X, Y, Z
//
// Wait, I need to be more careful:
// ,"skip":{"intro":{"start":0,"end":X},"outro":{"start":Y,"end":Z}}}
// Let me spell it out character by character:
// , " s k i p " : { " i n t r o " : { " s t a r t " : 0 , " e n d " : X } , " o u t r o " : { " s t a r t " : Y , " e n d " : Z } } }
//
// Fixed chars (not counting X, Y, Z which are multi-digit numbers):
// Everything except X, Y, Z = 
// ,"skip":{"intro":{"start":0,"end":  = 26 + 1 + 1 + 5 = 33
// Wait, let me just count the full template with placeholders:
const fullSuffix = ',"skip":{"intro":{"start":0,"end":},"outro":{"start":,"end":}}}';
console.log(`Full suffix template: ${fullSuffix}`);
console.log(`Template length (without digit values): ${fullSuffix.length}`);
// The 3 number placeholders (X, Y, Z) are empty in this template.
// suffixLen = template.length + digits(X) + digits(Y) + digits(Z)
// For g0: suffixLen = ptLen - 93
// So: digits(X) + digits(Y) + digits(Z) = ptLen - 93 - template.length

const templateLen = fullSuffix.length;
console.log(`\nFor each ptLen, total variable digits:`);
const ptLens = [...new Set(g0.map(s => s.ptLen))].sort((a,b) => a-b);
for (const pl of ptLens) {
  const suffixLen = pl - 93;
  const varDigits = suffixLen - templateLen;
  const count = g0.filter(s => s.ptLen === pl).length;
  console.log(`  ptLen=${pl}: suffixLen=${suffixLen}, varDigits=${varDigits} (${count} samples)`);
}

// Now I need to figure out the EXACT position of each number in the suffix.
// The key insight: we can determine where each number starts and ends
// by looking at which positions are constant vs variable.
//
// For the SHORTEST ptLen in g0, the numbers have the fewest digits.
// For the LONGEST ptLen, the numbers have the most digits.
//
// The structure after pos 126 (end of ,"end":) is:
// [intro_end digits] } , " o u t r o " : { " s t a r t " : [outro_start digits] , " e n d " : [outro_end digits] } } }
//
// The fixed chars between the numbers are:
// },"outro":{"start":  = 18 chars (including the } that closes intro)
// Wait: },"outro":{"start": 
// } = 1
// , = 1
// " = 1
// o = 1
// u = 1
// t = 1
// r = 1
// o = 1
// " = 1
// : = 1
// { = 1
// " = 1
// s = 1
// t = 1
// a = 1
// r = 1
// t = 1
// " = 1
// : = 1
// = 19 chars
//
// Then: ,"end": = 6 chars
// Then: }}} = 3 chars
//
// So after the intro_end digits:
// 19 fixed chars + [outro_start digits] + 6 fixed chars + [outro_end digits] + 3 fixed chars

// For the TAIL of the suffix (last 3 chars are always }}}):
// The last 3 positions of each sample should map to }}}.
// For g0 ptLen=169: last 3 positions = 166, 167, 168 → all should be }
// For g0 ptLen=179: last 3 positions = 176, 177, 178 → all should be }

// Let me verify and collect } mappings for many positions:
console.log('\n=== Collecting } mappings from tail positions ===\n');

for (const s of allSamples) {
  for (let offset = 1; offset <= 3; offset++) {
    const pos = s.ptLen - offset;
    const byte = s.enc[cipherPos(pos)];
    addEntry(pos, byte, '}');
  }
}

// Also collect the fixed chars BEFORE the tail:
// Before }}} comes the outro_end digits, then ,"end": (6 chars), then outro_start digits,
// then ,"outro":{"start": (but we need to work backwards)
//
// Actually, let me work from the END of each sample backwards.
// Last 3 chars: }}}
// Before that: outro_end digits (variable)
// Before that: ,"end": (6 chars)
// Before that: outro_start digits (variable)
// Before that: },"outro":{"start": (19 chars)
// Before that: intro_end digits (variable)
// Before that: 0,"end": (8 chars, pos 119-126 for g0)
// Before that: ,"skip":{"intro":{"start": (26 chars, pos 93-118 for g0)

// I can work backwards from the end to find the fixed sections.
// The last 3 chars are }}}.
// Going backwards from ptLen-4:
// The 6 chars ,"end": end at ptLen-4 (the char before the first })
// So ,"end": occupies positions (ptLen-4-5) to (ptLen-4), i.e., ptLen-9 to ptLen-4
// Wait, that's not right. Let me think again.
//
// suffix ends with: [outro_end_digits] } } }
// The }}} are the last 3 chars.
// Before }}} is the outro_end value (digits).
// Before the outro_end digits is ,"end":
// 
// So from the end:
// pos ptLen-1: }
// pos ptLen-2: }
// pos ptLen-3: }
// pos ptLen-4 to ptLen-3-len(outro_end): outro_end digits
// Before that: ,"end": (6 chars)
// Before that: outro_start digits
// Before that: },"outro":{"start": (19 chars)
// Before that: intro_end digits
// Before that: 0,"end": (8 chars)
// Before that: ,"skip":{"intro":{"start": (26 chars)

// The problem is we don't know how many digits each number has.
// But we CAN figure it out by looking at which positions are constant
// across samples with the SAME ptLen.

// For samples with the same ptLen, the total number of digits is fixed.
// But the distribution across the 3 numbers can vary.
// UNLESS all samples with the same ptLen have the same digit distribution.
// That would happen if the numbers are correlated (e.g., all from the same anime).

// Actually, different anime have different skip values, so the digit distribution
// WILL vary even within the same ptLen. This means some positions will be
// "sometimes a digit, sometimes a fixed char" — making them appear variable.

// This is getting complex. Let me try a different approach:
// For each sample, try ALL possible digit distributions and see which one
// produces consistent table entries.

console.log('\n=== Trying to determine digit distribution per sample ===\n');

// For each g0 sample, the suffix is:
// ,"skip":{"intro":{"start":0,"end":A},"outro":{"start":B,"end":C}}}
// where A, B, C are integers.
// 
// suffixLen = ptLen - 93
// templateLen (without A,B,C digits) = 62 (from fullSuffix)
// digits(A) + digits(B) + digits(C) = suffixLen - templateLen
//
// The suffix character at each position (relative to suffix start = pos 93):
// offset 0-25: ,"skip":{"intro":{"start": (26 chars)
// offset 26: '0' (intro_start = 0)
// offset 27-32: ,"end": (6 chars)
// offset 33 to 33+len(A)-1: digits of A
// offset 33+len(A): }
// offset 34+len(A) to 34+len(A)+17: ,"outro":{"start": (18 chars)
// Wait, },"outro":{"start": is 19 chars:
// } , " o u t r o " : { " s t a r t " :
// 1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1 = 19

// Let me recount the template:
// ,"skip":{"intro":{"start":0,"end":},"outro":{"start":,"end":}}}
// Let me verify by counting:
// , " s k i p " : { " i n t r o " : { " s t a r t " : 0 , " e n d " : } , " o u t r o " : { " s t a r t " : , " e n d " : } } }
// 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62
// = 62 chars. Good.

// So for a given sample with suffixLen = ptLen - 93:
// totalDigits = suffixLen - 62
// These digits are split as: len(A) + len(B) + len(C) = totalDigits
// where A = intro_end, B = outro_start, C = outro_end

// For each possible (lenA, lenB, lenC) combination, we can construct
// the full suffix plaintext and check if it's consistent with the cipher bytes.

// But we don't know A, B, C values. However, we DO know the fixed chars.
// So for each combination, we can check if the cipher bytes at fixed-char positions
// are consistent with our existing table entries.

// Let me build a function that, given (lenA, lenB, lenC), returns the positions
// of all fixed chars in the suffix.

function getSuffixFixedPositions(lenA, lenB, lenC) {
  // Returns array of { pos (relative to suffix start), char }
  const fixed = [];
  let offset = 0;
  
  // ,"skip":{"intro":{"start": (26 chars)
  const part1 = ',"skip":{"intro":{"start":';
  for (const ch of part1) fixed.push({ offset: offset++, char: ch });
  
  // 0 (intro_start = 0)
  fixed.push({ offset: offset++, char: '0' });
  
  // ,"end": (6 chars)
  for (const ch of ',"end":') fixed.push({ offset: offset++, char: ch });
  
  // A digits (lenA chars) — VARIABLE, skip
  offset += lenA;
  
  // },"outro":{"start": (19 chars)
  for (const ch of '},"outro":{"start":') fixed.push({ offset: offset++, char: ch });
  
  // B digits (lenB chars) — VARIABLE, skip
  offset += lenB;
  
  // ,"end": (6 chars)
  for (const ch of ',"end":') fixed.push({ offset: offset++, char: ch });
  
  // C digits (lenC chars) — VARIABLE, skip
  offset += lenC;
  
  // }}} (3 chars)
  for (const ch of '}}}') fixed.push({ offset: offset++, char: ch });
  
  return fixed;
}

// For each sample, try all valid (lenA, lenB, lenC) and score them
// based on consistency with existing table entries.

function scoreCombination(sample, lenA, lenB, lenC, isG1) {
  const suffixStart = isG1 ? 95 : 93;
  const totalDigits = lenA + lenB + lenC;
  const expectedSuffixLen = 62 + totalDigits;
  const actualSuffixLen = sample.ptLen - suffixStart;
  
  if (expectedSuffixLen !== actualSuffixLen) return -1;
  
  const fixedPositions = getSuffixFixedPositions(lenA, lenB, lenC);
  let matches = 0;
  let conflicts = 0;
  
  for (const { offset, char } of fixedPositions) {
    const pos = suffixStart + offset;
    const byte = sample.enc[cipherPos(pos)];
    if (byte === undefined) continue;
    
    // Check against existing table entries
    if (tables[pos]) {
      if (tables[pos][byte] === char) {
        matches++;
      } else if (tables[pos][byte] && tables[pos][byte] !== char) {
        conflicts++;
      }
    }
  }
  
  return conflicts > 0 ? -1 : matches;
}

// Try to determine the digit distribution for each sample
console.log('Determining digit distributions...\n');

const sampleAnalysis = [];

for (const s of g0.slice(0, 20)) { // Start with first 20 g0 samples
  const suffixLen = s.ptLen - 93;
  const totalDigits = suffixLen - 62;
  
  if (totalDigits < 3 || totalDigits > 30) continue;
  
  let bestScore = -1;
  let bestCombo = null;
  
  // Try all valid combinations
  for (let lenA = 1; lenA <= Math.min(totalDigits - 2, 6); lenA++) {
    for (let lenB = 1; lenB <= Math.min(totalDigits - lenA - 1, 6); lenB++) {
      const lenC = totalDigits - lenA - lenB;
      if (lenC < 1 || lenC > 6) continue;
      
      const score = scoreCombination(s, lenA, lenB, lenC, false);
      if (score > bestScore) {
        bestScore = score;
        bestCombo = { lenA, lenB, lenC };
      }
    }
  }
  
  sampleAnalysis.push({ sample: s, bestCombo, bestScore, totalDigits });
  if (bestCombo) {
    console.log(`  lid=${s.lid} ptLen=${s.ptLen} digits=${totalDigits} → A=${bestCombo.lenA} B=${bestCombo.lenB} C=${bestCombo.lenC} (score=${bestScore})`);
  }
}

// Now, for each sample where we determined the digit distribution,
// we can extract the FULL plaintext and build table entries for ALL positions.

console.log('\n=== Building tables from determined distributions ===\n');

let newEntries = 0;

for (const { sample, bestCombo } of sampleAnalysis) {
  if (!bestCombo) continue;
  const { lenA, lenB, lenC } = bestCombo;
  const suffixStart = 93;
  
  // Build the full suffix with placeholders for digits
  const fixedPositions = getSuffixFixedPositions(lenA, lenB, lenC);
  
  for (const { offset, char } of fixedPositions) {
    const pos = suffixStart + offset;
    const byte = sample.enc[cipherPos(pos)];
    if (byte === undefined) continue;
    
    if (!tables[pos]) tables[pos] = {};
    if (!tables[pos][byte]) {
      tables[pos][byte] = char;
      newEntries++;
    }
  }
}

console.log(`Added ${newEntries} new table entries from fixed positions`);

// Also add entries for the video ID constant positions (GROUP_CONST)
// For g0: pos 38-61 are constant (24 chars of video ID prefix)
// For g0: pos 70-91 are constant (22 chars of video ID suffix)
// We don't know what chars these are, but we know they're the same for all g0 samples.
// We can't add them to the tables without knowing the actual chars.
// BUT we can note that all g0 samples have the same byte at these positions.

// For the digit positions, we need to figure out what digit each cipher byte maps to.
// We can do this by collecting all cipher bytes at digit positions and seeing
// which digits they could be.

console.log('\n=== Collecting digit mappings ===\n');

for (const { sample, bestCombo } of sampleAnalysis) {
  if (!bestCombo) continue;
  const { lenA, lenB, lenC } = bestCombo;
  const suffixStart = 93;
  
  // Digit positions for A (intro_end):
  // A starts at offset 33 (after ,"skip":{"intro":{"start":0,"end":)
  const aStart = suffixStart + 33;
  
  // Digit positions for B (outro_start):
  // B starts at offset 33 + lenA + 19 (after },"outro":{"start":)
  const bStart = suffixStart + 33 + lenA + 19;
  
  // Digit positions for C (outro_end):
  // C starts at offset 33 + lenA + 19 + lenB + 6 (after ,"end":)
  const cStart = suffixStart + 33 + lenA + 19 + lenB + 6;
  
  // We know these are digits (0-9) but don't know which ones.
  // Collect the cipher bytes at these positions.
  for (let i = 0; i < lenA; i++) {
    const pos = aStart + i;
    const byte = sample.enc[cipherPos(pos)];
    if (byte !== undefined) {
      if (!tables[pos]) tables[pos] = {};
      // Mark as digit position (we'll resolve later)
      tables[pos][byte] = tables[pos][byte] || `DIGIT_${pos}`;
    }
  }
}

// Count total entries
let totalEntries = 0;
let positionsCovered = 0;
for (const pos in tables) {
  positionsCovered++;
  totalEntries += Object.keys(tables[pos]).length;
}
console.log(`Total: ${totalEntries} entries across ${positionsCovered} positions`);

// Save intermediate results
const output = {
  timestamp: new Date().toISOString(),
  totalSamples: allSamples.length,
  g0Count: g0.length,
  g1Count: g1.length,
  totalEntries,
  positionsCovered,
  tables: {},
};

for (const pos in tables) {
  output.tables[pos] = tables[pos];
}

fs.writeFileSync('scripts/kai-tables-v11.json', JSON.stringify(output, null, 2));
console.log('\nSaved to scripts/kai-tables-v11.json');

// Print summary of what we have vs what we need
console.log('\n=== Coverage Summary ===\n');
console.log(`Positions with entries: ${positionsCovered}`);
console.log(`Need ~183 positions for full coverage`);
console.log(`Missing positions: ${183 - positionsCovered}`);
