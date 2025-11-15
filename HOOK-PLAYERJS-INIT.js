const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * HOOK PLAYERJS INITIALIZATION
 * 
 * This script hooks into the PlayerJS player initialization
 * to capture the exact moment when the encoded hash is decoded
 */

async function hookPlayerJSInit() {
  console.log('🎯 Hooking into PlayerJS initialization...\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true
  });

  const page = await browser.newPage();

  // Inject hooks before page loads
  await page.evaluateOnNewDocument(() => {
    // Hook into PlayerJS constructor
    window.playerJSHooks = {
      configs: [],
      decoderCalls: [],
      fileUrls: []
    };

    // Override Object.defineProperty to catch PlayerJS setup
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
      if (prop === 'file' && descriptor.value && typeof descriptor.value === 'string') {
        console.log('🔍 FILE PROPERTY SET:', descriptor.value);
        window.playerJSHooks.fileUrls.push(descriptor.value);
      }
      return originalDefineProperty.call(this, obj, prop, descriptor);
    };

    // Hook common player initialization patterns
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (name === 'data-file' || name === 'data-source') {
        console.log('🔍 PLAYER DATA ATTRIBUTE:', name, value);
        window.playerJSHooks.fileUrls.push(value);
      }
      return originalSetAttribute.call(this, name, value);
    };

    // Monitor script execution
    const originalEval = window.eval;
    window.eval = function(code) {
      if (code.includes('file:') || code.includes('.m3u8')) {
        console.log('🔍 EVAL WITH M3U8:', code.substring(0, 200));
        window.playerJSHooks.decoderCalls.push({
          type: 'eval',
          code: code.substring(0, 500)
        });
      }
      return originalEval.call(this, code);
    };

    // Hook Function constructor
    const OriginalFunction = window.Function;
    window.Function = function(...args) {
      const code = args[args.length - 1];
      if (typeof code === 'string' && (code.includes('file:') || code.includes('.m3u8'))) {
        console.log('🔍 FUNCTION WITH M3U8:', code.substring(0, 200));
        window.playerJSHooks.decoderCalls.push({
          type: 'Function',
          code: code.substring(0, 500)
        });
      }
      return new OriginalFunction(...args);
    };
  });

  const testUrl = 'https://pro.rcp.best/e/?id=tt0137523';
  console.log(`📡 Loading: ${testUrl}\n`);
  
  await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for player to initialize
  await page.waitForTimeout(5000);

  // Extract the hooks data
  const hooksData = await page.evaluate(() => {
    return {
      hooks: window.playerJSHooks,
      // Try to find PlayerJS instance
      playerInstance: window.Playerjs ? {
        exists: true,
        prototype: Object.getOwnPropertyNames(window.Playerjs.prototype)
      } : null,
      // Get all global variables that might be PlayerJS
      globals: Object.keys(window).filter(k => 
        k.toLowerCase().includes('player') || 
        k.toLowerCase().includes('pjs') ||
        k.toLowerCase().includes('sbx')
      )
    };
  });

  console.log('\n📊 HOOKS DATA:\n');
  console.log('File URLs found:', hooksData.hooks.fileUrls);
  console.log('Decoder calls:', hooksData.hooks.decoderCalls.length);
  console.log('PlayerJS instance:', hooksData.playerInstance);
  console.log('Player-related globals:', hooksData.globals);

  // Now try to call the decoder directly
  console.log('\n🔍 ATTEMPTING DIRECT DECODER EXTRACTION...\n');

  const decoderExtraction = await page.evaluate(() => {
    // Get the pjsdiv content
    const pjsDiv = document.querySelector('[id^="pjsdiv"]');
    if (!pjsDiv) return { error: 'No pjsdiv found' };

    const encodedHash = pjsDiv.textContent;
    const divId = pjsDiv.id;

    console.log('🔍 Encoded hash:', encodedHash.substring(0, 100));
    console.log('🔍 Div ID:', divId);

    // Try to find and call the decoder
    const results = {
      encodedHash: encodedHash.substring(0, 200),
      divId,
      attempts: []
    };

    // Method 1: Look for global decoder functions
    const potentialDecoders = ['sbx', 'SBX', 'decode', 'decoder', 'decrypt'];
    for (const name of potentialDecoders) {
      if (typeof window[name] === 'function') {
        try {
          const decoded = window[name](encodedHash);
          results.attempts.push({
            method: `window.${name}()`,
            success: true,
            result: decoded
          });
        } catch (e) {
          results.attempts.push({
            method: `window.${name}()`,
            success: false,
            error: e.message
          });
        }
      }
    }

    // Method 2: Try common decoding patterns manually
    try {
      // URL-safe base64 decode
      const urlSafeDecoded = encodedHash.replace(/-/g, '+').replace(/_/g, '/');
      const base64Decoded = atob(urlSafeDecoded);
      results.attempts.push({
        method: 'URL-safe base64 decode',
        success: true,
        result: base64Decoded.substring(0, 100),
        length: base64Decoded.length
      });

      // Try reverse
      const reversed = base64Decoded.split('').reverse().join('');
      results.attempts.push({
        method: 'Reversed',
        result: reversed.substring(0, 100)
      });

      // Try XOR with divId
      const xorKey = divId.replace('pjsdiv', '');
      let xorResult = '';
      for (let i = 0; i < base64Decoded.length; i++) {
        const keyChar = xorKey.charCodeAt(i % xorKey.length);
        xorResult += String.fromCharCode(base64Decoded.charCodeAt(i) ^ keyChar);
      }
      results.attempts.push({
        method: 'XOR with divId',
        result: xorResult.substring(0, 100)
      });

    } catch (e) {
      results.attempts.push({
        method: 'Manual decoding',
        success: false,
        error: e.message
      });
    }

    return results;
  });

  console.log('\n📊 DECODER EXTRACTION RESULTS:\n');
  console.log(JSON.stringify(decoderExtraction, null, 2));

  // Save results
  fs.writeFileSync('decoder-extraction-results.json', JSON.stringify(decoderExtraction, null, 2));
  console.log('\n💾 Results saved to decoder-extraction-results.json');

  console.log('\n✅ Extraction complete. Browser kept open for inspection.');
  await new Promise(() => {});
}

hookPlayerJSInit().catch(console.error);
