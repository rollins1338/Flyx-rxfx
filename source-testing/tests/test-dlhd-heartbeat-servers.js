#!/usr/bin/env node
/**
 * Test which servers have working heartbeat endpoints
 */

const https = require('https');

const CHANNEL = '51';
const channelKey = `premium${CHANNEL}`;

const SERVERS = ['zeko', 'chevy', 'wind', 'nfs', 'ddy6'];
const DOMAINS = ['kiko2.ru', 'giokko.ru'];

async function fetchUrl(url, headers = {}) {
  return new Promise((resolve) => {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...headers
    };
    
    const req = https.get(url, { headers: defaultHeaders, timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', (err) => resolve({ status: 'ERROR', error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
  });
}

async function main() {
  console.log('Testing heartbeat endpoints on all servers...\n');
  
  // Get auth token first
  console.log('1. Getting auth token...');
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${CHANNEL}`;
  const playerResult = await fetchUrl(playerUrl, { 'Referer': 'https://daddyhd.com/' });
  
  const tokenMatch = playerResult.data?.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  if (!tokenMatch) {
    console.log('   ❌ No AUTH_TOKEN found');
    return;
  }
  const authToken = tokenMatch[1];
  console.log(`   ✅ Got token: ${authToken.substring(0, 30)}...`);
  
  // Test heartbeat on all servers
  console.log('\n2. Testing heartbeat endpoints...\n');
  
  for (const server of SERVERS) {
    for (const domain of DOMAINS) {
      const hbUrl = `https://${server}.${domain}/heartbeat`;
      const result = await fetchUrl(hbUrl, {
        'Authorization': `Bearer ${authToken}`,
        'X-Channel-Key': channelKey,
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      });
      
      const isOk = result.data?.includes('"ok"') || result.data?.includes('"status":"ok"');
      const icon = isOk ? '✅' : '❌';
      console.log(`   ${icon} ${server}.${domain}: ${result.status}`);
      if (isOk) {
        console.log(`      Response: ${result.data?.substring(0, 100)}`);
      }
    }
  }
  
  // Now test key fetch after heartbeat on chevy
  console.log('\n3. Testing key fetch after heartbeat on chevy...');
  
  // Call heartbeat on chevy
  const hbResult = await fetchUrl('https://chevy.kiko2.ru/heartbeat', {
    'Authorization': `Bearer ${authToken}`,
    'X-Channel-Key': channelKey,
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
  });
  console.log(`   Heartbeat: ${hbResult.status} - ${hbResult.data?.substring(0, 80)}`);
  
  // Now fetch key
  const keyUrl = 'https://chevy.kiko2.ru/key/premium51/5886979';
  const keyResult = await fetchUrl(keyUrl, {
    'Authorization': `Bearer ${authToken}`,
    'X-Channel-Key': channelKey,
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
  });
  
  console.log(`   Key fetch: ${keyResult.status}, ${keyResult.data?.length} bytes`);
  if (keyResult.data?.length === 16) {
    console.log(`   ✅ Valid key: ${Buffer.from(keyResult.data).toString('hex')}`);
  } else {
    console.log(`   Response: ${keyResult.data?.substring(0, 100)}`);
  }
}

main().catch(console.error);
