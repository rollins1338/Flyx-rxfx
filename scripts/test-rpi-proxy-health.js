#!/usr/bin/env node
/**
 * Test RPi Proxy Health and IPTV API
 * 
 * Usage: node scripts/test-rpi-proxy-health.js
 */

const RPI_PROXY_URL = process.env.RPI_PROXY_URL || 'https://rpi-proxy.vynx.cc';
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY || '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

async function testHealth() {
  console.log('Testing RPi Proxy Health...');
  console.log('URL:', RPI_PROXY_URL);
  
  try {
    const res = await fetch(`${RPI_PROXY_URL}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    console.log('Health Response:', res.status, data);
    return res.ok;
  } catch (err) {
    console.error('Health check failed:', err.message);
    return false;
  }
}

async function testIPTVApi(portalUrl, mac) {
  console.log('\nTesting IPTV API through RPi Proxy...');
  
  // Build handshake URL
  const handshakeUrl = new URL('/portal.php', portalUrl);
  handshakeUrl.searchParams.set('type', 'stb');
  handshakeUrl.searchParams.set('action', 'handshake');
  handshakeUrl.searchParams.set('token', '');
  handshakeUrl.searchParams.set('JsHttpRequest', '1-xml');
  
  const params = new URLSearchParams({
    url: handshakeUrl.toString(),
    mac: mac,
    key: RPI_PROXY_KEY,
  });
  
  const fullUrl = `${RPI_PROXY_URL}/iptv/api?${params.toString()}`;
  console.log('Request URL:', fullUrl.substring(0, 100) + '...');
  
  try {
    const res = await fetch(fullUrl, {
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    console.log('Response Status:', res.status);
    console.log('Response Headers:', Object.fromEntries(res.headers.entries()));
    console.log('Response Body:', text.substring(0, 500));
    
    if (res.ok) {
      // Try to parse the response
      const clean = text.replace(/^\/\*-secure-\s*/, '').replace(/\s*\*\/$/, '');
      try {
        const data = JSON.parse(clean);
        if (data?.js?.token) {
          console.log('\n✓ SUCCESS! Got token:', data.js.token.substring(0, 20) + '...');
        } else {
          console.log('\n✗ No token in response');
        }
      } catch {
        console.log('\n✗ Failed to parse JSON');
      }
    } else {
      console.log('\n✗ Request failed with status:', res.status);
    }
  } catch (err) {
    console.error('IPTV API test failed:', err.message);
  }
}

async function main() {
  // Test health first
  const healthy = await testHealth();
  
  if (!healthy) {
    console.log('\n⚠️  RPi Proxy is not reachable. Check:');
    console.log('   1. Is the RPi proxy running? (node server.js)');
    console.log('   2. Is cloudflared tunnel active?');
    console.log('   3. Is the URL correct?');
    return;
  }
  
  // If you have a test portal, uncomment and fill in:
  // await testIPTVApi('http://your-portal.com/c', '00:1A:79:XX:XX:XX');
  
  console.log('\n✓ RPi Proxy is healthy!');
  console.log('\nTo test IPTV API, edit this script and add your portal URL and MAC.');
}

main().catch(console.error);
