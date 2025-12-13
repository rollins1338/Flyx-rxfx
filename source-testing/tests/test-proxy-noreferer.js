/**
 * Test the stream proxy with explicit noreferer parameter
 * This tests if the deployed proxy has the skipReferer fix
 */

const PROXY_URL = 'https://media-proxy.vynx.workers.dev';

async function testProxy() {
  // Test URL from AnimeKai extraction - use a fresh one if available
  const streamUrl = 'https://rrr.hub26link.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
  
  // The referer being passed
  const referer = 'https://rrr.hub26link.site/';
  
  console.log('='.repeat(60));
  console.log('Testing MegaUp stream proxy with noreferer fix');
  console.log('='.repeat(60));
  console.log('Stream URL:', streamUrl.substring(0, 80) + '...');
  console.log('Referer:', referer);
  console.log('');
  
  // Test 1: Direct fetch WITHOUT referer (should work)
  console.log('=== Test 1: Direct fetch WITHOUT referer ===');
  try {
    const directResponse = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    });
    console.log('Status:', directResponse.status);
    if (directResponse.ok) {
      const text = await directResponse.text();
      console.log('✓ SUCCESS - Response (first 200 chars):', text.substring(0, 200));
    } else {
      console.log('✗ FAILED');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 2: Direct fetch WITH referer (should fail with 403)
  console.log('\n=== Test 2: Direct fetch WITH referer (expect 403) ===');
  try {
    const directResponse = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer,
        'Origin': new URL(referer).origin,
      },
    });
    console.log('Status:', directResponse.status);
    if (directResponse.status === 403) {
      console.log('✓ Expected 403 - MegaUp blocks requests WITH referer');
    } else if (directResponse.ok) {
      console.log('? Unexpected success');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 3: Through proxy WITHOUT noreferer param (relies on sameOriginReferer detection)
  console.log('\n=== Test 3: Proxy WITHOUT noreferer param ===');
  const proxyUrl1 = `${PROXY_URL}/stream/?url=${encodeURIComponent(streamUrl)}&source=animekai&referer=${encodeURIComponent(referer)}`;
  console.log('Proxy URL:', proxyUrl1.substring(0, 120) + '...');
  
  try {
    const proxyResponse = await fetch(proxyUrl1, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://tv.vynx.cc',
        'Referer': 'https://tv.vynx.cc/',
      },
    });
    console.log('Status:', proxyResponse.status);
    
    if (proxyResponse.ok) {
      const text = await proxyResponse.text();
      console.log('✓ SUCCESS - Response (first 300 chars):', text.substring(0, 300));
    } else {
      const text = await proxyResponse.text();
      console.log('✗ FAILED - Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 4: Through proxy WITH explicit noreferer=true
  console.log('\n=== Test 4: Proxy WITH noreferer=true ===');
  const proxyUrl2 = `${PROXY_URL}/stream/?url=${encodeURIComponent(streamUrl)}&source=animekai&referer=${encodeURIComponent(referer)}&noreferer=true`;
  console.log('Proxy URL:', proxyUrl2.substring(0, 140) + '...');
  
  try {
    const proxyResponse = await fetch(proxyUrl2, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://tv.vynx.cc',
        'Referer': 'https://tv.vynx.cc/',
      },
    });
    console.log('Status:', proxyResponse.status);
    console.log('Response headers:', Object.fromEntries(proxyResponse.headers));
    
    if (proxyResponse.ok) {
      const text = await proxyResponse.text();
      console.log('✓ SUCCESS - Response (first 300 chars):', text.substring(0, 300));
    } else {
      const text = await proxyResponse.text();
      console.log('✗ FAILED - Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 5: Through proxy with localhost origin (should be allowed)
  console.log('\n=== Test 5: Proxy with localhost origin ===');
  const proxyUrl3 = `${PROXY_URL}/stream/?url=${encodeURIComponent(streamUrl)}&source=animekai&referer=${encodeURIComponent(referer)}&noreferer=true`;
  
  try {
    const proxyResponse = await fetch(proxyUrl3, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/',
      },
    });
    console.log('Status:', proxyResponse.status);
    
    if (proxyResponse.ok) {
      const text = await proxyResponse.text();
      console.log('✓ SUCCESS - Response (first 300 chars):', text.substring(0, 300));
    } else {
      const text = await proxyResponse.text();
      console.log('✗ FAILED - Response:', text.substring(0, 500));
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 6: Proxy health check
  console.log('\n=== Test 6: Proxy health check ===');
  try {
    const healthResponse = await fetch(`${PROXY_URL}/health`);
    const health = await healthResponse.json();
    console.log('Proxy health:', JSON.stringify(health, null, 2));
  } catch (error) {
    console.log('Health check error:', error.message);
  }
}

testProxy().catch(console.error);
