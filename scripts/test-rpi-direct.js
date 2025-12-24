#!/usr/bin/env node
/**
 * Test RPI /animekai/extract endpoint DIRECTLY (bypass CF Worker)
 */

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

// Dragon Ball Z: TMDB ID 12971, Season 5 Episode 1 = Absolute Episode 140
const KAI_ID = 'd4e49A';
const KAI_AJAX = 'https://animekai.to/ajax';

// RPI Proxy URL (direct)
const RPI_PROXY_URL = 'https://rpi-proxy.vynx.cc';
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY || '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : require('http');
    
    client.get(url, { headers: HEADERS }, (res) => {
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

function runTsx(code) {
  const result = execSync(`npx tsx -e "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  return result.trim();
}

async function main() {
  console.log('=== Dragon Ball Z RPI DIRECT Extraction Test ===\n');
  console.log(`AnimeKai kai_id: ${KAI_ID}`);
  console.log(`RPI Proxy: ${RPI_PROXY_URL}`);
  console.log(`Target: Episode 140 (S5E1)\n`);

  // Step 1: Get encrypted kai_id
  console.log('--- Step 1: Encrypt kai_id ---');
  const encKaiId = JSON.parse(runTsx(`
    const { encryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
    console.log(JSON.stringify({ encrypted: encryptAnimeKai('${KAI_ID}') }));
  `)).encrypted;
  console.log(`✓ Encrypted: ${encKaiId.substring(0, 50)}...`);

  // Step 2: Get episodes
  console.log('\n--- Step 2: Get Episodes ---');
  const episodesUrl = `${KAI_AJAX}/episodes/list?ani_id=${KAI_ID}&_=${encKaiId}`;
  const episodesResult = await fetchJson(episodesUrl);
  
  if (!episodesResult.result) {
    console.log('❌ Failed to get episodes:', episodesResult);
    return;
  }
  console.log(`✓ Got episodes HTML (${episodesResult.result.length} chars)`);

  // Parse episode 140
  const episodeRegex = /<a[^>]*\bnum="140"[^>]*\btoken="([^"]+)"[^>]*>/i;
  const match = episodesResult.result.match(episodeRegex);
  
  if (!match) {
    console.log('❌ Episode 140 not found');
    return;
  }
  
  const episodeToken = match[1];
  console.log(`✓ Episode 140 token: ${episodeToken}`);

  // Step 3: Get servers
  console.log('\n--- Step 3: Get Servers ---');
  const encToken = JSON.parse(runTsx(`
    const { encryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
    console.log(JSON.stringify({ encrypted: encryptAnimeKai('${episodeToken}') }));
  `)).encrypted;
  
  const serversUrl = `${KAI_AJAX}/links/list?token=${episodeToken}&_=${encToken}`;
  const serversResult = await fetchJson(serversUrl);
  
  if (!serversResult.result) {
    console.log('❌ Failed to get servers:', serversResult);
    return;
  }
  console.log(`✓ Got servers HTML (${serversResult.result.length} chars)`);

  // Parse first server lid
  const serverRegex = /<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>/i;
  const serverMatch = serversResult.result.match(serverRegex);
  
  if (!serverMatch) {
    console.log('❌ No servers found');
    return;
  }
  
  const lid = serverMatch[1];
  console.log(`✓ First server lid: ${lid}`);

  // Step 4: Get encrypted embed
  console.log('\n--- Step 4: Get Encrypted Embed ---');
  const encLid = JSON.parse(runTsx(`
    const { encryptAnimeKai } = require('./app/lib/animekai-crypto.ts');
    console.log(JSON.stringify({ encrypted: encryptAnimeKai('${lid}') }));
  `)).encrypted;
  
  const embedUrl = `${KAI_AJAX}/links/view?id=${lid}&_=${encLid}`;
  const embedResult = await fetchJson(embedUrl);
  
  if (!embedResult.result) {
    console.log('❌ Failed to get embed:', embedResult);
    return;
  }
  
  const encryptedEmbed = embedResult.result;
  console.log(`✓ Got encrypted embed (${encryptedEmbed.length} chars)`);

  // Step 5: Send DIRECTLY to RPI for full extraction (bypass CF Worker)
  console.log('\n--- Step 5: RPI DIRECT Full Extraction ---');
  const extractUrl = `${RPI_PROXY_URL}/animekai/extract?key=${RPI_PROXY_KEY}&embed=${encodeURIComponent(encryptedEmbed)}`;
  console.log(`Calling: ${extractUrl.substring(0, 100)}...`);
  
  const extractResult = await fetchJson(extractUrl);
  
  if (extractResult.error) {
    console.log('❌ Extraction error:', extractResult);
    return;
  }
  
  if (!extractResult.success) {
    console.log('❌ Extraction failed:', extractResult);
    return;
  }
  
  console.log('\n=== SUCCESS ===');
  console.log(`Stream URL: ${extractResult.streamUrl}`);
  if (extractResult.skip) {
    console.log(`Skip intro: ${JSON.stringify(extractResult.skip.intro)}`);
    console.log(`Skip outro: ${JSON.stringify(extractResult.skip.outro)}`);
  }
}

main().catch(console.error);
