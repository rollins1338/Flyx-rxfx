/**
 * Test Hetzner proxy directly
 */

const HETZNER_URL = 'http://91.98.164.123:3001';
const API_KEY = 'BushDid9/11WithTheJews';

async function test() {
  // Test 1: Health check
  console.log('=== Test 1: Hetzner health check ===');
  try {
    const res = await fetch(`${HETZNER_URL}/health`);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Test 2: Stream endpoint with MegaUp URL
  console.log('\n=== Test 2: Hetzner stream proxy ===');
  const megaupUrl = 'https://rrr.app28base.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';
  const proxyUrl = `${HETZNER_URL}/stream?url=${encodeURIComponent(megaupUrl)}&key=${API_KEY}&referer=none`;
  console.log('Proxy URL:', proxyUrl.substring(0, 100) + '...');
  
  try {
    const res = await fetch(proxyUrl);
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers));
    
    if (res.ok) {
      const text = await res.text();
      console.log('✓ SUCCESS - Response (first 300 chars):', text.substring(0, 300));
    } else {
      const text = await res.text();
      console.log('✗ FAILED - Response:', text.substring(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test().catch(console.error);
