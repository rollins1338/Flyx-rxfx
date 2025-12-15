/**
 * Validate 111movies m3u8/manifest URL retrieval
 */

const puppeteer = require('puppeteer');
const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://111movies.com/',
        'Origin': 'https://111movies.com',
        ...headers
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function extractM3U8(tmdbId, type = 'movie', season, episode) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    let streamData = null;
    let sources = [];
    
    page.on('response', async res => {
      const url = res.url();
      
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        try {
          sources = await res.json();
        } catch (e) {}
      }
      
      if (url.includes('fcd552c4') && !url.endsWith('/sr') && res.status() === 200) {
        try {
          const data = await res.json();
          if (data.url) {
            streamData = data;
          }
        } catch (e) {}
      }
    });
    
    const pageUrl = type === 'movie' 
      ? `https://111movies.com/movie/${tmdbId}`
      : `https://111movies.com/tv/${tmdbId}/${season}/${episode}`;
    
    await page.goto(pageUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    return { streamData, sources };
    
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== VALIDATING 111MOVIES M3U8 RETRIEVAL ===\n');
  
  // Test 1: Movie
  console.log('Test 1: Movie (The Dark Knight - TMDB 155)');
  console.log('─'.repeat(50));
  
  const movieResult = await extractM3U8('155', 'movie');
  
  if (movieResult.streamData) {
    console.log('✓ Stream URL retrieved');
    console.log(`  URL: ${movieResult.streamData.url.substring(0, 80)}...`);
    console.log(`  Sources available: ${movieResult.sources.length}`);
    console.log(`  Subtitles: ${movieResult.streamData.tracks?.length || 0}`);
    
    // Validate the m3u8 URL
    console.log('\n  Validating m3u8...');
    try {
      const m3u8Response = await fetchUrl(movieResult.streamData.url);
      console.log(`  M3U8 Status: ${m3u8Response.status}`);
      
      if (m3u8Response.status === 200 && m3u8Response.data.includes('#EXTM3U')) {
        console.log('  ✓ Valid HLS manifest');
        
        // Parse quality options
        const qualities = m3u8Response.data.match(/RESOLUTION=(\d+x\d+)/g);
        if (qualities) {
          console.log(`  Qualities: ${qualities.map(q => q.replace('RESOLUTION=', '')).join(', ')}`);
        }
        
        // Check for variant streams
        const variants = m3u8Response.data.match(/\.m3u8/g);
        console.log(`  Variant streams: ${variants?.length || 0}`);
      } else {
        console.log('  ✗ Invalid m3u8 response');
      }
    } catch (e) {
      console.log(`  ✗ Failed to fetch m3u8: ${e.message}`);
    }
  } else {
    console.log('✗ Failed to retrieve stream URL');
  }
  
  // Test 2: TV Show
  console.log('\n\nTest 2: TV Show (Breaking Bad S1E1 - TMDB 1396)');
  console.log('─'.repeat(50));
  
  const tvResult = await extractM3U8('1396', 'tv', 1, 1);
  
  if (tvResult.streamData) {
    console.log('✓ Stream URL retrieved');
    console.log(`  URL: ${tvResult.streamData.url.substring(0, 80)}...`);
    console.log(`  Sources available: ${tvResult.sources.length}`);
    
    // Validate the m3u8 URL
    console.log('\n  Validating m3u8...');
    try {
      const m3u8Response = await fetchUrl(tvResult.streamData.url);
      console.log(`  M3U8 Status: ${m3u8Response.status}`);
      
      if (m3u8Response.status === 200 && m3u8Response.data.includes('#EXTM3U')) {
        console.log('  ✓ Valid HLS manifest');
        
        const qualities = m3u8Response.data.match(/RESOLUTION=(\d+x\d+)/g);
        if (qualities) {
          console.log(`  Qualities: ${qualities.map(q => q.replace('RESOLUTION=', '')).join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`  ✗ Failed to fetch m3u8: ${e.message}`);
    }
  } else {
    console.log('✗ Failed to retrieve stream URL');
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(50));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(50));
  
  const moviePassed = movieResult.streamData !== null;
  const tvPassed = tvResult.streamData !== null;
  
  console.log(`Movie m3u8 retrieval: ${moviePassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`TV show m3u8 retrieval: ${tvPassed ? '✓ PASS' : '✗ FAIL'}`);
  
  if (moviePassed && tvPassed) {
    console.log('\n✓ All m3u8 retrieval tests passed!');
  } else {
    console.log('\n✗ Some tests failed');
  }
}

main().catch(console.error);
