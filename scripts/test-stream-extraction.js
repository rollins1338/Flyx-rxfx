/**
 * Test Stream Extraction - MoviesAPI (primary) with 2Embed fallback
 * 
 * Tests multiple movies and TV shows to verify extraction works
 */

const testCases = [
  // Movies
  { tmdbId: '550', type: 'movie', name: 'Fight Club (1999)' },
  { tmdbId: '157336', type: 'movie', name: 'Interstellar (2014)' },
  { tmdbId: '238', type: 'movie', name: 'The Godfather (1972)' },
  { tmdbId: '680', type: 'movie', name: 'Pulp Fiction (1994)' },
  { tmdbId: '155', type: 'movie', name: 'The Dark Knight (2008)' },
  
  // TV Shows
  { tmdbId: '1396', type: 'tv', season: 1, episode: 1, name: 'Breaking Bad S01E01' },
  { tmdbId: '1399', type: 'tv', season: 1, episode: 1, name: 'Game of Thrones S01E01' },
  { tmdbId: '60059', type: 'tv', season: 1, episode: 1, name: 'Better Call Saul S01E01' },
  { tmdbId: '94605', type: 'tv', season: 1, episode: 1, name: 'Arcane S01E01' },
  { tmdbId: '84958', type: 'tv', season: 1, episode: 1, name: 'Loki S01E01' },
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testExtraction(testCase) {
  const { tmdbId, type, season, episode, name } = testCase;
  
  let url = `${BASE_URL}/api/stream/extract?tmdbId=${tmdbId}&type=${type}`;
  if (type === 'tv') {
    url += `&season=${season}&episode=${episode}`;
  }
  
  console.log(`\n📽️  Testing: ${name}`);
  console.log(`   URL: ${url}`);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const elapsed = Date.now() - startTime;
    
    if (data.success) {
      console.log(`   ✅ SUCCESS (${elapsed}ms)`);
      console.log(`   Provider: ${data.provider}`);
      console.log(`   Sources: ${data.sources?.length || 0}`);
      if (data.sources?.[0]) {
        console.log(`   First source: ${data.sources[0].quality}`);
      }
      return { success: true, provider: data.provider, elapsed, name };
    } else {
      console.log(`   ❌ FAILED (${elapsed}ms)`);
      console.log(`   Error: ${data.error}`);
      console.log(`   Details: ${data.details || 'N/A'}`);
      return { success: false, error: data.error, elapsed, name };
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`   ❌ ERROR (${elapsed}ms)`);
    console.log(`   ${error.message}`);
    return { success: false, error: error.message, elapsed, name };
  }
}

async function runTests() {
  console.log('🎬 Stream Extraction Test Suite');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Testing ${testCases.length} titles...\n`);
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testExtraction(testCase);
    results.push(result);
    
    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('==========');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Passed: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    const moviesApiCount = successful.filter(r => r.provider === 'moviesapi').length;
    const embedCount = successful.filter(r => r.provider === '2embed').length;
    console.log(`\nProvider breakdown:`);
    console.log(`   MoviesAPI (primary): ${moviesApiCount}`);
    console.log(`   2Embed (fallback): ${embedCount}`);
    
    const avgTime = Math.round(successful.reduce((a, b) => a + b.elapsed, 0) / successful.length);
    console.log(`\nAverage extraction time: ${avgTime}ms`);
  }
  
  if (failed.length > 0) {
    console.log('\nFailed titles:');
    failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
  }
  
  console.log('\n');
}

runTests().catch(console.error);
