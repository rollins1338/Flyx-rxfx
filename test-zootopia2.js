// Test Zootopia 2 (TMDB ID 1084242) with MoviesAPI
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'moviesapi-secure-encryption-key-2024-v1';
const PLAYER_API_KEY = 'moviesapi-player-auth-key-2024-secure';
const SCRAPIFY_URL = 'https://w1.moviesapi.to/api/scrapify';

const SOURCES = [
  { name: 'Beta', source: 'fmovies' },
  { name: 'Orion', source: 'm4uhd' },
  { name: 'Apollo', source: 'sflix2', srv: '0' },
  { name: 'Alpha', source: 'sflix2', srv: '1' },
  { name: 'Nexon', source: 'bmovies' },
  { name: 'Pulsar', source: 'embed69' },
  { name: 'Nova', source: 'warezcdn' },
  { name: 'Zenith', source: 'hianime' },
  { name: 'Titan', source: '1movies' },
  { name: 'Vega', source: 'insertunit' },
  { name: 'Cosmos', source: 'moviebox' },
  { name: 'Stellar', source: 'primewire' },
  { name: 'Galaxy', source: 'allmovieland' },
];

async function testZootopia2() {
  const tmdbId = '1084242';
  console.log('Testing Zootopia 2 (TMDB ID: 1084242) with ALL MoviesAPI sources\n');
  
  for (const src of SOURCES) {
    const payload = {
      source: src.source,
      type: 'movie',
      id: tmdbId,
      ...(src.srv && { srv: src.srv })
    };
    
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://w1.moviesapi.to/',
          'Origin': 'https://w1.moviesapi.to'
        },
        body: JSON.stringify({ payload: encrypted })
      });
      
      if (res.status === 200) {
        const json = await res.json();
        let url = json.sources?.[0]?.url || json.url;
        
        if (url) {
          if (src.name === 'Apollo' || src.name === 'Nexon') {
            url = `https://ax.1hd.su/${url.replace(/^https?:\/\//, '')}`;
          } else if (src.name === 'Alpha') {
            url = `https://xd.flix1.online/${url.replace(/^https?:\/\//, '')}`;
          }
          
          // Check accessibility
          try {
            const check = await fetch(url, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://w1.moviesapi.to/' }
            });
            
            if (check.ok) {
              console.log(`✅ ${src.name} (${src.source}): WORKING!`);
              console.log(`   URL: ${url}`);
              return;
            } else {
              console.log(`⚠️  ${src.name} (${src.source}): URL blocked (${check.status})`);
            }
          } catch (e) {
            console.log(`⚠️  ${src.name} (${src.source}): Check failed - ${e.message}`);
          }
        } else {
          console.log(`❌ ${src.name} (${src.source}): No URL in response`);
        }
      } else {
        console.log(`❌ ${src.name} (${src.source}): ${res.status}`);
      }
    } catch (e) {
      console.log(`❌ ${src.name} (${src.source}): ${e.message}`);
    }
  }
  
  console.log('\n❌ No working source found on MoviesAPI for Zootopia 2');
}

testZootopia2().catch(console.error);
