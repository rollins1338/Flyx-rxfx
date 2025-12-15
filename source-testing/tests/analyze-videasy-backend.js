/**
 * Analyze Videasy backend API
 * Found: https://backend.videasy.net
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://player.videasy.net/',
  'Origin': 'https://player.videasy.net',
};

const TMDB_ID = '550'; // Fight Club

// Read the saved chunk and find API patterns
function analyzeChunk() {
  console.log('=== ANALYZING VIDEASY CHUNK ===\n');
  
  const content = fs.readFileSync('source-testing/results/videasy-_app-f339a33ed2f4fdb8.js', 'utf8');
  
  // Find all backend.videasy.net references
  const backendPattern = /backend\.videasy\.net[^"'`\s]*/g;
  let match;
  const endpoints = new Set();
  
  while ((match = backendPattern.exec(content)) !== null) {
    endpoints.add(match[0]);
  }
  
  console.log('Backend endpoints found:');
  endpoints.forEach(e => console.log(`  ${e}`));
  
  // Find URL construction patterns
  const urlPattern = /["'`]([^"'`]*\/(?:movie|tv|anime|source|stream|embed)[^"'`]*)["'`]/gi;
  const urls = new Set();
  
  while ((match = urlPattern.exec(content)) !== null) {
    urls.add(match[1]);
  }
  
  console.log('\nURL patterns:');
  urls.forEach(u => console.log(`  ${u}`));
  
  // Find the code around backend.videasy.net
  const backendIndex = content.indexOf('backend.videasy.net');
  if (backendIndex !== -1) {
    console.log('\nCode around backend.videasy.net:');
    const context = content.substring(
      Math.max(0, backendIndex - 200),
      Math.min(content.length, backendIndex + 500)
    );
    console.log(context.replace(/\s+/g, ' '));
  }
  
  // Find fetch/axios calls
  const fetchPattern = /fetch\s*\(\s*[^)]+\)/g;
  const fetches = [];
  
  while ((match = fetchPattern.exec(content)) !== null) {
    fetches.push(match[0]);
  }
  
  console.log(`\nFetch calls: ${fetches.length}`);
  fetches.slice(0, 10).forEach(f => console.log(`  ${f.substring(0, 100)}`));
  
  // Look for API route patterns
  const routePattern = /["'`](\/[a-z]+\/[a-z]+(?:\/[a-z0-9]+)*)["'`]/gi;
  const routes = new Set();
  
  while ((match = routePattern.exec(content)) !== null) {
    if (!match[1].includes('_next') && !match[1].includes('static')) {
      routes.add(match[1]);
    }
  }
  
  console.log('\nAPI routes:');
  [...routes].slice(0, 30).forEach(r => console.log(`  ${r}`));
}

async function testBackendAPI() {
  console.log('\n=== TESTING BACKEND.VIDEASY.NET ===\n');
  
  const endpoints = [
    `/movie/${TMDB_ID}`,
    `/api/movie/${TMDB_ID}`,
    `/sources/movie/${TMDB_ID}`,
    `/embed/movie/${TMDB_ID}`,
    `/v1/movie/${TMDB_ID}`,
    `/stream/movie/${TMDB_ID}`,
    `/video/movie/${TMDB_ID}`,
    `/player/movie/${TMDB_ID}`,
  ];
  
  for (const endpoint of endpoints) {
    const url = `https://backend.videasy.net${endpoint}`;
    console.log(`\n${url}:`);
    
    try {
      const response = await fetch(url, { headers: HEADERS });
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`  Length: ${text.length} chars`);
        console.log(`  Preview: ${text.substring(0, 300)}`);
        
        // If it looks like encrypted data, try to decrypt
        if (text.length > 100 && !text.includes('<html')) {
          console.log('\n  Trying decryption...');
          
          const decResponse = await fetch('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...HEADERS,
            },
            body: JSON.stringify({
              text: text,
              id: TMDB_ID,
            }),
          });
          
          console.log(`  Decryption status: ${decResponse.status}`);
          if (decResponse.ok) {
            const decJson = await decResponse.json();
            console.log(`  Decrypted: ${JSON.stringify(decJson).substring(0, 500)}`);
          } else {
            const errText = await decResponse.text();
            console.log(`  Error: ${errText.substring(0, 200)}`);
          }
        }
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

async function findCorrectEndpoint() {
  console.log('\n=== FINDING CORRECT ENDPOINT ===\n');
  
  // Read the chunk and look for the exact API call pattern
  const content = fs.readFileSync('source-testing/results/videasy-_app-f339a33ed2f4fdb8.js', 'utf8');
  
  // Look for template literals with backend URL
  const templatePattern = /`[^`]*backend\.videasy\.net[^`]*`/g;
  let match;
  
  console.log('Template literals with backend URL:');
  while ((match = templatePattern.exec(content)) !== null) {
    console.log(`  ${match[0]}`);
  }
  
  // Look for string concatenation
  const concatPattern = /["'][^"']*backend\.videasy\.net["']\s*\+\s*["'][^"']*["']/g;
  
  console.log('\nString concatenation:');
  while ((match = concatPattern.exec(content)) !== null) {
    console.log(`  ${match[0]}`);
  }
  
  // Look for variable assignments with the URL
  const varPattern = /(\w+)\s*=\s*["']https:\/\/backend\.videasy\.net["']/g;
  
  console.log('\nVariable assignments:');
  while ((match = varPattern.exec(content)) !== null) {
    console.log(`  ${match[0]}`);
    
    // Find where this variable is used
    const varName = match[1];
    const usagePattern = new RegExp(`${varName}\\s*\\+|\\$\\{${varName}\\}|${varName}\\s*,`, 'g');
    let usageMatch;
    
    while ((usageMatch = usagePattern.exec(content)) !== null) {
      const context = content.substring(
        Math.max(0, usageMatch.index - 50),
        Math.min(content.length, usageMatch.index + 100)
      );
      console.log(`    Usage: ${context.replace(/\s+/g, ' ')}`);
    }
  }
}

async function main() {
  analyzeChunk();
  await findCorrectEndpoint();
  await testBackendAPI();
}

main().catch(console.error);
