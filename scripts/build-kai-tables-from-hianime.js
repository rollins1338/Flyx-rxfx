#!/usr/bin/env node
/**
 * Build AnimeKai decrypt tables by cross-referencing with HiAnime.
 * 
 * Strategy:
 * 1. For each anime episode, get ALL server links from AnimeKai (encrypted)
 * 2. For the same episode on HiAnime, get the MegaUp embed URL (via MegaCloud decrypt)
 * 3. The MegaUp video ID from HiAnime IS the plaintext for the AnimeKai cipher
 * 4. Build full 183-position substitution tables from known plaintext-ciphertext pairs
 * 
 * This works because both providers serve the SAME MegaUp video for the same episode.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function rf(url, mode = 'fetch', extra = {}) {
  const hdrs = { 'User-Agent': UA, ...extra };
  const args = ['--url', url, '--mode', mode, '--timeout', '20', '--headers', JSON.stringify(hdrs)];
  return execFileSync(RUST, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true }).trim();
}

function rfSafe(url, mode = 'fetch', extra = {}) {
  try { return rf(url, mode, extra); }
  catch (err) { if (err.stdout?.trim()) return err.stdout.trim(); throw err; }
}

function kaiEncrypt(text) {
  return execFileSync(RUST, ['--url', text, '--mode', 'kai-encrypt'], {
    encoding: 'utf8', timeout: 5000, windowsHide: true
  }).trim();
}

function fetchUrl(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': UA, ...hdrs }, timeout: 15000,
    };
    https.get(opts, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}


const HI = 'https://hianimez.to';
const HI_AJAX = { 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${HI}/` };
const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const KAI_DOMAINS = ['https://animekai.to', 'https://anikai.to'];

// Cipher position mapping (same as Rust)
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

function kaiFetch(urlPath) {
  for (const domain of KAI_DOMAINS) {
    try {
      const raw = rfSafe(`${domain}${urlPath}`, 'fetch', { ...KAI_HDRS, 'Referer': `${domain}/` });
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// HIANIME: Get MegaUp embed URLs for an anime
// ═══════════════════════════════════════════════════════

function hiGetMegaUpUrls(query, episodes = [1, 2, 3]) {
  const results = [];
  try {
    // Search
    const html = rfSafe(`${HI}/search?keyword=${encodeURIComponent(query)}`);
    const re = /<a\s[^>]*class="dynamic-name"[^>]*>[^<]*<\/a>/gs;
    const searchResults = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const href = m[0].match(/href="\/([^"?]+)/)?.[1];
      const title = m[0].match(/title="([^"]*)"/)?.[1];
      if (href) {
        const numId = href.match(/-(\d+)$/)?.[1];
        if (numId) searchResults.push({ slug: href, title: title || '', numId });
      }
    }
    if (!searchResults.length) return results;

    const qLow = query.toLowerCase();
    const best = searchResults.find(x => x.title.toLowerCase() === qLow) || searchResults[0];

    // Get episodes
    const epRaw = rfSafe(`${HI}/ajax/v2/episode/list/${best.numId}`, 'fetch', HI_AJAX);
    const epHtml = JSON.parse(epRaw).html || '';
    const eps = [];
    const epRe = /data-number="(\d+)"[^>]*data-id="(\d+)"/g;
    while ((m = epRe.exec(epHtml)) !== null) eps.push({ num: parseInt(m[1]), id: m[2] });

    for (const epNum of episodes) {
      const ep = eps.find(e => e.num === epNum);
      if (!ep) continue;

      // Get servers
      const srvRaw = rfSafe(`${HI}/ajax/v2/episode/servers?episodeId=${ep.id}`, 'fetch', HI_AJAX);
      const srvHtml = JSON.parse(srvRaw).html || '';
      const servers = [];
      const srvRe = /<div[^>]*class="[^"]*server-item[^"]*"[^>]*>/gs;
      while ((m = srvRe.exec(srvHtml)) !== null) {
        const b = m[0];
        const dataId = b.match(/data-id="(\d+)"/)?.[1];
        const type = b.match(/data-type="(sub|dub)"/)?.[1];
        const sid = b.match(/data-server-id="(\d+)"/)?.[1];
        if (dataId && type && sid) servers.push({ dataId, type, serverId: sid });
      }

      // For each sub/dub server, get the embed URL via MegaCloud decrypt
      for (const type of ['sub', 'dub']) {
        // Try server 4 (MegaCloud) first
        const srv = servers.find(s => s.type === type && s.serverId === '4') || servers.find(s => s.type === type);
        if (!srv) continue;
        try {
          const srcRaw = rfSafe(`${HI}/ajax/v2/episode/sources?id=${srv.dataId}`, 'fetch', HI_AJAX);
          const embedUrl = JSON.parse(srcRaw).link;
          if (!embedUrl) continue;
          
          // Decrypt via MegaCloud mode to get the actual stream data
          const data = JSON.parse(rfSafe(embedUrl, 'megacloud', { 'Referer': `${HI}/` }));
          const stream = data.sources?.[0]?.file || '';
          
          // The embed URL itself contains the MegaUp video ID
          // e.g., https://megacloud.blog/e/VIDEO_ID?k=1
          const sourceId = embedUrl.split('/e/')[1]?.split('?')[0];
          
          if (sourceId) {
            results.push({
              query, epNum, type, sourceId,
              embedUrl: embedUrl.substring(0, 80),
              hasStream: stream.includes('.m3u8'),
            });
          }
        } catch {}
      }
    }
  } catch (e) {
    console.log(`  HiAnime error for ${query}: ${e.message?.substring(0, 80)}`);
  }
  return results;
}


// ═══════════════════════════════════════════════════════
// ANIMEKAI: Get encrypted embed responses for an anime
// ═══════════════════════════════════════════════════════

function kaiGetEncryptedEmbeds(query, episodes = [1, 2, 3]) {
  const results = [];
  try {
    const searchData = kaiFetch(`/ajax/anime/search?keyword=${encodeURIComponent(query)}`);
    if (!searchData?.result?.html) return results;

    const slugRe = /<a[^>]*href="\/watch\/([^"]+)"[^>]*>[\s\S]*?<h6[^>]*class="title"[^>]*>([^<]*)<\/h6>/gi;
    const searchResults = [];
    let m;
    while ((m = slugRe.exec(searchData.result.html)) !== null) {
      searchResults.push({ slug: m[1], title: m[2].trim() });
    }
    if (!searchResults.length) return results;

    const qLow = query.toLowerCase();
    const best = searchResults.find(x => x.title.toLowerCase() === qLow) || searchResults[0];

    // Get anime_id
    let contentId = null;
    for (const domain of KAI_DOMAINS) {
      try {
        const watchHtml = rfSafe(`${domain}/watch/${best.slug}`, 'fetch', { 'Referer': `${domain}/` });
        const syncMatch = watchHtml.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
        if (syncMatch) {
          const sync = JSON.parse(syncMatch[1]);
          contentId = sync.anime_id;
          break;
        }
      } catch {}
    }
    if (!contentId) return results;

    // Get episodes
    const encId = kaiEncrypt(contentId);
    const epData = kaiFetch(`/ajax/episodes/list?ani_id=${contentId}&_=${encId}`);
    if (!epData?.result) return results;

    const epRe = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"/gi;
    const epMap = {};
    while ((m = epRe.exec(epData.result)) !== null) epMap[m[1]] = m[2];
    const epRe2 = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"/gi;
    while ((m = epRe2.exec(epData.result)) !== null) { if (!epMap[m[2]]) epMap[m[2]] = m[1]; }

    for (const epNum of episodes) {
      const token = epMap[String(epNum)];
      if (!token) continue;

      const encToken = kaiEncrypt(token);
      const srvData = kaiFetch(`/ajax/links/list?token=${token}&_=${encToken}`);
      if (!srvData?.result) continue;

      // Get ALL lids (not just first sub/dub)
      for (const type of ['sub', 'dub']) {
        const secMatch = srvData.result.match(new RegExp(`<div[^>]*data-id="${type}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'));
        if (!secMatch) continue;
        
        // Get all lids in this section
        const lids = [...secMatch[1].matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
        
        for (const lid of lids) {
          try {
            const encLid = kaiEncrypt(lid);
            const viewResp = kaiFetch(`/ajax/links/view?id=${lid}&_=${encLid}`);
            if (!viewResp?.result) continue;

            const raw = b64Decode(viewResp.result);
            const cipherData = raw.slice(21);
            const pl = ptLen(cipherData.length);

            results.push({
              query, epNum, type, lid,
              encrypted: viewResp.result,
              cipherData,
              cipherHex: cipherData.toString('hex'),
              ptLen: pl,
            });
          } catch {}
        }
      }
    }
  } catch (e) {
    console.log(`  AnimeKai error for ${query}: ${e.message?.substring(0, 80)}`);
  }
  return results;
}


// ═══════════════════════════════════════════════════════
// MAIN: Cross-reference and build tables
// ═══════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  BUILD ANIMEKAI TABLES FROM HIANIME CROSS-REFERENCE  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // tables[pos][byte] = plainChar
  const tables = {};
  function addEntry(pos, byte, char) {
    if (!tables[pos]) tables[pos] = {};
    if (tables[pos][byte] && tables[pos][byte] !== char) {
      console.log(`  ⚠ CONFLICT at pos ${pos}: byte 0x${byte.toString(16)} → '${tables[pos][byte]}' vs '${char}'`);
      return false;
    }
    tables[pos][byte] = char;
    return true;
  }

  // Anime list — use many different anime to maximize byte diversity
  const ANIME = [
    { query: 'bleach', episodes: [1, 2, 3, 4, 5] },
    { query: 'naruto', episodes: [1, 2, 3, 4, 5] },
    { query: 'dragon ball z', episodes: [1, 2, 3, 4, 5] },
    { query: 'jujutsu kaisen', episodes: [1, 2, 3, 4, 5] },
    { query: 'death note', episodes: [1, 2, 3, 4, 5] },
    { query: 'one piece', episodes: [1, 2, 3, 4, 5] },
    { query: 'black butler', episodes: [1, 2, 3, 4, 5] },
    { query: 'attack on titan', episodes: [1, 2, 3, 4, 5] },
    { query: 'demon slayer', episodes: [1, 2, 3, 4, 5] },
    { query: 'fullmetal alchemist brotherhood', episodes: [1, 2, 3, 4, 5] },
    { query: 'hunter x hunter', episodes: [1, 2, 3, 4, 5] },
    { query: 'my hero academia', episodes: [1, 2, 3, 4, 5] },
    { query: 'one punch man', episodes: [1, 2, 3, 4, 5] },
    { query: 'spy x family', episodes: [1, 2, 3, 4, 5] },
    { query: 'chainsaw man', episodes: [1, 2, 3, 4, 5] },
    { query: 'tokyo ghoul', episodes: [1, 2, 3, 4, 5] },
    { query: 'sword art online', episodes: [1, 2, 3, 4, 5] },
    { query: 'fairy tail', episodes: [1, 2, 3, 4, 5] },
    { query: 'black clover', episodes: [1, 2, 3, 4, 5] },
    { query: 'mob psycho 100', episodes: [1, 2, 3, 4, 5] },
    { query: 'vinland saga', episodes: [1, 2, 3, 4, 5] },
    { query: 'cowboy bebop', episodes: [1, 2, 3, 4, 5] },
    { query: 'steins gate', episodes: [1, 2, 3, 4, 5] },
    { query: 'code geass', episodes: [1, 2, 3, 4, 5] },
    { query: 'solo leveling', episodes: [1, 2, 3, 4, 5] },
    { query: 'blue lock', episodes: [1, 2, 3, 4, 5] },
    { query: 'frieren', episodes: [1, 2, 3, 4, 5] },
    { query: 'dandadan', episodes: [1, 2, 3, 4, 5] },
    { query: 'dr stone', episodes: [1, 2, 3, 4, 5] },
    { query: 'fire force', episodes: [1, 2, 3, 4, 5] },
  ];

  let totalPairs = 0;
  let matchedPairs = 0;

  for (const anime of ANIME) {
    console.log(`\n━━━ ${anime.query} ━━━`);
    
    // Step 1: Get HiAnime MegaUp URLs
    console.log('  [HiAnime] Getting embed URLs...');
    const hiResults = hiGetMegaUpUrls(anime.query, anime.episodes);
    console.log(`  [HiAnime] Got ${hiResults.length} embed URLs`);
    
    if (hiResults.length === 0) {
      console.log('  Skipping — no HiAnime results');
      continue;
    }

    // Step 2: Get AnimeKai encrypted embeds
    console.log('  [AnimeKai] Getting encrypted embeds...');
    const kaiResults = kaiGetEncryptedEmbeds(anime.query, anime.episodes);
    console.log(`  [AnimeKai] Got ${kaiResults.length} encrypted embeds`);

    if (kaiResults.length === 0) {
      console.log('  Skipping — no AnimeKai results');
      continue;
    }

    // Step 3: Cross-reference
    // For each AnimeKai encrypted embed, try to match with a HiAnime embed
    // The match is by episode number + type (sub/dub)
    // The HiAnime sourceId IS the video ID in the AnimeKai plaintext
    
    for (const kai of kaiResults) {
      // Find matching HiAnime result
      const hi = hiResults.find(h => h.epNum === kai.epNum && h.type === kai.type);
      if (!hi) continue;

      totalPairs++;
      
      // Build the expected plaintext
      // Format: {"url":"https:\/\/megaup22.online\/e\/VIDEO_ID","skip":{"intro":[...numbers...],"outro":[...numbers...]}}
      // We know the prefix and the video ID from HiAnime
      const videoId = hi.sourceId;
      const prefix = `{"url":"https:\\/\\/megaup22.online\\/e\\/${videoId}`;
      
      // Verify: the prefix should match the constant bytes at positions 0-37
      // and the video ID fills positions 38 to 38+videoId.length-1
      
      console.log(`  Match: ep${kai.epNum} ${kai.type} — videoId=${videoId} (${videoId.length} chars), ptLen=${kai.ptLen}`);
      
      // Now we know the plaintext for positions 0 through prefix.length-1
      // Add entries for ALL positions we know
      let conflicts = 0;
      for (let i = 0; i < prefix.length && i < kai.ptLen; i++) {
        const cp = cipherPos(i);
        if (cp < kai.cipherData.length) {
          if (!addEntry(i, kai.cipherData[cp], prefix[i])) conflicts++;
        }
      }
      
      // We also know position prefix.length is '"' (the quote after the video ID)
      const quotePos = prefix.length;
      if (quotePos < kai.ptLen) {
        const cp = cipherPos(quotePos);
        if (cp < kai.cipherData.length) {
          addEntry(quotePos, kai.cipherData[cp], '"');
        }
      }
      
      // And we know the suffix structure after the quote:
      // ,"skip":{"intro":[NUMBERS],"outro":[NUMBERS]}}
      const suffix1 = ',"skip":{"intro":[';
      const suffix1Start = quotePos + 1;
      for (let i = 0; i < suffix1.length && suffix1Start + i < kai.ptLen; i++) {
        const pos = suffix1Start + i;
        const cp = cipherPos(pos);
        if (cp < kai.cipherData.length) {
          addEntry(pos, kai.cipherData[cp], suffix1[i]);
        }
      }
      
      // The end is always ]}}
      const endChars = [']', '}', '}'];
      for (let offset = 0; offset < 3; offset++) {
        const pos = kai.ptLen - 3 + offset;
        const cp = cipherPos(pos);
        if (cp < kai.cipherData.length) {
          addEntry(pos, kai.cipherData[cp], endChars[offset]);
        }
      }
      
      // We also know "],"outro":["  comes before the outro numbers
      // And "]" comes before ]}}
      // The structure is: ...intro_numbers],"outro":[outro_numbers]}}
      // We need to figure out where the intro numbers end and outro starts
      // This depends on the actual numbers, which we don't know yet
      // But we can work backwards from ]}}:
      // pos ptLen-3 = ]
      // pos ptLen-4 = } or digit (last outro number char or closing bracket)
      // Actually the structure is: ...numbers]}}
      // So ptLen-3 = ], ptLen-2 = }, ptLen-1 = }
      // And before ] there are outro numbers, then "],"outro":["
      // The outro section is: ],"outro":[NUMBERS]}}
      // So working backwards: ]}}, then NUMBERS, then ],"outro":[
      
      if (conflicts === 0) matchedPairs++;
    }
    
    // Small delay between anime
    await new Promise(r => setTimeout(r, 200));
  }

  // ═══════════════════════════════════════════════════════
  // COVERAGE ANALYSIS
  // ═══════════════════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('  TABLE COVERAGE');
  console.log('═══════════════════════════════════════════════════════\n');

  let totalEntries = 0;
  let positionsWithEntries = 0;
  for (let pos = 0; pos < 183; pos++) {
    const t = tables[pos] || {};
    const count = Object.keys(t).length;
    totalEntries += count;
    if (count > 0) {
      positionsWithEntries++;
      const chars = [...new Set(Object.values(t))].sort().join('');
      const bar = '█'.repeat(Math.min(count, 50));
      console.log(`  pos ${pos.toString().padStart(3)}: ${count.toString().padStart(3)} entries [${chars.substring(0, 40)}] ${bar}`);
    }
  }

  console.log(`\n  Positions with entries: ${positionsWithEntries}/183`);
  console.log(`  Total entries: ${totalEntries}`);
  console.log(`  Matched pairs: ${matchedPairs}/${totalPairs}`);

  // ═══════════════════════════════════════════════════════
  // SAVE TABLES
  // ═══════════════════════════════════════════════════════
  const outFile = path.join(__dirname, 'kai-crossref-tables.json');
  fs.writeFileSync(outFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalEntries,
    positionsWithEntries,
    matchedPairs,
    totalPairs,
    tables,
  }, null, 2));
  console.log(`\n  Saved to ${outFile}`);

  // ═══════════════════════════════════════════════════════
  // GENERATE RUST TABLES
  // ═══════════════════════════════════════════════════════
  if (positionsWithEntries >= 100) {
    console.log('\n  Generating Rust tables...');
    generateRustTables(tables);
  } else {
    console.log(`\n  Not enough coverage (${positionsWithEntries}/183) to generate Rust tables.`);
    console.log('  Need more anime or episodes to fill gaps.');
  }
}

function generateRustTables(tables) {
  let rust = `//! AnimeKai substitution tables — AUTO-GENERATED
//! Generated: ${new Date().toISOString()}
//! DO NOT EDIT MANUALLY

pub const NUM_TABLES: usize = 183;

/// ENCRYPT[pos][ascii] = cipher_byte  (0xFF = unmapped)
pub const ENCRYPT: [[u8; 128]; NUM_TABLES] = [\n`;

  for (let pos = 0; pos < 183; pos++) {
    const t = tables[pos] || {};
    // Build reverse: char → byte (for encrypt table)
    const enc = new Array(128).fill(0xFF);
    for (const [byteStr, char] of Object.entries(t)) {
      const byte = parseInt(byteStr);
      const ascii = char.charCodeAt(0);
      if (ascii < 128) {
        enc[ascii] = byte;
      }
    }
    
    rust += `    // pos ${pos}\n    [`;
    for (let i = 0; i < 128; i++) {
      if (i % 16 === 0 && i > 0) rust += '\n     ';
      rust += `0x${enc[i].toString(16).padStart(2, '0')},`;
    }
    rust += `],\n`;
  }

  rust += `];\n`;

  const outPath = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'src', 'animekai_tables.rs');
  fs.writeFileSync(outPath, rust);
  console.log(`  Written to ${outPath}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
