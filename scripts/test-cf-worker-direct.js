#!/usr/bin/env node
/**
 * Test Cloudflare Worker directly
 */

async function testCFWorker() {
  console.log('Testing CF Worker health...\n');
  
  const healthUrl = 'https://media-proxy.vynx.workers.dev/hianime/health';
  const healthRes = await fetch(healthUrl);
  console.log(`Health: ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log(JSON.stringify(healthData, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing HiAnime stream proxy with retry logic...\n');
  
  // Get a real stream URL from the API
  const apiUrl = 'https://tv.vynx.cc/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=40748';
  const apiRes = await fetch(apiUrl);
  const apiData = await apiRes.json();
  
  const hiAnimeSource = apiData.sources?.find(s => s.title?.includes('[HiAnime]'));
  if (!hiAnimeSource) {
    console.log('No HiAnime source found');
    return;
  }
  
  console.log(`Testing stream URL: ${hiAnimeSource.url.substring(0, 100)}...\n`);
  
  const startTime = Date.now();
  const streamRes = await fetch(hiAnimeSource.url, {
    signal: AbortSignal.timeout(60000), // 60s timeout to allow for retries
  });
  const elapsed = Date.now() - startTime;
  
  console.log(`Status: ${streamRes.status}`);
  console.log(`Time: ${elapsed}ms`);
  console.log(`X-Proxied-Via: ${streamRes.headers.get('x-proxied-via')}`);
  
  if (streamRes.ok) {
    const text = await streamRes.text();
    console.log(`\n✓ SUCCESS! Got playlist (${text.length} bytes)`);
    console.log(`First 300 chars:\n${text.substring(0, 300)}`);
  } else {
    const errorText = await streamRes.text();
    console.log(`\n✗ FAILED: ${errorText}`);
  }
}

testCFWorker().catch(console.error);
