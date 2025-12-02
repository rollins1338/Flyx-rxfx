// Test the scrapify API with REAL source names
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'moviesapi-secure-encryption-key-2024-v1';
const PLAYER_API_KEY = 'moviesapi-player-auth-key-2024-secure';
const SCRAPIFY_URL = 'https://w1.moviesapi.to/api/scrapify';

// Real source mappings from the JS bundle:
// {name:"Apollo",source:"sflix2",srv:"0"}
// {name:"Alpha",source:"sflix2",srv:"1"}
// {name:"Orion",source:"m4uhd"}
// {name:"Beta",source:"fmovies"}
// {name:"Nexon",source:"bmovies"}
// {name:"Zenith",source:"hianime"}
// {name:"Pulsar",source:"embed69"}
// {name:"Nova",source:"warezcdn"}

const SOURCES = [
  { name: 'Apollo', source: 'sflix2', srv: '0' },
  { name: 'Alpha', source: 'sflix2', srv: '1' },
  { name: 'Orion', source: 'm4uhd' },
  { name: 'Beta', source: 'fmovies' },
  { name: 'Nexon', source: 'bmovies' },
  { name: 'Pulsar', source: 'embed69' },
  { name: 'Nova', source: 'warezcdn' },
];

async function testScrapify() {
  const testCases = [
    { id: '550', type: 'movie', name: 'Fight Club' },
    { id: '1396', type: 'tv', season: 1, episode: 1, name: 'Breaking Bad S01E01' },
  ];
  
  for (const test of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${test.name}`);
    console.log('='.repeat(60));
    
    for (const src of SOURCES) {
      console.log(`\n--- ${src.name} (${src.source}) ---`);
      
      // Build the payload exactly like the frontend does
      const payload = {
        source: src.source,
        type: test.type,
        id: test.id,
        ...(test.type === 'tv' && { season: test.season, episode: test.episode }),
        ...(src.srv && { srv: src.srv })
      };
      
      // Encrypt the payload
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(payload),
        ENCRYPTION_KEY
      ).toString();
      
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
        
        if (res.status === 200) {
          const json = await res.json();
          
          let streamUrl = '';
          if (json.sources && json.sources[0]) {
            streamUrl = json.sources[0].url;
          } else if (json.url) {
            streamUrl = json.url;
          }
          
          if (streamUrl) {
            // Apply URL transformations like the frontend does
            if (src.name === 'Apollo' || src.name === 'Nexon') {
              streamUrl = streamUrl.replace(/^https?:\/\//, '');
              streamUrl = `https://ax.1hd.su/${streamUrl}`;
            } else if (src.name === 'Alpha') {
              streamUrl = streamUrl.replace(/^https?:\/\//, '');
              streamUrl = `https://xd.flix1.online/${streamUrl}`;
            }
            
            console.log('✓ SUCCESS!');
            console.log('Stream URL:', streamUrl);
            
            // Check if the stream is accessible
            try {
              const streamRes = await fetch(streamUrl, {
                method: 'HEAD',
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Referer': 'https://w1.moviesapi.to/'
                }
              });
              console.log('Stream status:', streamRes.status);
            } catch (e) {
              console.log('Stream check failed:', e.message);
            }
          } else {
            console.log('No URL in response:', JSON.stringify(json).substring(0, 200));
          }
        } else {
          const text = await res.text();
          console.log(`Status ${res.status}:`, text.substring(0, 100));
        }
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  }
}

testScrapify().catch(console.error);
