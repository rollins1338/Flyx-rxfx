/**
 * Simple test to verify proxy is reachable and check what's happening
 */

const PROXY_URL = 'https://media-proxy.vynx.workers.dev';

async function test() {
  // Test 1: Simple health check
  console.log('=== Test 1: Health check ===');
  try {
    const res = await fetch(`${PROXY_URL}/health`);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 2: Root endpoint
  console.log('\n=== Test 2: Root endpoint ===');
  try {
    const res = await fetch(PROXY_URL);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response (truncated):', JSON.stringify(data, null, 2).substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 3: Stream endpoint with a simple test URL
  console.log('\n=== Test 3: Stream endpoint (simple test) ===');
  const testUrl = 'https://httpbin.org/get';
  const proxyUrl = `${PROXY_URL}/stream/?url=${encodeURIComponent(testUrl)}&source=test&referer=${encodeURIComponent('https://httpbin.org/')}`;
  console.log('Proxy URL:', proxyUrl);
  
  try {
    const res = await fetch(proxyUrl, {
      headers: {
        'Origin': 'https://tv.vynx.cc',
        'Referer': 'https://tv.vynx.cc/',
      },
    });
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers));
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 4: Stream endpoint with MegaUp URL and noreferer
  console.log('\n=== Test 4: MegaUp stream with noreferer=true ===');
  const megaupUrl = 'https://rrr.hub26link.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
  const megaupReferer = 'https://rrr.hub26link.site/';
  const megaupProxyUrl = `${PROXY_URL}/stream/?url=${encodeURIComponent(megaupUrl)}&source=animekai&referer=${encodeURIComponent(megaupReferer)}&noreferer=true`;
  console.log('Proxy URL:', megaupProxyUrl.substring(0, 150) + '...');
  
  try {
    const res = await fetch(megaupProxyUrl, {
      headers: {
        'Origin': 'https://tv.vynx.cc',
        'Referer': 'https://tv.vynx.cc/',
      },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test().catch(console.error);
