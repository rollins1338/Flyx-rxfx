/**
 * Test DLHD heartbeat flow - V4
 * Heartbeat requires: GET with X-Channel-Key header
 */

async function main() {
  console.log('=== Testing DLHD Heartbeat V4 ===\n');
  
  const channel = '51';
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  
  // Step 1: Get auth token
  console.log('1. Fetching player page...');
  const playerRes = await fetch(playerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://daddyhd.com/',
    }
  });
  
  const html = await playerRes.text();
  const tokenMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  const channelKeyMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
  
  const token = tokenMatch ? tokenMatch[1] : null;
  const channelKey = channelKeyMatch ? channelKeyMatch[1] : `premium${channel}`;
  
  console.log('AUTH_TOKEN:', token ? token.substring(0, 40) + '...' : 'NOT FOUND');
  console.log('CHANNEL_KEY:', channelKey);
  
  if (!token) {
    console.log('❌ No token found');
    return;
  }
  
  // Step 2: Call heartbeat with X-Channel-Key header (GET request)
  console.log('\n2. Calling heartbeat with X-Channel-Key header...');
  const heartbeatUrl = 'https://chevy.kiko2.ru/heartbeat';
  
  const hbRes = await fetch(heartbeatUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Authorization': `Bearer ${token}`,
      'X-Channel-Key': channelKey,
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    }
  });
  
  const hbText = await hbRes.text();
  console.log('Heartbeat status:', hbRes.status);
  console.log('Heartbeat response:', hbText);
  
  // Step 3: Try key fetch
  console.log('\n3. Testing key fetch...');
  const keyUrl = 'https://chevy.kiko2.ru/key/premium51/5885916';
  const keyRes = await fetch(keyUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Authorization': `Bearer ${token}`,
      'X-Channel-Key': channelKey,
      'Origin': 'https://epicplayplay.cfd',
      'Referer': 'https://epicplayplay.cfd/',
    }
  });
  
  const keyData = await keyRes.arrayBuffer();
  console.log('Key status:', keyRes.status);
  console.log('Key size:', keyData.byteLength);
  
  if (keyData.byteLength === 16) {
    const text = new TextDecoder().decode(keyData);
    if (!text.includes('error') && !text.includes('"E')) {
      console.log('✓ Valid AES-128 key!');
      console.log('Key (hex):', Buffer.from(keyData).toString('hex'));
    } else {
      console.log('❌ Error response:', text);
    }
  } else {
    console.log('❌ Invalid response:', new TextDecoder().decode(keyData));
  }
}

main().catch(console.error);
