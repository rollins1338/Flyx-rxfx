/**
 * Test Videasy API Endpoints
 * Discover what endpoints are available
 */

const VIDEASY_API = 'https://api.videasy.net';
const DECRYPTION_API = 'https://enc-dec.app/api';

// Test content
const TEST_MOVIE = { tmdbId: '550', title: 'Fight Club', year: '1999' };
const TEST_TV = { tmdbId: '1396', title: 'Breaking Bad', year: '2008', season: 1, episode: 1 };

// Known working endpoints from videasy-extractor.ts
const KNOWN_ENDPOINTS = [
  'myflixerzupcloud',
  '1movies',
  'moviebox',
  'cdn',
  'primewire',
  'onionplay',
  'm4uhd',
  'hdmovie',
  'meine',
  'cuevana-latino',
  'cuevana-spanish',
  'superflix',
  'overflix',
  'visioncine',
];

// Potential new endpoints to test (based on enc-dec.app docs)
const POTENTIAL_ENDPOINTS = [
  // Vidstack related
  'smashystream',
  'smashy',
  'multimovies',
  'multi',
  'cloudy',
  'vidstack',
  // XPrime related
  'xprime',
  'prime',
  // Hexa related
  'hexa',
  'flixer',
  // Other potential sources
  'vidsrc',
  'embed',
  'player',
  '2embed',
  'autoembed',
  'moviesapi',
  'gomovies',
  'fmovies',
  '123movies',
  'putlocker',
  'soap2day',
  'yesmovies',
  'solarmovie',
  'popcorntime',
  'streamlord',
  'watchseries',
  'couchtuner',
  'projectfreetv',
];

async function testEndpoint(endpoint, content, type = 'movie') {
  const url = type === 'movie'
    ? `${VIDEASY_API}/${endpoint}/sources-with-title?title=${encodeURIComponent(content.title)}&mediaType=movie&year=${content.year}&tmdbId=${content.tmdbId}`
    : `${VIDEASY_API}/${endpoint}/sources-with-title?title=${encodeURIComponent(content.title)}&mediaType=tv&year=${content.year}&tmdbId=${content.tmdbId}&seasonId=${content.season}&episodeId=${content.episode}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { endpoint, status: response.status, success: false };
    }

    const text = await response.text();
    
    if (!text || text.trim() === '' || text.includes('error') || text.includes('Error') || text.length < 50) {
      return { endpoint, status: response.status, success: false, reason: 'empty/error response' };
    }

    // Try to decrypt
    const decryptResponse = await fetch(`${DECRYPTION_API}/dec-videasy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, id: content.tmdbId }),
    });

    if (decryptResponse.ok) {
      const json = await decryptResponse.json();
      if (json.result) {
        let result = json.result;
        if (typeof result === 'string') {
          try { result = JSON.parse(result); } catch {}
        }
        
        if (result.sources && result.sources.length > 0) {
          const streamUrl = result.sources[0].url || result.sources[0].file;
          if (streamUrl) {
            return { 
              endpoint, 
              status: response.status, 
              success: true, 
              streamUrl: streamUrl.substring(0, 60) + '...',
              encryptedLength: text.length,
            };
          }
        }
      }
    }

    return { endpoint, status: response.status, success: false, reason: 'decrypt failed', encryptedLength: text.length };
  } catch (error) {
    return { endpoint, status: 'error', success: false, reason: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Videasy API Endpoint Discovery');
  console.log('='.repeat(60));

  // Test known endpoints first
  console.log('\n### KNOWN ENDPOINTS (Movie) ###\n');
  for (const endpoint of KNOWN_ENDPOINTS) {
    const result = await testEndpoint(endpoint, TEST_MOVIE, 'movie');
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${endpoint}: ${result.success ? result.streamUrl : result.reason || `HTTP ${result.status}`}`);
    await new Promise(r => setTimeout(r, 500));
  }

  // Test potential new endpoints
  console.log('\n### POTENTIAL NEW ENDPOINTS (Movie) ###\n');
  const working = [];
  
  for (const endpoint of POTENTIAL_ENDPOINTS) {
    const result = await testEndpoint(endpoint, TEST_MOVIE, 'movie');
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${endpoint}: ${result.success ? result.streamUrl : result.reason || `HTTP ${result.status}`}`);
    
    if (result.success) {
      working.push(endpoint);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nNew working endpoints found: ${working.length}`);
  if (working.length > 0) {
    console.log('Endpoints:', working.join(', '));
  }
}

main().catch(console.error);
