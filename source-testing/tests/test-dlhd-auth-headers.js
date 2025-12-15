/**
 * Test DLHD key fetch with Authorization header
 * The player uses: Authorization: Bearer <token>
 */

const https = require('https');

// These are extracted from the player page - they change per session!
const AUTH_TOKEN = "7f2f4b4ee5da1a5aaca95d6ae4618589de16dc58439340bda789cff5ea9f814a";
const CHANNEL_KEY = "premium51";

async function getKeyUrl() {
  // First get fresh M3U8 to get current key URL
  return new Promise((resolve, reject) => {
    https.get('https://zekonew.kiko2.ru/zeko/premium51/mono.css', {
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
    }).on('error', reject);
  });
}

async function fetchKey(keyUrl, useAuth) {
  return new Promise((resolve) => {
    const url = new URL(keyUrl);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    };
    
    if (useAuth) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
      headers['X-Channel-Key'] = CHANNEL_KEY;
      headers['Cookie'] = `eplayer_session=${AUTH_TOKEN}`;
    }
    
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });
    
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

async function main() {
  console.log('Testing DLHD key fetch with Authorization header...\n');
  
  const keyUrl = await getKeyUrl();
  if (!keyUrl) {
    console.log('ERROR: Could not get key URL');
    return;
  }
  console.log('Key URL:', keyUrl);
  console.log('Auth Token:', AUTH_TOKEN.substring(0, 20) + '...');
  
  // Test 1: Without auth headers
  console.log('\n=== Test 1: Without Authorization ===');
  const result1 = await fetchKey(keyUrl, false);
  if (result1.error) {
    console.log('Error:', result1.error);
  } else {
    console.log('Status:', result1.status);
    console.log('Length:', result1.data.length);
    const text = result1.data.toString('utf8');
    if (text.includes('error')) {
      console.log('Response:', text);
    } else if (result1.data.length === 16) {
      console.log('Key (hex):', result1.data.toString('hex'));
    }
  }
  
  // Test 2: With auth headers
  console.log('\n=== Test 2: With Authorization ===');
  const result2 = await fetchKey(keyUrl, true);
  if (result2.error) {
    console.log('Error:', result2.error);
  } else {
    console.log('Status:', result2.status);
    console.log('Length:', result2.data.length);
    const text = result2.data.toString('utf8');
    if (text.includes('error')) {
      console.log('Response:', text);
    } else if (result2.data.length === 16) {
      console.log('Key (hex):', result2.data.toString('hex'));
      console.log('\n✓ SUCCESS! Authorization header works!');
    }
  }
  
  // Test 3: Get fresh token from player page
  console.log('\n=== Test 3: Get fresh token from player page ===');
  const freshToken = await getFreshToken();
  if (freshToken) {
    console.log('Fresh token:', freshToken.substring(0, 20) + '...');
    
    // Test with fresh token
    const result3 = await fetchKeyWithToken(keyUrl, freshToken);
    if (result3.error) {
      console.log('Error:', result3.error);
    } else {
      console.log('Status:', result3.status);
      console.log('Length:', result3.data.length);
      const text = result3.data.toString('utf8');
      if (text.includes('error')) {
        console.log('Response:', text);
      } else if (result3.data.length === 16) {
        console.log('Key (hex):', result3.data.toString('hex'));
        console.log('\n✓ SUCCESS with fresh token!');
      }
    }
  }
}

async function getFreshToken() {
  return new Promise((resolve) => {
    https.get('https://epicplayplay.cfd/premiumtv/daddyhd.php?id=51', {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0',
        'Referer': 'https://daddyhd.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract AUTH_TOKEN from the page
        const match = data.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
        resolve(match ? match[1] : null);
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchKeyWithToken(keyUrl, token) {
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
        'Authorization': `Bearer ${token}`,
        'X-Channel-Key': CHANNEL_KEY,
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

main();
