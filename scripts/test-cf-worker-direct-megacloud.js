#!/usr/bin/env node
/**
 * Test if CF Worker can access MegaCloud directly (CF-to-CF bypass)
 */

async function testCFWorkerDirect() {
  console.log('Testing CF Worker direct access to MegaCloud...\n');
  
  // Get a real MegaCloud URL
  const apiUrl = 'https://tv.vynx.cc/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=40748';
  const apiRes = await fetch(apiUrl);
  const apiData = await apiRes.json();
  
  const hiAnimeSource = apiData.sources?.find(s => s.title?.includes('[HiAnime]'));
  if (!hiAnimeSource) {
    console.log('No HiAnime source found');
    return;
  }
  
  console.log(`Proxied URL: ${hiAnimeSource.url.substring(0, 100)}...\n`);
  console.log('This goes through CF Worker which tries direct fetch first...\n');
  
  const startTime = Date.now();
  try {
    const res = await fetch(hiAnimeSource.url, {
      signal: AbortSignal.timeout(60000),
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`Status: ${res.status}`);
    console.log(`Time: ${elapsed}ms`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    console.log(`X-Proxied-Via: ${res.headers.get('x-proxied-via')}`);
    
    if (res.ok) {
      const text = await res.text();
      console.log(`\n✓ Response (${text.length} bytes)`);
      console.log(`First 500 chars:\n${text.substring(0, 500)}`);
      
      if (text.includes('#EXTM3U')) {
        console.log('\n✓✓✓ CF WORKER DIRECT ACCESS WORKS!');
      } else if (text.includes('Cloudflare')) {
        console.log('\n✗ Cloudflare challenge even for CF Worker');
      }
    } else {
      const errorText = await res.text();
      console.log(`\n✗ FAILED: ${errorText}`);
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log(`✗ ERROR after ${elapsed}ms: ${err.message}`);
  }
}

testCFWorkerDirect().catch(console.error);
