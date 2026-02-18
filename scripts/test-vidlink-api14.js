// Full flow: mercury → WASM → getAdv → API
const fs = require('fs');
const crypto = require('crypto');

const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Referer': 'https://vidlink.pro/movie/550',
  'Origin': 'https://vidlink.pro',
};

async function run() {
  // Step 1: Fetch mercury to get the encrypted data
  console.log('Step 1: Fetching mercury...');
  const mercuryResp = await fetch('https://vidlink.pro/api/mercury?tmdbId=550&type=movie', {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const mercuryText = await mercuryResp.text();
  
  // Extract the window variable
  const varMatch = mercuryText.match(/window\['([^']+)'\]\s*=\s*'([^']+)'/);
  if (!varMatch) {
    console.log('No window variable found in mercury response');
    return;
  }
  const varName = varMatch[1];
  const varValue = varMatch[2];
  console.log(`Mercury variable: window['${varName}'] = '${varValue.substring(0, 50)}...' (${varValue.length} chars)`);
  
  // Set the window variable
  globalThis[varName] = varValue;
  
  // Step 2: Load the Go WASM
  console.log('\nStep 2: Loading Go WASM...');
  
  // Download fu.wasm
  const wasmResp = await fetch('https://vidlink.pro/fu.wasm', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000)
  });
  const wasmBuffer = await wasmResp.arrayBuffer();
  
  // Load script.js (defines Dm class)
  eval(fs.readFileSync('scripts/vidlink-script.js', 'utf8'));
  
  const go = new globalThis.Dm();
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  const instance = await WebAssembly.instantiate(wasmModule, go.importObject);
  
  // Run the Go program
  go.run(instance).catch(() => {});
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('getAdv available:', typeof globalThis.getAdv);
  
  if (typeof globalThis.getAdv !== 'function') {
    console.log('getAdv not available');
    return;
  }
  
  // Step 3: Call getAdv
  console.log('\nStep 3: Calling getAdv("550")...');
  const token = globalThis.getAdv('550');
  console.log('Token:', token);
  console.log('Token type:', typeof token);
  
  if (!token) {
    console.log('Token is null/undefined');
    
    // Try with different argument types
    console.log('\nTrying different argument types...');
    const tests = [550, '550', { id: 550 }, { tmdbId: 550 }];
    for (const arg of tests) {
      try {
        const t = globalThis.getAdv(arg);
        console.log(`getAdv(${JSON.stringify(arg)}) →`, t);
        if (t) break;
      } catch (e) {
        console.log(`getAdv(${JSON.stringify(arg)}) → ERROR:`, e.message);
      }
    }
    
    // Check what other globals the WASM set
    const wasmGlobals = Object.keys(globalThis).filter(k => 
      typeof globalThis[k] === 'function' && 
      !['fs', 'process', 'Dm', 'getAdv', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'structuredClone', 'atob', 'btoa', 'fetch', 'crypto', 'performance', 'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'AbortController', 'AbortSignal', 'Event', 'EventTarget', 'MessageChannel', 'MessagePort', 'MessageEvent', 'ReadableStream', 'WritableStream', 'TransformStream', 'Blob', 'File', 'FormData', 'Headers', 'Request', 'Response', 'WebAssembly', 'SharedArrayBuffer', 'Atomics', 'navigator', 'console'].includes(k)
    );
    console.log('\nWASM-set globals:', wasmGlobals);
    
    return;
  }
  
  // Step 4: Use token to call API
  console.log('\nStep 4: Calling API with token...');
  const apiUrl = `https://vidlink.pro/api/b/movie/${encodeURIComponent(token)}?multiLang=1`;
  console.log('URL:', apiUrl);
  
  const apiResp = await fetch(apiUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000)
  });
  const apiText = await apiResp.text();
  console.log('API response:', apiResp.status, 'len:', apiText.length);
  
  if (apiText.length > 0) {
    try {
      const json = JSON.parse(apiText);
      console.log('JSON:', JSON.stringify(json).substring(0, 1000));
    } catch {
      // Try AES decrypt
      try {
        const raw = Buffer.from(apiText.trim(), 'base64');
        const iv = raw.slice(0, 16);
        const ct = raw.slice(16);
        const key = Buffer.from(KEY, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let dec = decipher.update(ct);
        dec = Buffer.concat([dec, decipher.final()]);
        console.log('Decrypted:', dec.toString('utf8').substring(0, 1000));
      } catch {
        console.log('Raw:', apiText.substring(0, 500));
      }
    }
  }
}

run().catch(e => console.log('Fatal:', e));
