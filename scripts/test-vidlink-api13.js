// Run the Go WASM to get the getAdv token, then use it to call the API
const fs = require('fs');
const crypto = require('crypto');

const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

async function run() {
  // Load the Go WASM
  console.log('Loading Go WASM...');
  
  // Download fu.wasm
  const wasmResp = await fetch('https://vidlink.pro/fu.wasm', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000)
  });
  const wasmBuffer = await wasmResp.arrayBuffer();
  console.log('WASM size:', wasmBuffer.byteLength);
  
  // Set up the Go runtime environment
  // We need to simulate the browser environment
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Create a mock window/globalThis
  const mockWindow = {
    ...globalThis,
    // The WASM will set getAdv on this
  };
  
  // Load script.js to get the Dm class
  // We already have it - it defines globalThis.Dm
  eval(fs.readFileSync('scripts/vidlink-script.js', 'utf8'));
  
  console.log('Dm class available:', typeof globalThis.Dm);
  
  // Instantiate the Go runtime
  const go = new globalThis.Dm();
  
  // Compile and instantiate the WASM
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  const result = await WebAssembly.instantiate(wasmModule, go.importObject);
  const instance = result;
  
  console.log('WASM instantiated');
  console.log('WASM exports:', Object.keys(instance.exports));
  
  // Run the Go program (this sets up window.getAdv)
  // Run in background - don't await (Go programs run indefinitely)
  go.run(instance).catch(e => {
    // Expected - Go program exits
    console.log('Go program ended:', e?.message || 'ok');
  });
  
  // Wait a bit for the Go program to initialize
  await new Promise(r => setTimeout(r, 500));
  
  // Check if getAdv was set
  console.log('getAdv available:', typeof globalThis.getAdv);
  console.log('window keys with "get":', Object.keys(globalThis).filter(k => k.toLowerCase().includes('get') || k.toLowerCase().includes('adv')));
  
  if (typeof globalThis.getAdv === 'function') {
    // Call getAdv with a TMDB ID
    console.log('\nCalling getAdv("550")...');
    const token = globalThis.getAdv('550');
    console.log('Token:', token);
    console.log('Token type:', typeof token);
    if (token) {
      console.log('Token length:', token.length || JSON.stringify(token).length);
      
      // Use the token to call the API
      const apiUrl = `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;
      console.log('\nFetching:', apiUrl);
      const apiResp = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://vidlink.pro/movie/550',
          'Origin': 'https://vidlink.pro',
        },
        signal: AbortSignal.timeout(10000)
      });
      const apiText = await apiResp.text();
      console.log('API response:', apiResp.status, 'len:', apiText.length);
      if (apiText.length > 0) {
        try {
          const json = JSON.parse(apiText);
          console.log('JSON:', JSON.stringify(json).substring(0, 1000));
        } catch {
          // Try decrypt
          try {
            const raw = Buffer.from(apiText.trim(), 'base64');
            const iv = raw.slice(0, 16);
            const ct = raw.slice(16);
            const key = Buffer.from(KEY, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let dec = decipher.update(ct);
            dec = Buffer.concat([dec, decipher.final()]);
            console.log('Decrypted:', dec.toString('utf8').substring(0, 500));
          } catch (e) {
            console.log('Raw:', apiText.substring(0, 500));
          }
        }
      }
    }
  } else {
    // Check all global properties that might have been set
    console.log('\nChecking for any new global properties...');
    const newProps = Object.keys(globalThis).filter(k => !['fs', 'process', 'crypto', 'performance', 'TextEncoder', 'TextDecoder', 'Dm'].includes(k));
    console.log('Global properties:', newProps.filter(k => typeof globalThis[k] === 'function').slice(0, 20));
  }
}

run().catch(e => console.log('Fatal:', e));
