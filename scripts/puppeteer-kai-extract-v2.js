#!/usr/bin/env node
/**
 * Extract AnimeKai decrypt tables via Puppeteer.
 * Load the page, wait for the crypto bundle, then extract tables.
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

async function main() {
  console.log('=== AnimeKai Table Extraction v2 ===\n');

  const browser = await puppeteer.launch({
    headless: false, // Use headed mode to handle Cloudflare
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');

  // Capture ALL scripts
  const capturedScripts = {};
  page.on('response', async resp => {
    const url = resp.url();
    if (url.endsWith('.js') && !url.includes('cloudflare') && !url.includes('swiper') && !url.includes('jquery') && !url.includes('bootstrap')) {
      try {
        const text = await resp.text();
        if (text.length > 10000 && (text.includes('565766') || text.includes('p_mLjDq') || text.includes('charCodeAt'))) {
          capturedScripts[url] = text;
          console.log(`[CAPTURED] ${url} (${text.length} chars) — contains crypto patterns!`);
        }
      } catch {}
    }
  });

  console.log('Navigating to AnimeKai...');
  await page.goto('https://animekai.to/watch/bleach-re3j', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait for the page to fully load (including Cloudflare challenge if any)
  console.log('Waiting for page to settle...');
  await new Promise(r => setTimeout(r, 10000));

  // Check if we got past Cloudflare
  const title = await page.title();
  console.log('Page title:', title);

  // Check for syncData
  const hasSyncData = await page.evaluate(() => !!document.getElementById('syncData'));
  console.log('Has syncData:', hasSyncData);

  if (!hasSyncData) {
    console.log('Page may be blocked by Cloudflare. Waiting longer...');
    await new Promise(r => setTimeout(r, 15000));
    
    const title2 = await page.title();
    console.log('Page title after wait:', title2);
    
    const hasSyncData2 = await page.evaluate(() => !!document.getElementById('syncData'));
    console.log('Has syncData after wait:', hasSyncData2);
    
    if (!hasSyncData2) {
      // Try navigating again
      console.log('Retrying navigation...');
      await page.goto('https://animekai.to/watch/bleach-re3j', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Check for the _ global and window.__$
  const pageState = await page.evaluate(() => {
    return {
      hasUnderscore: typeof _ === 'function',
      hasWindowKey: typeof window.__$ !== 'undefined',
      windowKey: window.__$ ? String(window.__$).substring(0, 60) : null,
      hasSyncData: !!document.getElementById('syncData'),
      syncData: document.getElementById('syncData')?.textContent?.substring(0, 100),
      url: window.location.href,
      title: document.title,
    };
  });
  console.log('\nPage state:', JSON.stringify(pageState, null, 2));

  if (!pageState.hasUnderscore) {
    console.log('\nThe _ global is not available. The crypto bundle may not have loaded.');
    console.log('Captured scripts:', Object.keys(capturedScripts).length);
    
    // List all scripts on the page
    const allScripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    });
    console.log('Scripts on page:', allScripts);
    
    // Check inline scripts
    const inlineScripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script:not([src])')).map(s => ({
        len: s.textContent.length,
        preview: s.textContent.substring(0, 100)
      }));
    });
    console.log('Inline scripts:', inlineScripts);
    
    await browser.close();
    return;
  }

  // Great! The _ global exists. Now let's extract the decrypt function.
  console.log('\n=== Extracting decrypt tables ===');

  // The decrypt function works by:
  // 1. Base64 decode the input
  // 2. Skip 21-byte header
  // 3. For each plaintext position, look up the cipher byte in a substitution table
  // 4. The table maps byte → char
  
  // We can extract the tables by calling the decrypt function with crafted inputs
  // where we control exactly one byte at a time.
  
  // But first, we need to FIND the decrypt function.
  // Let's try to trigger an actual decrypt by making an API call.
  
  const syncData = await page.evaluate(() => {
    const el = document.getElementById('syncData');
    return el ? JSON.parse(el.textContent) : null;
  });
  
  if (!syncData) {
    console.log('No syncData!');
    await browser.close();
    return;
  }
  
  console.log('anime_id:', syncData.anime_id);
  
  // Now let's hook into the decrypt function
  // The site's JS calls decrypt when processing AJAX responses
  // We'll override the function to capture the tables
  
  const tables = await page.evaluate(async (animeId, encId) => {
    // First, let's find the decrypt function by making an API call
    // and intercepting the processing
    
    // The site uses jQuery AJAX. Let's hook into it.
    const results = { tables: null, error: null };
    
    try {
      // Make the episodes API call
      const resp = await fetch(`/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      const data = await resp.json();
      
      if (data.result) {
        results.hasEpisodes = true;
        results.resultLen = data.result.length;
        
        // The result is HTML, not encrypted. Episodes list is not encrypted.
        // Only link/view responses are encrypted.
        
        // Get a token from the episodes
        const tokenMatch = data.result.match(/token="([^"]+)"/);
        if (tokenMatch) {
          results.token = tokenMatch[1];
        }
      }
    } catch (e) {
      results.error = e.message;
    }
    
    return results;
  }, syncData.anime_id, rustExec(syncData.anime_id, 'kai-encrypt'));
  
  console.log('API call result:', JSON.stringify(tables, null, 2));
  
  if (tables.token) {
    // Now get the servers and a link/view response
    const encToken = rustExec(tables.token, 'kai-encrypt');
    
    const linkResult = await page.evaluate(async (token, encToken) => {
      const results = {};
      
      try {
        // Get servers
        const srvResp = await fetch(`/ajax/links/list?token=${token}&_=${encToken}`, {
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        });
        const srvData = await srvResp.json();
        
        if (srvData.result) {
          const lidMatch = srvData.result.match(/data-lid="([^"]+)"/);
          if (lidMatch) {
            results.lid = lidMatch[1];
          }
        }
      } catch (e) {
        results.error = e.message;
      }
      
      return results;
    }, tables.token, encToken);
    
    console.log('Link result:', JSON.stringify(linkResult, null, 2));
    
    if (linkResult.lid) {
      const encLid = rustExec(linkResult.lid, 'kai-encrypt');
      
      // Now get the encrypted link/view response
      // AND try to decrypt it using the page's own JS
      const viewResult = await page.evaluate(async (lid, encLid) => {
        const results = {};
        
        try {
          const viewResp = await fetch(`/ajax/links/view?id=${lid}&_=${encLid}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
          });
          const viewData = await viewResp.json();
          
          if (viewData.result) {
            results.encrypted = viewData.result;
            results.encryptedLen = viewData.result.length;
            
            // Now try to find and call the decrypt function
            // The site's JS should have a function that decrypts this
            
            // Check if there's a global decrypt function
            // Common patterns: window.decrypt, _.decrypt, or a module function
            
            // Let's try to find it by checking the _ object's methods
            if (typeof _ === 'function') {
              // Try all function properties
              for (const key of Object.getOwnPropertyNames(_)) {
                if (typeof _[key] === 'function') {
                  try {
                    const result = _[key](viewData.result);
                    if (typeof result === 'string' && (result.includes('{') || result.includes('url'))) {
                      results.decryptKey = key;
                      results.decrypted = result.substring(0, 200);
                      break;
                    }
                  } catch {}
                }
              }
            }
            
            // Also try window-level functions
            for (const key of ['decrypt', 'dec', 'decode', 'decryptResult']) {
              if (typeof window[key] === 'function') {
                try {
                  const result = window[key](viewData.result);
                  if (typeof result === 'string') {
                    results.windowDecryptKey = key;
                    results.windowDecrypted = result.substring(0, 200);
                  }
                } catch {}
              }
            }
          }
        } catch (e) {
          results.error = e.message;
        }
        
        return results;
      }, linkResult.lid, encLid);
      
      console.log('\nView result:', JSON.stringify(viewResult, null, 2));
      
      if (viewResult.encrypted && !viewResult.decrypted) {
        // The decrypt function wasn't found by simple enumeration
        // Let's try a more sophisticated approach: hook into the jQuery AJAX
        // success handler and trigger the call through the site's own UI
        
        console.log('\nTrying to find decrypt via jQuery AJAX hook...');
        
        // Set up the hook
        await page.evaluate((encrypted) => {
          window.__kiro_encrypted = encrypted;
          window.__kiro_decrypted = null;
          
          // Hook String.fromCharCode to detect when decrypt is called
          const origFromCharCode = String.fromCharCode;
          let callCount = 0;
          let lastResult = '';
          
          String.fromCharCode = function(...args) {
            const result = origFromCharCode.apply(this, args);
            callCount++;
            if (callCount > 10 && callCount < 500) {
              lastResult += result;
            }
            return result;
          };
          
          // Also hook atob
          const origAtob = window.atob;
          window.atob = function(str) {
            const result = origAtob.call(this, str);
            if (str.length > 50) {
              window.__kiro_atob_input = str.substring(0, 60);
              window.__kiro_atob_output_len = result.length;
            }
            return result;
          };
          
          window.__kiro_getDecryptResult = () => {
            String.fromCharCode = origFromCharCode;
            window.atob = origAtob;
            return { callCount, lastResult: lastResult.substring(0, 500) };
          };
        }, viewResult.encrypted);
        
        // Now try to trigger the decrypt by simulating what the site does
        // when it receives a link/view response
        
        // The site likely has a click handler on server buttons that makes
        // the AJAX call and processes the response
        
        // Let's try clicking on a server button
        const clicked = await page.evaluate(() => {
          // Find server buttons
          const btns = document.querySelectorAll('[data-lid]');
          if (btns.length > 0) {
            btns[0].click();
            return { clicked: true, lid: btns[0].getAttribute('data-lid') };
          }
          return { clicked: false };
        });
        
        console.log('Click result:', clicked);
        
        if (clicked.clicked) {
          // Wait for the AJAX call to complete
          await new Promise(r => setTimeout(r, 3000));
          
          // Check if decrypt was called
          const decryptInfo = await page.evaluate(() => {
            return window.__kiro_getDecryptResult();
          });
          console.log('Decrypt info:', JSON.stringify(decryptInfo, null, 2));
          
          if (decryptInfo.lastResult && decryptInfo.lastResult.includes('url')) {
            console.log('\n*** DECRYPT CAPTURED! ***');
            console.log('Decrypted:', decryptInfo.lastResult);
          }
        }
      }
      
      if (viewResult.decrypted) {
        console.log('\n*** DECRYPT FUNCTION FOUND! ***');
        console.log('Key:', viewResult.decryptKey);
        console.log('Decrypted:', viewResult.decrypted);
        
        // Now we can extract the tables by calling the decrypt function
        // with crafted inputs
      }
    }
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
