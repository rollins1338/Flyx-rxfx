// Test the scrapify API with authentication

async function testScrapifyAuth() {
  // From the JS bundle:
  // PLAYER_API_KEY: "moviesapi-player-auth-key-2024-secure"
  // ENCRYPTION_KEY: "moviesapi-secure-encryption-key-2024-v1"
  
  const apiKey = 'moviesapi-player-auth-key-2024-secure';
  const encKey = 'moviesapi-secure-encryption-key-2024-v1';
  
  const testCases = [
    { id: '550', type: 'movie', name: 'Fight Club' },
    { id: '1396', type: 'tv', season: 1, episode: 1, name: 'Breaking Bad S01E01' },
  ];
  
  for (const test of testCases) {
    console.log(`\n=== Testing: ${test.name} ===`);
    
    const url = `https://w1.moviesapi.to/api/scrapify/v1/fetch`;
    const params = new URLSearchParams({
      id: test.id,
      type: test.type,
      ...(test.season && { season: test.season.toString(), episode: test.episode.toString() })
    });
    
    // Try different auth methods
    const authMethods = [
      // Method 1: API key in header
      {
        name: 'X-API-Key header',
        headers: { 'X-API-Key': apiKey }
      },
      // Method 2: Authorization Bearer
      {
        name: 'Authorization Bearer',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      },
      // Method 3: Custom header
      {
        name: 'X-Player-Key header',
        headers: { 'X-Player-Key': apiKey }
      },
      // Method 4: API key in query
      {
        name: 'api_key in query',
        queryParam: `&api_key=${apiKey}`
      },
      // Method 5: key in query
      {
        name: 'key in query',
        queryParam: `&key=${apiKey}`
      },
    ];
    
    for (const auth of authMethods) {
      const fullUrl = `${url}?${params}${auth.queryParam || ''}`;
      console.log(`\nTrying ${auth.name}:`);
      
      try {
        const res = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://w1.moviesapi.to/',
            'Origin': 'https://w1.moviesapi.to',
            ...auth.headers
          }
        });
        
        console.log('Status:', res.status);
        
        if (res.status === 200) {
          const json = await res.json();
          console.log('✓ SUCCESS!');
          console.log(JSON.stringify(json, null, 2).substring(0, 1500));
          break; // Found working method
        } else {
          const text = await res.text();
          console.log('Response:', text.substring(0, 200));
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  }
}

testScrapifyAuth().catch(console.error);
