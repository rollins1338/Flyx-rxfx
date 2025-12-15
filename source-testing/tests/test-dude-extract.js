/**
 * Test dude.php extraction with better parsing
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://smashystream.com/',
};

async function extractFromDude(imdbId, season, episode) {
  let url = `https://embed.smashystream.com/dude.php?imdb=${imdbId}`;
  if (season && episode) {
    url += `&season=${season}&episode=${episode}`;
  }
  
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    console.log(`HTTP ${response.status}`);
    return null;
  }
  
  const html = await response.text();
  console.log(`Got ${html.length} chars`);
  
  // Save raw response for debugging
  // console.log('\n--- RAW HTML ---');
  // console.log(html);
  // console.log('--- END RAW ---\n');
  
  // Method 1: Extract all "file":"url" patterns
  const filePattern = /"file"\s*:\s*"(https?:[^"]+)"/g;
  const streams = [];
  let match;
  
  while ((match = filePattern.exec(html)) !== null) {
    const streamUrl = match[1].replace(/\\\//g, '/');
    if (streamUrl.includes('m3u8') || streamUrl.includes('mp4')) {
      streams.push(streamUrl);
    }
  }
  
  // Method 2: Extract titles
  const titlePattern = /"title"\s*:\s*"([^"]+)"/g;
  const titles = [];
  while ((match = titlePattern.exec(html)) !== null) {
    titles.push(match[1]);
  }
  
  console.log(`Found ${streams.length} streams, ${titles.length} titles`);
  
  // Combine streams with titles
  const results = streams.map((url, i) => ({
    title: titles[i] || `Stream ${i + 1}`,
    url: url,
  }));
  
  return results;
}

async function testStream(url, title) {
  console.log(`\nTesting: ${title}`);
  console.log(`URL: ${url.substring(0, 100)}...`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://embed.smashystream.com/',
        'Origin': 'https://embed.smashystream.com',
      }
    });
    
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const text = await response.text();
      const isM3U8 = text.includes('#EXTM3U');
      console.log(`Valid M3U8: ${isM3U8}`);
      
      if (isM3U8) {
        // Count quality variants
        const variants = (text.match(/#EXT-X-STREAM-INF/g) || []).length;
        console.log(`Quality variants: ${variants}`);
        console.log(`Preview:\n${text.substring(0, 300)}`);
        return true;
      }
    } else {
      const errText = await response.text();
      console.log(`Error body: ${errText.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  return false;
}

async function main() {
  console.log('=== TESTING DUDE.PHP EXTRACTION ===\n');
  
  // Test Fight Club
  console.log('\n--- Fight Club (tt0137523) ---');
  const fightClub = await extractFromDude('tt0137523');
  if (fightClub) {
    for (const stream of fightClub) {
      await testStream(stream.url, stream.title);
    }
  }
  
  // Test The Dark Knight (has multiple languages)
  console.log('\n\n--- The Dark Knight (tt0468569) ---');
  const darkKnight = await extractFromDude('tt0468569');
  if (darkKnight) {
    for (const stream of darkKnight) {
      await testStream(stream.url, stream.title);
    }
  }
  
  // Test TV show
  console.log('\n\n--- Breaking Bad S1E1 ---');
  const bb = await extractFromDude('tt0903747', 1, 1);
  if (bb) {
    for (const stream of bb) {
      await testStream(stream.url, stream.title);
    }
  }
}

main().catch(console.error);
