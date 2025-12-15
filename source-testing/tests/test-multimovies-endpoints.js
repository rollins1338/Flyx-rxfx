/**
 * Test MultiMovies and MultiEmbed endpoints for bypass opportunities
 */

async function main() {
  console.log('=== TESTING MULTIMOVIES ENDPOINTS ===\n');
  
  const tmdbId = '155'; // The Dark Knight
  const imdbId = 'tt0468569';
  
  // MultiMovies endpoints
  const multiMoviesEndpoints = [
    `https://multimovies.cloud/embed/movie/${tmdbId}`,
    `https://multimovies.cloud/embed/movie/${imdbId}`,
    `https://multimovies.cloud/api/movie/${tmdbId}`,
    `https://multimovies.cloud/api/sources/${tmdbId}`,
    `https://multimovies.cloud/sources/${tmdbId}`,
    `https://multimovies.cloud/stream/${tmdbId}`,
    `https://multimovies.cloud/player/${tmdbId}`,
  ];
  
  for (const url of multiMoviesEndpoints) {
    console.log(`\n${url}`);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://multimovies.cloud/',
        }
      });
      
      console.log(`  Status: ${resp.status}`);
      const text = await resp.text();
      console.log(`  Length: ${text.length}`);
      console.log(`  Has m3u8: ${text.includes('m3u8')}`);
      console.log(`  Has mp4: ${text.includes('.mp4')}`);
      console.log(`  Has sources: ${text.includes('sources')}`);
      
      // Check if JSON
      if (text.startsWith('{') || text.startsWith('[')) {
        console.log('  JSON response');
        try {
          const json = JSON.parse(text);
          console.log(`  Keys: ${Object.keys(json).slice(0, 10).join(', ')}`);
        } catch (e) {}
      }
      
      // Look for script data
      if (text.includes('<script')) {
        const scriptCount = (text.match(/<script/g) || []).length;
        console.log(`  Script tags: ${scriptCount}`);
      }
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log('\n\n=== TESTING CLOUDY.LOL ===\n');
  
  const cloudyEndpoints = [
    `https://cloudy.lol/embed/movie/${tmdbId}`,
    `https://cloudy.lol/api/movie/${tmdbId}`,
    `https://cloudy.lol/sources/${tmdbId}`,
  ];
  
  for (const url of cloudyEndpoints) {
    console.log(`\n${url}`);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://cloudy.lol/',
        }
      });
      
      console.log(`  Status: ${resp.status}`);
      const text = await resp.text();
      console.log(`  Length: ${text.length}`);
      console.log(`  Has m3u8: ${text.includes('m3u8')}`);
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log('\n\n=== TESTING XPRIME.TV ===\n');
  
  const xprimeEndpoints = [
    `https://xprime.tv/embed/movie/${tmdbId}`,
    `https://xprime.tv/api/movie/${tmdbId}`,
    `https://xprime.tv/sources/${tmdbId}`,
  ];
  
  for (const url of xprimeEndpoints) {
    console.log(`\n${url}`);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://xprime.tv/',
        }
      });
      
      console.log(`  Status: ${resp.status}`);
      const text = await resp.text();
      console.log(`  Length: ${text.length}`);
      console.log(`  Has m3u8: ${text.includes('m3u8')}`);
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log('\n\n=== TESTING HEXA.WATCH ===\n');
  
  const hexaEndpoints = [
    `https://hexa.watch/embed/movie/${tmdbId}`,
    `https://hexa.watch/api/movie/${tmdbId}`,
  ];
  
  for (const url of hexaEndpoints) {
    console.log(`\n${url}`);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://hexa.watch/',
        }
      });
      
      console.log(`  Status: ${resp.status}`);
      const text = await resp.text();
      console.log(`  Length: ${text.length}`);
      console.log(`  Has m3u8: ${text.includes('m3u8')}`);
      
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
