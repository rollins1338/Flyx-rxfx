const puppeteer = require('puppeteer');

/**
 * INTERCEPT PLAYERJS DECODER - Real-time extraction
 * 
 * Strategy:
 * 1. Load PRO.RCP page with encoded hash
 * 2. Intercept ALL function calls in PlayerJS
 * 3. Hook into the exact moment the hash is decoded
 * 4. Extract the decoder function, key, and algorithm
 */

async function interceptPlayerJSDecoder() {
  console.log('🎯 Starting PlayerJS decoder interception...\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🔍') || text.includes('DECODER') || text.includes('HASH')) {
      console.log('Browser:', text);
    }
  });

  // Inject interception code BEFORE any scripts load
  await page.evaluateOnNewDocument(() => {
    // Store original functions
    const originalAtob = window.atob;
    const originalBtoa = window.btoa;
    
    // Track all base64 operations
    window.base64Operations = [];
    
    window.atob = function(str) {
      const result = originalAtob.call(this, str);
      window.base64Operations.push({
        type: 'atob',
        input: str.substring(0, 100),
        output: result.substring(0, 100),
        stack: new Error().stack
      });
      console.log('🔍 ATOB called:', str.substring(0, 50));
      return result;
    };

    window.btoa = function(str) {
      const result = originalBtoa.call(this, str);
      window.base64Operations.push({
        type: 'btoa',
        input: str.substring(0, 100),
        output: result.substring(0, 100),
        stack: new Error().stack
      });
      return result;
    };

    // Hook String.prototype methods
    const originalCharCodeAt = String.prototype.charCodeAt;
    const originalFromCharCode = String.fromCharCode;
    
    window.charCodeOperations = [];
    
    String.prototype.charCodeAt = function(index) {
      const result = originalCharCodeAt.call(this, index);
      if (this.length > 100) {
        window.charCodeOperations.push({
          string: this.substring(0, 50),
          index,
          result
        });
      }
      return result;
    };

    // Hook XOR operations by monitoring bitwise operations
    window.xorOperations = [];
    
    // Intercept common decoder patterns
    window.decoderCalls = [];
    
    // Monitor any function that processes the pjsdiv content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.id && node.id.includes('pjsdiv')) {
            console.log('🔍 PJSDIV DETECTED:', node.id);
            console.log('🔍 PJSDIV CONTENT LENGTH:', node.textContent.length);
            console.log('🔍 PJSDIV FIRST 100 CHARS:', node.textContent.substring(0, 100));
            
            // Store the encoded content
            window.encodedHash = node.textContent;
            window.divId = node.id;
          }
        });
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });

  // Navigate to PRO.RCP page
  const testUrl = 'https://pro.rcp.best/e/?id=tt0137523'; // Fight Club
  console.log(`📡 Loading: ${testUrl}\n`);
  
  await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for PlayerJS to load
  await page.waitForTimeout(3000);

  // Extract all the intercepted data
  const interceptionData = await page.evaluate(() => {
    const data = {
      encodedHash: window.encodedHash || null,
      divId: window.divId || null,
      base64Operations: window.base64Operations || [],
      charCodeOperations: window.charCodeOperations || [],
      xorOperations: window.xorOperations || [],
      decoderCalls: window.decoderCalls || []
    };

    // Try to find the decoded m3u8 URL in the page
    const scripts = Array.from(document.scripts).map(s => s.textContent);
    const playerJsScript = scripts.find(s => s.includes('file:') || s.includes('.m3u8'));
    
    if (playerJsScript) {
      // Extract the file URL from PlayerJS config
      const fileMatch = playerJsScript.match(/file\s*:\s*["']([^"']+)["']/);
      if (fileMatch) {
        data.decodedUrl = fileMatch[1];
      }
    }

    return data;
  });

  console.log('\n📊 INTERCEPTION RESULTS:\n');
  console.log('Encoded Hash:', interceptionData.encodedHash?.substring(0, 100));
  console.log('Div ID:', interceptionData.divId);
  console.log('Base64 Operations:', interceptionData.base64Operations.length);
  console.log('CharCode Operations:', interceptionData.charCodeOperations.length);
  console.log('Decoded URL:', interceptionData.decodedUrl);

  // Analyze the base64 operations to find the decoder
  if (interceptionData.base64Operations.length > 0) {
    console.log('\n🔍 BASE64 OPERATIONS ANALYSIS:\n');
    
    interceptionData.base64Operations.forEach((op, i) => {
      console.log(`\nOperation ${i + 1}:`);
      console.log(`Type: ${op.type}`);
      console.log(`Input: ${op.input}`);
      console.log(`Output: ${op.output}`);
      
      // Check if this operation involves our encoded hash
      if (interceptionData.encodedHash && op.input.includes(interceptionData.encodedHash.substring(0, 50))) {
        console.log('⭐ THIS OPERATION PROCESSES THE ENCODED HASH!');
      }
    });
  }

  // Now let's try to extract the actual decoder function from PlayerJS
  console.log('\n🔍 EXTRACTING DECODER FUNCTION FROM PLAYERJS...\n');

  const decoderFunction = await page.evaluate(() => {
    // Search for decoder-like functions in window object
    const decoders = [];
    
    function searchObject(obj, path = 'window', depth = 0) {
      if (depth > 3) return;
      
      try {
        for (let key in obj) {
          if (typeof obj[key] === 'function') {
            const funcStr = obj[key].toString();
            // Look for functions that do base64 + XOR + reverse operations
            if (funcStr.includes('atob') && 
                (funcStr.includes('charCodeAt') || funcStr.includes('fromCharCode')) &&
                funcStr.length < 5000) {
              decoders.push({
                path: `${path}.${key}`,
                code: funcStr
              });
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            searchObject(obj[key], `${path}.${key}`, depth + 1);
          }
        }
      } catch (e) {}
    }
    
    searchObject(window);
    
    return decoders;
  });

  if (decoderFunction.length > 0) {
    console.log(`Found ${decoderFunction.length} potential decoder functions:\n`);
    decoderFunction.forEach((decoder, i) => {
      console.log(`\nDecoder ${i + 1}: ${decoder.path}`);
      console.log(decoder.code);
      console.log('\n' + '='.repeat(80));
    });
  }

  // Keep browser open for manual inspection
  console.log('\n✅ Interception complete. Browser kept open for inspection.');
  console.log('Press Ctrl+C to close.\n');

  // Don't close automatically
  await new Promise(() => {});
}

interceptPlayerJSDecoder().catch(console.error);
