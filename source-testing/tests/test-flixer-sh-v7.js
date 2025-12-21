/**
 * Test script to reverse engineer Flixer.sh - V7
 * 
 * Extract the actual source fetching logic from the bundle
 */

const https = require('https');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://flixer.sh/',
};

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function analyzeVideoPlayer() {
  console.log('=== Extracting Flixer.sh Source Fetching Logic ===\n');
  
  const js = await fetch('https://flixer.sh/assets/js/VideoPlayer-21683734.js');
  
  // Look for the context around "fetch server source"
  console.log('1. Finding source fetching context...\n');
  
  const fetchSourceIndex = js.indexOf('fetch server source');
  if (fetchSourceIndex !== -1) {
    const context = js.substring(Math.max(0, fetchSourceIndex - 2000), fetchSourceIndex + 2000);
    console.log('   Context around "fetch server source":');
    console.log('   ' + context.substring(0, 500) + '...');
    console.log('\n   ...' + context.substring(context.length - 500));
  }
  
  // Look for the source state/context
  console.log('\n2. Looking for source state management...\n');
  
  const sourceStatePatterns = [
    /source\s*[:=]\s*\{[^}]+\}/gi,
    /setSource\s*\([^)]+\)/gi,
    /sourceUrl\s*[:=]/gi,
    /sourceData\s*[:=]/gi,
  ];
  
  for (const pattern of sourceStatePatterns) {
    const matches = js.match(pattern) || [];
    if (matches.length > 0) {
      console.log(`   Pattern: ${pattern}`);
      matches.slice(0, 3).forEach(m => console.log(`     - ${m.substring(0, 150)}`));
    }
  }
  
  // Look for the actual fetch call that gets the source
  console.log('\n3. Looking for fetch calls with credentials...\n');
  
  // Find all fetch calls
  const fetchCalls = [];
  let idx = 0;
  while ((idx = js.indexOf('fetch(', idx)) !== -1) {
    const end = js.indexOf(')', idx + 6);
    if (end !== -1) {
      const call = js.substring(idx, Math.min(end + 200, js.length));
      if (call.includes('source') || call.includes('server') || call.includes('embed') || 
          call.includes('stream') || call.includes('plsdontscrapemelove')) {
        fetchCalls.push(call.substring(0, 300));
      }
    }
    idx++;
  }
  
  console.log(`   Found ${fetchCalls.length} relevant fetch calls:`);
  fetchCalls.forEach(c => console.log(`     - ${c}`));
  
  // Look for the poster server patterns (found earlier)
  console.log('\n4. Looking for poster server patterns...\n');
  
  const posterIndex = js.indexOf('posterServer');
  if (posterIndex !== -1) {
    const context = js.substring(Math.max(0, posterIndex - 500), posterIndex + 1000);
    console.log('   Context around "posterServer":');
    console.log('   ' + context.substring(0, 800));
  }
  
  // Look for the actual video source URL pattern
  console.log('\n5. Looking for video URL patterns...\n');
  
  const videoUrlPatterns = js.match(/["'`][^"'`]*(?:\.m3u8|\.mp4|stream|video)[^"'`]*["'`]/gi) || [];
  const uniquePatterns = [...new Set(videoUrlPatterns)].filter(p => 
    p.includes('http') || p.includes('://') || p.includes('${')
  );
  console.log(`   Found ${uniquePatterns.length} video URL patterns:`);
  uniquePatterns.slice(0, 20).forEach(p => console.log(`     - ${p}`));
  
  // Look for the source object structure
  console.log('\n6. Looking for source object structure...\n');
  
  const sourceObjPatterns = js.match(/\{[^{}]*url\s*:[^{}]*quality[^{}]*\}/gi) || [];
  console.log(`   Found ${sourceObjPatterns.length} source object patterns:`);
  sourceObjPatterns.slice(0, 5).forEach(p => console.log(`     - ${p.substring(0, 200)}`));
  
  // Look for the server configuration
  console.log('\n7. Looking for server configuration...\n');
  
  // Find patterns like server names/IDs
  const serverConfigPatterns = js.match(/["'`](?:alpha|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliet|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)["'`]/gi) || [];
  console.log(`   Found ${serverConfigPatterns.length} NATO alphabet server names:`);
  [...new Set(serverConfigPatterns)].forEach(p => console.log(`     - ${p}`));
  
  // Look for the actual API call to get sources
  console.log('\n8. Looking for API source endpoint...\n');
  
  // Search for patterns that look like source API endpoints
  const apiSourcePatterns = js.match(/["'`][^"'`]*\/(?:source|sources|server|servers|embed|stream)[^"'`]*["'`]/gi) || [];
  console.log(`   Found ${apiSourcePatterns.length} API source patterns:`);
  [...new Set(apiSourcePatterns)].forEach(p => console.log(`     - ${p}`));
  
  console.log('\n=== Analysis Complete ===');
}

analyzeVideoPlayer().catch(console.error);
