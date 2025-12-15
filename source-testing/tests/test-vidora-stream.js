/**
 * Test Vidora.stream - found via MoviesAPI
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function testVidora() {
  console.log('=== TESTING VIDORA.STREAM ===\n');
  
  // The embed URL we found
  const embedUrl = 'https://vidora.stream/embed/e5ccbb10n1xp';
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, {
      headers: { ...HEADERS, 'Referer': 'https://moviesapi.club/' }
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Final URL: ${response.url}`);
    
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Save for inspection
    fs.writeFileSync('source-testing/vidora-response.html', html);
    console.log('Saved to: source-testing/vidora-response.html\n');
    
    // Look for source URLs
    console.log('--- Source URLs ---');
    const sourcePatterns = [
      /["']([^"']*\.m3u8[^"']*)["']/gi,
      /["']([^"']*\.mp4[^"']*)["']/gi,
      /file\s*[:=]\s*["']([^"']+)["']/gi,
      /source\s*[:=]\s*["']([^"']+)["']/gi,
      /src\s*[:=]\s*["']([^"']+)["']/gi,
    ];
    
    for (const pattern of sourcePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (match[1].includes('http') || match[1].includes('.m3u8') || match[1].includes('.mp4')) {
          console.log(`  ${match[0].substring(0, 200)}`);
        }
      }
    }
    
    // Look for API endpoints
    console.log('\n--- API Endpoints ---');
    const apiPattern = /["'](https?:\/\/[^"']+)["']/gi;
    const urls = new Set();
    let match;
    while ((match = apiPattern.exec(html)) !== null) {
      if (!match[1].includes('google') && !match[1].includes('cloudflare') && !match[1].includes('gstatic')) {
        urls.add(match[1]);
      }
    }
    for (const url of urls) {
      console.log(`  ${url}`);
    }
    
    // Look for encrypted data
    console.log('\n--- Encrypted Data ---');
    const encPattern = /["']([A-Za-z0-9+/=_-]{50,})["']/g;
    while ((match = encPattern.exec(html)) !== null) {
      if (!match[1].includes('http')) {
        console.log(`  (${match[1].length} chars): ${match[1].substring(0, 80)}...`);
      }
    }
    
    // Look for script content
    console.log('\n--- Inline Scripts ---');
    const scriptPattern = /<script[^>]*>([^<]{100,})<\/script>/gi;
    let scriptNum = 0;
    while ((match = scriptPattern.exec(html)) !== null) {
      scriptNum++;
      const script = match[1];
      console.log(`\nScript ${scriptNum} (${script.length} chars):`);
      console.log(script.substring(0, 500));
      
      // Look for fetch/API calls in script
      if (script.includes('fetch') || script.includes('axios')) {
        console.log('  *** Contains fetch/API calls ***');
      }
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

// Also test the API pattern for vidora
async function testVidoraAPI() {
  console.log('\n\n=== TESTING VIDORA API PATTERNS ===\n');
  
  const videoId = 'e5ccbb10n1xp';
  
  const apiPatterns = [
    `https://vidora.stream/api/source/${videoId}`,
    `https://vidora.stream/api/video/${videoId}`,
    `https://vidora.stream/api/embed/${videoId}`,
    `https://vidora.stream/source/${videoId}`,
    `https://vidora.stream/ajax/embed/${videoId}`,
  ];
  
  for (const url of apiPatterns) {
    console.log(`\nTrying: ${url}`);
    try {
      const response = await fetch(url, {
        headers: { ...HEADERS, 'Referer': 'https://vidora.stream/' }
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`  Length: ${text.length} chars`);
        console.log(`  Preview: ${text.substring(0, 200)}`);
        
        // Try to parse as JSON
        try {
          const json = JSON.parse(text);
          console.log(`  JSON: ${JSON.stringify(json).substring(0, 300)}`);
        } catch {}
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
}

async function main() {
  await testVidora();
  await testVidoraAPI();
}

main().catch(console.error);
