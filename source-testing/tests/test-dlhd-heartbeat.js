/**
 * Test DLHD heartbeat/session flow
 * The key server now requires: "Session must be created via heartbeat first"
 */

async function main() {
  console.log('=== Testing DLHD Heartbeat Flow ===\n');
  
  // Step 1: Fetch player page to get auth token and HB_URL
  console.log('1. Fetching player page...');
  const playerUrl = 'https://epicplayplay.cfd/premiumtv/daddyhd.php?id=51';
  
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
    const channelMatch = html.match(/CHANNEL_KEY\s*=\s*["']([^"']+)["']/);
    
    console.log('AUTH_TOKEN:', authMatch ? authMatch[1].substring(0, 40) + '...' : 'NOT FOUND');
    console.log('HB_URL:', hbMatch ? hbMatch[1] : 'NOT FOUND');
    console.log('CHANNEL_KEY:', channelMatch ? channelMatch[1] : 'NOT FOUND');
    
    // Look for any heartbeat-related patterns
    const heartbeatPatterns = html.match(/heartbeat|hb_url|session|ping/gi);
    console.log('Heartbeat patterns found:', heartbeatPatterns ? [...new Set(heartbeatPatterns)] : 'none');
    
    // Extract all URLs that might be heartbeat related
    const urls = html.match(/https?:\/\/[^\s"'<>]+/g) || [];
    const relevantUrls = urls.filter(u => 
      u.includes('heartbeat') || 
      u.includes('hb') || 
      u.includes('session') ||
      u.includes('ping') ||
      u.includes('kiko2')
    );
    console.log('\nRelevant URLs found:');
    relevantUrls.forEach(u => console.log('  -', u));
    
    // If we found HB_URL, try calling it
    if (hbMatch) {
      console.log('\n2. Calling heartbeat URL...');
      const hbRes = await fetch(hbMatch[1], {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Authorization': authMatch ? `Bearer ${authMatch[1]}` : '',
          'Referer': 'https://epicplayplay.cfd/',
        }
      });
      console.log('Heartbeat status:', hbRes.status);
      const hbData = await hbRes.text();
      console.log('Heartbeat response:', hbData.substring(0, 200));
    }
    
    // Step 3: Try key fetch after heartbeat
    console.log('\n3. Testing key fetch...');
    const keyUrl = 'https://chevy.kiko2.ru/key/premium51/5885916';
    const keyRes = await fetch(keyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': authMatch ? `Bearer ${authMatch[1]}` : '',
        'Referer': 'https://epicplayplay.cfd/',
        'Origin': 'https://epicplayplay.cfd',
      }
    });
    console.log('Key status:', keyRes.status);
    const keyData = await keyRes.arrayBuffer();
    console.log('Key size:', keyData.byteLength);
    if (keyData.byteLength === 16) {
      console.log('✓ Valid AES-128 key!');
    } else {
      const text = new TextDecoder().decode(keyData);
      console.log('Key response:', text);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
