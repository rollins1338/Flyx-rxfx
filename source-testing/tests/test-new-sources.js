/**
 * Test New Source Extractors
 * Tests SmashyStream and MultiMovies
 */

const TEST_MOVIE_TMDB = '550'; // Fight Club
const TEST_TV_TMDB = '1396'; // Breaking Bad

async function testSmashyStream() {
  console.log('\n=== Testing SmashyStream ===');
  
  // Test movie
  console.log('\nMovie (Fight Club):');
  const movieUrl = `https://embed.smashystream.com/playere.php?tmdb=${TEST_MOVIE_TMDB}`;
  console.log(`URL: ${movieUrl}`);
  
  try {
    const response = await fetch(movieUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const html = await response.text();
      console.log(`HTML Length: ${html.length}`);
      
      // Look for m3u8 URLs
      const m3u8 = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi);
      console.log(`M3U8 URLs found: ${m3u8 ? m3u8.length : 0}`);
      if (m3u8) console.log(`First: ${m3u8[0].substring(0, 80)}...`);
      
      // Look for encoded data
      const encoded = html.match(/[A-Za-z0-9+/=]{200,}/g);
      console.log(`Long encoded strings: ${encoded ? encoded.length : 0}`);
      
      // Look for API endpoints
      const apis = html.match(/fetch\s*\(\s*["']([^"']+)["']/g);
      console.log(`Fetch calls: ${apis ? apis.length : 0}`);
      if (apis) apis.slice(0, 3).forEach(a => console.log(`  ${a}`));
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function testMultiMovies() {
  console.log('\n=== Testing MultiMovies ===');
  
  // Test movie
  console.log('\nMovie (Fight Club):');
  const movieUrl = `https://multimovies.cloud/embed/movie/${TEST_MOVIE_TMDB}`;
  console.log(`URL: ${movieUrl}`);
  
  try {
    const response = await fetch(movieUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const html = await response.text();
      console.log(`HTML Length: ${html.length}`);
      console.log(`Preview: ${html.substring(0, 300)}`);
      
      // Look for m3u8 URLs
      const m3u8 = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi);
      console.log(`M3U8 URLs found: ${m3u8 ? m3u8.length : 0}`);
      
      // Look for encoded data
      const encoded = html.match(/[A-Za-z0-9+/=]{200,}/g);
      console.log(`Long encoded strings: ${encoded ? encoded.length : 0}`);
      if (encoded) console.log(`First (${encoded[0].length} chars): ${encoded[0].substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function testDecryption() {
  console.log('\n=== Testing Decryption API ===');
  
  // Test if enc-dec.app is reachable
  try {
    const response = await fetch('https://enc-dec.app/api/dec-vidstack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test', type: 'smashy' }),
    });
    console.log(`dec-vidstack status: ${response.status}`);
    const data = await response.json();
    console.log(`Response: ${JSON.stringify(data).substring(0, 200)}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('New Source Extractors Test');
  console.log('='.repeat(60));
  
  await testSmashyStream();
  await testMultiMovies();
  await testDecryption();
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
