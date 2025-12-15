/**
 * Test DLHD full browser flow - get session then fetch key
 */

const https = require('https');

const CHANNEL = '51';

async function fetchWithCookies(url, cookies = '', referer = '') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    };
    
    if (cookies) options.headers['Cookie'] = cookies;
    if (referer) options.headers['Referer'] = referer;
    
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        // Extract set-cookie headers
        const setCookies = res.headers['set-cookie'] || [];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: setCookies,
          data: data,
          text: data.toString('utf8'),
        });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== DLHD Full Flow Test ===\n');
  
  // Step 1: Load player page to get cookies
  console.log('Step 1: Loading player page...');
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${CHANNEL}`;
  const playerRes = await fetchWithCookies(playerUrl);
  console.log('Player status:', playerRes.status);
  console.log('Cookies received:', playerRes.cookies);
  
  // Combine cookies
  let allCookies = playerRes.cookies.map(c => c.split(';')[0]).join('; ');
  console.log('Combined cookies:', allCookies);
  
  // Step 2: Get server key
  console.log('\nStep 2: Getting server key...');
  const serverLookupUrl = `https://epicplayplay.cfd/server_lookup.js?channel_id=premium${CHANNEL}`;
  const serverRes = await fetchWithCookies(serverLookupUrl, allCookies, playerUrl);
  console.log('Server lookup status:', serverRes.status);
  console.log('Server response:', serverRes.text.substring(0, 200));
  
  let serverKey = 'zeko'; // default
  try {
    const serverData = JSON.parse(serverRes.text);
    serverKey = serverData.server_key || 'zeko';
  } catch (e) {
    console.log('Failed to parse server key, using default:', serverKey);
  }
  console.log('Server key:', serverKey);
  
  // Step 3: Fetch M3U8
  console.log('\nStep 3: Fetching M3U8...');
  const m3u8Url = `https://${serverKey}new.kiko2.ru/${serverKey}/premium${CHANNEL}/mono.css`;
  console.log('M3U8 URL:', m3u8Url);
  const m3u8Res = await fetchWithCookies(m3u8Url, allCookies, playerUrl);
  console.log('M3U8 status:', m3u8Res.status);
  console.log('M3U8 preview:', m3u8Res.text.substring(0, 300));
  
  // Extract key URL from M3U8
  const keyMatch = m3u8Res.text.match(/URI="([^"]+)"/);
  if (!keyMatch) {
    console.log('No key URL found in M3U8!');
    return;
  }
  
  let keyUrl = keyMatch[1];
  // Resolve relative URL
  if (!keyUrl.startsWith('http')) {
    const base = new URL(m3u8Url);
    keyUrl = new URL(keyUrl, base.origin + base.pathname.replace(/\/[^/]*$/, '/')).toString();
  }
  console.log('\nKey URL:', keyUrl);
  
  // Step 4: Fetch key with session
  console.log('\nStep 4: Fetching key with session...');
  const keyRes = await fetchWithCookies(keyUrl, allCookies, m3u8Url);
  console.log('Key status:', keyRes.status);
  console.log('Key size:', keyRes.data.length);
  
  if (keyRes.data.length === 16) {
    const keyHex = keyRes.data.toString('hex');
    const keyText = keyRes.data.toString('utf8');
    
    if (keyText.includes('error')) {
      console.log('✗ Got error response:', keyText);
    } else {
      console.log('✓ Valid AES-128 key!');
      console.log('Key (hex):', keyHex);
    }
  } else {
    console.log('✗ Invalid key size');
    console.log('Preview:', keyRes.text.substring(0, 200));
  }
  
  // Step 5: Try key WITHOUT cookies
  console.log('\nStep 5: Fetching key WITHOUT cookies...');
  const keyRes2 = await fetchWithCookies(keyUrl, '', m3u8Url);
  console.log('Key status:', keyRes2.status);
  console.log('Key size:', keyRes2.data.length);
  
  if (keyRes2.data.length === 16) {
    const keyText = keyRes2.data.toString('utf8');
    if (keyText.includes('error')) {
      console.log('✗ Got error response:', keyText);
    } else {
      console.log('✓ Valid key without cookies!');
    }
  }
  
  console.log('\n=== Done ===');
}

main().catch(console.error);
