const puppeteer = require('puppeteer');

/**
 * INTERCEPT TV SHOW DECODER
 * 
 * Load the vidsrc-embed.ru TV show page directly and intercept the decoder
 */

async function interceptTVShowDecoder() {
  console.log('🎯 Starting TV Show decoder interception...\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });

  const page = await browser.newPage();

  // Inject comprehensive monitoring BEFORE page loads
  await page.evaluateOnNewDocument(() => {
    window.decoderWatch = {
      encodedHash: null,
      decodedUrl: null,
      divId: null,
      allAtobCalls: [],
      allReplaceCalls: [],
      allXorOperations: []
    };

    // Track ALL atob calls
    const originalAtob = window.atob;
    window.atob = function(input) {
      const output = originalAtob.call(this, input);
      
      const record = {
        input: input,
        output: output,
        inputLength: input.length,
        outputLength: output.length,
        inputFirst100: input.substring(0, 100),
        outputFirst100: output.substring(0, 100),
        timestamp: Date.now()
      };
      
      window.decoderWatch.allAtobCalls.push(record);
      
      console.log('🔍 ATOB #' + window.decoderWatch.allAtobCalls.length);
      console.log('   In:', input.substring(0, 80));
      console.log('   Out:', output.substring(0, 80));
      
      // Check if this produces the m3u8 URL
      if (output.includes('.m3u8') || output.includes('http')) {
        console.log('🎯🎯🎯 FOUND URL IN ATOB OUTPUT!');
        console.log('   Full:', output);
        window.decoderWatch.decodedUrl = output;
      }
      
      return output;
    };

    // Track string replace operations (URL-safe base64)
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function(search, replacement) {
      const result = originalReplace.call(this, search, replacement);
      
      // Only track on long strings
      if (this.length > 100) {
        window.decoderWatch.allReplaceCalls.push({
          inputLength: this.length,
          outputLength: result.length,
          search: search.toString(),
          replacement: replacement.toString(),
          inputFirst50: this.substring(0, 50),
          outputFirst50: result.substring(0, 50),
          timestamp: Date.now()
        });
        
        // Check for URL-safe base64 pattern
        if (search.toString().includes('-') || search.toString().includes('_')) {
          console.log('🔍 URL-safe base64 replace detected');
        }
      }
      
      return result;
    };

    // Track XOR via charCodeAt
    const originalCharCodeAt = String.prototype.charCodeAt;
    const originalFromCharCode = String.fromCharCode;
    
    let charCodeCallCount = 0;
    let currentString = null;
    
    String.prototype.charCodeAt = function(index) {
      const result = originalCharCodeAt.call(this, index);
      
      if (this.length > 100) {
        if (currentString !== this) {
          if (charCodeCallCount > 10) {
            console.log('🔍 XOR loop completed:', charCodeCallCount, 'iterations');
          }
          charCodeCallCount = 0;
          currentString = this;
        }
        charCodeCallCount++;
      }
      
      return result;
    };

    // Monitor pjsdiv creation
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.id && node.id.startsWith('pjsdiv')) {
            console.log('🔍🔍🔍 PJSDIV DETECTED!');
            console.log('   ID:', node.id);
            console.log('   Length:', node.textContent.length);
            console.log('   First 100:', node.textContent.substring(0, 100));
            
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

    // Also check for any existing pjsdiv after page load
    setTimeout(() => {
      const pjsDiv = document.querySelector('[id^="pjsdiv"]');
      if (pjsDiv && !window.decoderWatch.encodedHash) {
        console.log('🔍 Found existing pjsdiv:', pjsDiv.id);
        window.decoderWatch.encodedHash = pjsDiv.textContent;
        window.decoderWatch.divId = pjsDiv.id;
      }
    }, 1000);
  });

  // Load the TV show page
  const url = 'https://vidsrc-embed.ru/embed/tv/259909/1/1/';
  console.log(`📡 Loading: ${url}\n`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    console.log('⚠️  Navigation timeout, but continuing...\n');
  }

  // Wait for decoder to run
  console.log('⏳ Waiting for decoder to run...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Extract all intercepted data
  const watchData = await page.evaluate(() => {
    return {
      encodedHash: window.decoderWatch.encodedHash,
      decodedUrl: window.decoderWatch.decodedUrl,
      divId: window.decoderWatch.divId,
      atobCallCount: window.decoderWatch.allAtobCalls.length,
      replaceCallCount: window.decoderWatch.allReplaceCalls.length,
      allAtobCalls: window.decoderWatch.allAtobCalls,
      allReplaceCalls: window.decoderWatch.allReplaceCalls
    };
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 INTERCEPTION RESULTS');
  console.log('='.repeat(80) + '\n');

  console.log('Encoded Hash Found:', !!watchData.encodedHash);
  if (watchData.encodedHash) {
    console.log('  Length:', watchData.encodedHash.length);
    console.log('  First 100:', watchData.encodedHash.substring(0, 100));
  }
  
  console.log('\nDiv ID:', watchData.divId);
  console.log('Decoded URL Found:', !!watchData.decodedUrl);
  if (watchData.decodedUrl) {
    console.log('  URL:', watchData.decodedUrl);
  }
  
  console.log('\nTotal atob calls:', watchData.atobCallCount);
  console.log('Total replace calls:', watchData.replaceCallCount);

  // Analyze atob calls
  if (watchData.allAtobCalls.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ATOB CALL DETAILS');
    console.log('='.repeat(80) + '\n');

    watchData.allAtobCalls.forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`);
      console.log(`  Input length: ${call.inputLength}`);
      console.log(`  Output length: ${call.outputLength}`);
      console.log(`  Input: ${call.inputFirst100}`);
      console.log(`  Output: ${call.outputFirst100}`);
      
      // Check if this matches our encoded hash
      if (watchData.encodedHash && call.input.substring(0, 50) === watchData.encodedHash.substring(0, 50)) {
        console.log('  ⭐⭐⭐ THIS PROCESSES THE ENCODED HASH!');
      }
      
      if (call.output.includes('.m3u8')) {
        console.log('  🎯🎯🎯 THIS PRODUCES THE M3U8 URL!');
      }
    });
  }

  // If we have both, reverse engineer
  if (watchData.encodedHash && watchData.decodedUrl) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 SUCCESS! REVERSE ENGINEERING');
    console.log('='.repeat(80) + '\n');

    console.log('Encoded (first 150):', watchData.encodedHash.substring(0, 150));
    console.log('Decoded:', watchData.decodedUrl);

    // Test decoding methods
    console.log('\n🔬 Testing decoding methods...\n');

    const testResults = await page.evaluate((encoded, divId) => {
      const results = {};
      
      try {
        // Method 1: URL-safe base64
        const urlSafe = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const decoded1 = atob(urlSafe);
        results.urlSafeBase64 = {
          output: decoded1.substring(0, 100),
          length: decoded1.length,
          hasHttp: decoded1.includes('http')
        };
        
        // Method 2: Reverse
        const reversed = decoded1.split('').reverse().join('');
        results.reversed = {
          output: reversed.substring(0, 100),
          hasHttp: reversed.includes('http')
        };
        
        // Method 3: XOR with divId number
        const xorKey = divId.replace('pjsdiv', '');
        let xorResult = '';
        for (let i = 0; i < decoded1.length; i++) {
          xorResult += String.fromCharCode(decoded1.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
        }
        results.xorWithDivId = {
          output: xorResult.substring(0, 100),
          hasHttp: xorResult.includes('http')
        };
        
        // Method 4: Double base64
        try {
          const decoded2 = atob(decoded1);
          results.doubleBase64 = {
            output: decoded2.substring(0, 100),
            hasHttp: decoded2.includes('http')
          };
        } catch (e) {
          results.doubleBase64 = { error: 'Invalid base64' };
        }
        
      } catch (e) {
        results.error = e.message;
      }
      
      return results;
    }, watchData.encodedHash, watchData.divId);

    console.log('Test Results:');
    console.log(JSON.stringify(testResults, null, 2));
  }

  console.log('\n✅ Interception complete. Browser kept open for inspection.');
  console.log('Check DevTools console for real-time logs.\n');

  // Keep browser open
  await new Promise(() => {});
}

interceptTVShowDecoder().catch(console.error);
