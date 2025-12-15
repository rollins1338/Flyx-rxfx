/**
 * Test enc-dec.app API with correct parameters
 * 
 * Based on the API hint: POST: { 'text': 'text_to_decrypt', 'type': 'type_idx' }
 * 
 * Let's find the correct type indices and data format
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
};

// Test all available endpoints
async function testAllEndpoints() {
  console.log('=== TESTING ALL ENC-DEC.APP ENDPOINTS ===\n');
  
  const endpoints = [
    { path: '/api/dec-vidstack', body: { text: 'test', type: 0 } },
    { path: '/api/dec-xprime', body: { text: 'test' } },
    { path: '/api/dec-hexa', body: { text: 'test', key: 'test' } },
    { path: '/api/dec-videasy', body: { text: 'test', id: '550' } },
    { path: '/api/enc-vidstack', body: { text: 'test', type: 0 } },
    { path: '/api/enc-xprime', body: { text: 'test' } },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n${endpoint.path}:`);
    
    try {
      // Try GET first
      const getResponse = await fetch(`https://enc-dec.app${endpoint.path}`, {
        method: 'GET',
        headers: HEADERS,
      });
      
      console.log(`  GET: ${getResponse.status}`);
      if (getResponse.ok) {
        const text = await getResponse.text();
        console.log(`    ${text.substring(0, 200)}`);
      }
      
      // Try POST
      const postResponse = await fetch(`https://enc-dec.app${endpoint.path}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(endpoint.body),
      });
      
      console.log(`  POST: ${postResponse.status}`);
      const postText = await postResponse.text();
      console.log(`    ${postText.substring(0, 300)}`);
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

// Try to find documentation or hints
async function checkDocumentation() {
  console.log('\n=== CHECKING FOR DOCUMENTATION ===\n');
  
  const docUrls = [
    'https://enc-dec.app/',
    'https://enc-dec.app/docs',
    'https://enc-dec.app/api',
    'https://enc-dec.app/api/docs',
  ];
  
  for (const url of docUrls) {
    console.log(`\n${url}:`);
    
    try {
      const response = await fetch(url, { headers: HEADERS });
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`  Length: ${html.length} chars`);
        
        // Look for API documentation
        if (html.includes('api') || html.includes('endpoint')) {
          // Extract relevant text
          const apiMentions = html.match(/(?:api|endpoint|decrypt|encrypt)[^<]{0,200}/gi);
          if (apiMentions) {
            console.log('  API mentions:');
            apiMentions.slice(0, 5).forEach(m => console.log(`    ${m.trim()}`));
          }
        }
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

// Test with real encrypted data from a working source
async function testWithRealData() {
  console.log('\n=== TESTING WITH REAL ENCRYPTED DATA ===\n');
  
  // First, let's get data from Videasy which we know works
  const videasyUrl = 'https://player.videasy.net/movie/550';
  
  console.log(`Fetching Videasy: ${videasyUrl}`);
  
  try {
    const response = await fetch(videasyUrl, {
      headers: {
        ...HEADERS,
        'Referer': 'https://videasy.net/',
      },
    });
    
    if (!response.ok) {
      console.log(`  Status: ${response.status}`);
      return;
    }
    
    const html = await response.text();
    console.log(`  Length: ${html.length} chars`);
    
    // Look for the encrypted data pattern
    // Videasy typically has data in a specific format
    
    // Look for any long encoded strings
    const patterns = [
      /data\s*[:=]\s*["']([^"']{50,})["']/gi,
      /encrypted\s*[:=]\s*["']([^"']{50,})["']/gi,
      /source\s*[:=]\s*["']([^"']{50,})["']/gi,
      /file\s*[:=]\s*["']([^"']{50,})["']/gi,
      /["']([A-Za-z0-9_-]{100,})["']/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const data = match[1];
        if (data.length > 50 && !data.includes('http') && !data.includes('<')) {
          console.log(`\nFound potential encrypted data (${data.length} chars):`);
          console.log(`  ${data.substring(0, 80)}...`);
          
          // Try to decrypt with Videasy endpoint
          console.log('  Trying dec-videasy...');
          
          const decResponse = await fetch('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
              text: data,
              id: '550',
            }),
          });
          
          console.log(`    Status: ${decResponse.status}`);
          const decText = await decResponse.text();
          console.log(`    Response: ${decText.substring(0, 300)}`);
        }
      }
    }
    
    // Also look for script content
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    let scriptIndex = 0;
    
    while ((scriptMatch = scriptPattern.exec(html)) !== null) {
      const scriptContent = scriptMatch[1];
      if (scriptContent.length > 100 && !scriptContent.includes('google') && !scriptContent.includes('analytics')) {
        console.log(`\nScript ${scriptIndex} (${scriptContent.length} chars):`);
        
        // Look for interesting patterns
        if (scriptContent.includes('sources') || scriptContent.includes('file') || scriptContent.includes('m3u8')) {
          console.log('  Contains source-related keywords');
          
          // Extract the relevant part
          const sourceMatch = scriptContent.match(/sources?\s*[:=]\s*(\[[^\]]+\]|\{[^}]+\})/i);
          if (sourceMatch) {
            console.log(`  Sources: ${sourceMatch[1].substring(0, 200)}`);
          }
        }
        
        scriptIndex++;
      }
    }
    
  } catch (error) {
    console.log(`  Error: ${error.message}`);
  }
}

async function main() {
  await testAllEndpoints();
  await checkDocumentation();
  await testWithRealData();
  
  console.log('\n=== CONCLUSION ===');
  console.log('The enc-dec.app API requires specific encrypted data formats.');
  console.log('SmashyStream and MultiMovies use client-side JavaScript to:');
  console.log('1. Fetch encrypted source data from their API');
  console.log('2. Decrypt it using their own algorithms');
  console.log('3. Pass it to the video player');
  console.log('\nWithout browser execution, we cannot intercept this flow.');
}

main().catch(console.error);
