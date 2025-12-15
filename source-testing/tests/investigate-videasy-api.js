/**
 * Investigate Videasy API to understand the encryption flow
 * 
 * The hint says: "Provide full encrypted text from api.videasy.net"
 * So there must be an API endpoint that returns encrypted data
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TMDB_ID = '550'; // Fight Club

async function findVideasyAPI() {
  console.log('=== FINDING VIDEASY API ===\n');
  
  // Try various API endpoints
  const endpoints = [
    `https://api.videasy.net/movie/${TMDB_ID}`,
    `https://api.videasy.net/sources/${TMDB_ID}`,
    `https://api.videasy.net/embed/${TMDB_ID}`,
    `https://api.videasy.net/v1/movie/${TMDB_ID}`,
    `https://api.videasy.net/api/movie/${TMDB_ID}`,
    `https://player.videasy.net/api/movie/${TMDB_ID}`,
    `https://player.videasy.net/api/sources/${TMDB_ID}`,
  ];
  
  for (const url of endpoints) {
    console.log(`\n${url}:`);
    
    try {
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          'Referer': 'https://videasy.net/',
          'Origin': 'https://videasy.net',
        },
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`  Length: ${text.length} chars`);
        console.log(`  Preview: ${text.substring(0, 300)}`);
        
        // Check if it's JSON
        try {
          const json = JSON.parse(text);
          console.log(`  JSON keys: ${Object.keys(json).join(', ')}`);
        } catch {}
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

async function analyzeVideasyPlayer() {
  console.log('\n=== ANALYZING VIDEASY PLAYER PAGE ===\n');
  
  const url = `https://player.videasy.net/movie/${TMDB_ID}`;
  
  const response = await fetch(url, {
    headers: {
      ...HEADERS,
      'Referer': 'https://videasy.net/',
    },
  });
  
  const html = await response.text();
  console.log(`Page length: ${html.length} chars`);
  
  // Find all script tags
  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 0;
  
  while ((match = scriptPattern.exec(html)) !== null) {
    const content = match[1].trim();
    if (content.length > 50) {
      console.log(`\n--- Script ${scriptIndex} (${content.length} chars) ---`);
      
      // Look for API calls
      const fetchPattern = /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g;
      let fetchMatch;
      while ((fetchMatch = fetchPattern.exec(content)) !== null) {
        console.log(`  Fetch: ${fetchMatch[1]}`);
      }
      
      // Look for axios calls
      const axiosPattern = /axios\s*\.\s*\w+\s*\(\s*["'`]([^"'`]+)["'`]/g;
      let axiosMatch;
      while ((axiosMatch = axiosPattern.exec(content)) !== null) {
        console.log(`  Axios: ${axiosMatch[1]}`);
      }
      
      // Look for URL patterns
      const urlPattern = /["'`](https?:\/\/api[^"'`]+)["'`]/g;
      let urlMatch;
      while ((urlMatch = urlPattern.exec(content)) !== null) {
        console.log(`  API URL: ${urlMatch[1]}`);
      }
      
      // Look for encrypted data patterns
      const dataPattern = /["'`]([A-Za-z0-9_-]{100,})["'`]/g;
      let dataMatch;
      while ((dataMatch = dataPattern.exec(content)) !== null) {
        console.log(`  Long string (${dataMatch[1].length} chars): ${dataMatch[1].substring(0, 50)}...`);
      }
      
      // Show first 500 chars of interesting scripts
      if (content.includes('source') || content.includes('file') || content.includes('api')) {
        console.log(`  Preview: ${content.substring(0, 500).replace(/\s+/g, ' ')}`);
      }
      
      scriptIndex++;
    }
  }
  
  // Look for external script sources
  const extScriptPattern = /<script[^>]*src=["']([^"']+)["']/gi;
  console.log('\n--- External Scripts ---');
  while ((match = extScriptPattern.exec(html)) !== null) {
    console.log(`  ${match[1]}`);
  }
}

async function fetchVideasyBundle() {
  console.log('\n=== FETCHING VIDEASY BUNDLE ===\n');
  
  // First get the player page to find the bundle URL
  const playerUrl = `https://player.videasy.net/movie/${TMDB_ID}`;
  
  const response = await fetch(playerUrl, {
    headers: {
      ...HEADERS,
      'Referer': 'https://videasy.net/',
    },
  });
  
  const html = await response.text();
  
  // Find the main bundle
  const bundleMatch = html.match(/src=["']([^"']*index[^"']*\.js)["']/);
  if (bundleMatch) {
    let bundleUrl = bundleMatch[1];
    if (bundleUrl.startsWith('/')) {
      bundleUrl = `https://player.videasy.net${bundleUrl}`;
    }
    
    console.log(`Bundle URL: ${bundleUrl}`);
    
    const bundleResponse = await fetch(bundleUrl, {
      headers: {
        ...HEADERS,
        'Referer': playerUrl,
      },
    });
    
    if (bundleResponse.ok) {
      const bundle = await bundleResponse.text();
      console.log(`Bundle size: ${bundle.length} chars`);
      
      // Look for API endpoints in the bundle
      const apiPattern = /["'`](https?:\/\/api\.videasy\.net[^"'`]*)["'`]/g;
      let match;
      const apis = new Set();
      while ((match = apiPattern.exec(bundle)) !== null) {
        apis.add(match[1]);
      }
      
      if (apis.size > 0) {
        console.log('\nAPI endpoints found:');
        apis.forEach(a => console.log(`  ${a}`));
      }
      
      // Look for encryption-related code
      const encPatterns = [
        /decrypt/gi,
        /encrypt/gi,
        /atob/g,
        /btoa/g,
        /CryptoJS/g,
      ];
      
      console.log('\nEncryption patterns:');
      for (const pattern of encPatterns) {
        const matches = bundle.match(pattern);
        if (matches) {
          console.log(`  ${pattern.source}: ${matches.length} occurrences`);
        }
      }
      
      // Look for source-related code
      const sourcePattern = /sources?\s*[:=]\s*[^;]{10,100}/gi;
      const sourceMatches = bundle.match(sourcePattern);
      if (sourceMatches) {
        console.log('\nSource patterns:');
        sourceMatches.slice(0, 10).forEach(s => console.log(`  ${s.substring(0, 100)}`));
      }
    }
  }
}

async function main() {
  await findVideasyAPI();
  await analyzeVideasyPlayer();
  await fetchVideasyBundle();
  
  console.log('\n=== SUMMARY ===');
  console.log('Videasy uses a React/Vue SPA that:');
  console.log('1. Loads encrypted source data from api.videasy.net');
  console.log('2. Decrypts it client-side');
  console.log('3. Passes the decrypted URLs to the video player');
}

main().catch(console.error);
