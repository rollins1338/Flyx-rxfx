/**
 * Full Dragon Ball Z extraction test - simulates what the extractor does
 */
const https = require('https');
const fs = require('fs');

// Use the compiled JS version or inline the crypto functions
// For simplicity, we'll use a direct HTTP call to test the API flow

// Use enc-dec.app API for testing (the production code uses native crypto)
async function encryptAnimeKai(text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ text });
    const req = https.request({
      hostname: 'enc-dec.app',
      path: '/enc-kai',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.result || json.encrypted);
        } catch (e) {
          reject(new Error(`Encrypt failed: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function decryptAnimeKai(encoded) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ text: encoded });
    const req = https.request({
      hostname: 'enc-dec.app',
      path: '/dec-kai',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.result || json.decrypted);
        } catch (e) {
          reject(new Error(`Decrypt failed: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { 
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch(e) { resolve({ status: res.statusCode, data, error: e.message }); } 
      });
    }).on('error', reject);
  });
}

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Dragon Ball Z Full Extraction Test ===\n');
  
  // Dragon Ball Z TMDB ID is 12971
  // Season 5 Episode 1 would be episode 140 in absolute numbering (S1: 39, S2: 35, S3: 33, S4: 32)
  // But AnimeKai might list all 291 episodes as a single season
  
  const kaiId = 'd4e49A';
  const targetEpisode = 140; // S5E1 in absolute numbering
  
  console.log(`1. Getting episodes for kai_id: ${kaiId}...`);
  const encKaiId = encryptAnimeKai(kaiId);
  const episodesResult = await fetchJson(`https://animekai.to/ajax/episodes/list?ani_id=${kaiId}&_=${encKaiId}`);
  
  if (!episodesResult.data?.result) {
    console.log('   ERROR: No episodes result');
    console.log('   Response:', episodesResult);
    return;
  }
  
  // Parse episodes
  const episodeRegex = /<a[^>]*\bnum="(\d+)"[^>]*\btoken="([^"]+)"[^>]*>/gi;
  const episodes = {};
  let match;
  while ((match = episodeRegex.exec(episodesResult.data.result)) !== null) {
    episodes[match[1]] = match[2];
  }
  
  // Also try alternate order
  const altRegex = /<a[^>]*\btoken="([^"]+)"[^>]*\bnum="(\d+)"[^>]*>/gi;
  while ((match = altRegex.exec(episodesResult.data.result)) !== null) {
    if (!episodes[match[2]]) {
      episodes[match[2]] = match[1];
    }
  }
  
  const episodeNums = Object.keys(episodes).map(Number).sort((a, b) => a - b);
  console.log(`   Found ${episodeNums.length} episodes`);
  console.log(`   Episode range: ${episodeNums[0]} - ${episodeNums[episodeNums.length - 1]}`);
  
  // Check if target episode exists
  if (!episodes[targetEpisode]) {
    console.log(`   ERROR: Episode ${targetEpisode} not found!`);
    console.log(`   Available episodes: ${episodeNums.slice(0, 20).join(', ')}...`);
    
    // Try episode 1 instead
    console.log(`\n   Trying episode 1 instead...`);
    if (!episodes[1]) {
      console.log('   ERROR: Episode 1 also not found!');
      return;
    }
  }
  
  const testEpisode = episodes[targetEpisode] ? targetEpisode : 1;
  const token = episodes[testEpisode];
  console.log(`\n2. Getting servers for episode ${testEpisode}...`);
  console.log(`   Token: ${token.substring(0, 30)}...`);
  
  const encToken = encryptAnimeKai(token);
  const serversResult = await fetchJson(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`);
  
  if (!serversResult.data?.result) {
    console.log('   ERROR: No servers result');
    console.log('   Response:', serversResult);
    return;
  }
  
  // Parse servers
  const serverRegex = /<span[^>]*class="server"[^>]*data-lid="([^"]+)"[^>]*>([^<]*)<\/span>/gi;
  const servers = [];
  while ((match = serverRegex.exec(serversResult.data.result)) !== null) {
    servers.push({ lid: match[1], name: match[2].trim() });
  }
  
  console.log(`   Found ${servers.length} servers:`);
  servers.forEach((s, i) => console.log(`   ${i + 1}. ${s.name} (lid: ${s.lid.substring(0, 20)}...)`));
  
  if (servers.length === 0) {
    console.log('   ERROR: No servers found!');
    return;
  }
  
  // Try first server
  const server = servers[0];
  console.log(`\n3. Getting embed from server "${server.name}"...`);
  
  const encLid = encryptAnimeKai(server.lid);
  const embedResult = await fetchJson(`https://animekai.to/ajax/links/view?id=${server.lid}&_=${encLid}`);
  
  if (!embedResult.data?.result) {
    console.log('   ERROR: No embed result');
    console.log('   Response:', embedResult);
    return;
  }
  
  console.log(`   Got encrypted embed (${embedResult.data.result.length} chars)`);
  
  // Decrypt
  let decrypted = decryptAnimeKai(embedResult.data.result);
  decrypted = decrypted.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );
  
  console.log(`   Decrypted: ${decrypted.substring(0, 200)}...`);
  
  try {
    const streamData = JSON.parse(decrypted);
    console.log(`\n4. Stream data:`);
    console.log(`   URL: ${streamData.url}`);
    
    // Check if it's an embed URL that needs further extraction
    if (streamData.url && streamData.url.includes('/e/')) {
      console.log(`\n   ⚠️ This is an EMBED URL, not a direct stream!`);
      console.log(`   The extractor needs to call MegaUp /media/ API to get the actual stream.`);
      
      // Extract video ID
      const urlMatch = streamData.url.match(/https?:\/\/([^\/]+)\/e\/([^\/\?]+)/);
      if (urlMatch) {
        const [, host, videoId] = urlMatch;
        console.log(`   Host: ${host}`);
        console.log(`   Video ID: ${videoId}`);
        console.log(`   Media URL: https://${host}/media/${videoId}`);
      }
    }
  } catch (e) {
    console.log(`   ERROR parsing stream data: ${e.message}`);
    console.log(`   Raw decrypted: ${decrypted}`);
  }
  
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
