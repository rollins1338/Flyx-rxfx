/**
 * Find the actual API domain in the JavaScript bundles
 */

const https = require('https');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== FINDING API DOMAIN ===\n');
  
  // Fetch the main page to get script URLs
  const mainPage = await fetchUrl('https://player.smashystream.com/movie/155');
  
  // Extract script URLs
  const scriptMatches = mainPage.match(/src="([^"]+\.js)"/g) || [];
  const scripts = scriptMatches.map(m => m.match(/src="([^"]+)"/)[1]);
  
  console.log('Scripts found:', scripts);
  
  // Also check for asset scripts
  const assetMatches = mainPage.match(/\/assets\/[^"]+\.js/g) || [];
  console.log('Asset scripts:', assetMatches);
  
  // Fetch each script and search for API URLs
  const allScripts = [...new Set([...scripts, ...assetMatches])];
  
  for (const script of allScripts) {
    const url = script.startsWith('http') ? script : `https://player.smashystream.com${script}`;
    console.log(`\nFetching: ${url}`);
    
    try {
      const code = await fetchUrl(url);
      
      // Search for various API patterns
      const patterns = [
        /https?:\/\/[a-z0-9.-]*smashystream[a-z0-9.-]*\.[a-z]+/gi,
        /api[._-]?url['":\s]*['"]([^'"]+)['"]/gi,
        /base[._-]?url['":\s]*['"]([^'"]+)['"]/gi,
        /endpoint['":\s]*['"]([^'"]+)['"]/gi,
        /\/api\/v\d+\/[a-z]+/gi
      ];
      
      for (const pattern of patterns) {
        const matches = code.match(pattern);
        if (matches) {
          console.log(`  Pattern ${pattern}: ${[...new Set(matches)].join(', ')}`);
        }
      }
      
      // Look for specific strings
      if (code.includes('smashystream.top')) {
        console.log('  Contains: smashystream.top');
      }
      if (code.includes('smashystream.com')) {
        console.log('  Contains: smashystream.com');
      }
      if (code.includes('api.smashystream')) {
        console.log('  Contains: api.smashystream');
      }
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Also check the PlayerContainer script specifically
  console.log('\n=== CHECKING PLAYER CONTAINER ===\n');
  
  // Find PlayerContainer URL
  const playerContainerMatch = mainPage.match(/\/assets\/PlayerContainer[^"]+\.js/);
  if (playerContainerMatch) {
    const pcUrl = `https://player.smashystream.com${playerContainerMatch[0]}`;
    console.log('PlayerContainer URL:', pcUrl);
    
    const pcCode = await fetchUrl(pcUrl);
    
    // Search for API-related code
    const apiSection = pcCode.match(/.{0,100}smashystream\.top.{0,100}/g);
    if (apiSection) {
      console.log('\nAPI sections found:');
      apiSection.forEach((s, i) => console.log(`  ${i + 1}: ${s}`));
    }
    
    // Look for the data endpoint
    const dataEndpoint = pcCode.match(/.{0,50}\/data\?.{0,50}/g);
    if (dataEndpoint) {
      console.log('\nData endpoint sections:');
      dataEndpoint.forEach((s, i) => console.log(`  ${i + 1}: ${s}`));
    }
  }
}

main().catch(console.error);
