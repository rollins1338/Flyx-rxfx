#!/usr/bin/env node
/**
 * Crack AnimeKai tables v6 — The Two-Group Analysis
 * 
 * KEY FINDING: All samples split into exactly 2 groups.
 * Group 1's ptLen = Group 0's ptLen + 2.
 * This means the plaintext differs by exactly 2 characters between groups.
 * 
 * Hypothesis: The two groups use different MegaUp domains or URL formats.
 * If we can figure out what the 2-char difference is, we can determine
 * the full plaintext for BOTH groups and build ALL tables.
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

// Load samples
const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  data: Buffer.from(s.cipherHex, 'hex'),
}));

// Split into two groups based on position 93
const cp93 = cipherPos(93);
const byte93vals = new Map();
for (const s of samples) {
  if (cp93 < s.data.length) {
    const v = s.data[cp93];
    if (!byte93vals.has(v)) byte93vals.set(v, []);
    byte93vals.get(v).push(s);
  }
}

const [group0, group1] = [...byte93vals.values()].sort((a, b) => {
  const avgA = a.reduce((sum, s) => sum + s.ptLen, 0) / a.length;
  const avgB = b.reduce((sum, s) => sum + s.ptLen, 0) / b.length;
  return avgA - avgB; // group0 = shorter ptLen
});

console.log(`Group 0: ${group0.length} samples (shorter ptLen)`);
console.log(`Group 1: ${group1.length} samples (longer ptLen, +2 chars)\n`);

// ═══════════════════════════════════════════════════════════
// ANALYSIS: What differs between the two groups?
// ═══════════════════════════════════════════════════════════

// The prefix {"url":"https:\/\/megaup22.online\/e\/ is 38 chars.
// If the domain differs, the prefix length changes.
// Let's check: do positions 0-37 have the SAME cipher bytes in both groups?

console.log('=== Checking if prefix bytes are identical between groups ===\n');
let prefixDiffers = false;
for (let pos = 0; pos <= 37; pos++) {
  const cp = cipherPos(pos);
  const v0 = new Set(group0.map(s => s.data[cp]).filter(v => v !== undefined));
  const v1 = new Set(group1.map(s => s.data[cp]).filter(v => v !== undefined));
  
  if (v0.size !== 1 || v1.size !== 1) {
    console.log(`  pos ${pos}: NOT constant (g0: ${v0.size} vals, g1: ${v1.size} vals)`);
    prefixDiffers = true;
  } else {
    const b0 = [...v0][0];
    const b1 = [...v1][0];
    if (b0 !== b1) {
      console.log(`  pos ${pos}: DIFFERS (g0: 0x${b0.toString(16)}, g1: 0x${b1.toString(16)})`);
      prefixDiffers = true;
    }
  }
}
if (!prefixDiffers) {
  console.log('  All prefix positions (0-37) are IDENTICAL between groups');
  console.log('  → The domain is the same. The difference is in the video ID or suffix.\n');
}

// ═══════════════════════════════════════════════════════════
// Check if the video ID positions differ
// ═══════════════════════════════════════════════════════════

console.log('=== Video ID positions (38-91) ===\n');
for (let pos = 38; pos <= 91; pos++) {
  const cp = cipherPos(pos);
  const v0 = new Set(group0.map(s => s.data[cp]).filter(v => v !== undefined));
  const v1 = new Set(group1.map(s => s.data[cp]).filter(v => v !== undefined));
  
  // Check if each group has exactly 1 value (constant within group)
  const g0const = v0.size === 1;
  const g1const = v1.size === 1;
  
  if (g0const && g1const) {
    const b0 = [...v0][0];
    const b1 = [...v1][0];
    if (b0 === b1) {
      // Same in both groups — this position has the same plaintext char
      // This could be a constant part of the URL (like a common prefix in the video ID)
    } else {
      // Different between groups but constant within each
    }
  }
  
  if (pos <= 42 || pos >= 88 || !g0const || !g1const) {
    console.log(`  pos ${pos}: g0=${g0const ? '1 val' : v0.size + ' vals'} g1=${g1const ? '1 val' : v1.size + ' vals'}${g0const && g1const ? (([...v0][0] === [...v1][0]) ? ' SAME' : ' DIFF') : ''}`);
  }
}

// ═══════════════════════════════════════════════════════════
// KEY INSIGHT: If group1 is 2 chars longer, and the prefix is the same,
// then either:
// (a) The video ID is 2 chars longer in group1
// (b) The suffix is 2 chars longer in group1
// (c) The domain is 2 chars longer in group1
// 
// Since the prefix bytes are identical, the domain must be the same.
// But wait — if the domain were different (e.g., megaup22 vs megaup222),
// the prefix would be different because the characters at positions
// 18+ would shift. Let me check more carefully.
// 
// Actually, the prefix is {"url":"https:\/\/megaup22.online\/e\/
// If group1 uses megaup222.online, the prefix would be:
// {"url":"https:\/\/megaup222.online\/e\/
// That's 39 chars instead of 38. But then ALL subsequent positions
// would shift by 1, and the cipher bytes would be completely different
// at every position. Since positions 0-37 are identical, the prefix
// must be the same length.
// 
// So the difference is in the video ID length or suffix length.
// ═══════════════════════════════════════════════════════════

// Let's check: within each group, are the video ID positions constant?
// (i.e., does each group have a single video ID per lid?)

console.log('\n=== Within-group video ID analysis ===\n');

// Group by lid within each group
const g0ByLid = {};
for (const s of group0) {
  if (!g0ByLid[s.lid]) g0ByLid[s.lid] = [];
  g0ByLid[s.lid].push(s);
}

// Check if same lid always has same cipher bytes at video ID positions
for (const [lid, ss] of Object.entries(g0ByLid).slice(0, 3)) {
  console.log(`Group 0, lid=${lid}: ${ss.length} samples, ptLen=${ss.map(s => s.ptLen).join(',')}`);
  if (ss.length > 1) {
    let allSame = true;
    for (let pos = 38; pos <= 91; pos++) {
      const cp = cipherPos(pos);
      const vals = new Set(ss.map(s => s.data[cp]).filter(v => v !== undefined));
      if (vals.size > 1) { allSame = false; break; }
    }
    console.log(`  Video ID bytes identical across samples: ${allSame}`);
  }
}

// ═══════════════════════════════════════════════════════════
// CRITICAL TEST: Check if the lid pattern correlates with groups
// ═══════════════════════════════════════════════════════════

console.log('\n=== Lid pattern analysis ===\n');

// Check if lids in group0 vs group1 have a pattern
const g0lids = [...new Set(group0.map(s => s.lid))].sort();
const g1lids = [...new Set(group1.map(s => s.lid))].sort();

console.log('Group 0 unique lids:', g0lids.length);
console.log('Group 1 unique lids:', g1lids.length);

// Check if any lid appears in both groups
const overlap = g0lids.filter(l => g1lids.includes(l));
console.log('Overlap:', overlap.length);

// Check lid endings
console.log('\nGroup 0 lid endings:', [...new Set(g0lids.map(l => l.slice(-2)))].join(', '));
console.log('Group 1 lid endings:', [...new Set(g1lids.map(l => l.slice(-2)))].join(', '));

// Check lid prefixes
console.log('Group 0 lid prefixes:', [...new Set(g0lids.map(l => l.slice(0, 4)))].join(', '));
console.log('Group 1 lid prefixes:', [...new Set(g1lids.map(l => l.slice(0, 4)))].join(', '));

// ═══════════════════════════════════════════════════════════
// APPROACH: Use the known MegaUp IDs to test
// ═══════════════════════════════════════════════════════════

console.log('\n=== Testing MegaUp domains ===\n');

// Maybe there are multiple MegaUp domains. Let's check.
const domains = [
  'megaup22.online',
  'megaup222.online', 
  'megaup2.online',
  'megaup.online',
  'megaupcdn.online',
  'megaup33.online',
  'megaup11.online',
];

for (const domain of domains) {
  try {
    const resp = rf(`https://${domain}/`, 'fetch', { 'Referer': 'https://animekai.to/' });
    if (resp && !resp.includes('ERROR')) {
      console.log(`${domain}: ALIVE (${resp.substring(0, 80)}...)`);
    } else {
      console.log(`${domain}: ${resp ? 'error response' : 'no response'}`);
    }
  } catch {
    console.log(`${domain}: unreachable`);
  }
}

// ═══════════════════════════════════════════════════════════
// APPROACH: Collect samples from DIFFERENT anime to get more
// video ID diversity, then use the suffix pattern to build tables
// ═══════════════════════════════════════════════════════════

console.log('\n=== Suffix structure from ptLen analysis ===\n');

// The suffix after the video ID closing quote is:
// ,"skip":{"intro":{"start":N,"end":N},"outro":{"start":N,"end":N}}}
// 
// Fixed chars: ,"skip":{"intro":{"start":,"end":},"outro":{"start":,"end":}}}
// = 63 fixed chars + 8 numbers
// Total suffix (including the ") = 1 + 63 + sum(digits) = 64 + sum(digits)
// 
// ptLen = 38 + videoIdLen + 1 + 63 + sum(digits)
// ptLen = 102 + videoIdLen + sum(digits)
// 
// For group0 (ptLen 169-179):
//   videoIdLen + sum(digits) = ptLen - 102
//   If videoIdLen = 54: sum(digits) = ptLen - 156 → 13-23
//   If videoIdLen = 52: sum(digits) = ptLen - 154 → 15-25
// 
// For group1 (ptLen 171-181):
//   If videoIdLen = 56: sum(digits) = ptLen - 158 → 13-23 (SAME as group0 with 54!)
//   If videoIdLen = 54: sum(digits) = ptLen - 156 → 15-25

// So if group0 has 54-char IDs and group1 has 56-char IDs,
// both groups have the same digit distribution (13-23 total digits).
// This makes sense!

// OR: both groups have 54-char IDs but group1 has 2 extra chars in the suffix.
// This could happen if group1 has a different JSON structure.

// Let's check: the ptLen distributions are:
// Group 0: 169(4), 170(1), 171(4), 175(1), 176(10), 177(10), 178(6), 179(5)
// Group 1: 171(4), 172(1), 173(4), 177(1), 178(10), 179(10), 180(6), 181(5)
// 
// These are EXACTLY the same distribution shifted by 2!
// This strongly suggests the video ID length differs by 2 between groups.

console.log('Video ID length hypothesis:');
console.log('  Group 0: 54-char video IDs');
console.log('  Group 1: 56-char video IDs');
console.log('  Both have same suffix structure with same digit distribution');

// ═══════════════════════════════════════════════════════════
// FINAL APPROACH: Brute-force the video ID character by character
// using MegaUp's /e/ endpoint
// ═══════════════════════════════════════════════════════════

console.log('\n=== Attempting video ID recovery ===\n');

// For a specific sample, we know:
// - The cipher bytes at positions 38-91 (or 38-93 for group1)
// - The video ID is base64url-encoded (chars: A-Za-z0-9_-)
// - We can verify a candidate ID by fetching /e/CANDIDATE_ID

// The base64url charset has 64 characters.
// For a 54-char ID, brute-forcing all at once is impossible (64^54).
// But we can verify character by character if MegaUp gives different
// responses for valid vs invalid IDs.

// Let's first check: does MegaUp give different responses for:
// - Valid ID: returns embed page with video title
// - Invalid ID: returns error or generic page

console.log('Testing MegaUp response patterns...');
const validResp = rf('https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCQ', 'fetch', { 'Referer': 'https://animekai.to/' });
const invalidResp = rf('https://megaup22.online/e/AAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'fetch', { 'Referer': 'https://animekai.to/' });
const invalidResp2 = rf('https://megaup22.online/e/jIrrLzj-WS2JcOLzF79O5xvpCX', 'fetch', { 'Referer': 'https://animekai.to/' });

if (validResp && invalidResp) {
  const validTitle = validResp.match(/<title>([^<]*)<\/title>/)?.[1] || 'N/A';
  const invalidTitle = invalidResp.match(/<title>([^<]*)<\/title>/)?.[1] || 'N/A';
  const invalidTitle2 = invalidResp2?.match(/<title>([^<]*)<\/title>/)?.[1] || 'N/A';
  
  console.log(`  Valid ID title: "${validTitle}"`);
  console.log(`  Invalid ID (all A's) title: "${invalidTitle}"`);
  console.log(`  Invalid ID (1 char off) title: "${invalidTitle2}"`);
  
  // Check /media/ endpoint
  const validMedia = rf('https://megaup22.online/media/jIrrLzj-WS2JcOLzF79O5xvpCQ', 'fetch', { 'Referer': 'https://animekai.to/' });
  const invalidMedia = rf('https://megaup22.online/media/AAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'fetch', { 'Referer': 'https://animekai.to/' });
  
  console.log(`  Valid /media/ response: ${validMedia?.substring(0, 100)}`);
  console.log(`  Invalid /media/ response: ${invalidMedia?.substring(0, 100)}`);
  
  // If invalid returns a different status or empty result, we can use this
  // to verify video IDs
  if (validMedia && invalidMedia) {
    try {
      const vp = JSON.parse(validMedia);
      const ip = JSON.parse(invalidMedia);
      console.log(`  Valid /media/ status: ${vp.status}, has result: ${!!vp.result}`);
      console.log(`  Invalid /media/ status: ${ip.status}, has result: ${!!ip.result}`);
    } catch {}
  }
}
