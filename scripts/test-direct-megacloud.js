#!/usr/bin/env node
/**
 * Test if MegaCloud URLs work without proxy
 */

async function testDirect() {
  console.log('Testing direct MegaCloud access...\n');
  
  // Get a real MegaCloud URL
  const apiUrl = 'https://tv.vynx.cc/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=40748';
  const apiRes = await fetch(apiUrl);
  const apiData = await apiRes.json();
  
  const hiAnimeSource = apiData.sources?.find(s => s.title?.includes('[HiAnime]'));
  if (!hiAnimeSource) {
    console.log('No HiAnime source found');
    return;
  }
  
  const proxyUrl = new URL(hiAnimeSource.url);
  const targetUrl = decodeURIComponent(proxyUrl.searchParams.get('url'));
  
  console.log(`Target URL: ${targetUrl.substring(0, 100)}...\n`);
  console.log('Testing direct fetch (no proxy)...\n');
  
  const startTime = Date.now();
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`Status: ${res.status}`);
    console.log(`Time: ${elapsed}ms`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    
    if (res.ok) {
      const text = await res.text();
      console.log(`\n✓ Response (${text.length} bytes)`);
      console.log(`First 500 chars:\n${text.substring(0, 500)}`);
      
      if (text.includes('#EXTM3U')) {
        console.log('\n✓✓✓ DIRECT ACCESS WORKS! No proxy needed!');
      } else if (text.includes('Cloudflare')) {
        console.log('\n✗ Cloudflare challenge detected');
      }
    } else {
      const errorText = await res.text();
      console.log(`\n✗ FAILED: ${errorText.substring(0, 200)}`);
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log(`✗ ERROR after ${elapsed}ms: ${err.message}`);
  }
}

testDirect().catch(console.error);
