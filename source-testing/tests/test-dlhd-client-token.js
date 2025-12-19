#!/usr/bin/env node
/**
 * Test DLHD heartbeat with CLIENT_TOKEN
 * 
 * This tests the full auth flow:
 * 1. Fetch player page to get AUTH_TOKEN, CHANNEL_KEY, AUTH_COUNTRY, AUTH_TS
 * 2. Generate CLIENT_TOKEN (base64 fingerprint)
 * 3. Call heartbeat with all headers
 * 4. Fetch key with all headers
 */

const https = require('https');

function generateClientToken(channelKey, country, timestamp, userAgent) {
  const screen = '1920x1080';
  const tz = 'America/New_York';
  const lang = 'en-US';
  const fingerprint = `${userAgent}|${screen}|${tz}|${lang}`;
  const signData = `${channelKey}|${country}|${timestamp}|${userAgent}|${fingerprint}`;
  return Buffer.from(signData).toString('base64');
}

async function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const channel = '51';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  console.log('=== Step 1: Fetch player page ===\n');
  
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  const playerRes = await fetchUrl(playerUrl, {
    headers: {
      'User-Agent': userAgent,
      'Referer': 'https://daddyhd.com/',
    }
  });
  
  console.log('Player page status:', playerRes.status);
  
  // Extract variables
  const tokenMatch = playerRes.body.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  const channelKeyMatch = playerRes.body.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
  const countryMatch = playerRes.body.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
  const tsMatch = playerRes.body.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);
  
  if (!tokenMatch) {
    console.error('Failed to extract AUTH_TOKEN');
    return;
  }
  
  const authToken = tokenMatch[1];
  const channelKey = channelKeyMatch ? channelKeyMatch[1] : `premium${channel}`;
  const country = countryMatch ? countryMatch[1] : 'US';
  const timestamp = tsMatch ? tsMatch[1] : String(Math.floor(Date.now() / 1000));
  
  console.log('AUTH_TOKEN:', authToken.substring(0, 30) + '...');
  console.log('CHANNEL_KEY:', channelKey);
  console.log('AUTH_COUNTRY:', country);
  console.log('AUTH_TS:', timestamp);
  
  // Generate CLIENT_TOKEN
  const clientToken = generateClientToken(channelKey, country, timestamp, userAgent);
  console.log('\nCLIENT_TOKEN:', clientToken.substring(0, 50) + '...');
  console.log('CLIENT_TOKEN decoded:', Buffer.from(clientToken, 'base64').toString().substring(0, 100) + '...');
  
  console.log('\n=== Step 2: Call heartbeat ===\n');
  
  const hbUrl = 'https://chevy.kiko2.ru/heartbeat';
  const hbHeaders = {
    'User-Agent': userAgent,
    'Accept': '*/*',
    'Origin': 'https://epicplayplay.cfd',
    'Referer': 'https://epicplayplay.cfd/',
    'Authorization': `Bearer ${authToken}`,
    'X-Channel-Key': channelKey,
    'X-Client-Token': clientToken,
    'X-User-Agent': userAgent,
  };
  
  console.log('Heartbeat URL:', hbUrl);
  console.log('Headers:', JSON.stringify(hbHeaders, null, 2).substring(0, 500));
  
  const hbRes = await fetchUrl(hbUrl, { headers: hbHeaders });
  
  console.log('\nHeartbeat status:', hbRes.status);
  console.log('Heartbeat response:', hbRes.body.substring(0, 200));
  
  if (hbRes.status !== 200) {
    console.log('\n❌ Heartbeat failed! The server may be blocking non-browser requests.');
    console.log('This is expected from a datacenter IP (like your local machine or CF Workers).');
    console.log('The heartbeat endpoint requires a residential IP.');
    return;
  }
  
  console.log('\n=== Step 3: Fetch key ===\n');
  
  // First get the M3U8 to find a key URL
  const m3u8Url = `https://zekonew.kiko2.ru/zeko/${channelKey}/mono.css`;
  const m3u8Res = await fetchUrl(m3u8Url, {
    headers: {
      'User-Agent': userAgent,
      'Referer': 'https://epicplayplay.cfd/',
    }
  });
  
  console.log('M3U8 status:', m3u8Res.status);
  
  // Extract key URL from M3U8
  const keyUrlMatch = m3u8Res.body.match(/URI="([^"]+)"/);
  if (!keyUrlMatch) {
    console.log('No key URL found in M3U8');
    console.log('M3U8 preview:', m3u8Res.body.substring(0, 300));
    return;
  }
  
  let keyUrl = keyUrlMatch[1];
  // Rewrite to chevy.kiko2.ru
  const keyPathMatch = keyUrl.match(/\/key\/premium\d+\/\d+/);
  if (keyPathMatch) {
    keyUrl = `https://chevy.kiko2.ru${keyPathMatch[0]}`;
  }
  
  console.log('Key URL:', keyUrl);
  
  const keyRes = await fetchUrl(keyUrl, {
    headers: {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
      'Authorization': `Bearer ${authToken}`,
      'X-Channel-Key': channelKey,
      'X-Client-Token': clientToken,
      'X-User-Agent': userAgent,
    }
  });
  
  console.log('Key status:', keyRes.status);
  console.log('Key size:', keyRes.body.length, 'bytes');
  
  if (keyRes.body.length === 16) {
    console.log('\n✅ SUCCESS! Got valid 16-byte AES key');
    const keyHex = Buffer.from(keyRes.body, 'binary').toString('hex');
    console.log('Key (hex):', keyHex);
  } else {
    console.log('\n❌ Invalid key response');
    console.log('Response:', keyRes.body.substring(0, 200));
  }
}

main().catch(console.error);
