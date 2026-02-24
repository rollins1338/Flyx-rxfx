#!/usr/bin/env node
/**
 * Test RPI SOCKS5 endpoint for MegaCloud CDN
 */

async function testSOCKS5() {
  console.log('Testing RPI SOCKS5 endpoint for MegaCloud...\n');
  
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
  
  const rpiKey = process.env.RPI_PROXY_KEY || '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
  const socks5Url = `https://rpi-proxy.vynx.cc/fetch-socks5?url=${encodeURIComponent(targetUrl)}&key=${rpiKey}`;
  
  console.log(`SOCKS5 URL: ${socks5Url.substring(0, 100)}...\n`);
  console.log('Fetching (this may take 10-30s with retries)...\n');
  
  const startTime = Date.now();
  try {
    const res = await fetch(socks5Url, {
      signal: AbortSignal.timeout(60000),
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`Status: ${res.status}`);
    console.log(`Time: ${elapsed}ms`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    
    if (res.ok) {
      const text = await res.text();
      console.log(`\n✓ SUCCESS! Got response (${text.length} bytes)`);
      console.log(`First 500 chars:\n${text.substring(0, 500)}`);
    } else {
      const errorText = await res.text();
      console.log(`\n✗ FAILED: ${errorText.substring(0, 500)}`);
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log(`✗ ERROR after ${elapsed}ms: ${err.message}`);
  }
}

testSOCKS5().catch(console.error);
