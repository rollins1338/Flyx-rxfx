#!/usr/bin/env node
/**
 * Extract AnimeKai decrypt tables by running the bundle's decrypt function
 * in a Node.js VM sandbox.
 * 
 * Strategy:
 * 1. Fetch the bundle.js from AnimeKai
 * 2. Set up a minimal browser-like environment
 * 3. Hook into the decrypt function
 * 4. Feed it our collected encrypted samples
 * 5. Capture the decrypted output
 * 6. Build tables from plaintext-ciphertext pairs
 */
const https = require('https');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetchUrl(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname, path: u.pathname + u.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', ...hdrs },
      timeout: 15000,
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    }).on('error', rej);
  });
}

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], {
    encoding: 'utf8', timeout: 8000, windowsHide: true
  }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };

async function main() {
  console.log('Fetching AnimeKai page to find bundle URL...');
  
  // Get the main page to find the bundle script URL
  const page = await fetchUrl('https://animekai.to/home');
  
  // Find script tags with bundle URLs
  const scriptUrls = [];
  const scriptRe = /<script[^>]+src="([^"]*_buildManifest[^"]*|[^"]*_ssgManifest[^"]*|[^"]*chunks[^"]*|[^"]*pages[^"]*)"[^>]*>/g;
  let m;
  while ((m = scriptRe.exec(page.body)) !== null) {
    scriptUrls.push(m[1]);
  }
  
  // Also find the main bundle
  const allScripts = [];
  const allScriptRe = /<script[^>]+src="([^"]+\.js)"[^>]*>/g;
  while ((m = allScriptRe.exec(page.body)) !== null) {
    allScripts.push(m[1]);
  }
  
  console.log(`Found ${allScripts.length} script URLs`);
  
  // We need to find the script that contains the crypto functions
  // It will have atob, btoa, fromCharCode, charCodeAt
  
  // First, let's check if we already have a cached bundle
  const cachedBundle = 'scripts/animekai-crypto-bundle-1771726946134.js';
  let bundleContent;
  
  if (fs.existsSync(cachedBundle)) {
    console.log('Using cached bundle');
    bundleContent = fs.readFileSync(cachedBundle, 'utf8');
  } else {
    // Download each script and check for crypto indicators
    for (const url of allScripts) {
      const fullUrl = url.startsWith('http') ? url : `https://animekai.to${url}`;
      console.log(`  Checking: ${fullUrl.substring(0, 80)}...`);
      try {
        const resp = await fetchUrl(fullUrl);
        if (resp.body.includes('fromCharCode') && resp.body.includes('charCodeAt') && resp.body.includes('atob')) {
          console.log(`  ✓ Found crypto bundle! (${resp.body.length} chars)`);
          bundleContent = resp.body;
          fs.writeFileSync(`scripts/animekai-bundle-${Date.now()}.js`, resp.body);
          break;
        }
      } catch {}
    }
  }
  
  if (!bundleContent) {
    console.log('Could not find crypto bundle!');
    return;
  }
  
  console.log(`Bundle size: ${bundleContent.length} chars`);
  
  // Now let's try to find and extract the decrypt function
  // The decrypt function takes a base64 string and returns JSON
  // It uses: atob, fromCharCode, charCodeAt
  
  // Strategy: Create a sandbox that intercepts atob/btoa calls
  // and tracks the decrypt flow
  
  // Actually, let's try a simpler approach:
  // Find the section of the bundle that handles the AJAX response decryption
  // The pattern is: when link/view returns, the result is passed through a decrypt function
  
  // Search for 'links/view' or 'link/view' in the bundle
  const viewIdx = bundleContent.indexOf('links/view');
  if (viewIdx >= 0) {
    console.log(`\nFound 'links/view' at position ${viewIdx}`);
    console.log('Context:', bundleContent.substring(viewIdx - 200, viewIdx + 200));
  }
  
  // Search for the decrypt pattern: something that takes the result and decodes it
  // The pattern is typically: result = decrypt(response.result)
  // or: JSON.parse(decrypt(response.result))
  
  // Let's look for the function that does atob + charCodeAt processing
  // This is the core of the substitution cipher
  
  // Find all function definitions that use both atob and charCodeAt
  const funcBoundaries = [];
  let searchIdx = 0;
  while (true) {
    const atobPos = bundleContent.indexOf('atob', searchIdx);
    if (atobPos < 0) break;
    
    // Find the enclosing function
    let braceCount = 0;
    let funcStart = atobPos;
    for (let i = atobPos; i >= Math.max(0, atobPos - 5000); i--) {
      if (bundleContent[i] === '}') braceCount++;
      if (bundleContent[i] === '{') {
        braceCount--;
        if (braceCount < 0) { funcStart = i; break; }
      }
    }
    
    // Check if this function also contains charCodeAt
    const funcEnd = Math.min(bundleContent.length, funcStart + 10000);
    const funcBody = bundleContent.substring(funcStart, funcEnd);
    if (funcBody.includes('charCodeAt') && funcBody.includes('fromCharCode')) {
      funcBoundaries.push({ start: funcStart, atobPos });
    }
    
    searchIdx = atobPos + 4;
  }
  
  console.log(`\nFunctions with atob+charCodeAt+fromCharCode: ${funcBoundaries.length}`);
  
  // Now let's try a completely different approach:
  // Run the bundle in a VM and intercept the decrypt function
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RUNNING BUNDLE IN VM SANDBOX');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Get a real encrypted sample to test with
  console.log('Getting a fresh encrypted sample...');
  const sr = await fetchUrl('https://animekai.to/ajax/anime/search?keyword=bleach', KAI_HDRS);
  const sd = JSON.parse(sr.body);
  const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
  
  const wp = await fetchUrl('https://animekai.to/watch/' + slug);
  const syncMatch = wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/);
  const sync = JSON.parse(syncMatch[1]);
  const animeId = sync.anime_id;
  
  // Also extract the __$ key from the page
  const keyMatch = wp.body.match(/window\.__\$\s*=\s*["']([^"']+)["']/);
  const pageKey = keyMatch ? keyMatch[1] : null;
  console.log(`Page key (__$): ${pageKey ? pageKey.substring(0, 20) + '...' : 'NOT FOUND'}`);
  
  // Look for other key patterns
  const keyPatterns = [
    /window\[["']__\$["']\]\s*=\s*["']([^"']+)["']/,
    /window\.__\$\s*=\s*["']([^"']+)["']/,
    /__\$["']\s*:\s*["']([^"']+)["']/,
  ];
  
  for (const p of keyPatterns) {
    const m = wp.body.match(p);
    if (m) console.log(`  Key pattern match: ${m[1].substring(0, 30)}...`);
  }
  
  // Get an encrypted response
  const encId = rustExec(animeId, 'kai-encrypt');
  const epResp = await fetchUrl(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
  const epData = JSON.parse(epResp.body);
  const token = epData.result.match(/token="([^"]+)"/)?.[1];
  
  const encToken = rustExec(token, 'kai-encrypt');
  const srvResp = await fetchUrl(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
  const srvData = JSON.parse(srvResp.body);
  const lid = srvData.result.match(/data-lid="([^"]+)"/)?.[1];
  
  const encLid = rustExec(lid, 'kai-encrypt');
  const viewResp = await fetchUrl(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
  const viewData = JSON.parse(viewResp.body);
  const encrypted = viewData.result;
  
  console.log(`\nEncrypted sample: ${encrypted.substring(0, 60)}...`);
  console.log(`Length: ${encrypted.length}`);
  
  // Now try to set up a VM sandbox and run the bundle's decrypt
  // We need to find the decrypt function in the bundle
  
  // The bundle uses a state machine pattern with switch/case
  // The decrypt function likely:
  // 1. Takes a base64 string
  // 2. Decodes it with atob (or custom base64)
  // 3. Applies substitution cipher (charCodeAt → table lookup → fromCharCode)
  // 4. Returns the decrypted string
  
  // Let's try to find the function by searching for the pattern
  // where atob is called and then charCodeAt is used in a loop
  
  // Actually, let me try to just run the whole bundle with a fake DOM
  // and see if we can call the decrypt function
  
  const sandbox = {
    window: {},
    document: {
      createElement: () => ({ style: {} }),
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: () => {},
      body: { appendChild: () => {} },
      head: { appendChild: () => {} },
      cookie: '',
    },
    navigator: { userAgent: 'Mozilla/5.0' },
    location: { href: 'https://animekai.to/', hostname: 'animekai.to', pathname: '/' },
    console: { log: () => {}, error: () => {}, warn: () => {} },
    setTimeout: (fn) => { try { fn(); } catch {} },
    setInterval: () => {},
    clearTimeout: () => {},
    clearInterval: () => {},
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}) }),
    XMLHttpRequest: function() { return { open: () => {}, send: () => {}, setRequestHeader: () => {} }; },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    self: {},
    globalThis: {},
    RegExp: RegExp,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Math: Math,
    Date: Date,
    JSON: JSON,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    encodeURI: encodeURI,
    decodeURI: decodeURI,
    escape: escape,
    unescape: unescape,
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    SyntaxError: SyntaxError,
    Promise: Promise,
    Symbol: Symbol,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Proxy: Proxy,
    Reflect: Reflect,
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
    DataView: DataView,
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    URL: URL,
    URLSearchParams: URLSearchParams,
    Function: Function,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  
  // Set the __$ key if we found it
  if (pageKey) {
    sandbox.window.__$ = pageKey;
    sandbox.__$ = pageKey;
  }
  
  try {
    console.log('\nRunning bundle in VM...');
    const context = vm.createContext(sandbox);
    
    // Try running the bundle
    vm.runInContext(bundleContent, context, { timeout: 10000, filename: 'bundle.js' });
    
    console.log('Bundle executed successfully!');
    
    // Check what's available on the window object
    const windowKeys = Object.keys(sandbox.window).filter(k => 
      typeof sandbox.window[k] === 'function' || 
      (typeof sandbox.window[k] === 'object' && sandbox.window[k] !== null)
    );
    console.log('Window functions/objects:', windowKeys.slice(0, 30).join(', '));
    
    // Look for the decrypt function
    // It might be exposed as window.decrypt, window.dec, or through a module system
    
    // Check for common patterns
    const checkKeys = ['decrypt', 'dec', 'encode', 'decode', '_decrypt', '__decrypt', 
                       'kaiDecrypt', 'decryptResult', 'decResult'];
    for (const key of checkKeys) {
      if (sandbox.window[key]) {
        console.log(`Found window.${key}:`, typeof sandbox.window[key]);
      }
    }
    
    // Check the _ object (underscore/lodash or custom)
    if (sandbox.window._) {
      console.log('window._ type:', typeof sandbox.window._);
      if (typeof sandbox.window._ === 'object') {
        const uKeys = Object.keys(sandbox.window._).slice(0, 20);
        console.log('window._ keys:', uKeys.join(', '));
      }
    }
    
  } catch (e) {
    console.log('VM execution error:', e.message?.substring(0, 200));
    
    // The bundle might fail due to missing DOM APIs
    // Let's try a different approach: extract just the crypto function
  }
  
  // Save the encrypted sample for later use
  console.log('\nSaved encrypted sample for testing');
  fs.writeFileSync('scripts/kai-test-sample.json', JSON.stringify({
    encrypted, lid, query: 'bleach', pageKey,
  }, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
