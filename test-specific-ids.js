// Test specific TMDB IDs with MoviesAPI directly
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'moviesapi-secure-encryption-key-2024-v1';
const PLAYER_API_KEY = 'moviesapi-player-auth-key-2024-secure';
const SCRAPIFY_URL = 'https://w1.moviesapi.to/api/scrapify';

// Your specific TMDB IDs
const TEST_IDS = [
  { id: '118083', type: 'movie', name: 'ID 118083' },
  { id: '110842', type: 'movie', name: 'ID 110842' },
  { id: '421363', type: 'movie', name: 'ID 421363' },
  { id: '123', type: 'movie', name: 'ID 123' },
];

const SOURCES = [
  { name: 'Beta', source: 'fmovies' },
  { name: 'Orion', source: 'm4uhd' },
  { name: 'Apollo', source: 'sflix2', srv: '0' },
  { name: 'Alpha', source: 'sflix2', srv: '1' },
  { name: 'Nexon', source: 'bmovies' },
];

async function testId(test) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing TMDB ID: ${test.id} (${test.name})`);
  console.log('='.repeat(60));
  
  for (const src of SOURCES) {
    const payload = {
      source: src.source,
      type: test.type,
      id: test.id,
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
          // Transform URL
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
              console.log(`✅ ${src.name}: WORKING (${check.status})`);
              console.log(`   URL: ${url.substring(0, 80)}...`);
              return { success: true, source: src.name, url };
            } else {
              console.log(`⚠️  ${src.name}: Got URL but blocked (${check.status})`);
            }
          } catch (e) {
            console.log(`⚠️  ${src.name}: Got URL but check failed`);
          }
        } else {
          console.log(`❌ ${src.name}: No URL in response`);
        }
      } else {
        const text = await res.text();
        console.log(`❌ ${src.name}: ${res.status} - ${text.substring(0, 50)}`);
      }
    } catch (e) {
      console.log(`❌ ${src.name}: Error - ${e.message}`);
    }
  }
  
  return { success: false };
}

async function main() {
  console.log('Testing specific TMDB IDs with MoviesAPI\n');
  
  const results = [];
  for (const test of TEST_IDS) {
    const result = await testId(test);
    results.push({ ...test, ...result });
  }
  
  console.log('\n\n📊 RESULTS SUMMARY');
  console.log('==================');
  results.forEach(r => {
    console.log(`${r.id}: ${r.success ? `✅ ${r.source}` : '❌ FAILED'}`);
  });
}

main().catch(console.error);
