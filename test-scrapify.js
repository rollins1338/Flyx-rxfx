// Debug moviesapi.to scrapify API

async function testScrapify() {
  // Try the scrapify endpoint with different params
  const endpoints = [
    'https://moviesapi.to/api/scrapify?id=1396&s=1&e=1&type=tv',
    'https://moviesapi.to/api/scrapify?tmdb=1396&season=1&episode=1',
    'https://moviesapi.to/api/scrapify?id=1396&season=1&episode=1',
    'https://w1.moviesapi.to/api/scrapify?id=1396&s=1&e=1',
    'https://moviesapi.to/api/scrapify?id=550&type=movie',
    'https://moviesapi.to/api/scrapify?id=550',
  ];
  
  for (const url of endpoints) {
    console.log('\n---');
    console.log('Trying:', url);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://w1.moviesapi.to/',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://w1.moviesapi.to'
        }
      });
      
      const text = await res.text();
      console.log('Status:', res.status);
      console.log('Content-Type:', res.headers.get('content-type'));
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(text);
        console.log('JSON:', JSON.stringify(json, null, 2).substring(0, 2000));
      } catch (e) {
        console.log('Response:', text.substring(0, 500));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
  
  // Also check the primewire endpoint
  console.log('\n\n=== Checking primewire endpoint ===');
  const primewireUrl = 'https://ww2.moviesapi.to/primewire_tf1.php?id=1396';
  try {
    const res = await fetch(primewireUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://w1.moviesapi.to/'
      }
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text.substring(0, 1000));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testScrapify().catch(console.error);
