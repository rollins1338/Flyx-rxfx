/**
 * Test Cloudy.lol API - one of the MultiEmbed sources
 * This might have a more accessible API than SmashyStream
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TMDB_ID = '550';

async function testCloudyAPI() {
  console.log('=== TESTING CLOUDY.LOL ===\n');
  
  // Test embed page
  const embedUrl = `https://cloudy.lol/embed/movie/${TMDB_ID}`;
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, {
      headers: { ...HEADERS, 'Referer': 'https://cloudy.lol/' }
    });
    
    console.log(`Status: ${response.status}`);
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Look for encrypted data
    const dataPatterns = [
      /data\s*[:=]\s*["']([^"']+)["']/gi,
      /sources?\s*[:=]\s*["']([^"']+)["']/gi,
      /encrypted\s*[:=]\s*["']([^"']+)["']/gi,
      /["']([A-Za-z0-9+/=]{100,})["']/g,
    ];
    
    console.log('\nLooking for encrypted data...');
    for (const pattern of dataPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1].length > 50 && !match[1].includes('<')) {
          console.log(`  Found (${match[1].length} chars): ${match[1].substring(0, 80)}...`);
          
          // Try to decrypt with enc-dec.app
          console.log('  Trying decryption...');
          const decResponse = await fetch('https://enc-dec.app/api/dec-vidstack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...HEADERS },
            body: JSON.stringify({ text: match[1], type: 0 }),
          });
          
          if (decResponse.ok) {
            const decJson = await decResponse.json();
            console.log(`  Decryption result: ${JSON.stringify(decJson).substring(0, 200)}`);
          }
        }
      }
    }
    
    // Look for script sources
    const scriptPattern = /<script[^>]*src=["']([^"']+)["']/gi;
    console.log('\nScript sources:');
    let match;
    while ((match = scriptPattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // Look for API URLs
    const apiPattern = /["'](https?:\/\/[^"']*(?:api|source|backend)[^"']*)["']/gi;
    console.log('\nAPI URLs:');
    while ((match = apiPattern.exec(html)) !== null) {
      if (!match[1].includes('google')) {
        console.log(`  ${match[1]}`);
      }
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function testXPrimeAPI() {
  console.log('\n=== TESTING XPRIME.TV ===\n');
  
  const embedUrl = `https://xprime.tv/embed/movie/${TMDB_ID}`;
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, {
      headers: { ...HEADERS, 'Referer': 'https://xprime.tv/' }
    });
    
    console.log(`Status: ${response.status}`);
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Look for backend.xprime.tv (mentioned in enc-dec.app hint)
    if (html.includes('backend.xprime.tv')) {
      console.log('\n*** Found backend.xprime.tv reference! ***');
      
      const backendPattern = /backend\.xprime\.tv[^"'\s]*/g;
      let match;
      while ((match = backendPattern.exec(html)) !== null) {
        console.log(`  ${match[0]}`);
      }
    }
    
    // Look for encrypted data
    const dataPattern = /["']([A-Za-z0-9+/=_-]{100,})["']/g;
    let match;
    while ((match = dataPattern.exec(html)) !== null) {
      if (!match[1].includes('http')) {
        console.log(`\nFound potential encrypted data (${match[1].length} chars)`);
        console.log(`  ${match[1].substring(0, 80)}...`);
        
        // Try dec-xprime
        const decResponse = await fetch('https://enc-dec.app/api/dec-xprime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...HEADERS },
          body: JSON.stringify({ text: match[1] }),
        });
        
        if (decResponse.ok) {
          const decJson = await decResponse.json();
          console.log(`  Decryption: ${JSON.stringify(decJson).substring(0, 200)}`);
        }
      }
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function testHexaAPI() {
  console.log('\n=== TESTING HEXA.WATCH ===\n');
  
  const embedUrl = `https://hexa.watch/embed/movie/${TMDB_ID}`;
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, {
      headers: { ...HEADERS, 'Referer': 'https://hexa.watch/' }
    });
    
    console.log(`Status: ${response.status}`);
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    console.log(`Preview: ${html.substring(0, 300)}`);
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function main() {
  await testCloudyAPI();
  await testXPrimeAPI();
  await testHexaAPI();
}

main().catch(console.error);
