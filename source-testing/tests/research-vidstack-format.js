/**
 * Research the vidstack encryption format used by SmashyStream/MultiMovies
 * 
 * Based on enc-dec.app documentation:
 * - POST /api/dec-vidstack with { "text": "...", "type": "..." }
 * - type can be: "smashy", "multimovies", "cloudy"
 * 
 * Let's try to understand what format the encrypted text should be in
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Test the enc-dec.app API with various inputs
async function testEncDecAPI() {
  console.log('=== TESTING ENC-DEC.APP API ===\n');
  
  // First, let's try the encryption endpoint to understand the format
  console.log('--- Testing enc-vidstack (encryption) ---\n');
  
  const testData = {
    sources: [
      { file: 'https://example.com/video.m3u8', label: '1080p' }
    ]
  };
  
  try {
    const encResponse = await fetch('https://enc-dec.app/api/enc-vidstack', {
      method: 'GET',
      headers: HEADERS,
    });
    
    console.log(`enc-vidstack GET status: ${encResponse.status}`);
    if (encResponse.ok) {
      const text = await encResponse.text();
      console.log(`Response: ${text.substring(0, 500)}`);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  
  // Try POST to encryption endpoint
  console.log('\n--- Testing enc-vidstack POST ---\n');
  
  try {
    const encResponse = await fetch('https://enc-dec.app/api/enc-vidstack', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: JSON.stringify(testData),
        type: 'smashy',
      }),
    });
    
    console.log(`enc-vidstack POST status: ${encResponse.status}`);
    if (encResponse.ok) {
      const json = await encResponse.json();
      console.log(`Response: ${JSON.stringify(json, null, 2)}`);
      
      // If we got encrypted data, try to decrypt it
      if (json.result) {
        console.log('\n--- Decrypting the result ---\n');
        
        const decResponse = await fetch('https://enc-dec.app/api/dec-vidstack', {
          method: 'POST',
          headers: {
            ...HEADERS,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: json.result,
            type: 'smashy',
          }),
        });
        
        console.log(`dec-vidstack status: ${decResponse.status}`);
        if (decResponse.ok) {
          const decJson = await decResponse.json();
          console.log(`Decrypted: ${JSON.stringify(decJson, null, 2)}`);
        }
      }
    } else {
      const text = await encResponse.text();
      console.log(`Error response: ${text}`);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  
  // Test different types
  console.log('\n--- Testing different types ---\n');
  
  const types = ['smashy', 'multimovies', 'cloudy'];
  
  for (const type of types) {
    console.log(`\nType: ${type}`);
    
    try {
      // Try with empty/test data to see error messages
      const response = await fetch('https://enc-dec.app/api/dec-vidstack', {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'test',
          type: type,
        }),
      });
      
      console.log(`  Status: ${response.status}`);
      const text = await response.text();
      console.log(`  Response: ${text.substring(0, 200)}`);
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

// Try to find real encrypted data from known working sources
async function findEncryptedData() {
  console.log('\n=== LOOKING FOR ENCRYPTED DATA PATTERNS ===\n');
  
  // MultiMovies embed
  const multiMoviesUrl = 'https://multimovies.cloud/movie/550';
  
  console.log(`Fetching: ${multiMoviesUrl}`);
  
  try {
    const response = await fetch(multiMoviesUrl, {
      headers: {
        ...HEADERS,
        'Referer': 'https://multimovies.cloud/',
      },
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const html = await response.text();
      console.log(`Length: ${html.length} chars`);
      
      // Look for encrypted data patterns
      // Common patterns: base64, hex, custom encoding
      
      // Long base64-like strings
      const base64Pattern = /["']([A-Za-z0-9+/=]{100,})["']/g;
      let match;
      const base64Matches = [];
      while ((match = base64Pattern.exec(html)) !== null) {
        base64Matches.push(match[1]);
      }
      
      if (base64Matches.length > 0) {
        console.log(`\nFound ${base64Matches.length} potential base64 strings:`);
        base64Matches.slice(0, 5).forEach((s, i) => {
          console.log(`  [${i}] ${s.substring(0, 80)}... (${s.length} chars)`);
        });
      }
      
      // Look for data in script tags
      const scriptDataPattern = /(?:sources|data|encrypted|encoded)\s*[:=]\s*["']([^"']+)["']/gi;
      const scriptMatches = [];
      while ((match = scriptDataPattern.exec(html)) !== null) {
        scriptMatches.push({ key: match[0].split(/[:=]/)[0].trim(), value: match[1] });
      }
      
      if (scriptMatches.length > 0) {
        console.log(`\nFound ${scriptMatches.length} data assignments:`);
        scriptMatches.slice(0, 10).forEach((m, i) => {
          console.log(`  [${i}] ${m.key}: ${m.value.substring(0, 60)}...`);
        });
      }
      
      // Look for API calls
      const apiPattern = /fetch\s*\(\s*["']([^"']+)["']/g;
      const apiMatches = [];
      while ((match = apiPattern.exec(html)) !== null) {
        apiMatches.push(match[1]);
      }
      
      if (apiMatches.length > 0) {
        console.log(`\nFound ${apiMatches.length} fetch calls:`);
        apiMatches.forEach((url, i) => {
          console.log(`  [${i}] ${url}`);
        });
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

// Test Videasy API (which we know works)
async function testVideasyAPI() {
  console.log('\n=== TESTING VIDEASY API FOR REFERENCE ===\n');
  
  // Videasy uses a different endpoint
  // POST /api/dec-videasy with { "text": "...", "id": "..." }
  
  // First, let's see what Videasy returns
  const videasyUrl = 'https://player.videasy.net/movie/550';
  
  console.log(`Fetching: ${videasyUrl}`);
  
  try {
    const response = await fetch(videasyUrl, {
      headers: {
        ...HEADERS,
        'Referer': 'https://videasy.net/',
      },
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const html = await response.text();
      console.log(`Length: ${html.length} chars`);
      
      // Look for the encrypted data that Videasy uses
      const dataPattern = /data\s*[:=]\s*["']([^"']+)["']/gi;
      let match;
      while ((match = dataPattern.exec(html)) !== null) {
        console.log(`\nFound data: ${match[1].substring(0, 100)}...`);
        
        // Try to decrypt it
        if (match[1].length > 50) {
          console.log('Attempting decryption...');
          
          const decResponse = await fetch('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: {
              ...HEADERS,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: match[1],
              id: '550',
            }),
          });
          
          console.log(`Decryption status: ${decResponse.status}`);
          if (decResponse.ok) {
            const decJson = await decResponse.json();
            console.log(`Decrypted: ${JSON.stringify(decJson).substring(0, 300)}`);
          }
        }
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function main() {
  await testEncDecAPI();
  await findEncryptedData();
  await testVideasyAPI();
  
  console.log('\n=== SUMMARY ===');
  console.log('The enc-dec.app API expects encrypted data in a specific format.');
  console.log('SmashyStream/MultiMovies encrypt their source data client-side.');
  console.log('Without browser execution, we cannot get the encrypted data to decrypt.');
  console.log('Alternative: Use a headless browser or find the API endpoints directly.');
}

main().catch(console.error);
