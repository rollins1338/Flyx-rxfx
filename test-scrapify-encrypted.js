// Test the scrapify API with proper encryption
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'moviesapi-secure-encryption-key-2024-v1';
const PLAYER_API_KEY = 'moviesapi-player-auth-key-2024-secure';
const SCRAPIFY_URL = 'https://w1.moviesapi.to/api/scrapify';

async function testScrapify() {
  const testCases = [
    { id: '550', type: 'movie', source: 'Apollo', name: 'Fight Club' },
    { id: '1396', type: 'tv', season: 1, episode: 1, source: 'Apollo', name: 'Breaking Bad S01E01' },
  ];
  
  // Try different sources mentioned in the code
  const sources = ['Apollo', 'Nexon', 'Alpha', 'vidsrc', 'vidora'];
  
  for (const test of testCases) {
    console.log(`\n=== Testing: ${test.name} ===`);
    
    for (const source of sources) {
      console.log(`\nTrying source: ${source}`);
      
      // Build the payload
      const payload = {
        source: source,
        type: test.type,
        id: test.id,
        ...(test.type === 'tv' && { season: test.season, episode: test.episode })
      };
      
      console.log('Payload:', JSON.stringify(payload));
      
      // Encrypt the payload
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(payload),
        ENCRYPTION_KEY
      ).toString();
      
      console.log('Encrypted:', encrypted.substring(0, 50) + '...');
      
      try {
        const res = await fetch(`${SCRAPIFY_URL}/v1/fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-key': PLAYER_API_KEY,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://w1.moviesapi.to/',
            'Origin': 'https://w1.moviesapi.to'
          },
          body: JSON.stringify({ payload: encrypted })
        });
        
        console.log('Status:', res.status);
        
        if (res.status === 200) {
          const json = await res.json();
          console.log('✓ SUCCESS!');
          console.log(JSON.stringify(json, null, 2).substring(0, 2000));
          
          // Check for stream URL
          if (json.url) {
            console.log('\n✓ STREAM URL:', json.url);
          }
          if (json.sources && json.sources[0]) {
            console.log('\n✓ STREAM URL:', json.sources[0].url);
          }
          break; // Found working source
        } else {
          const text = await res.text();
          console.log('Response:', text.substring(0, 300));
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  }
}

testScrapify().catch(console.error);
