/**
 * Deep dive into DLHD player page to find server selection logic
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

async function extractServerLogic(channel) {
  console.log(`Fetching player page for channel ${channel}...\n`);
  
  const url = `https://epicplayplay.cfd/premiumtv/daddyhd.php?id=${channel}`;
  const response = await fetch(url);
  const html = response.data;
  
  // Extract all inline scripts
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  console.log('Looking for server-related code in scripts...\n');
  
  for (let i = 0; i < scriptMatches.length; i++) {
    const script = scriptMatches[i];
    
    // Look for server_lookup, CDN patterns, or server selection
    if (script.includes('server_lookup') || 
        script.includes('kiko2.ru') || 
        script.includes('giokko.ru') ||
        script.includes('CHANNEL_KEY') ||
        script.includes('serverDomain') ||
        script.includes('server_key')) {
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`SCRIPT ${i + 1} (contains server logic)`);
      console.log('='.repeat(60));
      
      // Clean up the script content
      const content = script
        .replace(/<script[^>]*>/i, '')
        .replace(/<\/script>/i, '')
        .trim();
      
      // Print relevant portions
      const lines = content.split('\n');
      let inRelevantSection = false;
      let relevantLines = [];
      
      for (const line of lines) {
        if (line.includes('server') || 
            line.includes('kiko') || 
            line.includes('giokko') ||
            line.includes('CHANNEL') ||
            line.includes('CDN') ||
            line.includes('m3u8') ||
            line.includes('mono.css') ||
            line.includes('loadStream') ||
            line.includes('initPlayer') ||
            line.includes('source') ||
            inRelevantSection) {
          
          relevantLines.push(line);
          
          // Track if we're in a function
          if (line.includes('function') || line.includes('=>')) {
            inRelevantSection = true;
          }
          if (inRelevantSection && line.includes('}') && !line.includes('{')) {
            inRelevantSection = false;
          }
        }
      }
      
      if (relevantLines.length > 0) {
        console.log(relevantLines.join('\n').substring(0, 5000));
      }
    }
  }
  
  // Also look for any server selection UI elements
  console.log(`\n${'='.repeat(60)}`);
  console.log('Looking for server selection UI...');
  console.log('='.repeat(60));
  
  // Look for select elements or radio buttons
  const selectMatches = html.match(/<select[^>]*>[\s\S]*?<\/select>/gi) || [];
  const radioMatches = html.match(/<input[^>]*type="radio"[^>]*>/gi) || [];
  
  console.log(`Found ${selectMatches.length} select elements`);
  console.log(`Found ${radioMatches.length} radio buttons`);
  
  // Look for any div/span with "server" in class or id
  const serverDivs = html.match(/<(?:div|span|button)[^>]*(?:class|id)="[^"]*server[^"]*"[^>]*>[\s\S]*?<\/(?:div|span|button)>/gi) || [];
  console.log(`Found ${serverDivs.length} server-related elements`);
  
  if (serverDivs.length > 0) {
    serverDivs.forEach((div, i) => {
      console.log(`\nServer element ${i + 1}:`);
      console.log(div.substring(0, 500));
    });
  }
  
  // Look for any numbered buttons (Server 1, Server 2, etc.)
  const numberedBtns = html.match(/(?:Server|Player|Source)\s*[1-4]/gi) || [];
  if (numberedBtns.length > 0) {
    console.log('\nNumbered server/player references:', [...new Set(numberedBtns)]);
  }
}

async function checkMultipleChannelsServerKeys() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Checking server_lookup for multiple channels');
  console.log('='.repeat(60));
  
  const channels = [51, 52, 53, 54, 55, 100, 200, 300, 400, 500];
  
  for (const channel of channels) {
    const channelKey = `premium${channel}`;
    try {
      const response = await fetch(`https://chevy.giokko.ru/server_lookup?channel_id=${channelKey}`);
      if (response.status === 200) {
        const json = JSON.parse(response.data);
        console.log(`Channel ${channel}: server_key = ${json.server_key}`);
      } else {
        console.log(`Channel ${channel}: status ${response.status}`);
      }
    } catch (err) {
      console.log(`Channel ${channel}: error - ${err.message}`);
    }
  }
}

async function tryAlternativeEndpoints(channel) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Trying alternative stream endpoints');
  console.log('='.repeat(60));
  
  const channelKey = `premium${channel}`;
  
  // Try different CDN patterns found in the code
  const patterns = [
    // Pattern 1: top1.kiko2.ru
    `https://top1.kiko2.ru/top1/cdn/${channelKey}/mono.css`,
    // Pattern 2: {sk}new.kiko2.ru
    `https://zekonew.kiko2.ru/zeko/${channelKey}/mono.css`,
    // Pattern 3: Direct giokko
    `https://top1.giokko.ru/top1/cdn/${channelKey}/mono.css`,
    // Pattern 4: Alternative subdomains
    `https://cdn1.kiko2.ru/cdn1/${channelKey}/mono.css`,
    `https://cdn2.kiko2.ru/cdn2/${channelKey}/mono.css`,
    `https://stream.kiko2.ru/stream/${channelKey}/mono.css`,
  ];
  
  for (const url of patterns) {
    try {
      console.log(`\nTrying: ${url}`);
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://epicplayplay.cfd/',
          'Origin': 'https://epicplayplay.cfd'
        }
      });
      
      const isM3U8 = response.data.includes('#EXTM3U');
      console.log(`  Status: ${response.status}, Is M3U8: ${isM3U8}`);
      
      if (isM3U8) {
        console.log('  ✓ WORKING!');
        // Show first few lines
        console.log('  Preview:', response.data.split('\n').slice(0, 5).join(' | '));
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
}

async function main() {
  console.log('DLHD Server Discovery - Deep Dive\n');
  
  // Extract server logic from player page
  await extractServerLogic(51);
  
  // Check server keys for multiple channels
  await checkMultipleChannelsServerKeys();
  
  // Try alternative endpoints
  await tryAlternativeEndpoints(51);
  
  console.log('\n\nDone!');
}

main().catch(console.error);
