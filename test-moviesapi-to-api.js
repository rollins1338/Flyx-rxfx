// Debug moviesapi.to API extraction

async function testMoviesApiToApi() {
  // Try different API endpoints
  const endpoints = [
    'https://w1.moviesapi.to/api/tv/1396/1/1',
    'https://moviesapi.to/api/tv/1396/1/1',
    'https://w1.moviesapi.to/api/v1/tv/1396/1/1',
    'https://moviesapi.to/tv/1396/1/1',
  ];
  
  for (const url of endpoints) {
    console.log('\nTrying:', url);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://moviesapi.club/',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      
      const text = await res.text();
      console.log('Status:', res.status);
      console.log('Content-Type:', res.headers.get('content-type'));
      console.log('Response preview:', text.substring(0, 500));
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(text);
        console.log('JSON parsed:', JSON.stringify(json, null, 2).substring(0, 1000));
      } catch (e) {
        // Not JSON
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  
  // Also try fetching the JS bundle to find API patterns
  console.log('\n--- Checking JS bundle ---');
  const jsUrl = 'https://w1.moviesapi.to/assets/index-BHd4R3tU.js';
  try {
    const jsRes = await fetch(jsUrl);
    const jsText = await jsRes.text();
    console.log('JS bundle size:', jsText.length);
    
    // Look for API patterns
    const apiPatterns = [
      /api\/[^"'\s]+/g,
      /fetch\s*\(\s*["']([^"']+)["']/g,
      /\.m3u8/g,
      /hls/gi,
      /stream/gi
    ];
    
    for (const pattern of apiPatterns) {
      const matches = jsText.match(pattern);
      if (matches && matches.length < 20) {
        console.log(`\nPattern ${pattern.source}:`, matches.slice(0, 10));
      } else if (matches) {
        console.log(`\nPattern ${pattern.source}: ${matches.length} matches`);
      }
    }
    
    // Look for specific URL patterns
    const urlMatch = jsText.match(/https?:\/\/[^"'\s]+(?:api|stream|hls)[^"'\s]*/gi);
    if (urlMatch) {
      console.log('\nURL patterns found:');
      [...new Set(urlMatch)].slice(0, 20).forEach(u => console.log('  -', u));
    }
  } catch (e) {
    console.log('JS fetch error:', e.message);
  }
}

testMoviesApiToApi().catch(console.error);
