// Test if MegaUp CDN blocks requests with Origin header
const url = 'https://rrr.app28base.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

async function test() {
  console.log('Testing MegaUp CDN with different headers...\n');
  
  // Test 1: No Origin header (like Node.js)
  console.log('Test 1: No Origin header');
  try {
    const res1 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log('  Status:', res1.status);
    console.log('  CORS:', res1.headers.get('access-control-allow-origin'));
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Test 2: With Origin header (like browser XHR)
  console.log('\nTest 2: With Origin: http://localhost:3000');
  try {
    const res2 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'http://localhost:3000'
      }
    });
    console.log('  Status:', res2.status);
    console.log('  CORS:', res2.headers.get('access-control-allow-origin'));
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Test 3: With Referer header
  console.log('\nTest 3: With Referer: http://localhost:3000/');
  try {
    const res3 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'http://localhost:3000/'
      }
    });
    console.log('  Status:', res3.status);
    console.log('  CORS:', res3.headers.get('access-control-allow-origin'));
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Test 4: With both Origin and Referer
  console.log('\nTest 4: With both Origin and Referer');
  try {
    const res4 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/'
      }
    });
    console.log('  Status:', res4.status);
    console.log('  CORS:', res4.headers.get('access-control-allow-origin'));
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Test 5: With MegaUp's own origin as referer
  console.log('\nTest 5: With Referer from MegaUp domain');
  try {
    const res5 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://app28base.site/'
      }
    });
    console.log('  Status:', res5.status);
    console.log('  CORS:', res5.headers.get('access-control-allow-origin'));
  } catch (e) {
    console.log('  Error:', e.message);
  }
}

test();
