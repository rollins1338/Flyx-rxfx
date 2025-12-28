/**
 * Test PPV through RPI proxy directly
 */

const RPI_PROXY_URL = 'https://rpi-proxy.vynx.cc';
const RPI_PROXY_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function testRPIProxy() {
  console.log('Testing PPV through RPI proxy...\n');
  
  const testUrl = 'https://gg.poocloud.in/southpark/index.m3u8';
  
  // Test 1: Check RPI proxy health
  console.log('1. Testing RPI proxy health...');
  try {
    const healthResp = await fetch(`${RPI_PROXY_URL}/health`, {
      headers: { 'X-API-Key': RPI_PROXY_KEY },
    });
    console.log('Health status:', healthResp.status);
    if (healthResp.ok) {
      const health = await healthResp.json();
      console.log('Health:', JSON.stringify(health, null, 2));
    }
  } catch (e) {
    console.error('Health check failed:', e.message);
  }
  
  // Test 2: Proxy the PPV stream through RPI
  console.log('\n2. Testing PPV stream through RPI proxy...');
  try {
    const proxyResp = await fetch(`${RPI_PROXY_URL}/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RPI_PROXY_KEY,
      },
      body: JSON.stringify({
        url: testUrl,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://pooembed.top/',
          'Origin': 'https://pooembed.top',
        },
      }),
    });
    
    console.log('Proxy status:', proxyResp.status);
    console.log('Content-Type:', proxyResp.headers.get('content-type'));
    
    if (proxyResp.ok) {
      const text = await proxyResp.text();
      console.log('Content length:', text.length);
      console.log('Preview:', text.substring(0, 300));
    } else {
      const error = await proxyResp.text();
      console.log('Error:', error);
    }
  } catch (e) {
    console.error('Proxy failed:', e.message);
  }
  
  // Test 3: Try the simple GET proxy endpoint
  console.log('\n3. Testing simple GET proxy...');
  try {
    const getProxyUrl = `${RPI_PROXY_URL}/get?url=${encodeURIComponent(testUrl)}&referer=${encodeURIComponent('https://pooembed.top/')}`;
    const getResp = await fetch(getProxyUrl, {
      headers: { 'X-API-Key': RPI_PROXY_KEY },
    });
    
    console.log('GET proxy status:', getResp.status);
    console.log('Content-Type:', getResp.headers.get('content-type'));
    
    if (getResp.ok) {
      const text = await getResp.text();
      console.log('Content length:', text.length);
      console.log('Preview:', text.substring(0, 300));
    } else {
      const error = await getResp.text();
      console.log('Error:', error);
    }
  } catch (e) {
    console.error('GET proxy failed:', e.message);
  }
}

testRPIProxy().catch(console.error);
