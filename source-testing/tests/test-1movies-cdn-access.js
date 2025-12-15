/**
 * Test 1movies CDN access patterns
 */

async function test() {
  // Sample 1movies CDN URL
  const cdnUrl = 'https://p.10014.workers.dev/dewshine74.xyz/file2/itbsfrziFCxJ36DZiDwOwp18j4zvp0ZcvitXkO8XJq5gaGxb8tev5V4Ote7rsHUFRogPabPvS1v7DQJR6ueiVbLm+lkKwlBaSo~f9KWF3ad9WeSflAHkO8~Sn5F6UokWwuzZrIRIxcE0gIs+Jxoh+1jTJ7C430UJAs3Fllidoiw=/cGxheWxpc3QubTN1OA==.m3u8';
  
  console.log('=== TESTING 1MOVIES CDN ACCESS ===\n');
  console.log('URL:', cdnUrl.substring(0, 80) + '...\n');
  
  // Test 1: Direct access (no headers)
  console.log('1. Direct access (no headers):');
  try {
    const res1 = await fetch(cdnUrl);
    console.log(`   Status: ${res1.status}`);
    if (res1.ok) {
      const text = await res1.text();
      console.log(`   Valid HLS: ${text.includes('#EXTM3U')}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test 2: With Referer
  console.log('\n2. With Referer (111movies.com):');
  try {
    const res2 = await fetch(cdnUrl, {
      headers: { 'Referer': 'https://111movies.com/' }
    });
    console.log(`   Status: ${res2.status}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test 3: With Origin (simulating browser)
  console.log('\n3. With Origin header:');
  try {
    const res3 = await fetch(cdnUrl, {
      headers: { 
        'Origin': 'https://111movies.com',
        'Referer': 'https://111movies.com/'
      }
    });
    console.log(`   Status: ${res3.status}`);
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  // Test 4: No Origin, no Referer (like server-side fetch)
  console.log('\n4. Server-side style (User-Agent only):');
  try {
    const res4 = await fetch(cdnUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log(`   Status: ${res4.status}`);
    if (res4.ok) {
      const text = await res4.text();
      console.log(`   Valid HLS: ${text.includes('#EXTM3U')}`);
    }
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }
  
  console.log('\n=== CONCLUSION ===');
  console.log('If all tests return 200, the CDN does NOT block based on headers.');
  console.log('If tests fail, the CDN may be blocking datacenter IPs (like Cloudflare Workers).');
}

test().catch(console.error);
