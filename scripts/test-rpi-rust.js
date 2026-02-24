#!/usr/bin/env node
/**
 * Test if rust-fetch is installed on RPI
 */

async function testRustFetch() {
  console.log('Testing RPI rust-fetch endpoint...\n');
  
  const testUrl = 'https://rpi-proxy.vynx.cc/fetch-rust?url=https%3A%2F%2Fexample.com&key=5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';
  
  try {
    const res = await fetch(testUrl, { signal: AbortSignal.timeout(10000) });
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    
    const text = await res.text();
    console.log(`\nResponse (${text.length} bytes):`);
    console.log(text.substring(0, 500));
    
    if (res.status === 502) {
      const json = JSON.parse(text);
      console.log('\n❌ ERROR:', json.error);
      console.log('Hint:', json.hint);
      console.log('\nYou need to:');
      console.log('1. SSH to RPI: ssh vynx@vynx-pi.local');
      console.log('2. Copy rust-fetch: scp -r rpi-proxy/rust-fetch vynx@vynx-pi.local:~/rpi-proxy/');
      console.log('3. Build: cd ~/rpi-proxy/rust-fetch && bash build.sh');
      console.log('4. Install: sudo cp target/release/rust-fetch /usr/local/bin/');
      console.log('5. Restart: pm2 restart rpi-proxy');
    } else if (res.ok) {
      console.log('\n✓ rust-fetch is working!');
    }
  } catch (err) {
    console.log(`\n❌ ERROR: ${err.message}`);
  }
}

testRustFetch().catch(console.error);
