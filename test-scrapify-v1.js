// Test the scrapify v1 API

async function testScrapify() {
  // The API is at /api/scrapify/v1/fetch
  // It's a relative URL, so the full URL would be on the same domain
  
  const testCases = [
    // TV Show - Breaking Bad S01E01
    { id: '1396', type: 'tv', season: 1, episode: 1, name: 'Breaking Bad S01E01' },
    // Movie - Fight Club
    { id: '550', type: 'movie', name: 'Fight Club' },
  ];
  
  for (const test of testCases) {
    console.log(`\n=== Testing: ${test.name} ===`);
    
    // Try different URL patterns
    const urls = [
      `https://w1.moviesapi.to/api/scrapify/v1/fetch?id=${test.id}&type=${test.type}${test.season ? `&season=${test.season}&episode=${test.episode}` : ''}`,
      `https://moviesapi.to/api/scrapify/v1/fetch?id=${test.id}&type=${test.type}${test.season ? `&season=${test.season}&episode=${test.episode}` : ''}`,
    ];
    
    for (const url of urls) {
      console.log('\nTrying:', url);
      
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://w1.moviesapi.to/',
            'Origin': 'https://w1.moviesapi.to',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
          }
        });
        
        console.log('Status:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));
        
        const text = await res.text();
        
        // Try to parse as JSON
        try {
          const json = JSON.parse(text);
          console.log('JSON Response:');
          console.log(JSON.stringify(json, null, 2).substring(0, 2000));
          
          // Check for stream URL
          if (json.url || json.stream || json.source || json.sources) {
            console.log('\n✓ FOUND STREAM DATA!');
          }
        } catch (e) {
          console.log('Response (not JSON):', text.substring(0, 500));
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  }
  
  // Also try POST request
  console.log('\n\n=== Trying POST request ===');
  const postUrl = 'https://w1.moviesapi.to/api/scrapify/v1/fetch';
  const postBody = { id: '550', type: 'movie' };
  
  try {
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': 'https://w1.moviesapi.to/',
        'Origin': 'https://w1.moviesapi.to'
      },
      body: JSON.stringify(postBody)
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 1000));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testScrapify().catch(console.error);
