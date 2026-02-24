#!/usr/bin/env node
/**
 * Crack AnimeKai tables v13 — Get actual video IDs from HiAnime
 * to fill in positions 38-91
 * 
 * Strategy: For each AnimeKai lid, we can find the corresponding
 * HiAnime MegaCloud source. The MegaCloud decrypt gives us the
 * actual stream URL. But we need the MegaUp VIDEO ID, not the stream.
 * 
 * Better approach: Use the AnimeKai encrypt tables (which work) to
 * encrypt a known plaintext, then compare with the server's response
 * to figure out the video ID.
 * 
 * Actually, the SIMPLEST approach: We know the video ID has a constant
 * prefix and suffix within each group. We just need to figure out what
 * those constant chars are. We can do this by:
 * 1. Getting a MegaUp embed URL from AnimeKai (by decrypting with partial tables)
 * 2. The URL contains the video ID
 * 
 * But we can't decrypt yet (that's the whole problem).
 * 
 * ALTERNATIVE: The video ID constant parts are the same for ALL episodes
 * in a group. So they're likely a server/provider identifier.
 * Old MegaUp video IDs were like: "AbCdEfGhIjKlMnOpQrStUvWxYz"
 * New ones might be longer with a provider prefix.
 * 
 * Let me try to figure out the video ID by using what we know:
 * - The video ID is in a URL: https://megaup22.online/e/VIDEOID
 * - Video IDs typically contain [a-zA-Z0-9_-]
 * - For g0, the constant prefix is 24 chars (pos 38-61)
 * - For g0, the constant suffix is 22 chars (pos 70-91)
 * - The 8 variable chars (pos 62-69) differ per episode
 * 
 * We can try to determine the constant chars by looking at what
 * characters are valid in a URL path segment.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20',
    '--headers', JSON.stringify(hdrs)];
  try {
    return execFileSync(RUST, args, {
      encoding: 'utf8', timeout: 30000,
      maxBuffer: 10*1024*1024, windowsHide: true
    }).trim();
  } catch(e) { return e.stdout?.trim() || ''; }
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

// Load v12 results
const v12 = JSON.parse(fs.readFileSync('scripts/kai-tables-v12.json', 'utf8'));
const decryptTables = v12.decryptTables;

// Load samples
const existing = JSON.parse(
  fs.readFileSync('scripts/kai-bruteforce-result.json', 'utf8'));
const samples = existing.samples.map(s => ({
  ...s,
  enc: Buffer.from(s.cipherHex, 'hex'),
}));

// Split into groups
const cp93 = cipherPos(93);
const byByte93 = {};
for (const s of samples) {
  const v = s.enc[cp93];
  if (!byByte93[v]) byByte93[v] = [];
  byByte93[v].push(s);
}
const sorted = Object.values(byByte93).sort((a, b) => {
  const avgA = a.reduce((s, x) => s + x.ptLen, 0) / a.length;
  const avgB = b.reduce((s, x) => s + x.ptLen, 0) / b.length;
  return avgA - avgB;
});
const g0 = sorted[0];
const g1 = sorted[1];

// For positions 38-91, we know the cipher bytes are GROUP_CONST.
// Let's get the actual bytes for g0 and g1.
console.log('=== Video ID cipher bytes ===\n');

console.log('g0 constant video ID bytes (pos 38-91):');
const g0VidBytes = [];
for (let pos = 38; pos <= 91; pos++) {
  const byte = g0[0].enc[cipherPos(pos)];
  g0VidBytes.push(byte);
}
console.log(`  ${g0VidBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

console.log('\ng1 constant video ID bytes (pos 38-93):');
const g1VidBytes = [];
for (let pos = 38; pos <= 93; pos++) {
  const byte = g1[0].enc[cipherPos(pos)];
  g1VidBytes.push(byte);
}
console.log(`  ${g1VidBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

// Now, let me try a completely different approach to get the video IDs.
// I'll fetch a MegaUp embed page directly and see what video ID format they use.
// Then I can match it against the cipher bytes.

// First, let me check what MegaUp video IDs look like by fetching one.
// From the old working system, video IDs were like base64-ish strings.

// Actually, the BEST approach is to use HiAnime to get the SAME episode's
// MegaUp embed URL. HiAnime also uses MegaUp for some servers.
// If I can find the same episode on both HiAnime and AnimeKai,
// the MegaUp video ID should be the same.

// Let me try: get Bleach ep 1 from HiAnime, find MegaUp server
console.log('\n=== Getting MegaUp video IDs from HiAnime ===\n');

const HI = 'https://hianimez.to';
const HI_AJAX = { 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${HI}/` };

// Search for Bleach on HiAnime
const searchHtml = rf(`${HI}/search?keyword=bleach`);
const hrefMatch = searchHtml.match(/href="\/([^"?]*bleach[^"?]*)"/i);
const slug = hrefMatch?.[1];
console.log(`HiAnime slug: ${slug}`);

if (slug) {
  const numId = slug.match(/-(\d+)$/)?.[1];
  console.log(`HiAnime numId: ${numId}`);
  
  if (numId) {
    // Get episodes
    const epRaw = rf(`${HI}/ajax/v2/episode/list/${numId}`, 'fetch', HI_AJAX);
    try {
      const epHtml = JSON.parse(epRaw).html || '';
      const epMatch = epHtml.match(/data-number="1"[^>]*data-id="(\d+)"/);
      const epId = epMatch?.[1];
      console.log(`Episode 1 ID: ${epId}`);
      
      if (epId) {
        // Get servers
        const srvRaw = rf(`${HI}/ajax/v2/episode/servers?episodeId=${epId}`, 'fetch', HI_AJAX);
        const srvHtml = JSON.parse(srvRaw).html || '';
        
        // Find ALL servers, especially MegaUp ones
        const srvRe = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*>/gs;
        let m;
        const servers = [];
        while ((m = srvRe.exec(srvHtml)) !== null) {
          const b = m[0];
          const dataId = b.match(/data-id="(\d+)"/)?.[1];
          const type = b.match(/data-type="(sub|dub)"/)?.[1];
          const sid = b.match(/data-server-id="(\d+)"/)?.[1];
          if (dataId && type && sid) servers.push({ dataId, type, serverId: sid });
        }
        
        // Also extract server names from the HTML
        const nameRe = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*data-id="(\d+)"[^>]*>[\s\S]*?<\/div>/gs;
        console.log(`\nFound ${servers.length} servers:`);
        for (const srv of servers) {
          console.log(`  id=${srv.dataId} type=${srv.type} serverId=${srv.serverId}`);
          
          // Get the embed URL for each server
          try {
            const srcRaw = rf(`${HI}/ajax/v2/episode/sources?id=${srv.dataId}`, 'fetch', HI_AJAX);
            const srcData = JSON.parse(srcRaw);
            const embedUrl = srcData.link || '';
            console.log(`    embed: ${embedUrl.substring(0, 80)}`);
            
            // Check if it's a MegaUp URL
            if (embedUrl.includes('megaup')) {
              const vidId = embedUrl.split('/e/')[1]?.split('?')[0];
              console.log(`    ★ MegaUp video ID: ${vidId} (${vidId?.length} chars)`);
            }
          } catch {}
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

// Also try to partially decrypt a sample using what we have
console.log('\n=== Partial decrypt of g0 sample ===\n');

const s = g0[0];
console.log(`Sample: query=${s.query}, lid=${s.lid}, ptLen=${s.ptLen}`);

let partial = '';
for (let pos = 0; pos < s.ptLen; pos++) {
  const byte = s.enc[cipherPos(pos)];
  const posStr = String(pos);
  if (decryptTables[posStr] && decryptTables[posStr][byte]) {
    partial += decryptTables[posStr][byte];
  } else {
    partial += '?';
  }
}
console.log(`Partial: ${partial}`);

// Do the same for a g1 sample
console.log('\n=== Partial decrypt of g1 sample ===\n');
const s1 = g1[0];
console.log(`Sample: query=${s1.query}, lid=${s1.lid}, ptLen=${s1.ptLen}`);

let partial1 = '';
for (let pos = 0; pos < s1.ptLen; pos++) {
  const byte = s1.enc[cipherPos(pos)];
  const posStr = String(pos);
  if (decryptTables[posStr] && decryptTables[posStr][byte]) {
    partial1 += decryptTables[posStr][byte];
  } else {
    partial1 += '?';
  }
}
console.log(`Partial: ${partial1}`);

// Now let me try to get MegaUp video IDs from AnimeKai directly.
// The AnimeKai watch page might have the embed URL in the page source.
// Or we can try to find it through the API.

// Actually, let me try something clever:
// We know the video ID constant prefix for g0 is at positions 38-61.
// These are 24 chars that are the same for ALL g0 samples.
// The cipher bytes at these positions are known.
// If we can figure out what chars they map to, we have the prefix.
//
// The video ID chars are typically: a-z, A-Z, 0-9, -, _
// That's 64 possible chars per position.
// With 24 positions, that's 64^24 possibilities — way too many to brute force.
//
// BUT: if we can get even ONE actual video ID from MegaUp,
// we can determine all 24 constant chars at once.
// And the 22 constant suffix chars (pos 70-91) too.

// Let me try to get a MegaUp video ID by fetching the AnimeKai embed page
// for a known lid. The embed page should redirect to or contain the MegaUp URL.

console.log('\n=== Trying to get MegaUp URL from AnimeKai embed ===\n');

// The AnimeKai /ajax/links/view response is the encrypted embed URL.
// We can't decrypt it. But maybe we can find the video ID another way.

// Let me check: does MegaUp have a search or listing API?
// Or can we find the video ID from the MegaUp embed page title?

// Actually, let me try fetching a MegaUp embed page with a known video ID
// and see what the page looks like.
const testUrl = 'https://megaup22.online/e/test123';
const testPage = rf(testUrl);
console.log(`MegaUp test page (first 200 chars): ${testPage.substring(0, 200)}`);

// Let me also check if the HiAnime MegaCloud source for the same episode
// gives us any clue about the MegaUp video ID.
// MegaCloud and MegaUp might share video IDs.

// Actually, the REAL solution is simpler than I thought.
// We have the AnimeKai ENCRYPT tables (which work for encrypting our requests).
// The server's DECRYPT tables (for decrypting responses) are DIFFERENT.
// But the server's ENCRYPT tables (for encrypting responses) are what we need
// to reverse to get the DECRYPT tables.
//
// The server encrypts: plaintext → cipher using SERVER's encrypt tables
// We need: cipher → plaintext using SERVER's decrypt tables (= inverse of server's encrypt)
//
// We've been building: cipher_byte → plaintext_char at each position
// This IS the server's decrypt table.
// We just need more entries.
//
// For the video ID positions (38-91), we need to know the actual video ID.
// The video ID is different for each episode but has constant parts.
//
// KEY INSIGHT: We can get the video ID by using a DIFFERENT provider
// that serves the same MegaUp video. If HiAnime also uses MegaUp,
// the video ID would be the same.
//
// Let me check if any HiAnime server uses MegaUp.
