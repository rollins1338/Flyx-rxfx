/**
 * Test the stream proxy with AnimeKai URLs
 */

const PROXY_URL = 'https://media-proxy.vynx.workers.dev';

async function testProxy() {
  // Test URL from AnimeKai extraction
  const streamUrl = 'https://rrr.app28base.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
  
  // The referer should be the stream's origin
  const referer = 'https://rrr.app28base.site/';
  
  console.log('Testing stream proxy...');
  console.log('Stream URL:', streamUrl.substring(0, 80) + '...');
  console.log('Referer:', referer);
  
  // Test 1: Direct fetch (should fail without proper referer)
  console.log('\n=== Test 1: Direct fetch (no proxy) ===');
  try {
    const directResponse = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    console.log('Direct fetch status:', directResponse.status);
    if (directResponse.ok) {
      const text = await directResponse.text();
      console.log('Response (first 200 chars):', text.substring(0, 200));
    }
  } catch (error) {
    console.log('Direct fetch error:', error.message);
  }
  
  // Test 2: Direct fetch with referer
  console.log('\n=== Test 2: Direct fetch with referer ===');
  try {
    const directResponse = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Origin': new URL(referer).origin,
      },
    });
    console.log('Direct fetch with referer status:', directResponse.status);
    if (directResponse.ok) {
      const text = await directResponse.text();
      console.log('Response (first 200 chars):', text.substring(0, 200));
    }
  } catch (error) {
    console.log('Direct fetch with referer error:', error.message);
  }
  
  // Test 3: Through proxy
  console.log('\n=== Test 3: Through Cloudflare proxy ===');
  const proxyUrl = `${PROXY_URL}/stream/?url=${encodeURIComponent(streamUrl)}&source=animekai&referer=${encodeURIComponent(referer)}`;
  console.log('Proxy URL:', proxyUrl.substring(0, 120) + '...');
  
  try {
    const proxyResponse = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://tv.vynx.cc',
        'Referer': 'https://tv.vynx.cc/',
      },
    });
    console.log('Proxy fetch status:', proxyResponse.status);
    console.log('Response headers:', Object.fromEntries(proxyResponse.headers));
    
    if (proxyResponse.ok) {
      const text = await proxyResponse.text();
      console.log('Response (first 500 chars):', text.substring(0, 500));
    } else {
      const text = await proxyResponse.text();
      console.log('Error response:', text);
    }
  } catch (error) {
    console.log('Proxy fetch error:', error.message);
  }
  
  // Test 4: Proxy health check
  console.log('\n=== Test 4: Proxy health check ===');
  try {
    const healthResponse = await fetch(`${PROXY_URL}/health`);
    const health = await healthResponse.json();
    console.log('Proxy health:', JSON.stringify(health, null, 2));
  } catch (error) {
    console.log('Health check error:', error.message);
  }
}

testProxy().catch(console.error);
