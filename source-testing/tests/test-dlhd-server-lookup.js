/**
 * Test DLHD server_lookup.js to see what server key is returned
 * This tells us which CDN server to use for the channel
 */

const https = require('https');

const CHANNEL = 51;
const SERVER_LOOKUP_URL = `https://epicplayplay.cfd/server_lookup.js?channel_id=premium${CHANNEL}`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://dlhd.so/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('Testing DLHD server lookup...\n');
  
  // Test server_lookup.js
  console.log('1. Fetching server_lookup.js...');
  console.log('   URL:', SERVER_LOOKUP_URL);
  
  try {
    const result = await fetch(SERVER_LOOKUP_URL);
    console.log('   Status:', result.status);
    console.log('   Response:', result.data);
    
    // Parse the server key - can be JSON or JS variable
    let serverKey = null;
    try {
      const json = JSON.parse(result.data);
      serverKey = json.server_key;
    } catch (e) {
      const match = result.data.match(/server_key\s*=\s*["']([^"']+)["']/);
      if (match) serverKey = match[1];
    }
    
    if (serverKey) {
      console.log('\n   Server Key:', serverKey);
      
      // Construct the M3U8 URL based on server key
      const m3u8Url = `https://${serverKey}new.kiko2.ru/${serverKey}/premium${CHANNEL}/mono.css`;
      console.log('   M3U8 URL:', m3u8Url);
      
      // Try to fetch the M3U8
      console.log('\n2. Fetching M3U8...');
      const m3u8Result = await fetch(m3u8Url);
      console.log('   Status:', m3u8Result.status);
      console.log('   Length:', m3u8Result.data.length);
      
      if (m3u8Result.status === 200) {
        console.log('\n   M3U8 Content (first 500 chars):');
        console.log(m3u8Result.data.substring(0, 500));
        
        // Extract key URL from M3U8
        const keyMatch = m3u8Result.data.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
        if (keyMatch) {
          console.log('\n   Key URL from M3U8:', keyMatch[1]);
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Also try different server lookup domains
  console.log('\n\n3. Testing alternative server lookup domains...');
  const domains = [
    'epicplayplay.cfd',
    'dlhd.dad',
    'daddyhd.com',
  ];
  
  for (const domain of domains) {
    const url = `https://${domain}/server_lookup.js?channel_id=premium${CHANNEL}`;
    try {
      const result = await fetch(url);
      const match = result.data.match(/server_key\s*=\s*["']([^"']+)["']/);
      console.log(`   ${domain}: ${result.status} - server_key=${match ? match[1] : 'not found'}`);
    } catch (e) {
      console.log(`   ${domain}: ERROR - ${e.message}`);
    }
  }
}

main();
