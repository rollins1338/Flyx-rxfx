// The WASM might be looking for a specific variable name pattern
// Let's check if mercury returns different variable names each time
// and if the WASM needs to know which one to look for

const fs = require('fs');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Referer': 'https://vidlink.pro/',
  'Origin': 'https://vidlink.pro',
};

async function run() {
  // Fetch mercury multiple times to see if variable name changes
  console.log('=== Mercury variable name stability ===');
  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://vidlink.pro/api/mercury?tmdbId=550&type=movie', {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000)
    });
    const t = await r.text();
    const m = t.match(/window\['([^']+)'\]\s*=\s*'([^']+)'/);
    if (m) {
      console.log(`  Attempt ${i+1}: varName='${m[1]}' valueLen=${m[2].length}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Check the full mercury response for any other data
  console.log('\n=== Full mercury response analysis ===');
  const r = await fetch('https://vidlink.pro/api/mercury?tmdbId=550&type=movie', {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000)
  });
  const fullText = await r.text();
  
  // Check for multiple script tags
  const scripts = [...fullText.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  console.log('Script tags:', scripts.length);
  for (let i = 0; i < scripts.length; i++) {
    const content = scripts[i][1];
    console.log(`  Script ${i+1}: ${content.length} chars`);
    console.log(`    Preview: ${content.substring(0, 200)}`);
  }
  
  // The mercury response is 612KB - most of it must be something else
  // Let's check what's after the window variable assignment
  const varEnd = fullText.indexOf("';", fullText.indexOf("window['"));
  if (varEnd > -1) {
    const afterVar = fullText.substring(varEnd + 2, varEnd + 5000);
    console.log('\nAfter variable assignment:', afterVar.substring(0, 2000));
  }
  
  // Also check: maybe the WASM reads the mercury data differently
  // The page code loads mercury as a <script> tag via fetch, which means
  // the script executes and sets the window variable
  // But maybe the WASM also needs the mercury response to be loaded as a script
  // (i.e., the WASM reads from the DOM, not from window[varName])
  
  // Let's look at what the page chunk does with mercury more carefully
  // From the page chunk:
  // module 4883 fetches /api/mercury and injects it as a script tag
  // This is the Adcash ad library loader - NOT the stream data!
  // The actual stream data comes from /api/b/movie/{id}
  
  // Wait - let me re-read the page chunk more carefully
  // The SWR fetcher is: fetch("/api/b/movie/".concat(e[0]))
  // And e[0] is g, which comes from window.getAdv(t.id.toString())
  // But t is the data prop passed to the component, which has t.id = TMDB ID
  
  // So the question is: what does getAdv return?
  // It might return the TMDB ID itself (just a passthrough)
  // Or it might return an encrypted/signed version
  
  // Let's check if the API works with just the raw TMDB ID
  // We already tested this and got empty responses
  // So getAdv must transform the ID somehow
  
  // The WASM is a Go binary - let's look for strings that might reveal the algorithm
  console.log('\n=== WASM string analysis ===');
  const wasmResp = await fetch('https://vidlink.pro/fu.wasm', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(30000)
  });
  const wasmBuf = await wasmResp.arrayBuffer();
  const wasmBytes = new Uint8Array(wasmBuf);
  
  // Extract readable strings
  let str = '';
  const strings = [];
  for (let i = 0; i < wasmBytes.length; i++) {
    if (wasmBytes[i] >= 32 && wasmBytes[i] < 127) {
      str += String.fromCharCode(wasmBytes[i]);
    } else {
      if (str.length > 4) strings.push(str);
      str = '';
    }
  }
  
  // Find crypto/encoding related strings
  const cryptoStrings = strings.filter(s => 
    s.includes('encrypt') || s.includes('decrypt') || s.includes('cipher') ||
    s.includes('aes') || s.includes('AES') || s.includes('key') ||
    s.includes('token') || s.includes('sign') || s.includes('hmac') ||
    s.includes('base64') || s.includes('hex') || s.includes('getAdv') ||
    s.includes('sodium') || s.includes('nacl') || s.includes('chacha') ||
    s.includes('secretbox') || s.includes('box') || s.includes('seal') ||
    s.includes('c75136c5') || s.includes('window')
  );
  console.log('Crypto-related strings:', cryptoStrings.slice(0, 50));
  
  // Find URL-like strings
  const urlStrings = strings.filter(s => s.includes('http') || s.includes('/api/') || s.includes('.pro'));
  console.log('\nURL strings:', urlStrings.slice(0, 20));
  
  // Find function-like strings
  const funcStrings = strings.filter(s => s.includes('getAdv') || s.includes('Adv') || s.includes('get'));
  console.log('\nFunction strings:', funcStrings.filter(s => s.length < 100).slice(0, 30));
}

run().catch(e => console.log('Fatal:', e));
