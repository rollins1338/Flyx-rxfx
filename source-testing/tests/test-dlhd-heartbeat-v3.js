/**
 * Test DLHD heartbeat flow - V3
 * Found: https://chevy.kiko2.ru/heartbeat
 */

async function main() {
  console.log('=== Testing DLHD Heartbeat V3 ===\n');
  
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
  
  // Step 2: Call heartbeat endpoint
  console.log('\n2. Calling heartbeat...');
  const heartbeatUrl = 'https://chevy.kiko2.ru/heartbeat';
  
  // Try different heartbeat request formats
  const heartbeatMethods = [
    // Method 1: POST with channel in body
    async () => {
      console.log('  Method 1: POST with JSON body');
      const res = await fetch(heartbeatUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://epicplayplay.cfd',
          'Referer': 'https://epicplayplay.cfd/',
        },
        body: JSON.stringify({ channel: channelKey })
      });
      return { status: res.status, body: await res.text() };
    },
    // Method 2: GET with query param
    async () => {
      console.log('  Method 2: GET with query param');
      const res = await fetch(`${heartbeatUrl}?channel=${channelKey}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://epicplayplay.cfd',
          'Referer': 'https://epicplayplay.cfd/',
        }
      });
      return { status: res.status, body: await res.text() };
    },
    // Method 3: POST with form data
    async () => {
      console.log('  Method 3: POST with form data');
      const res = await fetch(heartbeatUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://epicplayplay.cfd',
          'Referer': 'https://epicplayplay.cfd/',
        },
        body: `channel=${channelKey}`
      });
      return { status: res.status, body: await res.text() };
    },
    // Method 4: Simple GET
    async () => {
      console.log('  Method 4: Simple GET');
      const res = await fetch(heartbeatUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://epicplayplay.cfd',
          'Referer': 'https://epicplayplay.cfd/',
        }
      });
      return { status: res.status, body: await res.text() };
    },
    // Method 5: POST with X-Channel-Key header
    async () => {
      console.log('  Method 5: POST with X-Channel-Key header');
      const res = await fetch(heartbeatUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': `Bearer ${token}`,
          'X-Channel-Key': channelKey,
          'Origin': 'https://epicplayplay.cfd',
          'Referer': 'https://epicplayplay.cfd/',
        }
      });
      return { status: res.status, body: await res.text() };
    },
  ];
  
  for (const method of heartbeatMethods) {
    try {
      const result = await method();
      console.log(`    Status: ${result.status}, Response: ${result.body.substring(0, 100)}`);
      
      // If heartbeat succeeded, try key fetch
      if (result.status === 200 || result.body.includes('ok')) {
        console.log('\n3. Testing key fetch after heartbeat...');
        const keyUrl = 'https://chevy.kiko2.ru/key/premium51/5885916';
        const keyRes = await fetch(keyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Authorization': `Bearer ${token}`,
            'Origin': 'https://epicplayplay.cfd',
            'Referer': 'https://epicplayplay.cfd/',
          }
        });
        const keyData = await keyRes.arrayBuffer();
        console.log('Key status:', keyRes.status, 'Size:', keyData.byteLength);
        if (keyData.byteLength === 16) {
          const text = new TextDecoder().decode(keyData);
          if (!text.includes('error')) {
            console.log('✓ Valid key!');
            return;
          }
        }
        console.log('Key response:', new TextDecoder().decode(keyData));
      }
    } catch (err) {
      console.log(`    Error: ${err.message}`);
    }
  }
}

main().catch(console.error);
