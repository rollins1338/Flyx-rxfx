#!/usr/bin/env node
/**
 * Crack AnimeKai substitution tables by:
 * 1. Collecting encrypted responses for known episodes
 * 2. Using the SUFFIX pattern after the video ID to get more table entries
 * 3. Attempting to determine video IDs by probing MegaUp /e/ endpoint
 * 
 * Strategy: The JSON response format is likely:
 *   {"url":"https:\/\/megaup22.online\/e\/VIDEO_ID","skip":{...}}
 * or similar. If we can figure out the exact suffix, we get table entries
 * for positions 92+ which gives us more known plaintext.
 * 
 * Then for the video ID positions (38-91), we can try character-by-character
 * brute force using MegaUp's /e/ endpoint to validate.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];

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

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim();
}

const KAI_HDRS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rf(`${domain}${urlPath}`, 'fetch', { ...KAI_HDRS, 'Referer': `${domain}/` });
      if (!raw) continue;
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

// Cipher position mapping (same as Rust)
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

// URL-safe base64 decode
function b64Decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

// ═══════════════════════════════════════════════════════════
// STEP 1: Collect fresh encrypted samples with known structure
// ═══════════════════════════════════════════════════════════

async function collectSamples() {
  console.log('=== Step 1: Collecting fresh encrypted samples ===\n');
  
  // Use Bleach as test anime (known to work)
  const searchData = kaiFetch('/ajax/anime/search?keyword=bleach');
  if (!searchData?.result?.html) { console.log('Search failed'); return []; }
  
  const slugRe = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
  const results = [];
  let m;
  while ((m = slugRe.exec(searchData.result.html)) !== null) {
    results.push({ slug: m[1], title: m[2].trim() });
  }
  
  const best = results.find(x => x.title.toLowerCase() === 'bleach') || results[0];
  if (!best) { console.log('No results'); return []; }
  console.log(`Found: ${best.title} (${best.slug})`);
  
  // Get content ID
  let contentId = null;
  for (const domain of KAI_DOMAINS) {
    try {
      const watchHtml = rf(`${domain}/watch/${best.slug}`, 'fetch', { 'Referer': `${domain}/` });
      if (!watchHtml) continue;
      const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
      if (syncMatch) {
        const sync = JSON.parse(syncMatch[1]);
        contentId = sync.anime_id;
        break;
      }
    } catch {}
  }
  if (!contentId) { console.log('No content_id'); return []; }
  console.log(`Content ID: ${contentId}`);
  
  // Get episodes
  const encId = kaiEncrypt(contentId);
  const epData = kaiFetch(`/ajax/episodes/list?ani_id=${contentId}&_=${encId}`);
  if (!epData?.result) { console.log('No episodes'); return []; }
  
  const epRe = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"/gi;
  const episodes = {};
  while ((m = epRe.exec(epData.result)) !== null) episodes[m[1]] = m[2];
  const epRe2 = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"/gi;
  while ((m = epRe2.exec(epData.result)) !== null) { if (!episodes[m[2]]) episodes[m[2]] = m[1]; }
  
  console.log(`Found ${Object.keys(episodes).length} episodes`);
  
  // Get servers for episodes 1-5
  const samples = [];
  for (let ep = 1; ep <= Math.min(5, Object.keys(episodes).length); ep++) {
    const token = episodes[String(ep)];
    if (!token) continue;
    
    const encToken = kaiEncrypt(token);
    const srvData = kaiFetch(`/ajax/links/list?token=${token}&_=${encToken}`);
    if (!srvData?.result) continue;
    
    // Get ALL server lids (sub and dub)
    const lidRe = /data-lid="([^"]+)"/g;
    const lids = [];
    while ((m = lidRe.exec(srvData.result)) !== null) lids.push(m[1]);
    
    for (const lid of lids) {
      try {
        const encLid = kaiEncrypt(lid);
        const embedData = kaiFetch(`/ajax/links/view?id=${lid}&_=${encLid}`);
        if (!embedData?.result) continue;
        
        // Decode the base64 to get raw cipher bytes
        const cipherBytes = b64Decode(embedData.result);
        if (cipherBytes.length <= 21) continue;
        
        const dataBytes = cipherBytes.slice(21);
        const ptLen = dataBytes.length > 20 ? 7 + (dataBytes.length - 20) : 0;
        
        samples.push({
          ep,
          lid,
          ptLen,
          cipherHex: dataBytes.toString('hex'),
          raw: embedData.result,
        });
        
        console.log(`  ep${ep} lid=${lid} ptLen=${ptLen} dataLen=${dataBytes.length}`);
      } catch {}
    }
  }
  
  return samples;
}

// ═══════════════════════════════════════════════════════════
// STEP 2: Analyze suffix pattern
// ═══════════════════════════════════════════════════════════

function analyzeSuffix(samples) {
  console.log('\n=== Step 2: Analyzing suffix pattern ===\n');
  
  // The prefix is: {"url":"https:\/\/megaup22.online\/e\/
  // After the video ID (pos 38-91), position 92 should be "
  // Then the JSON continues. Let's figure out what comes after.
  
  // Possible suffixes:
  // ","skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}
  // ","skip":{}}
  // "}
  
  // Let's check: do all samples have the same bytes at positions 92+?
  // If the suffix is constant, those bytes will be the same across all samples.
  
  const maxPtLen = Math.max(...samples.map(s => s.ptLen));
  console.log(`Max plaintext length: ${maxPtLen}`);
  
  // For each position from 92 onwards, check if the cipher byte is constant
  const constantPositions = {};
  for (let pos = 92; pos < maxPtLen; pos++) {
    const cp = cipherPos(pos);
    const values = new Set();
    let count = 0;
    
    for (const s of samples) {
      const data = Buffer.from(s.cipherHex, 'hex');
      if (cp < data.length) {
        values.add(data[cp]);
        count++;
      }
    }
    
    if (count >= 3) {
      constantPositions[pos] = {
        values: [...values],
        isConstant: values.size === 1,
        count,
      };
    }
  }
  
  // Print constant positions (these are likely the same character across all samples)
  console.log('Positions 92+ analysis:');
  let constantRun = [];
  for (let pos = 92; pos < maxPtLen; pos++) {
    const info = constantPositions[pos];
    if (!info) continue;
    
    if (info.isConstant) {
      constantRun.push({ pos, byte: info.values[0] });
    } else {
      if (constantRun.length > 0) {
        console.log(`  Constant run: pos ${constantRun[0].pos}-${constantRun[constantRun.length-1].pos} (${constantRun.length} chars)`);
        for (const c of constantRun) {
          console.log(`    pos ${c.pos}: byte 0x${c.byte.toString(16).padStart(2, '0')}`);
        }
        constantRun = [];
      }
      console.log(`  Variable: pos ${pos} (${info.values.length} unique values from ${info.count} samples)`);
    }
  }
  if (constantRun.length > 0) {
    console.log(`  Constant run: pos ${constantRun[0].pos}-${constantRun[constantRun.length-1].pos} (${constantRun.length} chars)`);
    for (const c of constantRun) {
      console.log(`    pos ${c.pos}: byte 0x${c.byte.toString(16).padStart(2, '0')}`);
    }
  }
  
  return constantPositions;
}

// ═══════════════════════════════════════════════════════════
// STEP 3: Try to determine video IDs
// ═══════════════════════════════════════════════════════════

async function probeVideoIds(samples) {
  console.log('\n=== Step 3: Probing MegaUp for video IDs ===\n');
  
  // For each sample, we know the lid. Let's see if we can find the video ID
  // by checking MegaUp's /e/ endpoint.
  
  // First, let's check what a valid MegaUp embed page looks like
  const testUrl = 'https://megaup22.online/e/test';
  const testResp = rf(testUrl, 'fetch', { 'Referer': 'https://animekai.to/' });
  if (testResp) {
    console.log('MegaUp /e/test response (first 300 chars):');
    console.log(testResp.substring(0, 300));
    console.log();
  }
  
  // Check if there's a pattern in the video IDs
  // Old IDs were like: jIrrLzj-WS2JcOLzF79O5xvpCQ (27 chars)
  // New IDs are 54 chars. Maybe it's two IDs concatenated? Or base64-encoded?
  
  // Let's try to access a known old video ID
  const oldIds = ['jIrrLzj-WS2JcOLzF79O5xvpCQ', 'k5OoeWapWS2JcOLzF79O5xvpCQ'];
  for (const id of oldIds) {
    console.log(`Testing old ID: ${id} (${id.length} chars)`);
    const resp = rf(`https://megaup22.online/e/${id}`, 'fetch', { 'Referer': 'https://animekai.to/' });
    if (resp) {
      // Check if it's a valid page
      const hasTitle = resp.includes('<title>');
      const title = resp.match(/<title>([^<]*)<\/title>/)?.[1] || 'N/A';
      console.log(`  Valid page: ${hasTitle}, Title: ${title}`);
      
      // Try /media/ endpoint
      const mediaResp = rf(`https://megaup22.online/media/${id}`, 'fetch', { 'Referer': 'https://animekai.to/' });
      if (mediaResp) {
        console.log(`  /media/ response: ${mediaResp.substring(0, 200)}`);
      }
    }
    console.log();
  }
  
  // Now let's try to figure out the 54-char ID format
  // Maybe it's: VIDEO_ID + "?" + query_params (URL-encoded in JSON)
  // In JSON, ? doesn't need escaping, but & might appear as-is
  // So the 54 chars might be: 27-char ID + "?k=1&..." or similar
  
  // Let's check: in the encrypted data, are positions 38-91 all from the
  // base64url charset (A-Za-z0-9_-)?
  // If there are non-base64url chars, it means the "video ID" includes
  // query params or other URL components.
  
  console.log('Checking video ID character distribution...');
  // We can't directly check since we don't know the plaintext,
  // but we can check if the cipher bytes at video ID positions
  // vary a lot (suggesting many different chars) or are limited
  // (suggesting a restricted charset like base64url)
  
  for (let pos = 38; pos <= 45; pos++) {
    const cp = cipherPos(pos);
    const values = new Set();
    for (const s of samples) {
      const data = Buffer.from(s.cipherHex, 'hex');
      if (cp < data.length) values.add(data[cp]);
    }
    console.log(`  pos ${pos}: ${values.size} unique cipher bytes`);
  }
}

// ═══════════════════════════════════════════════════════════
// STEP 4: Build tables from what we know + guess suffix
// ═══════════════════════════════════════════════════════════

function buildTablesWithSuffix(samples, constantPositions) {
  console.log('\n=== Step 4: Building tables with suffix guessing ===\n');
  
  // We know the prefix: {"url":"https:\/\/megaup22.online\/e\/
  // Position 92 is "
  // After that, the JSON likely continues with:
  // ,"skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}
  // or a simpler variant
  
  // Let's try common suffixes and see which one produces consistent tables
  const suffixes = [
    '","skip":{}}',
    '","skip":{"intro":{"start":0,"end":0},"outro":{"start":0,"end":0}}}',
    '","skip":{"intro":{"start":0,"end":0}}}',
    '"}',
    '","headers":{}}',
  ];
  
  const prefix = '{"url":"https:\\/\\/megaup22.online\\/e\\/';
  
  for (const suffix of suffixes) {
    // The full plaintext would be: prefix + VIDEO_ID(54 chars) + suffix
    // Total length = 38 + 54 + suffix.length
    const expectedLen = 38 + 54 + suffix.length;
    
    // Check if any samples have this exact length
    const matchingSamples = samples.filter(s => s.ptLen === expectedLen);
    
    if (matchingSamples.length > 0) {
      console.log(`Suffix "${suffix}" → ptLen=${expectedLen}: ${matchingSamples.length} matching samples`);
      
      // For matching samples, check if the suffix positions have consistent cipher bytes
      let consistent = true;
      for (let i = 0; i < suffix.length; i++) {
        const pos = 92 + i; // suffix starts at position 92
        const cp = cipherPos(pos);
        const values = new Set();
        
        for (const s of matchingSamples) {
          const data = Buffer.from(s.cipherHex, 'hex');
          if (cp < data.length) values.add(data[cp]);
        }
        
        if (values.size !== 1) {
          // Not consistent — this suffix char varies, which means
          // either the suffix is wrong or this position is part of variable data
          consistent = false;
        }
      }
      
      console.log(`  Consistent: ${consistent}`);
    } else {
      console.log(`Suffix "${suffix}" → ptLen=${expectedLen}: no matching samples`);
    }
  }
  
  // Also check what ptLen values we actually have
  const ptLens = {};
  for (const s of samples) {
    ptLens[s.ptLen] = (ptLens[s.ptLen] || 0) + 1;
  }
  console.log('\nPlaintext length distribution:');
  for (const [len, count] of Object.entries(ptLens).sort((a, b) => a[0] - b[0])) {
    const suffixLen = parseInt(len) - 38 - 54;
    console.log(`  ptLen=${len}: ${count} samples (suffix would be ${suffixLen} chars)`);
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  // Load existing samples too
  let existingSamples = [];
  try {
    const existing = JSON.parse(fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
    existingSamples = existing.samples || [];
    console.log(`Loaded ${existingSamples.length} existing samples\n`);
  } catch {}
  
  // Collect fresh samples
  const freshSamples = await collectSamples();
  const allSamples = [...existingSamples, ...freshSamples];
  console.log(`\nTotal samples: ${allSamples.length}`);
  
  // Analyze suffix
  const constantPositions = analyzeSuffix(allSamples);
  
  // Probe video IDs
  await probeVideoIds(freshSamples.length > 0 ? freshSamples : existingSamples.slice(0, 10));
  
  // Build tables with suffix guessing
  buildTablesWithSuffix(allSamples, constantPositions);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
