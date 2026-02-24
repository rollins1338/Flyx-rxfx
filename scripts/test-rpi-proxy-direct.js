#!/usr/bin/env node
/**
 * Test RPI proxy directly
 */

async function testRPIProxy() {
  console.log('Testing RPI Proxy directly...\n');
  
  // Get a real MegaCloud URL
  const apiUrl = 'https://tv.vynx.cc/api/anime/stream?tmdbId=95479&type=tv&episode=1&malId=40748';
  const apiRes = await fetch(apiUrl);
  const apiData = await apiRes.json();
  
  const hiAnimeSource = apiData.sources?.find(s => s.title?.includes('[HiAnime]'));
  if (!hiAnimeSource) {
    console.log('No HiAnime source found');
    return;
  }
  
  // Extract the actual MegaCloud URL from the proxied URL
  const proxyUrl = new URL(hiAnimeSource.url);
  const targetUrl = decodeURIComponent(proxyUrl.searchParams.get('url'));
  
  console.log(`Target URL: ${targetUrl.substring(0, 100)}...\n`);
  
  // Test RPI proxy
  const rpiUrl = `https://rpi-proxy.vynx.cc/animekai?url=${encodeURIComponent(targetUrl)}&key=${process.env.RPI_PROXY_KEY || 'test'}`;
  
  console.log(`RPI URL: ${rpiUrl.substring(0, 100)}...\n`);
  
  const startTime = Date.now();
  try {
    const rpiRes = await fetch(rpiUrl, {
      signal: AbortSignal.timeout(60000),
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`Status: ${rpiRes.status}`);
    console.log(`Time: ${elapsed}ms`);
    console.log(`Content-Type: ${rpiRes.headers.get('content-type')}`);
    console.log(`X-Proxied-By: ${rpiRes.headers.get('x-proxied-by')}`);
    
    if (rpiRes.ok) {
      const text = await rpiRes.text();
      console.log(`\n✓ SUCCESS! Got response (${text.length} bytes)`);
      console.log(`First 300 chars:\n${text.substring(0, 300)}`);
    } else {
      const errorText = await rpiRes.text();
      console.log(`\n✗ FAILED: ${errorText.substring(0, 500)}`);
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log(`✗ ERROR after ${elapsed}ms: ${err.message}`);
  }
}

testRPIProxy().catch(console.error);
