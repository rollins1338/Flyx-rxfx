#!/usr/bin/env node
/**
 * Test DLHD key fetch with binary handling
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

async function fetchBinary(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    
    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buffer });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const channel = '51';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  console.log('=== Fetching player page ===\n');
  
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  const playerRes = await fetchBinary(playerUrl, {
    headers: {
      'User-Agent': userAgent,
      'Referer': 'https://daddyhd.com/',
    }
  });
  
  const html = playerRes.body.toString();
  
  const tokenMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  const channelKeyMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
  const countryMatch = html.match(/AUTH_COUNTRY\s*=\s*["']([^"']+)["']/);
  const tsMatch = html.match(/AUTH_TS\s*=\s*["']([^"']+)["']/);
  
  const authToken = tokenMatch[1];
  const channelKey = channelKeyMatch ? channelKeyMatch[1] : `premium${channel}`;
  const country = countryMatch ? countryMatch[1] : 'US';
  const timestamp = tsMatch ? tsMatch[1] : String(Math.floor(Date.now() / 1000));
  const clientToken = generateClientToken(channelKey, country, timestamp, userAgent);
  
  console.log('AUTH_TOKEN:', authToken.substring(0, 30) + '...');
  console.log('CLIENT_TOKEN:', clientToken.substring(0, 40) + '...');
  
  console.log('\n=== Calling heartbeat ===\n');
  
  const hbRes = await fetchBinary('https://chevy.kiko2.ru/heartbeat', {
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
  
  console.log('Heartbeat status:', hbRes.status);
  console.log('Heartbeat response:', hbRes.body.toString());
  
  if (hbRes.status !== 200) {
    console.log('Heartbeat failed!');
    return;
  }
  
  console.log('\n=== Fetching M3U8 ===\n');
  
  const m3u8Res = await fetchBinary(`https://zekonew.kiko2.ru/zeko/${channelKey}/mono.css`, {
    headers: {
      'User-Agent': userAgent,
      'Referer': 'https://epicplayplay.cfd/',
    }
  });
  
  const m3u8 = m3u8Res.body.toString();
  const keyUrlMatch = m3u8.match(/URI="([^"]+)"/);
  
  if (!keyUrlMatch) {
    console.log('No key URL in M3U8');
    return;
  }
  
  let keyUrl = keyUrlMatch[1];
  const keyPathMatch = keyUrl.match(/\/key\/premium\d+\/\d+/);
  if (keyPathMatch) {
    keyUrl = `https://chevy.kiko2.ru${keyPathMatch[0]}`;
  }
  
  console.log('Key URL:', keyUrl);
  
  console.log('\n=== Fetching key ===\n');
  
  const keyRes = await fetchBinary(keyUrl, {
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
  console.log('Key buffer length:', keyRes.body.length, 'bytes');
  console.log('Key hex:', keyRes.body.toString('hex'));
  console.log('Key bytes:', Array.from(keyRes.body));
  
  if (keyRes.body.length === 16) {
    console.log('\n✅ SUCCESS! Valid 16-byte AES-128 key');
  } else if (keyRes.body.length === 15) {
    console.log('\n⚠️ Got 15 bytes - checking if there is a missing byte...');
    // Check if it's a text response
    const text = keyRes.body.toString();
    if (text.includes('{') || text.includes('error')) {
      console.log('Response is JSON:', text);
    }
  } else {
    console.log('\n❌ Invalid key size');
    console.log('Response as text:', keyRes.body.toString().substring(0, 200));
  }
}

main().catch(console.error);
