/**
 * Test the stream URL from dude.php and create extractor logic
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': '*/*',
  'Referer': 'https://embed.smashystream.com/',
};

// Test the stream URL we found
async function testStreamURL() {
  console.log('=== TESTING STREAM URL ===\n');
  
  const streamUrl = 'https://i-arch-400.kalis393fev.com/stream2/i-arch-400/974b94811fdb117fc06efffe0246965f/MJTMsp1RshGTygnMNRUR2N2MSlnWXZEdMNDZzQWe5MDZzMmdZJTO1R2RWVHZDljekhkSsl1VwYnWtx2cihVT21keatWWqZkaNRUQzoFRBVjWEtGNapmSp10VNhXT6VkeZdVRz8EVoh2TXVVP:1765756511:185.237.106.42:c8b8b61125446a701c76e81faebc3c086c0d6dd31819a48e827dee5d8d961ca6/index.m3u8';
  
  console.log(`URL: ${streamUrl.substring(0, 100)}...`);
  
  try {
    const response = await fetch(streamUrl, { headers: HEADERS });
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`Length: ${text.length} chars`);
      console.log(`Is M3U8: ${text.includes('#EXTM3U')}`);
      console.log(`\nPreview:\n${text.substring(0, 500)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

// Extract stream from dude.php
async function extractFromDudePHP(imdbId) {
  console.log(`\n\n=== EXTRACTING FROM DUDE.PHP ===`);
  console.log(`IMDB ID: ${imdbId}\n`);
  
  const url = `https://embed.smashystream.com/dude.php?imdb=${imdbId}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://smashystream.com/',
      }
    });
    
    if (!response.ok) {
      console.log(`HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract the file URL from the Playerjs config
    // Pattern: "file":"https:\/\/...\/index.m3u8"
    const filePattern = /"file"\s*:\s*"([^"]+index\.m3u8[^"]*)"/gi;
    const matches = [];
    let match;
    
    while ((match = filePattern.exec(html)) !== null) {
      // Unescape the URL
      const url = match[1].replace(/\\\//g, '/');
      matches.push(url);
    }
    
    if (matches.length === 0) {
      console.log('No stream URLs found');
      return null;
    }
    
    console.log(`Found ${matches.length} stream(s):`);
    for (const m of matches) {
      console.log(`  ${m.substring(0, 100)}...`);
    }
    
    // Also extract title if available
    const titlePattern = /"title"\s*:\s*"([^"]+)"/gi;
    const titles = [];
    while ((match = titlePattern.exec(html)) !== null) {
      titles.push(match[1]);
    }
    
    if (titles.length > 0) {
      console.log(`\nTitles: ${titles.join(', ')}`);
    }
    
    return {
      streams: matches,
      titles: titles,
    };
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
    return null;
  }
}

// Test with different movies
async function testMultipleMovies() {
  console.log('\n\n=== TESTING MULTIPLE MOVIES ===\n');
  
  const movies = [
    { imdb: 'tt0137523', name: 'Fight Club' },
    { imdb: 'tt0111161', name: 'Shawshank Redemption' },
    { imdb: 'tt0468569', name: 'The Dark Knight' },
  ];
  
  for (const movie of movies) {
    console.log(`\n--- ${movie.name} (${movie.imdb}) ---`);
    const result = await extractFromDudePHP(movie.imdb);
    
    if (result && result.streams.length > 0) {
      // Test the first stream
      console.log('\nTesting stream...');
      const streamUrl = result.streams[0];
      
      try {
        const response = await fetch(streamUrl, { headers: HEADERS });
        console.log(`  Status: ${response.status}`);
        
        if (response.ok) {
          const text = await response.text();
          console.log(`  Valid M3U8: ${text.includes('#EXTM3U')}`);
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }
}

// Test TV show
async function testTVShow() {
  console.log('\n\n=== TESTING TV SHOW ===\n');
  
  // Breaking Bad S1E1
  const url = 'https://embed.smashystream.com/dude.php?imdb=tt0959621&season=1&episode=1';
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Referer': 'https://smashystream.com/',
      }
    });
    
    console.log(`Status: ${response.status}`);
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Look for stream URLs
    const filePattern = /"file"\s*:\s*"([^"]+)"/gi;
    let match;
    while ((match = filePattern.exec(html)) !== null) {
      const url = match[1].replace(/\\\//g, '/');
      if (url.includes('m3u8') || url.includes('mp4')) {
        console.log(`  Stream: ${url.substring(0, 100)}...`);
      }
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function main() {
  await testStreamURL();
  await extractFromDudePHP('tt0137523');
  await testMultipleMovies();
  await testTVShow();
}

main().catch(console.error);
