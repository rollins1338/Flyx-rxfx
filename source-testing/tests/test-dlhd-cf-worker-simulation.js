/**
 * Test the updated CF Worker DLHD logic
 * This simulates exactly what the CF Worker will do
 */

const https = require('https');

// Simulate CF Worker caches
const authTokenCache = new Map();
const serverKeyCache = new Map();

const AUTH_TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
const SERVER_KEY_CACHE_TTL_MS = 30 * 60 * 1000;

// CDN patterns from CF Worker
const CDN_PATTERNS = {
  kiko2: (serverKey, channelKey) =>
    `https://${serverKey}new.kiko2.ru/${serverKey}/${channelKey}/mono.css`,
  top1cdn: (channelKey) =>
    `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`,
};

const KNOWN_SERVER_KEYS = ['zeko', 'chevy', 'top1/cdn'];

async function fetchAuthToken(channel) {
  const cached = authTokenCache.get(channel);
  if (cached && (Date.now() - cached.fetchedAt) < AUTH_TOKEN_CACHE_TTL_MS) {
    console.log(`  [Auth] Using cached token for channel ${channel}`);
    return cached.token;
  }
  
  console.log(`  [Auth] Fetching fresh token for channel ${channel}...`);
  
  return new Promise((resolve) => {
    const url = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
        if (match) {
          authTokenCache.set(channel, { token: match[1], fetchedAt: Date.now() });
          console.log(`  [Auth] Got token: ${match[1].substring(0, 20)}...`);
          resolve(match[1]);
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function extractChannelFromKeyUrl(keyUrl) {
  const match = keyUrl.match(/premium(\d+)/);
  return match ? match[1] : null;
}

async function getServerKey(channelKey) {
  const cached = serverKeyCache.get(channelKey);
  if (cached && (Date.now() - cached.fetchedAt) < SERVER_KEY_CACHE_TTL_MS) {
    return { serverKey: cached.serverKey, playerDomain: cached.playerDomain };
  }
  
  return new Promise((resolve) => {
    https.get(`https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.server_key) {
            serverKeyCache.set(channelKey, {
              serverKey: json.server_key,
              playerDomain: 'epicplayplay.cfd',
              fetchedAt: Date.now(),
            });
            resolve({ serverKey: json.server_key, playerDomain: 'epicplayplay.cfd' });
            return;
          }
        } catch {}
        resolve({ serverKey: KNOWN_SERVER_KEYS[0], playerDomain: 'epicplayplay.cfd' });
      });
    }).on('error', () => resolve({ serverKey: KNOWN_SERVER_KEYS[0], playerDomain: 'epicplayplay.cfd' }));
  });
}

function constructM3U8Url(serverKey, channelKey) {
  if (serverKey === 'top1/cdn') return CDN_PATTERNS.top1cdn(channelKey);
  return CDN_PATTERNS.kiko2(serverKey, channelKey);
}

// Simulate handlePlaylistRequest
async function handlePlaylistRequest(channel) {
  console.log(`\n=== handlePlaylistRequest(${channel}) ===`);
  
  const channelKey = `premium${channel}`;
  const { serverKey } = await getServerKey(channelKey);
  console.log(`  Server key: ${serverKey}`);
  
  const m3u8Url = constructM3U8Url(serverKey, channelKey);
  console.log(`  M3U8 URL: ${m3u8Url}`);
  
  // Fetch M3U8 directly (no RPI proxy)
  const m3u8 = await new Promise((resolve) => {
    https.get(`${m3u8Url}?_t=${Date.now()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://epicplayplay.cfd/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.includes('#EXTM3U') ? data : null));
    }).on('error', () => resolve(null));
  });
  
  if (!m3u8) {
    console.log('  ❌ Failed to fetch M3U8');
    return null;
  }
  console.log(`  ✓ Got M3U8 (${m3u8.length} bytes)`);
  
  // Extract key URL
  const keyMatch = m3u8.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
  if (!keyMatch) {
    console.log('  ❌ No key URL in M3U8');
    return null;
  }
  
  return { m3u8, keyUrl: keyMatch[1], serverKey };
}

// Simulate handleKeyProxy
async function handleKeyProxy(keyUrl) {
  console.log(`\n=== handleKeyProxy ===`);
  console.log(`  Key URL: ${keyUrl}`);
  
  const channel = extractChannelFromKeyUrl(keyUrl);
  if (!channel) {
    console.log('  ❌ Could not extract channel');
    return null;
  }
  console.log(`  Channel: ${channel}`);
  
  const authToken = await fetchAuthToken(channel);
  if (!authToken) {
    console.log('  ❌ Failed to get auth token');
    return null;
  }
  
  // Fetch key with Authorization header
  console.log('  Fetching key with auth token...');
  const key = await new Promise((resolve) => {
    const url = new URL(keyUrl);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
          console.log(`  Response: ${res.statusCode}, ${data.length} bytes`);
          if (data.length < 100) console.log(`  Data: ${data.toString('utf8')}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
  
  if (key) {
    console.log(`  ✓ Got valid key: ${key.toString('hex')}`);
  }
  return key;
}

async function testFullFlow(channel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTING FULL FLOW FOR CHANNEL ${channel}`);
  console.log('='.repeat(60));
  
  // Step 1: Get M3U8
  const playlistResult = await handlePlaylistRequest(channel);
  if (!playlistResult) {
    console.log('\n❌ FAILED: Could not get M3U8');
    return false;
  }
  
  // Step 2: Get Key
  const key = await handleKeyProxy(playlistResult.keyUrl);
  if (!key) {
    console.log('\n❌ FAILED: Could not get key');
    return false;
  }
  
  console.log('\n✓ SUCCESS: Full flow completed!');
  return true;
}

async function main() {
  console.log('Testing CF Worker DLHD Logic (Direct Auth Token Method)');
  console.log('This simulates exactly what the updated CF Worker will do.\n');
  
  const channels = [51, 52, 53];
  let success = 0;
  
  for (const channel of channels) {
    if (await testFullFlow(channel)) {
      success++;
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FINAL RESULT: ${success}/${channels.length} channels successful`);
  console.log('='.repeat(60));
  
  if (success === channels.length) {
    console.log('\n🎉 CF Worker is ready to deploy!');
    console.log('   Run: cd cloudflare-proxy && npx wrangler deploy');
  }
}

main();
