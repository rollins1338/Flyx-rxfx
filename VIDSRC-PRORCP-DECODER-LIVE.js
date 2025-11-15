const puppeteer = require('puppeteer');

/**
 * VIDSRC PRO.RCP DECODER - Live extraction
 * 
 * Flow:
 * 1. Load vidsrc.xyz/embed/movie/{tmdbID}
 * 2. Extract RCP hash from page
 * 3. Navigate to cloudnestra.com/rcp/{hash}
 * 4. Extract PRO.RCP hash
 * 5. Navigate to cloudnestra.com/prorcp/{hash}
 * 6. Watch the decoder in action to extract the algorithm
 */

async function extractVidsrcProRCPDecoder() {
  console.log('🎯 Starting VidSrc PRO.RCP decoder extraction...\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true
  });

  const page = await browser.newPage();

  // Inject comprehensive monitoring
  await page.evaluateOnNewDocument(() => {
    window.decoderWatch = {
      encodedHash: null,
      decodedUrl: null,
      divId: null,
      transformations: [],
      allAtobCalls: []
    };

    // Track ALL atob calls with full input/output
    const originalAtob = window.atob;
    window.atob = function(input) {
      const output = originalAtob.call(this, input);
      
      const record = {
        input: input,
        output: output,
        inputLength: input.length,
        outputLength: output.length,
        timestamp: Date.now(),
        stack: new Error().stack
      };
      
      window.decoderWatch.allAtobCalls.push(record);
      
      console.log('🔍 ATOB CALL #' + window.decoderWatch.allAtobCalls.length);
      console.log('   Input (first 100):', input.substring(0, 100));
      console.log('   Output (first 100):', output.substring(0, 100));
      
      // Check if this is the m3u8 URL
      if (output.includes('.m3u8') || output.includes('http')) {
        console.log('🎯🎯🎯 FOUND M3U8 URL!');
        console.log('   Full URL:', output);
        window.decoderWatch.decodedUrl = output;
      }
      
      return output;
    };

    // Track string replacements (URL-safe base64)
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function(search, replacement) {
      const result = originalReplace.call(this, search, replacement);
      
      // Track URL-safe base64 conversions
      if (this.length > 100 && (search.toString().includes('-') || search.toString().includes('_'))) {
        window.decoderWatch.transformations.push({
          operation: 'replace',
          type: 'URL-safe base64 conversion',
          inputLength: this.length,
          outputLength: result.length,
          search: search.toString(),
          replacement: replacement.toString(),
          timestamp: Date.now()
        });
        console.log('🔍 URL-safe base64 replace detected');
      }
      
      return result;
    };

    // Track XOR operations via charCodeAt
    const originalCharCodeAt = String.prototype.charCodeAt;
    let charCodeCallCount = 0;
    let lastString = null;
    
    String.prototype.charCodeAt = function(index) {
      const result = originalCharCodeAt.call(this, index);
      
      if (this.length > 100) {
        if (lastString !== this) {
          charCodeCallCount = 0;
          lastString = this;
        }
        charCodeCallCount++;
        
        if (charCodeCallCount === 1) {
          console.log('🔍 XOR pattern detected (charCodeAt loop starting)');
          window.decoderWatch.transformations.push({
            operation: 'charCodeAt',
            type: 'XOR decryption pattern',
            stringLength: this.length,
            timestamp: Date.now()
          });
        }
      }
      
      return result;
    };

    // Monitor pjsdiv
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.id && node.id.startsWith('pjsdiv')) {
            console.log('🔍🔍🔍 PJSDIV DETECTED!');
            console.log('   ID:', node.id);
            console.log('   Content length:', node.textContent.length);
            console.log('   First 100 chars:', node.textContent.substring(0, 100));
            
            window.decoderWatch.encodedHash = node.textContent;
            window.decoderWatch.divId = node.id;
          }
        });
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });

  // Step 1: Load VidSrc embed page
  const tmdbId = 'tt0137523'; // Fight Club
  const vidsrcUrl = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
  console.log(`[1] Loading VidSrc: ${vidsrcUrl}\n`);
  
  await page.goto(vidsrcUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Extract RCP hash from VidSrc page
  console.log('[2] Extracting RCP hash...\n');
  const rcpHash = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map(s => s.textContent).join('\n');
    const match = scripts.match(/\/rcp\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  });

  if (!rcpHash) {
    console.log('❌ No RCP hash found');
    await browser.close();
    return;
  }

  console.log(`✅ RCP Hash: ${rcpHash}\n`);

  // Step 3: Navigate to RCP page
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  console.log(`[3] Loading RCP: ${rcpUrl}\n`);
  
  await page.goto(rcpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 4: Extract PRO.RCP hash
  console.log('[4] Extracting PRO.RCP hash...\n');
  const prorcpHash = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map(s => s.textContent).join('\n');
    const match = scripts.match(/\/prorcp\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  });

  if (!prorcpHash) {
    console.log('❌ No PRO.RCP hash found');
    await browser.close();
    return;
  }

  console.log(`✅ PRO.RCP Hash: ${prorcpHash}\n`);

  // Step 5: Navigate to PRO.RCP player page
  const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
  console.log(`[5] Loading PRO.RCP player: ${prorcpUrl}`);
  console.log('    🔬 WATCH THE CONSOLE - DECODER WILL BE INTERCEPTED!\n');
  
  await page.goto(prorcpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait for player to initialize and decode
  console.log('⏳ Waiting for player initialization and decoding...\n');
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Extract all the intercepted data
  const watchData = await page.evaluate(() => {
    return window.decoderWatch;
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 DECODER INTERCEPTION RESULTS');
  console.log('='.repeat(80) + '\n');

  console.log('Encoded Hash:', watchData.encodedHash?.substring(0, 100));
  console.log('Div ID:', watchData.divId);
  console.log('Decoded URL:', watchData.decodedUrl);
  console.log('\nTotal atob calls:', watchData.allAtobCalls.length);
  console.log('Total transformations:', watchData.transformations.length);

  // Analyze the atob calls to find the decoder
  if (watchData.allAtobCalls.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ATOB CALL ANALYSIS');
    console.log('='.repeat(80) + '\n');

    watchData.allAtobCalls.forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`);
      console.log(`  Input length: ${call.inputLength}`);
      console.log(`  Output length: ${call.outputLength}`);
      console.log(`  Input (first 100): ${call.input.substring(0, 100)}`);
      console.log(`  Output (first 100): ${call.output.substring(0, 100)}`);
      
      // Check if input matches our encoded hash
      if (watchData.encodedHash && call.input.includes(watchData.encodedHash.substring(0, 50))) {
        console.log('  ⭐⭐⭐ THIS CALL PROCESSES THE ENCODED HASH!');
      }
      
      if (call.output.includes('.m3u8')) {
        console.log('  🎯🎯🎯 THIS CALL PRODUCES THE M3U8 URL!');
      }
    });
  }

  // If we have both encoded and decoded, reverse engineer the algorithm
  if (watchData.encodedHash && watchData.decodedUrl) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 SUCCESS! REVERSE ENGINEERING THE ALGORITHM');
    console.log('='.repeat(80) + '\n');

    console.log('Encoded:', watchData.encodedHash.substring(0, 150));
    console.log('Decoded:', watchData.decodedUrl);

    // Try to manually decode to verify
    console.log('\n🔬 Testing manual decoding...\n');

    const testResult = await page.evaluate((encoded, divId) => {
      try {
        // Method 1: URL-safe base64 decode
        const urlSafe = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const decoded1 = atob(urlSafe);
        
        // Method 2: Reverse
        const reversed = decoded1.split('').reverse().join('');
        
        // Method 3: XOR with divId
        const xorKey = divId.replace('pjsdiv', '');
        let xorResult = '';
        for (let i = 0; i < decoded1.length; i++) {
          xorResult += String.fromCharCode(decoded1.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
        }
        
        return {
          method1_urlSafeBase64: decoded1.substring(0, 100),
          method2_reversed: reversed.substring(0, 100),
          method3_xor: xorResult.substring(0, 100)
        };
      } catch (e) {
        return { error: e.message };
      }
    }, watchData.encodedHash, watchData.divId);

    console.log('Test results:');
    console.log(JSON.stringify(testResult, null, 2));
  }

  console.log('\n✅ Extraction complete. Browser kept open for manual inspection.');
  console.log('Check the DevTools console for detailed logs.\n');

  // Keep browser open
  await new Promise(() => {});
}

extractVidsrcProRCPDecoder().catch(console.error);
