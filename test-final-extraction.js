// Final test of stream extraction with MoviesAPI primary + 2Embed fallback

const BASE_URL = 'http://localhost:3000';

const testCases = [
  // NEW/Recent Movies (2024-2025)
  { tmdbId: '1084242', type: 'movie', name: 'Zootopia 2 (2025)' },
  { tmdbId: '1064028', type: 'movie', name: 'Wicked (2024)' },
  { tmdbId: '912649', type: 'movie', name: 'Venom: The Last Dance (2024)' },
  { tmdbId: '533535', type: 'movie', name: 'Deadpool & Wolverine (2024)' },
  { tmdbId: '1022789', type: 'movie', name: 'Inside Out 2 (2024)' },
  
  // Classic Movies
  { tmdbId: '550', type: 'movie', name: 'Fight Club (1999)' },
  { tmdbId: '157336', type: 'movie', name: 'Interstellar (2014)' },
  { tmdbId: '155', type: 'movie', name: 'The Dark Knight (2008)' },
  
  // TV Shows
  { tmdbId: '1396', type: 'tv', season: 1, episode: 1, name: 'Breaking Bad S01E01' },
  { tmdbId: '94605', type: 'tv', season: 1, episode: 1, name: 'Arcane S01E01' },
  { tmdbId: '84958', type: 'tv', season: 1, episode: 1, name: 'Loki S01E01' },
  { tmdbId: '136315', type: 'tv', season: 1, episode: 1, name: 'The Bear S01E01' },
];

async function testExtraction(testCase) {
  const { tmdbId, type, season, episode, name } = testCase;
  
  let url = `${BASE_URL}/api/stream/extract?tmdbId=${tmdbId}&type=${type}`;
  if (type === 'tv') {
    url += `&season=${season}&episode=${episode}`;
  }
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    const elapsed = Date.now() - startTime;
    
    if (data.success) {
      return { 
        success: true, 
        provider: data.provider, 
        elapsed, 
        name,
        sources: data.sources?.length || 0
      };
    } else {
      return { 
        success: false, 
        error: data.error, 
        elapsed, 
        name 
      };
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    return { 
      success: false, 
      error: error.message, 
      elapsed, 
      name 
    };
  }
}

async function runTests() {
  console.log('🎬 Stream Extraction Test - MoviesAPI Primary + 2Embed Fallback');
  console.log('================================================================\n');
  
  const results = [];
  
  for (const testCase of testCases) {
    process.stdout.write(`Testing: ${testCase.name}... `);
    const result = await testExtraction(testCase);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.provider} (${result.elapsed}ms)`);
    } else {
      console.log(`❌ ${result.error} (${result.elapsed}ms)`);
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
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
