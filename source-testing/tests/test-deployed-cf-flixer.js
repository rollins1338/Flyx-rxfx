/**
 * Test DEPLOYED Cloudflare Worker Flixer Endpoint
 * 
 * Tests the actual deployed CF worker at media-proxy.vynx.workers.dev
 */

const CF_WORKER_URL = 'https://media-proxy.vynx.workers.dev';

async function testFlixerHealth() {
  console.log('🏥 Testing /flixer/health endpoint...');
  try {
    const response = await fetch(`${CF_WORKER_URL}/flixer/health`);
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    return response.ok;
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function testFlixerExtractMovie() {
  console.log('\n🎬 Testing Movie Extraction (Inception - TMDB 27205)...');
  try {
    const url = `${CF_WORKER_URL}/flixer/extract?tmdbId=27205&type=movie&server=alpha`;
    console.log('   URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.sources?.[0]?.url) {
      console.log('   ✅ SUCCESS! Got m3u8 URL');
      return true;
    } else {
      console.log('   ❌ FAILED:', data.error || 'No URL in response');
      return false;
    }
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function testFlixerExtractTV() {
  console.log('\n📺 Testing TV Extraction (Arcane S1E1 - TMDB 94605)...');
  try {
    const url = `${CF_WORKER_URL}/flixer/extract?tmdbId=94605&type=tv&season=1&episode=1&server=alpha`;
    console.log('   URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.sources?.[0]?.url) {
      console.log('   ✅ SUCCESS! Got m3u8 URL');
      return true;
    } else {
      console.log('   ❌ FAILED:', data.error || 'No URL in response');
      return false;
    }
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DEPLOYED CLOUDFLARE WORKER FLIXER TEST');
  console.log(`  Worker URL: ${CF_WORKER_URL}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const healthOk = await testFlixerHealth();
  const movieOk = await testFlixerExtractMovie();
  const tvOk = await testFlixerExtractTV();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Health Check:     ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Movie Extraction: ${movieOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  TV Extraction:    ${tvOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

runTests();
