#!/usr/bin/env node
/**
 * Extract AnimeKai decrypt tables via Puppeteer v3.
 * Handles Cloudflare challenges and page navigation.
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

async function waitForAnimeKai(page, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const ready = await page.evaluate(() => {
        return {
          hasSync: !!document.getElementById('syncData'),
          hasUnderscore: typeof _ === 'function',
          url: window.location.href,
          title: document.title,
        };
      });
      if (ready.hasSync && ready.hasUnderscore) {
        console.log(`Page ready: ${ready.title}`);
        return true;
      }
      console.log(`Waiting... sync=${ready.hasSync} _=${ready.hasUnderscore} url=${ready.url.substring(0, 50)}`);
    } catch {
      console.log('Page navigating...');
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

async function main() {
  console.log('=== AnimeKai Table Extraction v3 ===\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  
  // Use stealth-like settings
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  console.log('Navigating to AnimeKai...');
  try {
    await page.goto('https://animekai.to/watch/bleach-re3j', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  } catch (e) {
    console.log('Navigation timeout, continuing...');
  }

  // Wait for the page to be ready
  const ready = await waitForAnimeKai(page);
  if (!ready) {
    console.log('Page did not become ready. Taking screenshot...');
    await page.screenshot({ path: 'scripts/kai-page-screenshot.png' });
    
    // Try to get page content
    try {
      const html = await page.content();
      console.log('Page HTML length:', html.length);
      console.log('Page HTML preview:', html.substring(0, 500));
    } catch {}
    
    await browser.close();
    return;
  }

  // Get syncData
  const syncData = await page.evaluate(() => {
    const el = document.getElementById('syncData');
    return el ? JSON.parse(el.textContent) : null;
  });
  console.log('anime_id:', syncData?.anime_id);

  // Get window.__$
  const windowKey = await page.evaluate(() => window.__$ || null);
  console.log('window.__$:', windowKey ? windowKey.substring(0, 50) + '...' : 'NOT FOUND');

  // Now the critical part: find and call the decrypt function
  // The site's bundle.js has the decrypt logic
  // Let's try to find it by examining the _ global
  
  console.log('\n=== Probing _ global ===');
  
  const probeResult = await page.evaluate(() => {
    const info = {};
    
    if (typeof _ !== 'function') return { error: 'no _ global' };
    
    // Get all function properties
    const funcs = [];
    for (const key of Object.getOwnPropertyNames(_)) {
      if (typeof _[key] === 'function' && !/^\d+$/.test(key)) {
        funcs.push(key);
      }
    }
    info.functions = funcs;
    
    // Get numeric properties with objects
    const numObjs = [];
    for (const key of Object.getOwnPropertyNames(_)) {
      if (/^\d+$/.test(key) && typeof _[key] === 'object' && _[key] !== null) {
        const objKeys = Object.keys(_[key]).slice(0, 5);
        numObjs.push({ key: parseInt(key), objKeys });
      }
    }
    info.numericObjects = numObjs;
    
    // Check specific known properties
    info.has565766 = typeof _[565766] !== 'undefined';
    info.has371508 = typeof _[371508] !== 'undefined';
    
    // Try to find the encrypt/decrypt by testing functions
    // The encrypt function takes a short string (like an ID) and returns a longer base64 string
    // The decrypt function takes a long base64 string and returns a shorter JSON string
    
    const testInput = 'test123';
    const encryptCandidates = [];
    
    for (const key of funcs) {
      try {
        const result = _[key](testInput);
        if (typeof result === 'string' && result.length > testInput.length * 2) {
          // Could be encrypt — the output is much longer
          encryptCandidates.push({ key, outputLen: result.length, output: result.substring(0, 60) });
        }
      } catch {}
    }
    info.encryptCandidates = encryptCandidates;
    
    return info;
  });
  
  console.log('Probe result:', JSON.stringify(probeResult, null, 2));

  // Now let's try to get an encrypted response and decrypt it
  const encId = rustExec(syncData.anime_id, 'kai-encrypt');
  
  // Get episodes
  const epResult = await page.evaluate(async (animeId, encId) => {
    try {
      const resp = await fetch(`/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
      });
      const data = await resp.json();
      if (!data.result) return { error: 'no result' };
      
      const tokens = [...data.result.matchAll(/token="([^"]+)"/g)].map(m => m[1]);
      return { tokens: tokens.slice(0, 2) };
    } catch (e) {
      return { error: e.message };
    }
  }, syncData.anime_id, encId);
  
  console.log('Episodes:', epResult);
  
  if (!epResult.tokens?.length) {
    await browser.close();
    return;
  }
  
  // Get servers
  const token = epResult.tokens[0];
  const encToken = rustExec(token, 'kai-encrypt');
  
  const srvResult = await page.evaluate(async (token, encToken) => {
    try {
      const resp = await fetch(`/ajax/links/list?token=${token}&_=${encToken}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
      });
      const data = await resp.json();
      if (!data.result) return { error: 'no result' };
      
      const lids = [...data.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
      return { lids: lids.slice(0, 4) };
    } catch (e) {
      return { error: e.message };
    }
  }, token, encToken);
  
  console.log('Servers:', srvResult);
  
  if (!srvResult.lids?.length) {
    await browser.close();
    return;
  }
  
  // Get encrypted link/view response
  const lid = srvResult.lids[0];
  const encLid = rustExec(lid, 'kai-encrypt');
  
  const viewResult = await page.evaluate(async (lid, encLid) => {
    try {
      const resp = await fetch(`/ajax/links/view?id=${lid}&_=${encLid}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
      });
      const data = await resp.json();
      return { encrypted: data.result || null };
    } catch (e) {
      return { error: e.message };
    }
  }, lid, encLid);
  
  console.log('Encrypted response:', viewResult.encrypted?.substring(0, 60));
  
  if (!viewResult.encrypted) {
    await browser.close();
    return;
  }
  
  // NOW: Try to find the decrypt function by brute-forcing through _ properties
  console.log('\n=== Searching for decrypt function ===');
  
  const decryptSearch = await page.evaluate((encrypted) => {
    const results = {};
    
    // Try every function on _ with the encrypted string
    for (const key of Object.getOwnPropertyNames(_)) {
      if (typeof _[key] === 'function') {
        try {
          const result = _[key](encrypted);
          if (typeof result === 'string' && result.length > 10 && result.length < encrypted.length) {
            // Shorter output = could be decrypt
            if (result.includes('{') || result.includes('url') || result.includes('http')) {
              results[key] = { output: result.substring(0, 300), len: result.length };
            }
          }
        } catch {}
      }
    }
    
    // Also try calling with additional arguments
    for (const key of Object.getOwnPropertyNames(_)) {
      if (typeof _[key] === 'function') {
        try {
          const result = _[key](encrypted, 'dec-kai');
          if (typeof result === 'string' && result.includes('{')) {
            results[`${key}_with_dec-kai`] = { output: result.substring(0, 300), len: result.length };
          }
        } catch {}
        try {
          const result = _[key](encrypted, 'decrypt');
          if (typeof result === 'string' && result.includes('{')) {
            results[`${key}_with_decrypt`] = { output: result.substring(0, 300), len: result.length };
          }
        } catch {}
      }
    }
    
    return results;
  }, viewResult.encrypted);
  
  console.log('Decrypt search results:', JSON.stringify(decryptSearch, null, 2));
  
  // If no direct function found, try the click approach
  if (Object.keys(decryptSearch).length === 0) {
    console.log('\nNo direct decrypt function found. Trying click approach...');
    
    // Set up interception before clicking
    await page.evaluate(() => {
      // Hook into the iframe/embed creation to capture the decrypted URL
      window.__kiro_embed_urls = [];
      
      const origCreateElement = document.createElement.bind(document);
      document.createElement = function(tag) {
        const el = origCreateElement(tag);
        if (tag.toLowerCase() === 'iframe') {
          const origSetAttr = el.setAttribute.bind(el);
          el.setAttribute = function(name, value) {
            if (name === 'src' && value.includes('http')) {
              window.__kiro_embed_urls.push(value);
            }
            return origSetAttr(name, value);
          };
          // Also watch the src property
          Object.defineProperty(el, 'src', {
            set: function(v) {
              if (v && v.includes('http')) {
                window.__kiro_embed_urls.push(v);
              }
              origSetAttr('src', v);
            },
            get: function() { return el.getAttribute('src'); }
          });
        }
        return el;
      };
      
      // Also hook window.open
      const origOpen = window.open;
      window.open = function(url) {
        if (url) window.__kiro_embed_urls.push(url);
        return origOpen.apply(this, arguments);
      };
    });
    
    // Click on the first server button
    const clickResult = await page.evaluate(() => {
      const btns = document.querySelectorAll('.server[data-lid]');
      if (btns.length > 0) {
        btns[0].click();
        return { clicked: true, lid: btns[0].getAttribute('data-lid'), count: btns.length };
      }
      // Try alternative selectors
      const altBtns = document.querySelectorAll('[data-lid]');
      if (altBtns.length > 0) {
        altBtns[0].click();
        return { clicked: true, lid: altBtns[0].getAttribute('data-lid'), count: altBtns.length, alt: true };
      }
      return { clicked: false };
    });
    
    console.log('Click result:', clickResult);
    
    if (clickResult.clicked) {
      // Wait for the response to be processed
      await new Promise(r => setTimeout(r, 5000));
      
      // Check captured URLs
      const capturedUrls = await page.evaluate(() => window.__kiro_embed_urls);
      console.log('Captured embed URLs:', capturedUrls);
      
      // Check if an iframe was created
      const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(f => ({
          src: f.src,
          id: f.id,
          className: f.className
        }));
      });
      console.log('Iframes:', iframes);
      
      // If we got an embed URL, that's the decrypted result!
      if (capturedUrls.length > 0 || iframes.some(f => f.src.includes('http'))) {
        const embedUrl = capturedUrls[0] || iframes.find(f => f.src.includes('http'))?.src;
        console.log('\n*** DECRYPTED EMBED URL: ***', embedUrl);
        
        // Now we have a known plaintext-ciphertext pair!
        // The plaintext is the JSON containing this URL
        // We can use this to build the tables
      }
    }
  }

  // Keep browser open for manual inspection if needed
  console.log('\nKeeping browser open for 10 seconds...');
  await new Promise(r => setTimeout(r, 10000));
  
  await browser.close();
  console.log('Done.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
