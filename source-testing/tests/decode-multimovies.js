/**
 * Decode and analyze the MultiMovies data
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function analyzeMultiMovies() {
  console.log('=== ANALYZING MULTIMOVIES ===\n');
  
  const url = 'https://multimovies.cloud/movie/550';
  
  const response = await fetch(url, {
    headers: {
      ...HEADERS,
      'Referer': 'https://multimovies.cloud/',
    },
  });
  
  const html = await response.text();
  console.log(`Page length: ${html.length} chars`);
  
  // Find the base64 string
  const base64Pattern = /["']([A-Za-z0-9+/=]{100,})["']/g;
  let match;
  
  while ((match = base64Pattern.exec(html)) !== null) {
    const encoded = match[1];
    console.log(`\nFound base64 (${encoded.length} chars):`);
    console.log(`  ${encoded.substring(0, 80)}...`);
    
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      console.log(`\nDecoded:`);
      console.log(decoded.substring(0, 500));
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(decoded);
        console.log(`\nParsed JSON:`);
        console.log(JSON.stringify(json, null, 2).substring(0, 1000));
      } catch {
        console.log('Not valid JSON');
      }
    } catch (e) {
      console.log(`Decode error: ${e.message}`);
    }
  }
  
  // Look for iframe sources
  const iframePattern = /<iframe[^>]*src=["']([^"']+)["']/gi;
  console.log('\n--- Iframes ---');
  while ((match = iframePattern.exec(html)) !== null) {
    console.log(`  ${match[1]}`);
  }
  
  // Look for script sources
  const scriptPattern = /<script[^>]*src=["']([^"']+)["']/gi;
  console.log('\n--- Scripts ---');
  while ((match = scriptPattern.exec(html)) !== null) {
    console.log(`  ${match[1]}`);
  }
  
  // Look for any API endpoints
  const apiPattern = /["'](https?:\/\/[^"']*(?:api|embed|player|source)[^"']*)["']/gi;
  console.log('\n--- API URLs ---');
  const apis = new Set();
  while ((match = apiPattern.exec(html)) !== null) {
    apis.add(match[1]);
  }
  apis.forEach(a => console.log(`  ${a}`));
  
  // Look for data attributes
  const dataPattern = /data-([a-z-]+)=["']([^"']+)["']/gi;
  console.log('\n--- Data Attributes ---');
  while ((match = dataPattern.exec(html)) !== null) {
    console.log(`  data-${match[1]}: ${match[2].substring(0, 60)}`);
  }
}

async function testDecryptionTypes() {
  console.log('\n=== TESTING DECRYPTION TYPE INDICES ===\n');
  
  // The API expects type_idx - let's try numeric values
  const testText = 'eyJzb3VyY2VzIjpbXX0='; // Base64 of {"sources":[]}
  
  for (let i = 0; i <= 10; i++) {
    try {
      const response = await fetch('https://enc-dec.app/api/dec-vidstack', {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          type: i,
        }),
      });
      
      const json = await response.json();
      console.log(`Type ${i}: ${json.status} - ${json.error || json.result || 'OK'}`);
    } catch (error) {
      console.log(`Type ${i}: Error - ${error.message}`);
    }
  }
}

async function fetchMultiMoviesEmbed() {
  console.log('\n=== FETCHING MULTIMOVIES EMBED ===\n');
  
  // Try the embed URL directly
  const embedUrls = [
    'https://multimovies.cloud/embed/movie/550',
    'https://multimovies.cloud/e/movie/550',
    'https://multimovies.cloud/player/movie/550',
    'https://multimovies.cloud/watch/movie/550',
  ];
  
  for (const url of embedUrls) {
    console.log(`\nTrying: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          ...HEADERS,
          'Referer': 'https://multimovies.cloud/',
        },
        redirect: 'follow',
      });
      
      console.log(`  Status: ${response.status}`);
      console.log(`  URL: ${response.url}`);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`  Length: ${html.length} chars`);
        
        // Check for video sources
        if (html.includes('.m3u8') || html.includes('.mp4')) {
          console.log('  Contains video URLs!');
          
          const m3u8Pattern = /["'](https?:\/\/[^"']*\.m3u8[^"']*)["']/gi;
          let match;
          while ((match = m3u8Pattern.exec(html)) !== null) {
            console.log(`    M3U8: ${match[1]}`);
          }
        }
        
        // Check for encrypted data
        const encPattern = /["']([A-Za-z0-9+/=]{200,})["']/g;
        let match;
        while ((match = encPattern.exec(html)) !== null) {
          console.log(`  Encrypted data found (${match[1].length} chars)`);
        }
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

async function main() {
  await analyzeMultiMovies();
  await testDecryptionTypes();
  await fetchMultiMoviesEmbed();
}

main().catch(console.error);
