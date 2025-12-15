/**
 * Test the dude.php endpoint found in SmashyStream bundle
 * This might be a different/simpler endpoint
 */

const fs = require('fs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://smashystream.com/',
};

const IMDB_ID = 'tt0137523'; // Fight Club

async function testDudePHP() {
  console.log('=== TESTING DUDE.PHP ENDPOINT ===\n');
  
  // From bundle: https://embed.smashystream.com/dude.php?imdb=${t}&season=${n}&episode=${r}
  // For movies: https://embed.smashystream.com/dude.php?imdb=${t}
  
  const url = `https://embed.smashystream.com/dude.php?imdb=${IMDB_ID}`;
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url, { headers: HEADERS });
    console.log(`Status: ${response.status}`);
    
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Save for inspection
    fs.writeFileSync('source-testing/dude-php-response.html', html);
    console.log('Saved to: source-testing/dude-php-response.html\n');
    
    // Look for iframes
    console.log('--- Iframes ---');
    const iframePattern = /<iframe[^>]*src=["']([^"']+)["']/gi;
    let match;
    while ((match = iframePattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // Look for video sources
    console.log('\n--- Video Sources ---');
    const sourcePattern = /<source[^>]*src=["']([^"']+)["']/gi;
    while ((match = sourcePattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // Look for m3u8 URLs
    console.log('\n--- M3U8 URLs ---');
    const m3u8Pattern = /["']([^"']*\.m3u8[^"']*)["']/gi;
    while ((match = m3u8Pattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // Look for any stream URLs
    console.log('\n--- Stream URLs ---');
    const streamPattern = /["'](https?:\/\/[^"']*(?:stream|cdn|hls|video)[^"']*)["']/gi;
    const streams = new Set();
    while ((match = streamPattern.exec(html)) !== null) {
      streams.add(match[1]);
    }
    for (const s of streams) {
      console.log(`  ${s}`);
    }
    
    // Look for file property
    console.log('\n--- File Properties ---');
    const filePattern = /file\s*[:=]\s*["']([^"']+)["']/gi;
    while ((match = filePattern.exec(html)) !== null) {
      console.log(`  ${match[1]}`);
    }
    
    // Show first 2000 chars of HTML
    console.log('\n--- HTML Preview ---');
    console.log(html.substring(0, 2000));
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

// Also test other potential endpoints
async function testOtherEndpoints() {
  console.log('\n\n=== TESTING OTHER ENDPOINTS ===\n');
  
  const endpoints = [
    `https://embed.smashystream.com/player.php?imdb=${IMDB_ID}`,
    `https://embed.smashystream.com/embed.php?imdb=${IMDB_ID}`,
    `https://embed.smashystream.com/video.php?imdb=${IMDB_ID}`,
    `https://embed.smashystream.com/watch.php?imdb=${IMDB_ID}`,
  ];
  
  for (const url of endpoints) {
    console.log(`\n${url}`);
    try {
      const response = await fetch(url, { headers: HEADERS });
      console.log(`  Status: ${response.status}`);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`  Length: ${html.length} chars`);
        
        // Check for m3u8
        if (html.includes('.m3u8')) {
          console.log('  *** Contains M3U8! ***');
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

async function main() {
  await testDudePHP();
  await testOtherEndpoints();
}

main().catch(console.error);
