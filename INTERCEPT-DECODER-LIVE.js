/**
 * LIVE DECODER INTERCEPTION
 * Hook into the actual decoder execution and capture the transformation
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function interceptDecoder() {
  console.log('🔥 LIVE DECODER INTERCEPTION STARTING\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // Inject hooks BEFORE page loads
  await page.evaluateOnNewDocument(() => {
    window.decoderTrace = {
      operations: [],
      divAccess: [],
      results: []
    };

    // Hook atob
    const originalAtob = window.atob;
    window.atob = function(str) {
      const result = originalAtob.call(this, str);
      
      // Log if this looks like it might be the div content
      if (str.length > 1000) {
        window.decoderTrace.operations.push({
          type: 'atob',
          inputLength: str.length,
          outputLength: result.length,
          inputPreview: str.substring(0, 100),
          outputPreview: result.substring(0, 100),
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Hook String.fromCharCode (used in decoders)
    const originalFromCharCode = String.fromCharCode;
    String.fromCharCode = function(...args) {
      const result = originalFromCharCode.apply(this, args);
      
      // Log large operations
      if (args.length > 100) {
        window.decoderTrace.operations.push({
          type: 'fromCharCode',
          count: args.length,
          firstFew: args.slice(0, 10),
          result: result.substring(0, 100),
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Hook charCodeAt (used for XOR)
    const originalCharCodeAt = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function(index) {
      const result = originalCharCodeAt.call(this, index);
      
      // Track if we're doing XOR-like operations
      if (this.length > 1000 && index === 0) {
        window.decoderTrace.operations.push({
          type: 'charCodeAt_start',
          stringLength: this.length,
          stringPreview: this.substring(0, 50),
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Hook split (often used in decoders)
    const originalSplit = String.prototype.split;
    String.prototype.split = function(separator) {
      const result = originalSplit.call(this, separator);
      
      if (this.length > 1000) {
        window.decoderTrace.operations.push({
          type: 'split',
          inputLength: this.length,
          separator: String(separator),
          resultLength: result.length,
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Hook replace (character substitution)
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function(search, replacement) {
      const result = originalReplace.call(this, search, replacement);
      
      if (this.length > 1000) {
        window.decoderTrace.operations.push({
          type: 'replace',
          inputLength: this.length,
          search: String(search),
          replacement: typeof replacement === 'function' ? 'function' : String(replacement),
          outputLength: result.length,
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Hook getElementById to catch div access
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
      const element = originalGetElementById.call(document, id);
      
      if (element && element.tagName === 'DIV') {
        const content = element.innerHTML || element.textContent;
        if (content && content.length > 1000) {
          window.decoderTrace.divAccess.push({
            id: id,
            contentLength: content.length,
            contentPreview: content.substring(0, 100),
            timestamp: Date.now()
          });
        }
      }
      
      return element;
    };

    // Hook window property assignments to catch the final result
    const windowProxy = new Proxy(window, {
      set: function(target, prop, value) {
        // Check if this looks like an M3U8 URL
        if (typeof value === 'string' && (value.includes('http') || value.includes('.m3u8'))) {
          window.decoderTrace.results.push({
            property: prop,
            value: value,
            timestamp: Date.now()
          });
          console.log('🎯 FOUND M3U8 URL ASSIGNMENT:', prop, '=', value);
        }
        
        target[prop] = value;
        return true;
      }
    });

    console.log('✅ Decoder hooks installed!');
  });

  // Navigate to a ProRCP page
  console.log('📡 Loading ProRCP page...\n');
  
  await page.goto('https://vidsrc.xyz/embed/movie/550', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  // Wait a bit for everything to load
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Extract the trace
  const trace = await page.evaluate(() => window.decoderTrace);

  console.log('\n📊 DECODER TRACE RESULTS:\n');
  console.log('Operations captured:', trace.operations.length);
  console.log('Div accesses:', trace.divAccess.length);
  console.log('Results found:', trace.results.length);

  // Save the trace
  fs.writeFileSync('decoder-trace.json', JSON.stringify(trace, null, 2));
  console.log('\n💾 Trace saved to decoder-trace.json');

  // Print key findings
  if (trace.divAccess.length > 0) {
    console.log('\n🔍 DIV ACCESS:');
    trace.divAccess.forEach((access, i) => {
      console.log(`\n[${i + 1}] Div ID: ${access.id}`);
      console.log(`    Length: ${access.contentLength}`);
      console.log(`    Preview: ${access.contentPreview}...`);
    });
  }

  if (trace.operations.length > 0) {
    console.log('\n⚙️  OPERATIONS (first 10):');
    trace.operations.slice(0, 10).forEach((op, i) => {
      console.log(`\n[${i + 1}] ${op.type}`);
      console.log(`    ${JSON.stringify(op, null, 2).substring(0, 200)}...`);
    });
  }

  if (trace.results.length > 0) {
    console.log('\n🎯 RESULTS:');
    trace.results.forEach((result, i) => {
      console.log(`\n[${i + 1}] ${result.property} = ${result.value}`);
    });
  }

  console.log('\n⏸️  Browser kept open for inspection. Press Ctrl+C to close.');
  await new Promise(resolve => setTimeout(resolve, 300000));

  await browser.close();
}

interceptDecoder().catch(console.error);
