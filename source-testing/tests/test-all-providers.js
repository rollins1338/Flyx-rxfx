/**
 * Test All Stream Providers
 * Tests each provider individually to verify they work
 */

const TEST_MOVIE = { tmdbId: '550', title: 'Fight Club' }; // Fight Club
const TEST_TV = { tmdbId: '1396', title: 'Breaking Bad', season: 1, episode: 1 };

// Base URL - change this if testing locally vs deployed
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const PROVIDERS = [
  'vidsrc',
  'videasy', 
  '1movies',
  'smashystream',
  'multimovies',
  'multiembed',
];

async function testProvider(provider, content, type) {
  const params = new URLSearchParams({
    tmdbId: content.tmdbId,
    type: type,
    provider: provider,
  });
  
  if (type === 'tv') {
    params.set('season', content.season.toString());
    params.set('episode', content.episode.toString());
  }

  const url = `${BASE_URL}/api/stream/extract?${params}`;
  
  console.log(`\n[${provider.toUpperCase()}] Testing ${type}: ${content.title}`);
  console.log(`  URL: ${url}`);
  
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    const elapsed = Date.now() - startTime;
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.log(`  ✗ HTTP ${response.status} (${elapsed}ms)`);
      console.log(`  Error: ${error.error || error.details || 'Unknown'}`);
      return { provider, type, success: false, status: response.status, error: error.error, time: elapsed };
    }
    
    const data = await response.json();
    
    if (data.success && data.sources && data.sources.length > 0) {
      const workingSources = data.sources.filter(s => s.status === 'working');
      console.log(`  ✓ SUCCESS (${elapsed}ms)`);
      console.log(`  Sources: ${data.sources.length} total, ${workingSources.length} working`);
      console.log(`  Provider used: ${data.provider}`);
      if (data.sources[0]) {
        console.log(`  First source: ${data.sources[0].title || 'unnamed'}`);
        console.log(`  Stream URL: ${(data.sources[0].url || '').substring(0, 80)}...`);
      }
      return { provider, type, success: true, sources: data.sources.length, working: workingSources.length, time: elapsed };
    } else {
      console.log(`  ✗ No sources (${elapsed}ms)`);
      console.log(`  Response: ${JSON.stringify(data).substring(0, 200)}`);
      return { provider, type, success: false, error: 'No sources', time: elapsed };
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error.name === 'AbortError') {
      console.log(`  ✗ TIMEOUT after 30s`);
      return { provider, type, success: false, error: 'Timeout', time: elapsed };
    }
    console.log(`  ✗ ERROR (${elapsed}ms): ${error.message}`);
    return { provider, type, success: false, error: error.message, time: elapsed };
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('STREAM PROVIDER TEST');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Movie: ${TEST_MOVIE.title} (TMDB: ${TEST_MOVIE.tmdbId})`);
  console.log(`Test TV: ${TEST_TV.title} S${TEST_TV.season}E${TEST_TV.episode} (TMDB: ${TEST_TV.tmdbId})`);
  console.log('='.repeat(70));

  const results = [];

  // Test each provider with movie
  console.log('\n### MOVIE TESTS ###');
  for (const provider of PROVIDERS) {
    const result = await testProvider(provider, TEST_MOVIE, 'movie');
    results.push(result);
    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Test each provider with TV
  console.log('\n### TV TESTS ###');
  for (const provider of PROVIDERS) {
    const result = await testProvider(provider, TEST_TV, 'tv');
    results.push(result);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(70));
  
  console.log('\nMOVIE RESULTS:');
  const movieResults = results.filter(r => r.type === 'movie');
  for (const r of movieResults) {
    const status = r.success ? '✓' : '✗';
    const info = r.success ? `${r.working}/${r.sources} sources` : r.error;
    console.log(`  ${status} ${r.provider.padEnd(15)} ${info} (${r.time}ms)`);
  }
  
  console.log('\nTV RESULTS:');
  const tvResults = results.filter(r => r.type === 'tv');
  for (const r of tvResults) {
    const status = r.success ? '✓' : '✗';
    const info = r.success ? `${r.working}/${r.sources} sources` : r.error;
    console.log(`  ${status} ${r.provider.padEnd(15)} ${info} (${r.time}ms)`);
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\nTotal: ${successCount}/${results.length} tests passed`);
}

main().catch(console.error);
