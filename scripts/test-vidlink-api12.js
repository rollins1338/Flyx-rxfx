// Fetch /script.js and /fu.wasm to understand the auth flow
const fs = require('fs');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Referer': 'https://vidlink.pro/movie/550',
};

async function run() {
  // Fetch script.js
  console.log('=== /script.js ===');
  try {
    const r = await fetch('https://vidlink.pro/script.js', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const js = await r.text();
    console.log('Status:', r.status, 'Length:', js.length);
    fs.writeFileSync('scripts/vidlink-script.js', js);
    console.log('Saved to vidlink-script.js');
    
    // Find getAdv function
    if (js.includes('getAdv')) {
      const idx = js.indexOf('getAdv');
      console.log('\ngetAdv context:', js.substring(Math.max(0, idx - 500), Math.min(js.length, idx + 1000)));
    }
    
    // Find any API references
    const apis = [...js.matchAll(/["'`](\/api\/[^"'`\s]{2,80})["'`]/g)].map(m => m[1]);
    if (apis.length > 0) console.log('\nAPIs:', [...new Set(apis)]);
    
    // Find decrypt/encrypt references
    if (js.includes('decrypt') || js.includes('encrypt') || js.includes('c75136c5')) {
      console.log('\nHas crypto references');
      for (const term of ['decrypt', 'encrypt', 'c75136c5', 'aes', 'AES']) {
        const tidx = js.indexOf(term);
        if (tidx > -1) {
          console.log(`  "${term}":`, js.substring(Math.max(0, tidx - 200), tidx + 300));
        }
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  // Fetch fu.wasm info
  console.log('\n=== /fu.wasm ===');
  try {
    const r = await fetch('https://vidlink.pro/fu.wasm', { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const buf = await r.arrayBuffer();
    console.log('Status:', r.status, 'Size:', buf.byteLength, 'bytes');
    
    // Check WASM magic bytes
    const bytes = new Uint8Array(buf);
    console.log('Magic:', Array.from(bytes.slice(0, 4)).map(b => b.toString(16)).join(' '));
    
    // Look for strings in the WASM
    let str = '';
    const strings = [];
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] < 127) {
        str += String.fromCharCode(bytes[i]);
      } else {
        if (str.length > 8) strings.push(str);
        str = '';
      }
    }
    if (str.length > 8) strings.push(str);
    
    // Filter interesting strings
    const interesting = strings.filter(s => 
      s.includes('api') || s.includes('http') || s.includes('decrypt') || 
      s.includes('key') || s.includes('token') || s.includes('auth') ||
      s.includes('getAdv') || s.includes('window') || s.length > 30
    );
    console.log('Interesting strings:', interesting.slice(0, 30));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

run().catch(e => console.log('Fatal:', e));
