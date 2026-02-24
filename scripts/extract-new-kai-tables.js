#!/usr/bin/env node
/**
 * Extract AnimeKai's NEW server-side encryption tables.
 * 
 * Strategy: Use Puppeteer to load AnimeKai, intercept the JS decrypt function,
 * and extract the substitution tables by calling decrypt on crafted inputs.
 * 
 * The site's bundle.js contains the decrypt logic. We hook into it from the
 * browser context and systematically map every byte→char for each position.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], { encoding: 'utf8', timeout: 5000 }).trim();
}

// AnimeKai cipher position mapping
const HEADER = Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa', 'hex');
const CONSTANT_BYTES = { 1: 0xf2, 2: 0xdf, 3: 0x9b, 4: 0x9d, 5: 0x16, 6: 0xe5, 8: 0x67, 9: 0xc9, 10: 0xdd, 12: 0x9c, 14: 0x29, 16: 0x35, 18: 0xc8 };
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function urlSafeB64Encode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function urlSafeB64Decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64');
}

/**
 * Build a fake encrypted token with a specific byte at a specific plaintext position.
 * We know the cipher structure: 21-byte header + data block with constant padding bytes.
 * For a plaintext of length N, the data block has cipherPos(N-1)+1 bytes.
 */
function buildFakeToken(position, testByte) {
  // We need a token long enough to include the target position
  const maxCp = cipherPos(position);
  const dataLen = maxCp + 1;
  const total = 21 + dataLen;
  const buf = Buffer.alloc(total);
  
  // Header
  HEADER.copy(buf, 0);
  
  // Constant padding bytes
  for (const [pos, val] of Object.entries(CONSTANT_BYTES)) {
    const p = parseInt(pos);
    if (p < dataLen) buf[21 + p] = val;
  }
  
  // Set the test byte at the cipher position for our target plaintext position
  buf[21 + cipherPos(position)] = testByte;
  
  // Fill other cipher positions with valid bytes (use 0x00 or known values)
  // For positions 0 to position-1, use bytes that decrypt to something valid
  // We'll use our known encrypt table for '{' at pos 0, etc.
  
  return urlSafeB64Encode(buf);
}

async function main() {
  console.log('=== AnimeKai Table Extraction via Puppeteer ===\n');
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');
  
  // Navigate to AnimeKai to load the bundle.js
  console.log('Loading AnimeKai...');
  await page.goto('https://animekai.to/watch/bleach-re3j', { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait for the crypto functions to be available
  await page.waitForFunction(() => {
    return typeof window.__$ !== 'undefined';
  }, { timeout: 10000 }).catch(() => console.log('window.__$ not found, continuing...'));
  
  // Check what's available in the global scope
  const globals = await page.evaluate(() => {
    const info = {};
    info.hasWindowKey = typeof window.__$ !== 'undefined';
    info.windowKey = window.__$ ? String(window.__$).substring(0, 50) : null;
    
    // Look for decrypt/encrypt functions
    // The bundle typically exposes these through AJAX interceptors
    // Let's check for common patterns
    info.hasJQuery = typeof window.$ !== 'undefined' || typeof window.jQuery !== 'undefined';
    
    return info;
  });
  
  console.log('Page globals:', JSON.stringify(globals, null, 2));
  
  // The decrypt function is called when AJAX responses come back.
  // Let's intercept it by hooking into the AJAX pipeline.
  // First, let's find the decrypt function by triggering an actual API call.
  
  // Strategy: Override the response handler to capture the decrypt function
  console.log('\nSetting up AJAX intercept...');
  
  await page.evaluate(() => {
    // Store intercepted data
    window.__kiro_intercepts = [];
    window.__kiro_decrypt_fn = null;
    
    // Hook XMLHttpRequest to capture decrypt calls
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this.__kiro_url = url;
      return origOpen.call(this, method, url, ...args);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      const origOnLoad = xhr.onload;
      const origOnReady = xhr.onreadystatechange;
      
      // Intercept response for link/view calls
      if (xhr.__kiro_url && xhr.__kiro_url.includes('/ajax/links/view')) {
        xhr.addEventListener('load', function() {
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.result) {
              window.__kiro_intercepts.push({
                url: xhr.__kiro_url,
                encrypted: resp.result,
                timestamp: Date.now()
              });
            }
          } catch {}
        });
      }
      
      return origSend.call(this, ...args);
    };
  });
  
  // Now trigger an actual link/view call by clicking on a server
  // But first, let's try a different approach: directly call the site's decrypt from the console
  
  // The bundle.js has the decrypt logic. Let's find it by searching for the pattern.
  // The decrypt function uses the substitution tables which are embedded in the bundle.
  
  // Actually, the BEST approach: 
  // 1. Get the bundle.js URL
  // 2. Find the encrypt/decrypt functions
  // 3. Call them directly from page context
  
  // Let's find the bundle script
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
  });
  console.log('Scripts on page:', scripts.filter(s => s.includes('bundle') || s.includes('main') || s.includes('app')));
  
  // Let's try to find the decrypt function by looking at how the site processes responses
  // The site uses jQuery AJAX with a custom response handler
  
  // Try to find the decrypt function through the global _ object (from the bundle)
  const bundleInfo = await page.evaluate(() => {
    // The bundle creates a global _ function with properties
    // Check if _ exists and has the expected structure
    const info = {};
    
    // Check for the _ global (from the obfuscated bundle)
    if (typeof _ === 'function') {
      info.hasUnderscore = true;
      // Check for known properties
      info.has565766 = typeof _[565766] !== 'undefined';
      info.has126765 = typeof _[126765] !== 'undefined';
      info.has371508 = typeof _[371508] !== 'undefined';
      info.has483180 = _[483180];
      info.has558164 = _[558164];
      info.has315832 = _[315832];
      
      if (_[565766]) {
        info.p_mLjDq_type = typeof _[565766].p_mLjDq;
      }
      
      // Try to find G3v and K76 (the shuffle function wrappers)
      info.hasG3v = typeof _.G3v === 'function';
      info.hasK76 = typeof _.K76 === 'function';
      info.hasS7t = typeof _.S7t === 'function';
      info.hasM_Z = typeof _.M_Z === 'function';
      info.hasa3s = typeof _.a3s === 'function';
    }
    
    return info;
  });
  console.log('\nBundle globals:', JSON.stringify(bundleInfo, null, 2));
  
  // Now let's try to find the actual encrypt/decrypt functions
  // They're typically attached to jQuery or called in AJAX handlers
  // Let's search for the pattern that processes the _ parameter and result decryption
  
  const cryptoFunctions = await page.evaluate(() => {
    const results = {};
    
    // The encrypt/decrypt are likely in the _ global's properties
    // Let's enumerate numeric properties of _
    if (typeof _ === 'function') {
      const numericProps = [];
      for (const key of Object.getOwnPropertyNames(_)) {
        if (/^\d+$/.test(key)) {
          const val = _[key];
          numericProps.push({ key: parseInt(key), type: typeof val, isObj: val !== null && typeof val === 'object' });
        }
      }
      results.numericProps = numericProps.slice(0, 30);
      
      // Check for function properties (non-numeric)
      const funcProps = [];
      for (const key of Object.getOwnPropertyNames(_)) {
        if (typeof _[key] === 'function' && !/^\d+$/.test(key)) {
          funcProps.push(key);
        }
      }
      results.funcProps = funcProps;
    }
    
    return results;
  });
  console.log('\nCrypto functions:', JSON.stringify(cryptoFunctions, null, 2));
  
  // Let's try to trigger an actual decrypt by making an API call
  // and intercepting the result
  console.log('\nTriggering API call to capture decrypt...');
  
  // Get the anime_id from the page
  const syncData = await page.evaluate(() => {
    const el = document.getElementById('syncData');
    return el ? JSON.parse(el.textContent) : null;
  });
  console.log('syncData:', syncData ? { anime_id: syncData.anime_id } : 'not found');
  
  if (syncData) {
    // Make the API calls from within the page context
    // This will use the site's own encrypt/decrypt
    const apiResult = await page.evaluate(async (animeId) => {
      try {
        // The site has a global encrypt function somewhere
        // Let's find it by checking what happens when we make an AJAX call
        
        // First, let's check if there's a global encrypt/decrypt
        // Common patterns: window.encrypt, window.decrypt, or attached to a module
        
        // Try to find the encrypt function by searching through the _ object
        // The encrypt function takes a string and returns a base64 string
        
        // Let's try calling the AJAX directly and see what happens
        const response = await fetch(`/ajax/episodes/list?ani_id=${animeId}&_=test`, {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        return { status: response.status, hasResult: !!data.result, resultLen: data.result?.length };
      } catch (e) {
        return { error: e.message };
      }
    }, syncData.anime_id);
    console.log('API test result:', apiResult);
  }
  
  // Let's try a completely different approach:
  // Hook into the Function constructor to find when the decrypt is called
  // Or better: find the decrypt by looking at the bundle's AJAX success handler
  
  // The most reliable approach: find the decrypt function by name/pattern in the bundle
  // and call it directly
  
  // Let's get the bundle source and find the decrypt function
  const bundleUrl = scripts.find(s => s.includes('bundle'));
  if (bundleUrl) {
    console.log('\nFetching bundle from:', bundleUrl);
    const bundleResp = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      const text = await resp.text();
      return text.length;
    }, bundleUrl);
    console.log('Bundle size:', bundleResp);
  }
  
  // Actually, let me try the SIMPLEST approach:
  // The site's jQuery AJAX calls have a success handler that decrypts the result.
  // Let's hook $.ajax to intercept the decrypt function.
  
  const decryptTest = await page.evaluate(async () => {
    // Try to find the decrypt function by hooking jQuery AJAX
    const results = {};
    
    // Check if jQuery is available
    if (typeof $ !== 'undefined' && $.ajax) {
      results.hasJQuery = true;
      
      // Hook $.ajax
      const origAjax = $.ajax;
      let capturedDecrypt = null;
      
      $.ajax = function(opts) {
        if (opts.success) {
          const origSuccess = opts.success;
          opts.success = function(data) {
            // The success handler likely calls decrypt on data.result
            // Let's capture it
            if (data && data.result && typeof data.result === 'string' && data.result.length > 50) {
              results.capturedEncrypted = data.result.substring(0, 60);
            }
            return origSuccess.apply(this, arguments);
          };
        }
        return origAjax.call(this, opts);
      };
    }
    
    // Try to find decrypt by looking at the prototype chain
    // The bundle typically defines encrypt/decrypt as methods on a module
    
    // Search for functions that take a base64-like string and return JSON
    // by checking all function properties on window and _
    
    if (typeof _ === 'function') {
      // Try calling known function patterns
      // The encrypt is likely _.G0a or similar
      const funcNames = Object.getOwnPropertyNames(_).filter(k => typeof _[k] === 'function' && !/^\d+$/.test(k));
      results.allFunctions = funcNames;
      
      // Try each function with a test string to see which one looks like encrypt/decrypt
      for (const name of funcNames) {
        try {
          const fn = _[name];
          // Try calling with no args to see what it returns
          const noArgResult = fn();
          if (typeof noArgResult === 'string' || typeof noArgResult === 'object') {
            results[`${name}_noarg`] = typeof noArgResult === 'string' ? noArgResult.substring(0, 50) : JSON.stringify(noArgResult).substring(0, 50);
          }
        } catch (e) {
          // Skip functions that throw
        }
      }
    }
    
    return results;
  });
  console.log('\nDecrypt test:', JSON.stringify(decryptTest, null, 2));
  
  await browser.close();
  console.log('\nBrowser closed.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
