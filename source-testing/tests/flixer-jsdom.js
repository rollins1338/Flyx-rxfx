/**
 * Flixer.sh - Using JSDOM to run WASM
 * 
 * Create a minimal browser environment with JSDOM and run the WASM
 */

const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';

// Fetch helper
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(body.toString()),
          arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
          json: () => Promise.resolve(JSON.parse(body.toString())),
        });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function runWithJsdom() {
  console.log('=== Running Flixer WASM with JSDOM ===\n');
  
  // Create a JSDOM instance with necessary features
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://flixer.sh/',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  
  const { window } = dom;
  const { document } = window;
  
  // Add missing APIs
  window.crypto = {
    getRandomValues: (arr) => {
      const bytes = crypto.randomBytes(arr.length);
      arr.set(bytes);
      return arr;
    },
    subtle: {
      importKey: async (format, keyData, algorithm, extractable, keyUsages) => {
        return { type: 'secret', algorithm, extractable, usages: keyUsages, _keyData: keyData };
      },
      sign: async (algorithm, key, data) => {
        const hmac = crypto.createHmac('sha256', Buffer.from(key._keyData));
        hmac.update(Buffer.from(data));
        return hmac.digest().buffer;
      },
    },
  };
  
  window.fetch = fetchUrl;
  window.performance = { now: () => Date.now() };
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  
  // Mock localStorage
  const storage = {};
  window.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
  };
  
  // Set up canvas mock
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'canvas') {
      el.getContext = () => ({
        fillText: () => {},
        fillRect: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(100) }),
      });
      el.toDataURL = () => 'data:image/png;base64,AAAA';
    }
    return el;
  };
  
  // Set WASM base URL
  window.WASM_BASE_URL = 'https://plsdontscrapemelove.flixer.sh';
  window.TMDB_API_BASE_URL = 'https://plsdontscrapemelove.flixer.sh';
  
  console.log('JSDOM environment set up');
  
  // Load the image enhancer script
  console.log('\nLoading image enhancer module...');
  
  try {
    // Fetch the enhancer script
    const enhancerRes = await fetchUrl('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-image-enhancer.js');
    const enhancerCode = await enhancerRes.text();
    
    console.log(`Enhancer script loaded (${enhancerCode.length} chars)`);
    
    // The script uses ES modules, which JSDOM doesn't support well
    // Let's try a different approach - extract the key generation logic
    
    // Look for the key generation pattern
    console.log('\nAnalyzing enhancer script for key generation...');
    
    // The script calls get_img_key() from WASM
    // Let's see if we can find how the key is used
    
    if (enhancerCode.includes('process_img_data')) {
      console.log('Found process_img_data reference');
    }
    
    if (enhancerCode.includes('get_img_key')) {
      console.log('Found get_img_key reference');
    }
    
    // Extract the buildSecureHeaders function
    const buildHeadersMatch = enhancerCode.match(/async function generateRequestSignature\([^)]+\)\{([^}]+)\}/);
    if (buildHeadersMatch) {
      console.log('\nFound generateRequestSignature function:');
      console.log(buildHeadersMatch[0].substring(0, 300));
    }
    
  } catch (err) {
    console.error('Error loading enhancer:', err.message);
  }
  
  dom.window.close();
}

// Alternative: Try to understand the WASM key derivation by analyzing the Rust source patterns
async function analyzeWasmKeyDerivation() {
  console.log('\n=== Analyzing WASM Key Derivation ===\n');
  
  // Read the WASM binary
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  if (!fs.existsSync(wasmPath)) {
    console.log('WASM file not found. Run crack-flixer-wasm.js first.');
    return;
  }
  
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // Look for key-related strings
  const wasmString = wasmBuffer.toString('latin1');
  
  // The WASM uses these Rust crates:
  // - aes-0.8.4: AES encryption
  // - ctr-0.9.2: CTR mode
  // - hmac-0.12.1: HMAC
  // - base64-0.21.7: Base64
  
  // In Rust's aes crate, the key is typically used directly
  // In ctr mode, the counter/nonce is usually prepended to the ciphertext
  
  console.log('Key derivation analysis:');
  console.log('1. The WASM generates a key using browser fingerprinting');
  console.log('2. This key is sent to the server as X-Api-Key');
  console.log('3. The server encrypts the response using this key');
  console.log('4. The WASM decrypts using the same key');
  
  console.log('\nThe encryption likely uses:');
  console.log('- AES-256-CTR mode');
  console.log('- 16-byte nonce/IV prepended to ciphertext');
  console.log('- Key used directly (no derivation)');
  
  // The issue might be that the server uses a DIFFERENT key derivation
  // Let's check if there's a pattern in the error codes
  
  const errorCodes = wasmString.match(/E\d{1,2}/g) || [];
  console.log('\nError codes found:', [...new Set(errorCodes)].join(', '));
  
  // E56, E57, E58 are related to decryption
  // Let's find the context
  const e56Index = wasmString.indexOf('E56');
  if (e56Index !== -1) {
    console.log('\nContext around E56:');
    console.log(wasmString.substring(e56Index - 50, e56Index + 100));
  }
}

async function main() {
  await runWithJsdom();
  await analyzeWasmKeyDerivation();
}

main().catch(console.error);
