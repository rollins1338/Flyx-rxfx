#!/usr/bin/env node
/**
 * Test Dragon Ball Z extraction via RPI /animekai/extract endpoint
 * 
 * This tests the NEW flow where RPI does ALL the work:
 * 1. Vercel/Client gets encrypted embed from AnimeKai
 * 2. Sends to CF Worker → RPI /animekai/extract
 * 3. RPI decrypts AnimeKai, fetches MegaUp /media/, decrypts MegaUp
 * 4. Returns final HLS stream URL
 */

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

// Dragon Ball Z: TMDB ID 12971, Season 5 Episode 1 = Absolute Episode 140
const KAI_ID = 'd4e49A';
const KAI_AJAX = 'https://animekai.to/ajax';

// CF Worker URL (routes to RPI)
const CF_PROXY_URL = 'https://media-proxy.vynx.workers.dev';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

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

function runTsx(code) {
  const result = execSync(`npx tsx -e "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  return result.trim();
}

async function main() {
  console.log('=== Dragon Ball Z RPI Extraction Test ===\n');
  console.log(`AnimeKai kai_id: ${KAI_ID}`);
  console.log(`CF Proxy: ${CF_PROXY_URL}`);
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

  // Step 5: Send to CF Worker → RPI for full extraction
  console.log('\n--- Step 5: RPI Full Extraction ---');
  const extractUrl = `${CF_PROXY_URL}/animekai/extract?embed=${encodeURIComponent(encryptedEmbed)}`;
  console.log(`Calling: ${extractUrl.substring(0, 80)}...`);
  
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
