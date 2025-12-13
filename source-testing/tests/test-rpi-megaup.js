// Test MegaUp through RPi proxy
const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
const megaupUrl = 'https://rrr.app28base.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

async function test() {
  // Test health
  console.log('=== RPi Health Check ===');
  try {
    const r = await fetch(`${RPI_URL}/health`);
    console.log('Status:', r.status);
    const data = await r.json();
    console.log('Response:', data);
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Test stream proxy
  console.log('\n=== RPi Stream Proxy ===');
  const proxyUrl = `${RPI_URL}/proxy?url=${encodeURIComponent(megaupUrl)}&key=${RPI_KEY}`;
  console.log('URL:', proxyUrl.substring(0, 80) + '...');
  
  try {
    const r = await fetch(proxyUrl);
    console.log('Status:', r.status);
    if (r.ok) {
      const text = await r.text();
      console.log('✓ SUCCESS:', text.substring(0, 300));
    } else {
      const text = await r.text();
      console.log('✗ FAILED:', text.substring(0, 300));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
