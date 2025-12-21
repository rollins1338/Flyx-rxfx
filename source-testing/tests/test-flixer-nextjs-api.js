/**
 * Test Flixer via Next.js API Route
 * 
 * This tests the full flow through the Next.js API which runs the WASM
 * in Node.js (Vercel serverless functions).
 * 
 * Run the Next.js dev server first: npm run dev
 */

const NEXTJS_API_URL = 'http://localhost:3000/api/stream/extract';

async function testFlixerMovie() {
  console.log('🎬 Testing Movie Extraction via Next.js API (Inception)...');
  try {
    const url = `${NEXTJS_API_URL}?tmdbId=27205&type=movie&provider=flixer`;
    console.log('   URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('   Status:', response.status);
    
    if (data.success && data.sources?.[0]?.url) {
      console.log('   ✅ SUCCESS!');
      console.log('   Provider:', data.provider);
      console.log('   Source:', data.sources[0].title);
      console.log('   URL:', data.sources[0].directUrl?.substring(0, 80) + '...');
      return true;
    } else {
      console.log('   ❌ FAILED:', data.error || JSON.stringify(data));
      return false;
    }
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function testFlixerTV() {
  console.log('\n📺 Testing TV Extraction via Next.js API (Arcane S1E1)...');
  try {
    const url = `${NEXTJS_API_URL}?tmdbId=94605&type=tv&season=1&episode=1&provider=flixer`;
    console.log('   URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('   Status:', response.status);
    
    if (data.success && data.sources?.[0]?.url) {
      console.log('   ✅ SUCCESS!');
      console.log('   Provider:', data.provider);
      console.log('   Source:', data.sources[0].title);
      console.log('   URL:', data.sources[0].directUrl?.substring(0, 80) + '...');
      return true;
    } else {
      console.log('   ❌ FAILED:', data.error || JSON.stringify(data));
      return false;
    }
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FLIXER VIA NEXT.JS API TEST');
  console.log('  Make sure Next.js dev server is running: npm run dev');
  console.log('═══════════════════════════════════════════════════════════\n');

  const movieOk = await testFlixerMovie();
  const tvOk = await testFlixerTV();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Movie Extraction: ${movieOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  TV Extraction:    ${tvOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (!movieOk && !tvOk) {
    console.log('⚠️  Make sure Next.js dev server is running: npm run dev\n');
  }
}

runTests();
