#!/usr/bin/env node
/**
 * Extract AnimeKai's decrypt tables using Puppeteer.
 * 
 * Strategy: Load the AnimeKai page, find the decrypt function in the JS bundle,
 * and call it with crafted inputs to map every byte→char for each position.
 * 
 * The site's bundle.js has the decrypt logic. We intercept it by:
 * 1. Loading the page and letting the bundle execute
 * 2. Hooking into the AJAX response handler to capture the decrypt function
 * 3. Calling decrypt with crafted ciphertexts to build the tables
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function rustExec(text, mode) {
  return execFileSync(RUST, ['--url', text, '--mode', mode], {
    encoding: 'utf8', timeout: 5000, windowsHide: true
  }).trim();
}

// Cipher structure constants
const HEADER_HEX = 'c509bdb497cbc06873ff412af12fd8007624c29faa';
const CONSTANT_BYTES = { 1: 0xf2, 2: 0xdf, 3: 0x9b, 4: 0x9d, 5: 0x16, 6: 0xe5, 8: 0x67, 9: 0xc9, 10: 0xdd, 12: 0x9c, 14: 0x29, 16: 0x35, 18: 0xc8 };
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

async function main() {
  console.log('=== AnimeKai Table Extraction via Puppeteer ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');

    // Intercept the bundle.js to inject our hook
    let bundleSource = null;
    await page.setRequestInterception(true);
    page.on('request', req => {
      req.continue();
    });
    page.on('response', async resp => {
      const url = resp.url();
      if (url.includes('bundle') && url.endsWith('.js')) {
        try {
          bundleSource = await resp.text();
          console.log(`Captured bundle.js: ${bundleSource.length} chars from ${url}`);
        } catch {}
      }
    });

    console.log('Loading AnimeKai...');
    await page.goto('https://animekai.to/watch/bleach-re3j', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Get the window.__$ key
    const pageKey = await page.evaluate(() => window.__$ || null);
    console.log('window.__$:', pageKey ? pageKey.substring(0, 50) + '...' : 'NOT FOUND');

    // Now let's try to find the decrypt function
    // The bundle uses a pattern where AJAX responses are decrypted
    // Let's hook into jQuery's ajaxSuccess or the specific handler

    // First, let's check what the _ global looks like
    const underscoreInfo = await page.evaluate(() => {
      if (typeof _ !== 'function') return { exists: false };
      
      const info = { exists: true, props: {} };
      
      // Get all properties
      for (const key of Object.getOwnPropertyNames(_)) {
        const val = _[key];
        const type = typeof val;
        if (type === 'function') {
          info.props[key] = 'function';
        } else if (type === 'string') {
          info.props[key] = `string:${val.substring(0, 30)}`;
        } else if (type === 'number') {
          info.props[key] = `number:${val}`;
        } else if (type === 'boolean') {
          info.props[key] = `boolean:${val}`;
        } else if (type === 'object' && val !== null) {
          info.props[key] = `object:${Object.keys(val).slice(0, 3).join(',')}`;
        }
      }
      
      return info;
    });
    
    console.log('\n_ global properties:');
    for (const [key, val] of Object.entries(underscoreInfo.props || {})) {
      if (val.startsWith('function') || val.startsWith('object')) {
        console.log(`  _[${key}] = ${val}`);
      }
    }

    // The key approach: trigger an actual link/view AJAX call and intercept
    // the decrypt function by hooking into the response processing
    
    // Let's set up a comprehensive hook
    console.log('\nSetting up decrypt interceptor...');
    
    await page.evaluate(() => {
      window.__kiro_decrypt_captured = false;
      window.__kiro_decrypt_result = null;
      window.__kiro_original_decrypt = null;
      
      // Hook into all function calls to find the decrypt
      // The decrypt function takes a base64 string and returns a JSON string
      // It's called from an AJAX success handler
      
      // Strategy: Override String.prototype methods that the decrypt might use
      // The decrypt likely uses charCodeAt and fromCharCode
      
      // Actually, let's hook the AJAX response handler directly
      // The site uses jQuery AJAX
      if (typeof $ !== 'undefined' && $.ajaxSetup) {
        const origAjaxSetup = $.ajaxSetup;
        
        // Add a global AJAX filter
        $(document).ajaxSuccess(function(event, xhr, settings) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.result && typeof data.result === 'string' && data.result.length > 50) {
              // This looks like an encrypted response
              window.__kiro_last_encrypted = data.result;
              console.log('[KIRO] Captured encrypted response:', data.result.substring(0, 40));
            }
          } catch {}
        });
      }
    });

    // Now trigger an actual API call by navigating to an episode
    // First get the syncData
    const syncData = await page.evaluate(() => {
      const el = document.getElementById('syncData');
      return el ? JSON.parse(el.textContent) : null;
    });

    if (!syncData) {
      console.log('No syncData found!');
      await browser.close();
      return;
    }

    console.log('anime_id:', syncData.anime_id);

    // Make the API calls from within the page context
    // The page's own JS will handle encryption/decryption
    
    // Let's try clicking on an episode to trigger the full flow
    // Or better: make the AJAX calls manually and see how the page processes them
    
    // Actually, the BEST approach: find the decrypt function in the bundle source
    // and extract it
    
    if (bundleSource) {
      console.log('\n=== Analyzing bundle source ===');
      console.log('Bundle length:', bundleSource.length);
      
      // Search for the decrypt function pattern
      // It should involve base64 decode, then position-dependent substitution
      
      // Look for the pattern that processes the _ parameter
      // The encrypt/decrypt functions are likely near "base64" or "btoa"/"atob" patterns
      
      // Search for charCodeAt usage (used in substitution)
      const charCodeAtCount = (bundleSource.match(/charCodeAt/g) || []).length;
      console.log('charCodeAt occurrences:', charCodeAtCount);
      
      // Search for fromCharCode usage
      const fromCharCodeCount = (bundleSource.match(/fromCharCode/g) || []).length;
      console.log('fromCharCode occurrences:', fromCharCodeCount);
      
      // Search for the header hex pattern
      const headerPatterns = bundleSource.match(/c509|0xc5.*0x09|197.*9.*189/g);
      console.log('Header-like patterns:', headerPatterns?.length || 0);
      
      // Search for base64 patterns
      const b64Patterns = (bundleSource.match(/atob|btoa|base64/gi) || []).length;
      console.log('Base64 patterns:', b64Patterns);
      
      // Look for the specific constant bytes pattern
      const constBytePattern = bundleSource.match(/0xf2.*0xdf.*0x9b|242.*223.*155/g);
      console.log('Constant bytes pattern:', constBytePattern?.length || 0);
      
      // Find the section with the substitution tables
      // Tables are likely stored as arrays of numbers
      // Look for large array literals
      const largeArrays = bundleSource.match(/\[(\d+,){50,}\d+\]/g);
      console.log('Large arrays (50+ elements):', largeArrays?.length || 0);
      if (largeArrays) {
        for (const arr of largeArrays.slice(0, 5)) {
          console.log(`  Array of ${arr.split(',').length} elements: ${arr.substring(0, 80)}...`);
        }
      }
    }

    // Let's try a different approach: use page.evaluate to call the site's
    // own encrypt/decrypt functions
    
    // The site's JS processes AJAX responses. Let's find the function that
    // decrypts the "result" field.
    
    // Try to find it by making an AJAX call and tracing the execution
    console.log('\n=== Attempting to call site decrypt ===');
    
    const decryptResult = await page.evaluate(async (animeId) => {
      // The site's encrypt function is used for the _ parameter
      // Let's find it by checking what happens when we trigger an episode list load
      
      // First, let's check if there's a global decrypt function
      // Common patterns in AnimeKai: the decrypt is in a module that's loaded by the bundle
      
      // Check for the decrypt in the _ global's numeric properties
      const results = {};
      
      if (typeof _ === 'function') {
        // The _ object has numeric properties that are modules
        // Let's find the one that has encrypt/decrypt
        
        // Check _[371508] which was seen in the bundle
        if (_[371508]) {
          results.has371508 = true;
          const props371508 = {};
          for (const key of Object.getOwnPropertyNames(_[371508])) {
            props371508[key] = typeof _[371508][key];
          }
          results.props371508 = props371508;
        }
        
        // Check _[126765]
        if (_[126765]) {
          results.has126765 = true;
          results.type126765 = typeof _[126765];
        }
        
        // Check _[565766]
        if (_[565766]) {
          results.has565766 = true;
          if (_[565766].p_mLjDq) {
            results.hasShuffle = true;
            // Try calling the shuffle
            try {
              const shuffleResult = _[565766].p_mLjDq(5, 2, [5]);
              results.shuffleTest = JSON.stringify(shuffleResult).substring(0, 200);
            } catch (e) {
              results.shuffleError = e.message;
            }
          }
        }
        
        // Try to find encrypt/decrypt by searching for functions that
        // take a string and return a string
        const stringFuncs = [];
        for (const key of Object.getOwnPropertyNames(_)) {
          if (typeof _[key] === 'function') {
            try {
              const result = _[key]('test');
              if (typeof result === 'string' && result !== 'test' && result.length > 0) {
                stringFuncs.push({ key, inputLen: 4, outputLen: result.length, output: result.substring(0, 50) });
              }
            } catch {}
          }
        }
        results.stringFuncs = stringFuncs.slice(0, 20);
      }
      
      return results;
    }, syncData.anime_id);
    
    console.log('Decrypt search result:', JSON.stringify(decryptResult, null, 2));

    // If we found string-transforming functions, test them more
    if (decryptResult.stringFuncs?.length > 0) {
      console.log('\n=== Testing string-transforming functions ===');
      for (const fn of decryptResult.stringFuncs) {
        console.log(`  _[${fn.key}]('test') → '${fn.output}' (len ${fn.outputLen})`);
      }
    }

    // Let's try yet another approach: intercept the actual decrypt by
    // overriding the response processing
    console.log('\n=== Hooking AJAX to capture decrypt ===');
    
    const hookResult = await page.evaluate(async (animeId, rustEncId) => {
      return new Promise((resolve) => {
        const results = {};
        
        // Hook XMLHttpRequest to intercept the response processing
        const origXHROpen = XMLHttpRequest.prototype.open;
        const origXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._kiro_url = url;
          return origXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
          const xhr = this;
          
          if (xhr._kiro_url && xhr._kiro_url.includes('/ajax/episodes/list')) {
            const origOnReady = xhr.onreadystatechange;
            xhr.onreadystatechange = function() {
              if (xhr.readyState === 4) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  results.episodesResponse = {
                    hasResult: !!data.result,
                    resultType: typeof data.result,
                    resultLen: data.result?.length
                  };
                } catch {}
              }
              if (origOnReady) origOnReady.apply(this, arguments);
            };
          }
          
          return origXHRSend.call(this, ...args);
        };
        
        // Make the actual API call
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `/ajax/episodes/list?ani_id=${animeId}&_=${rustEncId}`);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onload = function() {
          try {
            const data = JSON.parse(xhr.responseText);
            results.directCall = {
              status: xhr.status,
              hasResult: !!data.result,
              resultLen: data.result?.length,
              resultPreview: data.result?.substring(0, 100)
            };
          } catch (e) {
            results.directCall = { error: e.message };
          }
          
          // Restore
          XMLHttpRequest.prototype.open = origXHROpen;
          XMLHttpRequest.prototype.send = origXHRSend;
          
          resolve(results);
        };
        xhr.onerror = function() {
          resolve({ error: 'XHR error' });
        };
        xhr.send();
      });
    }, syncData.anime_id, rustExec(syncData.anime_id, 'kai-encrypt'));
    
    console.log('Hook result:', JSON.stringify(hookResult, null, 2));

    // Now let's try to get a link/view response and decrypt it using the page's JS
    // We need to find the decrypt function first
    
    // Let's search the bundle for the actual encrypt/decrypt implementation
    if (bundleSource) {
      // The encrypt function likely has a pattern like:
      // - Takes a string
      // - Iterates over characters
      // - Looks up each char in a table based on position
      // - Produces bytes
      // - Base64 encodes
      
      // Search for the encrypt/decrypt by looking for the header constant
      // The header is 'c509bdb497cbc06873ff412af12fd8007624c29faa'
      // In the bundle, it might be stored as individual bytes or a hex string
      
      // Search for 0xc5 near 0x09 (first two header bytes)
      const headerRegion = [];
      let searchIdx = 0;
      while (true) {
        const idx = bundleSource.indexOf('0xc5', searchIdx);
        if (idx === -1) break;
        // Check if 0x09 is nearby
        const nearby = bundleSource.substring(idx, idx + 100);
        if (nearby.includes('0x09') || nearby.includes('0x9')) {
          headerRegion.push({ idx, context: bundleSource.substring(Math.max(0, idx - 50), idx + 200) });
        }
        searchIdx = idx + 1;
        if (headerRegion.length >= 5) break;
      }
      
      if (headerRegion.length > 0) {
        console.log(`\nFound ${headerRegion.length} potential header locations:`);
        for (const h of headerRegion) {
          console.log(`  At ${h.idx}: ...${h.context.substring(0, 150)}...`);
        }
      }
      
      // Search for "c509" as a string
      const hexIdx = bundleSource.indexOf('c509');
      if (hexIdx !== -1) {
        console.log(`\nFound "c509" at index ${hexIdx}:`);
        console.log(bundleSource.substring(Math.max(0, hexIdx - 100), hexIdx + 200));
      }
      
      // Search for the constant 197 (0xc5) near 9 (0x09)
      const dec197 = [];
      searchIdx = 0;
      while (true) {
        const idx = bundleSource.indexOf('197', searchIdx);
        if (idx === -1 || dec197.length >= 3) break;
        const nearby = bundleSource.substring(idx - 5, idx + 50);
        if (/\b9\b/.test(nearby)) {
          dec197.push({ idx, context: bundleSource.substring(Math.max(0, idx - 30), idx + 100) });
        }
        searchIdx = idx + 1;
      }
      if (dec197.length > 0) {
        console.log(`\nFound ${dec197.length} potential decimal header locations`);
      }
    }

  } finally {
    await browser.close();
    console.log('\nBrowser closed.');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
