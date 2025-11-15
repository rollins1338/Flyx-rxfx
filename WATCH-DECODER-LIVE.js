const puppeteer = require('puppeteer');

/**
 * WATCH DECODER LIVE
 * 
 * This script watches the actual decoding process in real-time
 * by intercepting the exact moment when the hash becomes a URL
 */

async function watchDecoderLive() {
  console.log('🎯 Starting live decoder watch...\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: false
  });

  const page = await browser.newPage();

  // Store all string transformations
  const transformations = [];

  // Inject comprehensive monitoring BEFORE page loads
  await page.evaluateOnNewDocument(() => {
    window.decoderWatch = {
      encodedHash: null,
      decodedUrl: null,
      transformations: [],
      functionCalls: []
    };

    // Override atob to track base64 decoding
    const originalAtob = window.atob;
    window.atob = function(input) {
      const output = originalAtob.call(this, input);
      
      window.decoderWatch.transformations.push({
        operation: 'atob',
        inputLength: input.length,
        outputLength: output.length,
        inputSample: input.substring(0, 50),
        outputSample: output.substring(0, 50),
        timestamp: Date.now()
      });
      
      // If output looks like a URL, capture it
      if (output.includes('.m3u8') || output.includes('http')) {
        console.log('🎯 FOUND M3U8 URL IN ATOB OUTPUT!');
        window.decoderWatch.decodedUrl = output;
      }
      
      return output;
    };

    // Override String methods that might be used for decoding
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function(search, replacement) {
      const result = originalReplace.call(this, search, replacement);
      
      // Track URL-safe base64 conversions
      if ((search === /-/g || search === '_') && this.length > 100) {
        window.decoderWatch.transformations.push({
          operation: 'replace (URL-safe base64)',
          inputLength: this.length,
          outputLength: result.length,
          search: search.toString(),
          replacement: replacement,
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Override split/reverse/join pattern
    const originalSplit = String.prototype.split;
    String.prototype.split = function(separator) {
      const result = originalSplit.call(this, separator);
      
      if (this.length > 100 && separator === '') {
        window.decoderWatch.transformations.push({
          operation: 'split (possible reverse)',
          inputLength: this.length,
          inputSample: this.substring(0, 50),
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Monitor XOR operations by tracking charCodeAt patterns
    const originalCharCodeAt = String.prototype.charCodeAt;
    let charCodeCallCount = 0;
    
    String.prototype.charCodeAt = function(index) {
      const result = originalCharCodeAt.call(this, index);
      charCodeCallCount++;
      
      // If we're doing lots of charCodeAt calls, it's likely XOR
      if (charCodeCallCount % 100 === 0 && this.length > 100) {
        window.decoderWatch.transformations.push({
          operation: 'charCodeAt (XOR pattern)',
          callCount: charCodeCallCount,
          stringLength: this.length,
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Monitor when pjsdiv is accessed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.id && node.id.startsWith('pjsdiv')) {
            console.log('🔍 PJSDIV DETECTED:', node.id);
            window.decoderWatch.encodedHash = node.textContent;
            window.decoderWatch.divId = node.id;
            
            // Set a breakpoint here in DevTools to catch the decoder
            console.log('🔍 Encoded hash length:', node.textContent.length);
            console.log('🔍 First 100 chars:', node.textContent.substring(0, 100));
          }
        });
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // Intercept PlayerJS initialization
    Object.defineProperty(window, 'Playerjs', {
      set: function(value) {
        console.log('🎯 PLAYERJS CONSTRUCTOR DETECTED!');
        
        // Wrap the constructor
        const OriginalPlayerjs = value;
        window._Playerjs = function(config) {
          console.log('🎯 PLAYERJS INITIALIZED WITH CONFIG:', config);
          
          if (config && config.file) {
            console.log('🎯 FILE URL:', config.file);
            window.decoderWatch.decodedUrl = config.file;
          }
          
          return new OriginalPlayerjs(config);
        };
        
        // Copy prototype
        window._Playerjs.prototype = OriginalPlayerjs.prototype;
        
        this._playerjs = window._Playerjs;
      },
      get: function() {
        return this._playerjs;
      }
    });
  });

  // Navigate to test page
  const testUrl = 'https://pro.rcp.best/e/?id=tt0137523';
  console.log(`📡 Loading: ${testUrl}\n`);
  
  await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for player to initialize
  console.log('⏳ Waiting for player initialization...\n');
  await page.waitForTimeout(5000);

  // Extract all the watch data
  const watchData = await page.evaluate(() => {
    return window.decoderWatch;
  });

  console.log('\n📊 DECODER WATCH RESULTS:\n');
  console.log('='.repeat(80));
  console.log('\nEncoded Hash:', watchData.encodedHash?.substring(0, 100));
  console.log('Div ID:', watchData.divId);
  console.log('Decoded URL:', watchData.decodedUrl);
  console.log('\nTransformations:', watchData.transformations.length);

  if (watchData.transformations.length > 0) {
    console.log('\n🔍 TRANSFORMATION SEQUENCE:\n');
    watchData.transformations.forEach((t, i) => {
      console.log(`${i + 1}. ${t.operation}`);
      if (t.inputSample) console.log(`   Input: ${t.inputSample}`);
      if (t.outputSample) console.log(`   Output: ${t.outputSample}`);
      if (t.inputLength) console.log(`   Length: ${t.inputLength} → ${t.outputLength}`);
      console.log('');
    });
  }

  // If we found the decoded URL, compare it with the encoded hash
  if (watchData.encodedHash && watchData.decodedUrl) {
    console.log('\n🎯 SUCCESS! Found both encoded and decoded versions:\n');
    console.log('Encoded:', watchData.encodedHash.substring(0, 100));
    console.log('Decoded:', watchData.decodedUrl);
    
    // Now we can reverse engineer the algorithm
    console.log('\n🔬 REVERSE ENGINEERING THE ALGORITHM...\n');
    
    // Try to identify the steps
    const steps = [];
    
    // Check if URL-safe base64 was used
    if (watchData.transformations.some(t => t.operation.includes('URL-safe'))) {
      steps.push('1. Convert URL-safe base64 to standard base64 (- to +, _ to /)');
    }
    
    // Check if atob was used
    if (watchData.transformations.some(t => t.operation === 'atob')) {
      steps.push('2. Base64 decode using atob()');
    }
    
    // Check if reverse was used
    if (watchData.transformations.some(t => t.operation.includes('reverse'))) {
      steps.push('3. Reverse the string');
    }
    
    // Check if XOR was used
    if (watchData.transformations.some(t => t.operation.includes('XOR'))) {
      steps.push('4. XOR decryption (key unknown)');
    }
    
    console.log('Identified decoding steps:');
    steps.forEach(step => console.log(step));
  }

  console.log('\n✅ Watch complete. Browser kept open for inspection.');
  console.log('Check the DevTools console for more details.\n');

  // Keep browser open
  await new Promise(() => {});
}

watchDecoderLive().catch(console.error);
