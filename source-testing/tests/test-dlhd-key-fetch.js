#!/usr/bin/env node
/**
 * Test DLHD key fetching with proper session/heartbeat
 */

const https = require('https');

const CHANNEL = '51';
const channelKey = `premium${CHANNEL}`;

async function fetchUrl(url, headers = {}) {
  return new Promise((resolve) => {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...headers
    };
    
    const req = https.get(url, { headers: defaultHeaders, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', (err) => resolve({ status: 'ERROR', error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
  });
}

async function main() {
  console.log('Testing DLHD key fetch flow...\n');
  
  // Step 1: Get auth token from player page
  console.log('1. Fetching player page for auth token...');
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${CHANNEL}`;
  const playerResult = await fetchUrl(playerUrl, { 'Referer': 'https://daddyhd.com/' });
  
  if (playerResult.status !== 200) {
    console.log(`   ❌ Failed: ${playerResult.status}`);
    return;
  }
  
  const tokenMatch = playerResult.data.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  if (!tokenMatch) {
    console.log('   ❌ No AUTH_TOKEN found in page');
    return;
  }
  const authToken = tokenMatch[1];
  console.log(`   ✅ Got token: ${authToken.substring(0, 30)}...`);
  
  // Step 2: Call heartbeat on zeko server
  console.log('\n2. Calling heartbeat on zeko server...');
  const hbUrl = 'https://zeko.kiko2.ru/heartbeat';
  const hbResult = await fetchUrl(hbUrl, {
    'Authorization': `Bearer ${authToken}`,
    'X-Channel-Key': channelKey,
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
  });
  
  console.log(`   Status: ${hbResult.status}`);
  console.log(`   Response: ${hbResult.data?.substring(0, 200)}`);
  
  // Step 3: Get M3U8 to find key URL
  console.log('\n3. Fetching M3U8 to get key URL...');
  const m3u8Url = `https://zekonew.kiko2.ru/zeko/${channelKey}/mono.css`;
  const m3u8Result = await fetchUrl(m3u8Url, { 'Referer': 'https://epicplayplay.cfd/' });
  
  if (!m3u8Result.data?.includes('#EXTM3U')) {
    console.log(`   ❌ Invalid M3U8: ${m3u8Result.data?.substring(0, 100)}`);
    return;
  }
  
  const keyMatch = m3u8Result.data.match(/URI="([^"]+)"/);
  if (!keyMatch) {
    console.log('   ❌ No key URL in M3U8');
    return;
  }
  
  let keyUrl = keyMatch[1];
  // Resolve relative URL
  if (!keyUrl.startsWith('http')) {
    keyUrl = `https://zekonew.kiko2.ru/zeko/${channelKey}/${keyUrl}`;
  }
  console.log(`   ✅ Key URL: ${keyUrl}`);
  
  // Step 4: Fetch key with auth
  console.log('\n4. Fetching key with auth headers...');
  const keyResult = await fetchUrl(keyUrl, {
    'Authorization': `Bearer ${authToken}`,
    'X-Channel-Key': channelKey,
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
  });
  
  console.log(`   Status: ${keyResult.status}`);
  console.log(`   Data length: ${keyResult.data?.length}`);
  
  if (keyResult.data?.length === 16) {
    const hex = Buffer.from(keyResult.data).toString('hex');
    console.log(`   ✅ Valid 16-byte key: ${hex}`);
  } else {
    console.log(`   ❌ Invalid key data: ${keyResult.data?.substring(0, 100)}`);
  }
  
  // Step 5: Try key on different server (zeko.kiko2.ru vs zekonew.kiko2.ru)
  console.log('\n5. Testing key URL variations...');
  
  // Extract key path
  const keyPath = keyUrl.match(/\/key\/premium\d+\/\d+/)?.[0];
  if (keyPath) {
    const keyUrls = [
      `https://zeko.kiko2.ru${keyPath}`,
      `https://zeko.giokko.ru${keyPath}`,
      `https://zekonew.kiko2.ru${keyPath}`,
      `https://zekonew.giokko.ru${keyPath}`,
    ];
    
    for (const url of keyUrls) {
      const result = await fetchUrl(url, {
        'Authorization': `Bearer ${authToken}`,
        'X-Channel-Key': channelKey,
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      });
      
      const icon = result.data?.length === 16 ? '✅' : '❌';
      console.log(`   ${icon} ${url.replace(keyPath, '...')}: ${result.status}, ${result.data?.length || 0} bytes`);
    }
  }
}

main().catch(console.error);
