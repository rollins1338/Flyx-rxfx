/**
 * Test if DLHD can work entirely through Cloudflare (no RPI needed)
 * 
 * The key insight: The auth token method works from ANY IP!
 * We just need to:
 * 1. Fetch auth token from epicplayplay.cfd player page
 * 2. Use Authorization: Bearer <token> header for key requests
 * 
 * If this works from a datacenter IP (like this Windows machine),
 * it will work from Cloudflare Workers too!
 */

const https = require('https');

// Simulate what a Cloudflare Worker would do
async function simulateCFWorker(channel) {
  console.log(`\n=== Simulating CF Worker for channel ${channel} ===\n`);
  
  // Step 1: Fetch auth token from player page
  console.log('1. Fetching auth token from player page...');
  const authToken = await fetchAuthToken(channel);
  if (!authToken) {
    console.log('   ❌ Failed to get auth token');
    return false;
  }
  console.log(`   ✓ Got token: ${authToken.substring(0, 30)}...`);
  
  // Step 2: Get server key from server_lookup
  console.log('\n2. Getting server key from server_lookup...');
  const serverKey = await getServerKey(channel);
  console.log(`   ✓ Server key: ${serverKey}`);
  
  // Step 3: Fetch M3U8 playlist
  console.log('\n3. Fetching M3U8 playlist...');
  const m3u8Url = serverKey === 'top1/cdn'
    ? `https://top1.kiko2.ru/top1/cdn/premium${channel}/mono.css`
    : `https://${serverKey}new.kiko2.ru/${serverKey}/premium${channel}/mono.css`;
  
  const m3u8 = await fetchM3U8(m3u8Url);
  if (!m3u8) {
    console.log('   ❌ Failed to fetch M3U8');
    return false;
  }
  console.log(`   ✓ Got M3U8 (${m3u8.length} bytes)`);
  
  // Step 4: Extract key URL from M3U8
  const keyMatch = m3u8.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
  if (!keyMatch) {
    console.log('   ❌ No key URL in M3U8');
    return false;
  }
  const keyUrl = keyMatch[1];
  console.log(`   Key URL: ${keyUrl}`);
  
  // Step 5: Fetch key with Authorization header
  console.log('\n4. Fetching key with Authorization header...');
  const key = await fetchKeyWithAuth(keyUrl, authToken, channel);
  if (!key) {
    console.log('   ❌ Failed to fetch key');
    return false;
  }
  console.log(`   ✓ Got valid key: ${key.toString('hex')}`);
  
  console.log('\n✓ SUCCESS! DLHD can work entirely through Cloudflare!');
  return true;
}

async function fetchAuthToken(channel) {
  return new Promise((resolve) => {
    const url = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
        resolve(match ? match[1] : null);
      });
    }).on('error', () => resolve(null));
  });
}

async function getServerKey(channel) {
  return new Promise((resolve) => {
    https.get(`https://chevy.giokko.ru/server_lookup?channel_id=premium${channel}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.server_key || 'zeko');
        } catch {
          resolve('zeko');
        }
      });
    }).on('error', () => resolve('zeko'));
  });
}

async function fetchM3U8(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
        'Referer': 'https://epicplayplay.cfd/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.includes('#EXTM3U') ? data : null));
    }).on('error', () => resolve(null));
  });
}

async function fetchKeyWithAuth(keyUrl, authToken, channel) {
  return new Promise((resolve) => {
    const url = new URL(keyUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
        'Authorization': `Bearer ${authToken}`,
        'X-Channel-Key': `premium${channel}`,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        if (data.length === 16 && !data.toString('utf8').includes('error')) {
          resolve(data);
        } else {
          console.log(`   Response: ${res.statusCode}, ${data.length} bytes`);
          if (data.length < 100) console.log(`   Data: ${data.toString('utf8')}`);
          resolve(null);
        }
      });
    });
    req.on('error', (e) => {
      console.log(`   Error: ${e.message}`);
      resolve(null);
    });
    req.end();
  });
}

async function main() {
  console.log('Testing if DLHD can work entirely through Cloudflare');
  console.log('(No RPI proxy needed if auth token method works from datacenter IP)\n');
  console.log('Running from:', process.platform === 'win32' ? 'Windows' : process.platform);
  
  // Test multiple channels
  const channels = [51, 52, 53];
  let success = 0;
  
  for (const channel of channels) {
    if (await simulateCFWorker(channel)) {
      success++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${success}/${channels.length} channels successful`);
  
  if (success === channels.length) {
    console.log('\n🎉 DLHD CAN WORK ENTIRELY THROUGH CLOUDFLARE!');
    console.log('   No RPI proxy needed for key fetching.');
    console.log('   Just implement auth token fetching in CF Worker.');
  } else {
    console.log('\n⚠️ Some channels failed. RPI proxy may still be needed.');
  }
}

main();
