/**
 * Deep dive into MoviesAPI and Superembed
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TMDB_ID = '550'; // Fight Club

async function testMoviesAPI() {
  console.log('=== MOVIESAPI.CLUB DEEP DIVE ===\n');
  
  // Test the main embed
  const embedUrl = `https://moviesapi.club/movie/${TMDB_ID}`;
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, { headers: HEADERS });
    const html = await response.text();
    
    console.log(`Length: ${html.length} chars`);
    
    // Save for inspection
    fs.writeFileSync('source-testing/moviesapi-response.html', html);
    console.log('Saved to: source-testing/moviesapi-response.html');
    
    // Look for API patterns
    console.log('\n--- API Patterns ---');
    const apiPattern = /["'](https?:\/\/[^"']+)["']/gi;
    const urls = new Set();
    let match;
    while ((match = apiPattern.exec(html)) !== null) {
      if (!match[1].includes('google') && !match[1].includes('cloudflare')) {
        urls.add(match[1]);
      }
    }
    for (const url of urls) {
      console.log(`  ${url}`);
    }
    
    // Look for iframe sources
    console.log('\n--- Iframe Sources ---');
    const iframePattern = /<iframe[^>]*src=["']([^"']+)["']/gi;
    while ((match = iframePattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // Look for script content
    console.log('\n--- Script Analysis ---');
    const scriptPattern = /<script[^>]*>([^<]{100,})<\/script>/gi;
    while ((match = scriptPattern.exec(html)) !== null) {
      console.log(`  Script (${match[1].length} chars): ${match[1].substring(0, 200)}...`);
    }
    
    // Test the sbx.html endpoint
    console.log('\n--- Testing sbx.html ---');
    const sbxUrl = 'https://moviesapi.club/sbx.html';
    const sbxResponse = await fetch(sbxUrl, { headers: HEADERS });
    console.log(`Status: ${sbxResponse.status}`);
    if (sbxResponse.ok) {
      const sbxHtml = await sbxResponse.text();
      console.log(`Length: ${sbxHtml.length} chars`);
      console.log(`Preview: ${sbxHtml.substring(0, 300)}`);
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function testSuperembed() {
  console.log('\n\n=== SUPEREMBED (MULTIEMBED.MOV) DEEP DIVE ===\n');
  
  const embedUrl = `https://multiembed.mov/directstream.php?video_id=${TMDB_ID}&tmdb=1`;
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, { 
      headers: HEADERS,
      redirect: 'follow'
    });
    
    console.log(`Final URL: ${response.url}`);
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Save for inspection
    fs.writeFileSync('source-testing/superembed-response.html', html);
    console.log('Saved to: source-testing/superembed-response.html');
    
    // Look for encrypted data in URL
    const urlMatch = response.url.match(/play=([A-Za-z0-9+/=]+)/);
    if (urlMatch) {
      console.log(`\n--- Encrypted Play Parameter ---`);
      console.log(`Length: ${urlMatch[1].length} chars`);
      console.log(`Value: ${urlMatch[1].substring(0, 100)}...`);
      
      // Try base64 decode
      try {
        const decoded = Buffer.from(urlMatch[1], 'base64').toString('utf8');
        console.log(`Base64 decoded: ${decoded.substring(0, 200)}`);
      } catch {}
    }
    
    // Look for source patterns in HTML
    console.log('\n--- Source Patterns ---');
    const sourcePatterns = [
      /["']([^"']*\.m3u8[^"']*)["']/gi,
      /["']([^"']*\.mp4[^"']*)["']/gi,
      /file\s*[:=]\s*["']([^"']+)["']/gi,
      /source\s*[:=]\s*["']([^"']+)["']/gi,
    ];
    
    for (const pattern of sourcePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        console.log(`  ${match[0].substring(0, 150)}`);
      }
    }
    
    // Look for API endpoints
    console.log('\n--- API Endpoints ---');
    const apiPattern = /["'](https?:\/\/[^"']*(?:api|source|stream)[^"']*)["']/gi;
    let match;
    while ((match = apiPattern.exec(html)) !== null) {
      if (!match[1].includes('google')) {
        console.log(`  ${match[1]}`);
      }
    }
    
    // Look for JSON data
    console.log('\n--- JSON Data ---');
    const jsonPattern = /\{[^{}]*"(?:file|url|source)"[^{}]*\}/gi;
    while ((match = jsonPattern.exec(html)) !== null) {
      console.log(`  ${match[0].substring(0, 200)}`);
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function testVidsrcRip() {
  console.log('\n\n=== VIDSRC.RIP DEEP DIVE ===\n');
  
  const embedUrl = `https://vidsrc.rip/embed/movie/${TMDB_ID}`;
  console.log(`Embed URL: ${embedUrl}`);
  
  try {
    const response = await fetch(embedUrl, { headers: HEADERS });
    const html = await response.text();
    
    console.log(`Length: ${html.length} chars`);
    console.log(`Preview: ${html.substring(0, 500)}`);
    
    // Look for API patterns
    console.log('\n--- All URLs ---');
    const urlPattern = /["'](https?:\/\/[^"']+)["']/gi;
    const urls = new Set();
    let match;
    while ((match = urlPattern.exec(html)) !== null) {
      urls.add(match[1]);
    }
    for (const url of urls) {
      console.log(`  ${url}`);
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function main() {
  await testMoviesAPI();
  await testSuperembed();
  await testVidsrcRip();
}

main().catch(console.error);
