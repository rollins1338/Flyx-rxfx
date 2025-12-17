/**
 * Test DLHD heartbeat/session flow - V2
 * The key server now requires: "Session must be created via heartbeat first"
 */

async function main() {
  console.log('=== Testing DLHD Heartbeat Flow V2 ===\n');
  
  const channel = '51';
  
  // Step 1: Fetch player page to get auth token and HB_URL
  console.log('1. Fetching player page...');
  const playerUrl = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  
  try {
    const playerRes = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://daddyhd.com/',
      }
    });
    
    const html = await playerRes.text();
    
    // Extract variables
    const authMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
    const hbMatch = html.match(/HB_URL\s*=\s*["']([^"']+)["']/);
    const channelKeyMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
    
    const token = authMatch ? authMatch[1] : null;
    const hbUrl = hbMatch ? hbMatch[1] : null;
    const channelKey = channelKeyMatch ? channelKeyMatch[1] : `premium${channel}`;
    
    console.log('AUTH_TOKEN:', token ? token.substring(0, 40) + '...' : 'NOT FOUND');
    console.log('HB_URL:', hbUrl || 'NOT FOUND');
    console.log('CHANNEL_KEY:', channelKey);
    
    if (!token) {
      console.log('\n❌ No auth token found - cannot proceed');
      return;
    }
    
    // Step 2: Call heartbeat URL if available
    if (hbUrl) {
      console.log('\n2. Calling heartbeat URL...');
      try {
        const hbRes = await fetch(hbUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Authorization': `Bearer ${token}`,
            'Origin': 'https://epicplayplay.cfd',
            'Referer': 'https://epicplayplay.cfd/',
            'X-Channel-Key': channelKey,
          }
        });
        console.log('Heartbeat status:', hbRes.status);
        const hbData = await hbRes.text();
        console.log('Heartbeat response:', hbData.substring(0, 200));
      } catch (hbErr) {
        console.log('Heartbeat error:', hbErr.message);
      }
    } else {
      console.log('\n2. No HB_URL found - skipping heartbeat');
    }
    
    // Step 3: Try key fetch after heartbeat
    console.log('\n3. Testing key fetch...');
    const keyUrl = 'https://chevy.kiko2.ru/key/premium51/5885916';
    const keyRes = await fetch(keyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
        'X-Channel-Key': channelKey,
      }
    });
    console.log('Key status:', keyRes.status);
    const keyData = await keyRes.arrayBuffer();
    console.log('Key size:', keyData.byteLength);
    
    if (keyData.byteLength === 16) {
      const text = new TextDecoder().decode(keyData);
      if (text.includes('error') || text.includes('"E')) {
        console.log('❌ Key error response:', text);
      } else {
        console.log('✓ Valid AES-128 key!');
        console.log('Key (hex):', Buffer.from(keyData).toString('hex'));
      }
    } else {
      const text = new TextDecoder().decode(keyData);
      console.log('❌ Invalid key response:', text);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
