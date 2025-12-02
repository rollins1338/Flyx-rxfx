// Test Troll 2 (TMDB ID 1180831) with ALL MoviesAPI sources
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'moviesapi-secure-encryption-key-2024-v1';
const PLAYER_API_KEY = 'moviesapi-player-auth-key-2024-secure';
const SCRAPIFY_URL = 'https://w1.moviesapi.to/api/scrapify';

// ALL possible sources from the JS bundle
const SOURCES = [
  { name: 'Orion', source: 'm4uhd' },
  { name: 'Beta', source: 'fmovies' },
  { name: 'Apollo', source: 'sflix2', srv: '0' },
  { name: 'Alpha', source: 'sflix2', srv: '1' },
  { name: 'Nexon', source: 'bmovies' },
  { name: 'Zenith', source: 'hianime' },
  { name: 'Titan', source: '1movies' },
  { name: 'Vega', source: 'insertunit' },
  { name: 'Cosmos', source: 'moviebox' },
  { name: 'Stellar', source: 'primewire' },
  { name: 'Galaxy', source: 'allmovieland' },
  { name: 'Pulsar', source: 'embed69' },
  { name: 'Nova', source: 'warezcdn' },
];

async function testMovie(tmdbId, name) {
  console.log(`\nTesting ${name} (TMDB ID: ${tmdbId}) with ALL sources\n`);
  console.log('='.repeat(60));
  
  const results = [];
  
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
          // Transform URL based on source
          let originalUrl = url;
          if (src.name === 'Apollo' || src.name === 'Nexon') {
            url = `https://ax.1hd.su/${url.replace(/^https?:\/\//, '')}`;
          } else if (src.name === 'Alpha') {
            url = `https://xd.flix1.online/${url.replace(/^https?:\/\//, '')}`;
          }
          
          // Check accessibility
          try {
            const check = await fetch(url, {
              method: 'HEAD',
              headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://w1.moviesapi.to/' 
              }
            });
            
            results.push({
              source: src.name,
              backend: src.source,
              status: check.status,
              working: check.ok,
              url: url.substring(0, 80) + '...'
            });
            
            if (check.ok) {
              console.log(`✅ ${src.name} (${src.source}): WORKING (${check.status})`);
            } else {
              console.log(`⚠️  ${src.name} (${src.source}): URL returned but blocked (${check.status})`);
            }
          } catch (e) {
            console.log(`⚠️  ${src.name} (${src.source}): URL returned but check failed`);
            results.push({ source: src.name, backend: src.source, status: 'error', working: false });
          }
        } else {
          console.log(`❌ ${src.name} (${src.source}): No URL in response`);
          results.push({ source: src.name, backend: src.source, status: 'no_url', working: false });
        }
      } else {
        console.log(`❌ ${src.name} (${src.source}): HTTP ${res.status}`);
        results.push({ source: src.name, backend: src.source, status: res.status, working: false });
      }
    } catch (e) {
      console.log(`❌ ${src.name} (${src.source}): ${e.message}`);
      results.push({ source: src.name, backend: src.source, status: 'error', working: false });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  const working = results.filter(r => r.working);
  console.log(`\nWorking sources: ${working.length}/${results.length}`);
  if (working.length > 0) {
    console.log('Working:', working.map(w => w.source).join(', '));
  }
  
  return results;
}

async function main() {
  // Test Troll 2
  await testMovie('1180831', 'Troll 2');
  
  // Also test Zootopia 2 for comparison
  console.log('\n\n');
  await testMovie('1084242', 'Zootopia 2');
}

main().catch(console.error);
