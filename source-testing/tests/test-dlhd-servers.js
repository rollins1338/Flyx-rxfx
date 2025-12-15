/**
 * Test to find all 4 servers/players for DLHD channels
 * The player page at epicplayplay.cfd has multiple server options
 */

const https = require('https');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://daddyhd.com/',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function analyzePlayerPage(channel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analyzing player page for channel ${channel}`);
  console.log('='.repeat(60));
  
  // Fetch the player page
  const url = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  console.log(`Status: ${response.status}`);
  console.log(`Response length: ${response.data.length} bytes`);
  
  // Look for server/player buttons or options
  const html = response.data;
  
  // Find all script content
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  console.log(`\nFound ${scriptMatches.length} script tags`);
  
  // Look for server-related patterns
  const patterns = [
    /server[_\-]?(\d+|[a-z]+)/gi,
    /player[_\-]?(\d+|[a-z]+)/gi,
    /source[_\-]?(\d+|[a-z]+)/gi,
    /cdn[_\-]?(\d+|[a-z]+)/gi,
    /stream[_\-]?(\d+|[a-z]+)/gi,
    /kiko\d*\.ru/gi,
    /giokko\.ru/gi,
    /\.m3u8/gi,
    /mono\.css/gi,
  ];
  
  console.log('\n--- Pattern matches in HTML ---');
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      const unique = [...new Set(matches)];
      console.log(`${pattern}: ${unique.join(', ')}`);
    }
  }
  
  // Look for button/tab elements that might indicate servers
  const buttonMatches = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
  const tabMatches = html.match(/class="[^"]*tab[^"]*"/gi) || [];
  const serverBtnMatches = html.match(/class="[^"]*server[^"]*"/gi) || [];
  
  console.log(`\nFound ${buttonMatches.length} buttons, ${tabMatches.length} tabs, ${serverBtnMatches.length} server elements`);
  
  // Look for onclick handlers
  const onclickMatches = html.match(/onclick="[^"]+"/gi) || [];
  console.log(`Found ${onclickMatches.length} onclick handlers`);
  if (onclickMatches.length > 0 && onclickMatches.length < 20) {
    console.log('Onclick handlers:');
    onclickMatches.forEach(m => console.log(`  ${m}`));
  }
  
  // Look for data attributes
  const dataServerMatches = html.match(/data-server="[^"]+"/gi) || [];
  const dataSourceMatches = html.match(/data-source="[^"]+"/gi) || [];
  const dataUrlMatches = html.match(/data-url="[^"]+"/gi) || [];
  
  console.log(`\nData attributes: server=${dataServerMatches.length}, source=${dataSourceMatches.length}, url=${dataUrlMatches.length}`);
  if (dataServerMatches.length > 0) {
    console.log('Server data:', dataServerMatches);
  }
  if (dataSourceMatches.length > 0) {
    console.log('Source data:', dataSourceMatches);
  }
  
  // Extract AUTH_TOKEN
  const authMatch = html.match(/AUTH_TOKEN\s*=\s*["']([^"']+)["']/);
  if (authMatch) {
    console.log(`\nAUTH_TOKEN found: ${authMatch[1].substring(0, 30)}...`);
  }
  
  // Look for server configuration objects
  const serverConfigMatch = html.match(/servers?\s*[=:]\s*\[[\s\S]*?\]/gi);
  if (serverConfigMatch) {
    console.log('\nServer config found:');
    serverConfigMatch.forEach(m => console.log(m.substring(0, 200)));
  }
  
  // Look for CDN URLs
  const cdnUrls = html.match(/https?:\/\/[^"'\s]+(?:kiko|giokko|cdn)[^"'\s]*/gi) || [];
  if (cdnUrls.length > 0) {
    console.log('\nCDN URLs found:');
    [...new Set(cdnUrls)].forEach(url => console.log(`  ${url}`));
  }
  
  // Look for function definitions related to servers
  const funcMatches = html.match(/function\s+\w*(?:server|player|source|stream)\w*\s*\([^)]*\)/gi) || [];
  if (funcMatches.length > 0) {
    console.log('\nServer-related functions:');
    funcMatches.forEach(f => console.log(`  ${f}`));
  }
  
  // Extract all URLs from the page
  const allUrls = html.match(/https?:\/\/[^"'\s<>]+/gi) || [];
  const uniqueUrls = [...new Set(allUrls)].filter(u => 
    !u.includes('google') && 
    !u.includes('facebook') && 
    !u.includes('twitter') &&
    !u.includes('jquery') &&
    !u.includes('bootstrap')
  );
  
  console.log('\n--- Relevant URLs found ---');
  uniqueUrls.slice(0, 30).forEach(url => console.log(`  ${url}`));
  
  // Save full HTML for manual inspection
  return html;
}

async function checkServerLookup(channel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking server_lookup API for channel ${channel}`);
  console.log('='.repeat(60));
  
  const channelKey = `premium${channel}`;
  
  // Try different server lookup endpoints
  const endpoints = [
    `https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`,
    `https://zeko.giokko.ru/server_lookup?channel_id=${channelKey}`,
    `https://top1.giokko.ru/server_lookup?channel_id=${channelKey}`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTrying: ${endpoint}`);
      const response = await fetch(endpoint);
      console.log(`Status: ${response.status}`);
      if (response.data) {
        try {
          const json = JSON.parse(response.data);
          console.log('Response:', JSON.stringify(json, null, 2));
        } catch {
          console.log('Response (raw):', response.data.substring(0, 200));
        }
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
}

async function testDifferentServers(channel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing different server patterns for channel ${channel}`);
  console.log('='.repeat(60));
  
  const channelKey = `premium${channel}`;
  
  // Known server patterns
  const serverPatterns = [
    { name: 'zeko', url: `https://zekonew.kiko2.ru/zeko/${channelKey}/mono.css` },
    { name: 'chevy', url: `https://chevynew.kiko2.ru/chevy/${channelKey}/mono.css` },
    { name: 'top1/cdn', url: `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css` },
    { name: 'kiko', url: `https://kikonew.kiko2.ru/kiko/${channelKey}/mono.css` },
    { name: 'daddylive', url: `https://daddylivenew.kiko2.ru/daddylive/${channelKey}/mono.css` },
    { name: 'stream1', url: `https://stream1new.kiko2.ru/stream1/${channelKey}/mono.css` },
    { name: 'stream2', url: `https://stream2new.kiko2.ru/stream2/${channelKey}/mono.css` },
    { name: 'live', url: `https://livenew.kiko2.ru/live/${channelKey}/mono.css` },
  ];
  
  for (const server of serverPatterns) {
    try {
      console.log(`\nTrying ${server.name}: ${server.url}`);
      const response = await fetch(server.url, {
        headers: {
          'Referer': 'https://epicplayplay.cfd/',
          'Origin': 'https://epicplayplay.cfd'
        }
      });
      
      const isM3U8 = response.data.includes('#EXTM3U');
      console.log(`  Status: ${response.status}, Is M3U8: ${isM3U8}, Size: ${response.data.length}`);
      
      if (isM3U8) {
        // Extract key URL
        const keyMatch = response.data.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
        if (keyMatch) {
          console.log(`  Key URL: ${keyMatch[1]}`);
        }
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
}

async function main() {
  console.log('DLHD Server/Player Discovery');
  console.log('Looking for the 4 different servers mentioned by user\n');
  
  const testChannel = 51; // ESPN
  
  // Analyze the player page
  await analyzePlayerPage(testChannel);
  
  // Check server lookup API
  await checkServerLookup(testChannel);
  
  // Test different server patterns
  await testDifferentServers(testChannel);
  
  console.log('\n\nDone!');
}

main().catch(console.error);
