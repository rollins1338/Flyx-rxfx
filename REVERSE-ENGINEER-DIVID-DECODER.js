/**
 * REVERSE ENGINEER: How div ID is used to decode div content
 * This will analyze the relationship between the div ID and the decoding process
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function reverseEngineerDivIdDecoder() {
  console.log('🔬 Reverse engineering div ID decoder...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // Inject deep monitoring
  await page.evaluateOnNewDocument(() => {
    window.decoderTrace = {
      divAccess: [],
      decodingOperations: [],
      stringManipulations: []
    };

    // Track all div accesses with stack traces
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
      const element = originalGetElementById.call(document, id);
      if (element && element.tagName === 'DIV') {
        const stack = new Error().stack;
        window.decoderTrace.divAccess.push({
          id: id,
          innerHTML: element.innerHTML,
          stackTrace: stack,
          timestamp: Date.now()
        });
      }
      return element;
    };

    // Track atob with input/output correlation
    const originalAtob = window.atob;
    window.atob = function(str) {
      const result = originalAtob.call(window, str);
      const stack = new Error().stack;
      
      window.decoderTrace.decodingOperations.push({
        operation: 'atob',
        input: str,
        output: result,
        inputLength: str.length,
        outputLength: result.length,
        stackTrace: stack,
        timestamp: Date.now()
      });
      
      return result;
    };

    // Track string split operations
    const originalSplit = String.prototype.split;
    String.prototype.split = function(separator) {
      const result = originalSplit.call(this, separator);
      
      if (this.length > 50) { // Only track significant strings
        window.decoderTrace.stringManipulations.push({
          operation: 'split',
          input: this.substring(0, 100),
          separator: separator,
          resultLength: result.length,
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Track string replace operations
    const originalReplace = String.prototype.replace;
    String.prototype.replace = function(search, replacement) {
      const result = originalReplace.call(this, search, replacement);
      
      if (this.length > 50) {
        window.decoderTrace.stringManipulations.push({
          operation: 'replace',
          input: this.substring(0, 100),
          search: search.toString(),
          replacement: typeof replacement === 'function' ? 'function' : replacement,
          output: result.substring(0, 100),
          timestamp: Date.now()
        });
      }
      
      return result;
    };

    // Track XOR operations (common in decoding)
    const originalCharCodeAt = String.prototype.charCodeAt;
    let xorDetected = false;
    String.prototype.charCodeAt = function(index) {
      const result = originalCharCodeAt.call(this, index);
      
      // Detect XOR patterns by checking if result is used in bitwise operations
      const stack = new Error().stack;
      if (stack.includes('^') || stack.includes('xor')) {
        if (!xorDetected) {
          window.decoderTrace.decodingOperations.push({
            operation: 'XOR_DETECTED',
            string: this.substring(0, 50),
            timestamp: Date.now()
          });
          xorDetected = true;
        }
      }
      
      return result;
    };

    console.log('🔍 Deep decoder monitoring active!');
  });

  console.log('📡 Loading page...');
  await page.goto('https://vidsrc.xyz/embed/movie/550', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Extract the trace data
  const traceData = await page.evaluate(() => window.decoderTrace);

  console.log('\n📊 Decoder Trace Analysis:');
  console.log(`Div accesses: ${traceData.divAccess.length}`);
  console.log(`Decoding operations: ${traceData.decodingOperations.length}`);
  console.log(`String manipulations: ${traceData.stringManipulations.length}`);

  // Analyze the sequence
  if (traceData.divAccess.length > 0) {
    console.log('\n🎯 Div Access Details:');
    traceData.divAccess.forEach((access, index) => {
      console.log(`\n[${index + 1}] Div ID: ${access.id}`);
      console.log(`    Content length: ${access.innerHTML.length}`);
      console.log(`    Content preview: ${access.innerHTML.substring(0, 100)}...`);
      console.log(`    Stack trace (first 3 lines):`);
      const stackLines = access.stackTrace.split('\n').slice(0, 4);
      stackLines.forEach(line => console.log(`      ${line}`));
    });
  }

  if (traceData.decodingOperations.length > 0) {
    console.log('\n🔓 Decoding Operations:');
    traceData.decodingOperations.forEach((op, index) => {
      console.log(`\n[${index + 1}] ${op.operation}`);
      if (op.input) {
        console.log(`    Input: ${op.input.substring(0, 100)}...`);
        console.log(`    Output: ${op.output.substring(0, 100)}...`);
      }
    });
  }

  // Look for correlation between div ID and decoding
  console.log('\n🔗 Analyzing div ID usage in decoding...');
  
  const divIds = traceData.divAccess.map(a => a.id);
  const decodingInputs = traceData.decodingOperations.map(o => o.input);
  
  divIds.forEach(divId => {
    console.log(`\nChecking if div ID "${divId}" is used in decoding...`);
    
    // Check if div ID appears in any decoding operation
    const usedInDecoding = decodingInputs.some(input => 
      input && input.includes(divId)
    );
    
    if (usedInDecoding) {
      console.log(`  ✅ Div ID found in decoding input!`);
    } else {
      console.log(`  ❌ Div ID not directly used in decoding`);
      
      // Check if it's used as a key/salt
      console.log(`  🔍 Checking if used as XOR key...`);
      const divIdChars = divId.split('').map(c => c.charCodeAt(0));
      console.log(`  Div ID char codes: ${divIdChars.join(', ')}`);
    }
  });

  // Save complete trace
  fs.writeFileSync(
    'divid-decoder-trace.json',
    JSON.stringify(traceData, null, 2)
  );
  console.log('\n💾 Complete trace saved to divid-decoder-trace.json');

  // Try to extract the actual decoder function
  console.log('\n🎯 Attempting to extract decoder function...');
  
  const decoderFunction = await page.evaluate(() => {
    // Search for functions that take div ID as parameter
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      const content = script.innerHTML;
      
      // Look for function patterns
      const patterns = [
        /function\s+(\w+)\s*\(\s*\w+\s*\)\s*{[^}]*getElementById[^}]*atob[^}]*}/g,
        /(\w+)\s*=\s*function\s*\(\s*\w+\s*\)\s*{[^}]*getElementById[^}]*atob[^}]*}/g,
        /const\s+(\w+)\s*=\s*\(\s*\w+\s*\)\s*=>\s*{[^}]*getElementById[^}]*atob[^}]*}/g
      ];
      
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          return matches;
        }
      }
    }
    return null;
  });

  if (decoderFunction) {
    console.log('✅ Found potential decoder function:');
    console.log(decoderFunction);
    fs.writeFileSync('extracted-decoder-function.js', decoderFunction.join('\n\n'));
  } else {
    console.log('❌ Could not extract decoder function automatically');
  }

  console.log('\n⏸️  Browser kept open. Press Ctrl+C to close.');
  await new Promise(resolve => setTimeout(resolve, 300000));

  await browser.close();
}

reverseEngineerDivIdDecoder().catch(console.error);
