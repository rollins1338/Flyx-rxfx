/**
 * Test fresh dude.php extraction with detailed analysis
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://smashystream.com/',
};

async function testDudePHP(imdbId, name, season, episode) {
  console.log(`\n=== ${name} (${imdbId}) ===`);
  
  let url = `https://embed.smashystream.com/dude.php?imdb=${imdbId}`;
  if (season && episode) {
    url += `&season=${season}&episode=${episode}`;
  }
  
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url, { headers: HEADERS });
    console.log(`Status: ${response.status}`);
    
    const html = await response.text();
    console.log(`Length: ${html.length} chars`);
    
    // Check for error messages
    if (html.includes('not found') || html.includes('error') || html.includes('Error')) {
      console.log('Contains error message');
    }
    
    // Look for Playerjs config
    const playerjsMatch = html.match(/new Playerjs\((\{[\s\S]*?\})\);/);
    if (playerjsMatch) {
      console.log('\nPlayerjs config found!');
      try {
        // Parse the config (it's not valid JSON, but we can extract parts)
        const config = playerjsMatch[1];
        
        // Extract file array
        const fileMatch = config.match(/"file"\s*:\s*\[([\s\S]*?)\]/);
        if (fileMatch) {
          console.log('\nFile array found:');
          
          // Extract individual stream entries
          const entries = fileMatch[1].match(/\{[^{}]*"file"\s*:\s*"[^"]+[^{}]*\}/g);
          if (entries) {
            for (const entry of entries) {
              const titleMatch = entry.match(/"title"\s*:\s*"([^"]+)"/);
              const urlMatch = entry.match(/"file"\s*:\s*"([^"]+)"/);
              
              if (urlMatch) {
                const streamUrl = urlMatch[1].replace(/\\\//g, '/');
                const title = titleMatch ? titleMatch[1] : 'Unknown';
                console.log(`\n  Title: ${title}`);
                console.log(`  URL: ${streamUrl.substring(0, 120)}...`);
                
                // Test the stream
                console.log('  Testing stream...');
                try {
                  const streamResp = await fetch(streamUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Referer': 'https://embed.smashystream.com/',
                    }
                  });
                  console.log(`  Stream status: ${streamResp.status}`);
                  
                  if (streamResp.ok) {
                    const text = await streamResp.text();
                    console.log(`  Is M3U8: ${text.includes('#EXTM3U')}`);
                    if (text.includes('#EXTM3U')) {
                      console.log(`  Preview: ${text.substring(0, 200)}`);
                    }
                  } else {
                    const errText = await streamResp.text();
                    console.log(`  Error: ${errText.substring(0, 100)}`);
                  }
                } catch (e) {
                  console.log(`  Stream error: ${e.message}`);
                }
              }
            }
          }
        }
      } catch (e) {
        console.log(`Parse error: ${e.message}`);
      }
    } else {
      console.log('\nNo Playerjs config found');
      
      // Check what's in the response
      if (html.includes('iframe')) {
        console.log('Contains iframe');
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/);
        if (iframeMatch) {
          console.log(`Iframe src: ${iframeMatch[1]}`);
        }
      }
      
      // Show a preview
      console.log(`\nPreview:\n${html.substring(0, 500)}`);
    }
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

// Also try other endpoints
async function tryOtherEndpoints(imdbId) {
  console.log('\n\n=== TRYING OTHER ENDPOINTS ===');
  
  const endpoints = [
    `https://embed.smashystream.com/dude.php?imdb=${imdbId}`,
    `https://embed.smashystream.com/playere.php?imdb=${imdbId}`,
    `https://embed.smashystream.com/player.php?imdb=${imdbId}`,
    `https://player.smashystream.com/dude.php?imdb=${imdbId}`,
    `https://player.smashy.stream/dude.php?imdb=${imdbId}`,
  ];
  
  for (const url of endpoints) {
    console.log(`\n${url}`);
    try {
      const resp = await fetch(url, { headers: HEADERS });
      console.log(`  Status: ${resp.status}`);
      const text = await resp.text();
      console.log(`  Length: ${text.length}`);
      console.log(`  Has Playerjs: ${text.includes('Playerjs')}`);
      console.log(`  Has m3u8: ${text.includes('m3u8')}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

async function main() {
  // Test movies
  await testDudePHP('tt0137523', 'Fight Club');
  await testDudePHP('tt0468569', 'The Dark Knight');
  await testDudePHP('tt1375666', 'Inception');
  
  // Test TV
  await testDudePHP('tt0903747', 'Breaking Bad S1E1', 1, 1);
  
  // Try other endpoints
  await tryOtherEndpoints('tt0137523');
}

main().catch(console.error);
