#!/usr/bin/env node
/**
 * Test Dragon Ball Z extraction via AnimeKai
 * 
 * This tests the full flow:
 * 1. Search AnimeKai for Dragon Ball Z
 * 2. Get episodes list
 * 3. Get servers for episode 140 (S5E1)
 * 4. Get embed URL
 * 5. Call MegaUp /media/ via CF → RPI proxy
 * 6. Decrypt and get stream URL
 */

const https = require('https');

// Dragon Ball Z: TMDB ID 12971, Season 5 Episode 1 = Absolute Episode 140
const TMDB_ID = '12971';
const SEASON = 5;
const EPISODE = 1;

// AnimeKai kai_id for Dragon Ball Z
const KAI_ID = 'd4e49A';

// API endpoints
const KAI_AJAX = 'https://animekai.to/ajax';

// Headers
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

// Load crypto from the app
const path = require('path');

// We need to transpile the TypeScript file
async function loadCrypto() {
  try {
    // Try to use ts-node or tsx to load the TypeScript file
    const { encryptAnimeKai, decryptAnimeKai } = require('../app/lib/animekai-crypto.ts');
    return { encryptAnimeKai, decryptAnimeKai };
  } catch (e) {
    console.log('Could not load TypeScript directly, trying compiled version...');
    // Try the compiled version
    try {
      const { encryptAnimeKai, decryptAnimeKai } = require('../.next/server/app/lib/animekai-crypto.js');
      return { encryptAnimeKai, decryptAnimeKai };
    } catch (e2) {
      console.error('Could not load crypto module:', e2.message);
      process.exit(1);
    }
  }
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Invalid JSON', raw: data.substring(0, 500) });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Dragon Ball Z AnimeKai Extraction Test ===\n');
  console.log(`TMDB ID: ${TMDB_ID}, Season ${SEASON} Episode ${EPISODE}`);
  console.log(`AnimeKai kai_id: ${KAI_ID}`);
  console.log(`Expected absolute episode: 140\n`);

  // Load crypto
  console.log('Loading crypto module...');
  let crypto;
  try {
    // Use require with tsx
    const { execSync } = require('child_process');
    
    // Create a simple test to verify crypto works
    const testScript = `
      const { encryptAnimeKai, decryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
      const enc = encryptAnimeKai('${KAI_ID}');
      console.log(JSON.stringify({ encrypted: enc }));
    `;
    
    const result = execSync(`npx tsx -e "${testScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const { encrypted } = JSON.parse(result.trim());
    console.log(`✓ Crypto loaded, encrypted kai_id: ${encrypted.substring(0, 40)}...`);
    
    // Now we know crypto works, let's do the full test
    console.log('\n--- Step 1: Get Episodes List ---');
    const episodesUrl = `${KAI_AJAX}/episodes/list?ani_id=${KAI_ID}&_=${encrypted}`;
    console.log(`URL: ${episodesUrl.substring(0, 80)}...`);
    
    const episodesResult = await fetchJson(episodesUrl);
    
    if (!episodesResult.result) {
      console.log('❌ Failed to get episodes:', episodesResult);
      return;
    }
    
    console.log(`✓ Got episodes HTML (${episodesResult.result.length} chars)`);
    
    // Parse episodes to find episode 140
    const episodeRegex = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
    const episodes = {};
    let match;
    while ((match = episodeRegex.exec(episodesResult.result)) !== null) {
      episodes[match[1]] = match[2];
    }
    
    console.log(`✓ Parsed ${Object.keys(episodes).length} episodes`);
    console.log(`  Episodes available: ${Object.keys(episodes).slice(0, 10).join(', ')}...`);
    
    // Find episode 140
    const targetEp = '140';
    if (!episodes[targetEp]) {
      console.log(`❌ Episode ${targetEp} not found!`);
      console.log(`  Available: ${Object.keys(episodes).join(', ')}`);
      return;
    }
    
    const episodeToken = episodes[targetEp];
    console.log(`✓ Found episode ${targetEp}, token: ${episodeToken.substring(0, 30)}...`);
    
    // Step 2: Get servers
    console.log('\n--- Step 2: Get Servers ---');
    
    // Encrypt the token
    const encTokenScript = `
      const { encryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
      const enc = encryptAnimeKai('${episodeToken}');
      console.log(JSON.stringify({ encrypted: enc }));
    `;
    
    const encTokenResult = execSync(`npx tsx -e "${encTokenScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const { encrypted: encToken } = JSON.parse(encTokenResult.trim());
    
    const serversUrl = `${KAI_AJAX}/links/list?token=${episodeToken}&_=${encToken}`;
    console.log(`URL: ${serversUrl.substring(0, 80)}...`);
    
    const serversResult = await fetchJson(serversUrl);
    
    if (!serversResult.result) {
      console.log('❌ Failed to get servers:', serversResult);
      return;
    }
    
    console.log(`✓ Got servers HTML (${serversResult.result.length} chars)`);
    
    // Parse servers
    const serverRegex = /<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>([^<]*)<\/span>/gi;
    const servers = [];
    while ((match = serverRegex.exec(serversResult.result)) !== null) {
      servers.push({ lid: match[1], name: match[2].trim() });
    }
    
    console.log(`✓ Found ${servers.length} servers:`);
    servers.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (lid: ${s.lid.substring(0, 20)}...)`));
    
    if (servers.length === 0) {
      console.log('❌ No servers found!');
      return;
    }
    
    // Step 3: Get embed URL from first server
    console.log('\n--- Step 3: Get Embed URL ---');
    const server = servers[0];
    
    // Encrypt the lid
    const encLidScript = `
      const { encryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
      const enc = encryptAnimeKai('${server.lid}');
      console.log(JSON.stringify({ encrypted: enc }));
    `;
    
    const encLidResult = execSync(`npx tsx -e "${encLidScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const { encrypted: encLid } = JSON.parse(encLidResult.trim());
    
    const embedUrl = `${KAI_AJAX}/links/view?id=${server.lid}&_=${encLid}`;
    console.log(`URL: ${embedUrl.substring(0, 80)}...`);
    
    const embedResult = await fetchJson(embedUrl);
    
    if (!embedResult.result) {
      console.log('❌ Failed to get embed:', embedResult);
      return;
    }
    
    console.log(`✓ Got encrypted embed (${embedResult.result.length} chars)`);
    
    // Decrypt the embed
    const decryptScript = `
      const { decryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
      let dec = decryptAnimeKai('${embedResult.result}');
      // Decode }XX format
      dec = dec.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      console.log(JSON.stringify({ decrypted: dec }));
    `;
    
    const decryptResult = execSync(`npx tsx -e "${decryptScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const { decrypted } = JSON.parse(decryptResult.trim());
    console.log(`✓ Decrypted embed: ${decrypted.substring(0, 100)}...`);
    
    // Parse the decrypted data
    let embedData;
    try {
      embedData = JSON.parse(decrypted);
    } catch (e) {
      console.log('❌ Failed to parse decrypted embed as JSON');
      return;
    }
    
    const megaupEmbedUrl = embedData.url;
    console.log(`✓ MegaUp embed URL: ${megaupEmbedUrl}`);
    
    // Step 4: Call MegaUp /media/ via CF → RPI proxy
    console.log('\n--- Step 4: Fetch MegaUp /media/ via Proxy ---');
    
    // Extract video ID from embed URL
    const urlMatch = megaupEmbedUrl.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
    if (!urlMatch) {
      console.log('❌ Invalid MegaUp embed URL format');
      return;
    }
    
    const [, host, videoId] = urlMatch;
    const mediaUrl = `https://${host}/media/${videoId}`;
    console.log(`MegaUp /media/ URL: ${mediaUrl}`);
    
    // Call via CF proxy
    const cfProxyUrl = 'https://media-proxy.vynx.workers.dev';
    const proxiedUrl = `${cfProxyUrl}/animekai?url=${encodeURIComponent(mediaUrl)}&ua=${encodeURIComponent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')}`;
    
    console.log(`Proxied URL: ${proxiedUrl.substring(0, 100)}...`);
    
    const mediaResult = await fetchJson(proxiedUrl);
    
    if (mediaResult.error) {
      console.log('❌ Proxy error:', mediaResult);
      return;
    }
    
    if (mediaResult.status !== 200 || !mediaResult.result) {
      console.log('❌ MegaUp /media/ failed:', mediaResult);
      return;
    }
    
    console.log(`✓ Got encrypted media data (${mediaResult.result.length} chars)`);
    
    // Decrypt MegaUp response
    console.log('\n--- Step 5: Decrypt MegaUp Response ---');
    
    const megaupDecryptScript = `
      const { decryptMegaUp } = require('./app/lib/megaup-crypto.ts');
      const dec = decryptMegaUp('${mediaResult.result}');
      console.log(JSON.stringify({ decrypted: dec }));
    `;
    
    const megaupDecryptResult = execSync(`npx tsx -e "${megaupDecryptScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    
    const { decrypted: megaupDecrypted } = JSON.parse(megaupDecryptResult.trim());
    console.log(`✓ Decrypted MegaUp response: ${megaupDecrypted.substring(0, 200)}...`);
    
    // Parse stream data
    let streamData;
    try {
      streamData = JSON.parse(megaupDecrypted);
    } catch (e) {
      console.log('❌ Failed to parse MegaUp response as JSON');
      return;
    }
    
    // Extract stream URL
    let streamUrl = '';
    if (streamData.sources && streamData.sources[0]) {
      streamUrl = streamData.sources[0].file || streamData.sources[0].url || '';
    } else if (streamData.file) {
      streamUrl = streamData.file;
    } else if (streamData.url) {
      streamUrl = streamData.url;
    }
    
    if (!streamUrl) {
      console.log('❌ No stream URL in response:', streamData);
      return;
    }
    
    console.log('\n=== SUCCESS ===');
    console.log(`Stream URL: ${streamUrl}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stderr) console.error('stderr:', error.stderr.toString());
  }
}

main();
