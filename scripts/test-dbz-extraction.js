/**
 * Test Dragon Ball Z extraction flow - simulates what the API does
 * Uses the local API endpoint
 */
const http = require('http');

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? require('https') : http;
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { 
        try { resolve(JSON.parse(data)); } 
        catch(e) { resolve({ error: e.message, raw: data.substring(0, 500) }); } 
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Dragon Ball Z S5E1 Extraction Test ===\n');
  
  // Dragon Ball Z TMDB ID: 12971
  // Season 5, Episode 1
  const tmdbId = '12971';
  const season = 5;
  const episode = 1;
  
  // Test the local API
  const apiUrl = `http://localhost:3000/api/stream/extract?tmdbId=${tmdbId}&type=tv&season=${season}&episode=${episode}&provider=animekai`;
  
  console.log(`Calling: ${apiUrl}\n`);
  
  try {
    const result = await fetchJson(apiUrl);
    
    if (result.error) {
      console.log('ERROR:', result.error);
      console.log('Details:', result.details || result.raw);
    } else if (result.success) {
      console.log('SUCCESS!');
      console.log('Provider:', result.provider);
      console.log('Sources:', result.sources?.length || 0);
      if (result.sources && result.sources[0]) {
        console.log('First source:', result.sources[0].title);
        console.log('URL:', result.sources[0].url?.substring(0, 100) + '...');
      }
    } else {
      console.log('FAILED:', result);
    }
  } catch (e) {
    console.log('Request failed:', e.message);
    console.log('\nMake sure the dev server is running: npm run dev');
  }
}

main().catch(console.error);
