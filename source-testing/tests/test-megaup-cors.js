// Test if MegaUp CDN sends CORS headers
const url = 'https://rrr.app28base.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

async function test() {
  console.log('Testing MegaUp CDN CORS headers...\n');
  
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('Status:', res.status);
    console.log('\nAll headers:');
    for (const [key, value] of res.headers) {
      console.log(`  ${key}: ${value}`);
    }
    
    console.log('\nCORS-related headers:');
    console.log('  Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin') || '(not set)');
    console.log('  Access-Control-Allow-Methods:', res.headers.get('access-control-allow-methods') || '(not set)');
    console.log('  Access-Control-Allow-Headers:', res.headers.get('access-control-allow-headers') || '(not set)');
    
    if (!res.headers.get('access-control-allow-origin')) {
      console.log('\n⚠️  No CORS headers - browser will block direct fetch!');
      console.log('   Need to proxy through Cloudflare Worker to add CORS headers.');
    } else {
      console.log('\n✓ CORS headers present - browser can fetch directly!');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
