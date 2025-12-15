/**
 * Final test for DLHD key fetching with Authorization header
 * This mimics exactly what the updated RPI proxy does
 */

const https = require('https');

// Auth token cache
const authTokenCache = new Map();

/**
 * Fetch auth token from the player page
 */
async function fetchAuthToken(channel) {
  const cached = authTokenCache.get(channel);
  if (cached && (Date.now() - cached.fetchedAt) < 30 * 60 * 1000) {
    console.log(`Using cached token for channel ${channel}`);
    return cached.token;
  }
  
  console.log(`Fetching fresh token for channel ${channel}...`);
  
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
        if (match) {
          const token = match[1];
          authTokenCache.set(channel, { token, fetchedAt: Date.now() });
          console.log(`Got token: ${token.substring(0, 30)}...`);
          resolve(token);
        } else {
          console.log('No token found in page');
          resolve(null);
        }
      });
    }).on('error', (e) => {
      console.error(`Error: ${e.message}`);
      resolve(null);
    });
  });
}

/**
 * Get server key from server_lookup
 */
async function getServerKey(channel) {
  return new Promise((resolve) => {
    https.get(`https://chevy.giokko.ru/server_lookup?channel_id=premium${channel}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
      }
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

/**
 * Get fresh key URL from M3U8
 */
async function getKeyUrl(channel) {
  const serverKey = await getServerKey(channel);
  const m3u8Url = serverKey === 'top1/cdn'
    ? `https://top1.kiko2.ru/top1/cdn/premium${channel}/mono.css`
    : `https://${serverKey}new.kiko2.ru/${serverKey}/premium${channel}/mono.css`;
  
  console.log(`Server key: ${serverKey}, M3U8: ${m3u8Url.substring(0, 60)}...`);
  
  return new Promise((resolve) => {
    https.get(m3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
        'Referer': 'https://epicplayplay.cfd/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
        resolve(match ? match[1] : null);
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Fetch key with Authorization header
 */
async function fetchKey(keyUrl, authToken, channel) {
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
        resolve({ status: res.statusCode, data });
      });
    });
    
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

async function testChannel(channel) {
  console.log(`\n=== Testing Channel ${channel} ===`);
  
  // Get auth token
  const authToken = await fetchAuthToken(channel);
  if (!authToken) {
    console.log('❌ Failed to get auth token');
    return false;
  }
  
  // Get key URL
  const keyUrl = await getKeyUrl(channel);
  if (!keyUrl) {
    console.log('❌ Failed to get key URL from M3U8');
    return false;
  }
  console.log(`Key URL: ${keyUrl}`);
  
  // Fetch key
  const result = await fetchKey(keyUrl, authToken, channel);
  if (result.error) {
    console.log(`❌ Error: ${result.error}`);
    return false;
  }
  
  console.log(`Status: ${result.status}, Length: ${result.data.length}`);
  
  if (result.data.length === 16) {
    const text = result.data.toString('utf8');
    if (text.includes('error')) {
      console.log(`❌ Error response: ${text}`);
      return false;
    } else {
      console.log(`✓ Valid key: ${result.data.toString('hex')}`);
      return true;
    }
  }
  
  console.log(`❌ Unexpected response`);
  return false;
}

async function main() {
  console.log('Testing DLHD key fetching with Authorization header\n');
  console.log('This is the method discovered via reverse engineering.');
  console.log('The key server requires: Authorization: Bearer <token>');
  console.log('Token is fetched from the player page.\n');
  
  // Test multiple channels
  const channels = [51, 52, 53];
  let success = 0;
  
  for (const channel of channels) {
    if (await testChannel(channel)) {
      success++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`${success}/${channels.length} channels successful`);
  
  if (success === channels.length) {
    console.log('\n✓ All tests passed! The auth token method works.');
  } else {
    console.log('\n⚠ Some tests failed. Check the output above.');
  }
}

main();
