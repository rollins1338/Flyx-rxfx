/**
 * LIVE DECODER INTERCEPTOR - COMPLETE ANALYSIS
 * 
 * This script uses Puppeteer to:
 * 1. Load the ProRCP page
 * 2. Intercept ALL function calls (atob, charCodeAt, fromCharCode, etc.)
 * 3. Capture the EXACT transformation sequence
 * 4. Log input/output at each step
 * 5. Reverse engineer the algorithm
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': options.referer || '',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, statusCode: res.statusCode }));
    });

    req.on('error', reject);
    req.end();
  });
}

async function interceptLiveDecoder() {
  console.log('\n🎯 LIVE DECODER INTERCEPTOR - COMPLETE ANALYSIS\n');
  console.log('='.repeat(80));
  
  try {
    // Step 1: Get ProRCP URL using fetch
    console.log('\n📡 Step 1: Getting ProRCP URL...\n');
    
    const embedResp = await fetch('https://vidsrc-embed.ru/embed/movie/550');
    const $ = cheerio.load(embedResp.data);
    const dataHash = $('[data-hash]').first().attr('data-hash');
    console.log('✅ Data hash:', dataHash ? dataHash.substring(0, 50) + '...' : 'NOT FOUND');
    
    if (!dataHash) {
      console.error('❌ Could not find data-hash');
      console.log('Page content sample:', embedResp.data.substring(0, 500));
      return;
    }
    
    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    const rcpResp = await fetch(rcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
    if (!iframeSrcMatch) {
      console.error('❌ Could not find ProRCP iframe');
      return;
    }
    
    const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
    console.log('✅ ProRCP URL:', proRcpUrl.substring(0, 80) + '...');
    
    // Get div ID from the page
    const proRcpResp = await fetch(proRcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const $$ = cheerio.load(proRcpResp.data);
    let divId = null;
    let divContent = null;
    
    $$('div').each((i, elem) => {
      const $elem = $$(elem);
      const style = $elem.attr('style');
      const id = $elem.attr('id');
      const content = $elem.html();
      
      if (style && style.includes('display:none') && id && content && content.length > 500) {
        divId = id;
        divContent = content;
        return false;
      }
    });
    
    console.log('✅ Div ID:', divId);
    console.log('✅ Div content length:', divContent ? divContent.length : 0);
    
    // Step 2: Launch Puppeteer with interception
    console.log('\n🎭 Step 2: Launching browser with interceptors...\n');
    
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    
    // Disable anti-debugger detection
    await page.evaluateOnNewDocument(() => {
      // Override debugger statement
      Object.defineProperty(window, 'debugger', {
        get: function() { return undefined; },
        set: function() {}
      });
      
      // Prevent infinite debugger loops
      const originalFunction = Function;
      window.Function = function(...args) {
        const funcStr = args[args.length - 1] || '';
        if (typeof funcStr === 'string' && funcStr.includes('debugger')) {
          console.log('🛡️  Blocked debugger statement');
          return function() {};
        }
        return originalFunction.apply(this, args);
      };
      
      // Block setInterval/setTimeout with debugger
      const originalSetInterval = window.setInterval;
      window.setInterval = function(fn, delay) {
        if (typeof fn === 'function') {
          const fnStr = fn.toString();
          if (fnStr.includes('debugger')) {
            console.log('🛡️  Blocked setInterval with debugger');
            return 0;
          }
        }
        return originalSetInterval.apply(this, arguments);
      };
      
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(fn, delay) {
        if (typeof fn === 'function') {
          const fnStr = fn.toString();
          if (fnStr.includes('debugger')) {
            console.log('🛡️  Blocked setTimeout with debugger');
            return 0;
          }
        }
        return originalSetTimeout.apply(this, arguments);
      };
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Inject interception code BEFORE page loads
    await page.evaluateOnNewDocument((expectedDivId) => {
      window.decoderAnalysis = {
        divId: expectedDivId,
        divContent: null,
        transformations: [],
        finalResult: null,
        capturedCalls: {
          atob: [],
          btoa: [],
          charCodeAt: [],
          fromCharCode: [],
          split: [],
          reverse: [],
          replace: [],
          substring: [],
          charAt: [],
          slice: [],
          match: [],
          parseInt: [],
          xorOperations: []
        }
      };
      
      // Track ALL string operations with full stack traces
      window.trackOperation = function(type, input, output, extra = {}) {
        const stack = new Error().stack;
        window.decoderAnalysis.transformations.push({
          type,
          input: typeof input === 'string' ? input.substring(0, 500) : String(input),
          inputLength: typeof input === 'string' ? input.length : 0,
          output: typeof output === 'string' ? output.substring(0, 500) : String(output),
          outputLength: typeof output === 'string' ? output.length : 0,
          timestamp: Date.now(),
          stack: stack.split('\n').slice(2, 5).join('\n'),
          ...extra
        });
      };
      
      // Intercept atob (base64 decode)
      const originalAtob = window.atob;
      window.atob = function(input) {
        const output = originalAtob.call(this, input);
        
        window.trackOperation('atob', input, output, {
          isM3U8: output.includes('.m3u8') || output.includes('http')
        });
        
        window.decoderAnalysis.capturedCalls.atob.push({
          input: input.substring(0, 500),
          inputLength: input.length,
          output: output.substring(0, 500),
          outputLength: output.length,
          timestamp: Date.now()
        });
        
        console.log(`🔍 atob() - In: ${input.length}ch, Out: ${output.length}ch`);
        
        if (output.includes('.m3u8') || output.includes('http')) {
          console.log('🎯 M3U8 FOUND IN ATOB!', output);
          window.decoderAnalysis.finalResult = output;
        }
        
        return output;
      };
      
      // Intercept btoa (base64 encode)
      const originalBtoa = window.btoa;
      window.btoa = function(input) {
        const output = originalBtoa.call(this, input);
        
        window.decoderAnalysis.capturedCalls.btoa.push({
          input: input.substring(0, 200),
          output: output.substring(0, 200),
          timestamp: Date.now()
        });
        
        console.log(`🔍 btoa() called`);
        return output;
      };
      
      // Intercept String.prototype.charCodeAt
      const originalCharCodeAt = String.prototype.charCodeAt;
      String.prototype.charCodeAt = function(index) {
        const result = originalCharCodeAt.call(this, index);
        
        if (this.length > 100) {
          window.decoderAnalysis.capturedCalls.charCodeAt.push({
            stringLength: this.length,
            stringSample: this.substring(0, 100),
            index: index,
            result: result,
            char: this.charAt(index),
            timestamp: Date.now()
          });
          
          // Track XOR patterns - if we see charCodeAt followed by XOR
          if (!window._lastCharCodeAt) window._lastCharCodeAt = [];
          window._lastCharCodeAt.push({ str: this.toString(), index, result, time: Date.now() });
          if (window._lastCharCodeAt.length > 1000) window._lastCharCodeAt.shift();
        }
        
        return result;
      };
      
      // Intercept String.fromCharCode
      const originalFromCharCode = String.fromCharCode;
      String.fromCharCode = function(...codes) {
        const result = originalFromCharCode.apply(this, codes);
        
        window.trackOperation('fromCharCode', codes.join(','), result, {
          codesCount: codes.length,
          firstCodes: codes.slice(0, 20),
          lastCodes: codes.slice(-20),
          avgCode: codes.reduce((a,b) => a+b, 0) / codes.length,
          minCode: Math.min(...codes),
          maxCode: Math.max(...codes)
        });
        
        window.decoderAnalysis.capturedCalls.fromCharCode.push({
          codesCount: codes.length,
          allCodes: codes,
          result: result.substring(0, 500),
          resultLength: result.length,
          timestamp: Date.now()
        });
        
        console.log(`🔍 fromCharCode(${codes.length} codes) -> ${result.length}ch`);
        
        if (result.includes('.m3u8') || result.includes('http')) {
          console.log('🎯 M3U8 IN FROMCHARCODE!', result);
          window.decoderAnalysis.finalResult = result;
        }
        
        return result;
      };
      
      // Intercept String.prototype.split
      const originalSplit = String.prototype.split;
      String.prototype.split = function(separator, limit) {
        const result = originalSplit.call(this, separator, limit);
        
        if (this.length > 100) {
          window.decoderAnalysis.capturedCalls.split.push({
            stringLength: this.length,
            separator: String(separator),
            resultLength: result.length,
            timestamp: Date.now()
          });
          console.log(`🔍 split('${separator}') called on string of length ${this.length}`);
        }
        
        return result;
      };
      
      // Intercept String.prototype.replace
      const originalReplace = String.prototype.replace;
      String.prototype.replace = function(search, replacement) {
        const result = originalReplace.call(this, search, replacement);
        
        if (this.length > 50) {
          window.trackOperation('replace', this, result, {
            search: String(search),
            replacement: typeof replacement === 'function' ? '[function]' : String(replacement)
          });
          
          window.decoderAnalysis.capturedCalls.replace.push({
            input: this.substring(0, 500),
            stringLength: this.length,
            search: String(search),
            replacement: typeof replacement === 'function' ? '[function]' : String(replacement),
            result: result.substring(0, 500),
            resultLength: result.length,
            timestamp: Date.now()
          });
        }
        
        return result;
      };
      
      // Intercept String.prototype.slice
      const originalSlice = String.prototype.slice;
      String.prototype.slice = function(start, end) {
        const result = originalSlice.call(this, start, end);
        
        if (this.length > 100) {
          window.decoderAnalysis.capturedCalls.slice.push({
            stringLength: this.length,
            start, end,
            resultLength: result.length,
            timestamp: Date.now()
          });
        }
        
        return result;
      };
      
      // Intercept parseInt to catch XOR keys
      const originalParseInt = window.parseInt;
      window.parseInt = function(str, radix) {
        const result = originalParseInt.call(this, str, radix);
        
        if (typeof str === 'string' && str.length > 0) {
          window.decoderAnalysis.capturedCalls.parseInt.push({
            input: str,
            radix: radix,
            result: result,
            timestamp: Date.now()
          });
        }
        
        return result;
      };
      
      // Intercept document.getElementById to capture div content
      const originalGetElementById = document.getElementById;
      document.getElementById = function(id) {
        const element = originalGetElementById.call(document, id);
        
        if (id === expectedDivId && element) {
          const content = element.textContent || element.innerHTML;
          console.log(`🎯 DIV CAPTURED: ${id}`);
          console.log(`   Length: ${content.length}`);
          console.log(`   Sample: ${content.substring(0, 100)}`);
          
          window.decoderAnalysis.divContent = content;
          window.trackOperation('getElementById', id, content);
        }
        
        return element;
      };
      
      // Monitor ALL window property assignments
      const originalDefineProperty = Object.defineProperty;
      Object.defineProperty = function(obj, prop, descriptor) {
        if (obj === window && prop === expectedDivId) {
          console.log(`🎯 DEFINING window['${prop}']`);
          if (descriptor.value) {
            console.log(`   Value: ${descriptor.value}`);
            window.decoderAnalysis.finalResult = descriptor.value;
          }
        }
        return originalDefineProperty.call(this, obj, prop, descriptor);
      };
      
      // Intercept direct window assignments
      const handler = {
        set: function(target, property, value) {
          if (property === expectedDivId) {
            console.log(`🎯 window['${property}'] = ${value}`);
            window.decoderAnalysis.finalResult = value;
            window.trackOperation('windowAssignment', property, value);
          }
          target[property] = value;
          return true;
        }
      };
      
      // Try to proxy window (may not work in all browsers)
      try {
        const proxiedWindow = new Proxy(window, handler);
        // Can't actually replace window, but we tried
      } catch (e) {
        console.log('⚠️  Could not proxy window');
      }
      
      console.log('✅ All interceptors installed for:', expectedDivId);
    }, divId);
    
    // Step 3: Load the page
    console.log('\n📄 Step 3: Loading ProRCP page...\n');
    
    await page.setExtraHTTPHeaders({
      'Referer': 'https://vidsrc-embed.ru/',
      'Origin': 'https://vidsrc-embed.ru'
    });
    
    await page.goto(proRcpUrl, { 
      waitUntil: 'networkidle0', 
      timeout: 30000 
    });
    
    console.log('✅ Page loaded\n');
    
    // Step 4: Wait for decoder to execute
    console.log('⏳ Step 4: Waiting for decoder execution...\n');
    
    // Wait and check multiple times
    let m3u8Url = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      m3u8Url = await page.evaluate((divId) => {
        return window[divId] || window.decoderAnalysis?.finalResult;
      }, divId);
      
      if (m3u8Url) {
        console.log(`✅ Found M3U8 after ${i + 1} seconds`);
        break;
      }
      
      console.log(`   Waiting... (${i + 1}/10)`);
    }
    
    // Step 5: Extract all captured data
    console.log('\n📊 Step 5: Extracting captured data...\n');
    
    const analysis = await page.evaluate(() => window.decoderAnalysis);
    
    console.log('='.repeat(80));
    console.log('ANALYSIS RESULTS');
    console.log('='.repeat(80));
    
    console.log('\n📌 Div Information:');
    console.log('  ID:', analysis.divId);
    console.log('  Content captured:', analysis.divContent ? 'YES' : 'NO');
    if (analysis.divContent) {
      console.log('  Content length:', analysis.divContent.length);
      console.log('  Content sample:', analysis.divContent.substring(0, 100));
    }
    
    console.log('\n📌 Function Calls Summary:');
    console.log('  atob() calls:', analysis.capturedCalls.atob.length);
    console.log('  btoa() calls:', analysis.capturedCalls.btoa.length);
    console.log('  charCodeAt() calls:', analysis.capturedCalls.charCodeAt.length);
    console.log('  fromCharCode() calls:', analysis.capturedCalls.fromCharCode.length);
    console.log('  split() calls:', analysis.capturedCalls.split.length);
    console.log('  replace() calls:', analysis.capturedCalls.replace.length);
    
    console.log('\n📌 M3U8 URL:');
    if (m3u8Url) {
      console.log('  ✅ FOUND:', m3u8Url);
    } else {
      console.log('  ❌ NOT FOUND');
    }
    
    // Detailed analysis of transformations
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED TRANSFORMATION SEQUENCE');
    console.log('='.repeat(80));
    
    console.log('\n📊 TRANSFORMATION TIMELINE:');
    if (analysis.transformations && analysis.transformations.length > 0) {
      analysis.transformations.forEach((t, i) => {
        console.log(`\n  ${i + 1}. ${t.type.toUpperCase()}`);
        console.log(`     Input: ${t.input.substring(0, 100)}${t.inputLength > 100 ? '...' : ''}`);
        console.log(`     Output: ${t.output.substring(0, 100)}${t.outputLength > 100 ? '...' : ''}`);
        console.log(`     Lengths: ${t.inputLength} → ${t.outputLength}`);
        if (t.search) console.log(`     Search: ${t.search}`);
        if (t.replacement) console.log(`     Replace: ${t.replacement}`);
        if (t.codesCount) console.log(`     Codes: ${t.codesCount} (${t.minCode}-${t.maxCode}, avg: ${t.avgCode?.toFixed(1)})`);
      });
    }
    
    if (analysis.capturedCalls.atob.length > 0) {
      console.log('\n🔍 ATOB CALLS (Base64 Decode):');
      analysis.capturedCalls.atob.forEach((call, i) => {
        console.log(`\n  Call ${i + 1}:`);
        console.log(`    Input: ${call.input}`);
        console.log(`    Output: ${call.output}`);
        console.log(`    Lengths: ${call.inputLength} → ${call.outputLength}`);
      });
    }
    
    if (analysis.capturedCalls.replace.length > 0) {
      console.log('\n🔍 REPLACE CALLS:');
      analysis.capturedCalls.replace.slice(0, 20).forEach((call, i) => {
        console.log(`\n  ${i + 1}. replace('${call.search}', '${call.replacement}')`);
        console.log(`     ${call.stringLength}ch → ${call.resultLength}ch`);
      });
      if (analysis.capturedCalls.replace.length > 20) {
        console.log(`\n  ... and ${analysis.capturedCalls.replace.length - 20} more`);
      }
    }
    
    if (analysis.capturedCalls.fromCharCode.length > 0) {
      console.log('\n🔍 FROMCHARCODE CALLS:');
      analysis.capturedCalls.fromCharCode.forEach((call, i) => {
        console.log(`\n  Call ${i + 1}:`);
        console.log(`    Codes: ${call.codesCount} chars`);
        console.log(`    First 20: [${call.allCodes.slice(0, 20).join(', ')}]`);
        console.log(`    Result: ${call.result}`);
      });
    }
    
    if (analysis.capturedCalls.charCodeAt.length > 0) {
      console.log('\n🔍 CHARCODEAT CALLS:');
      console.log(`  Total: ${analysis.capturedCalls.charCodeAt.length} calls`);
      const sample = analysis.capturedCalls.charCodeAt.slice(0, 10);
      sample.forEach((call, i) => {
        console.log(`  ${i + 1}. str[${call.index}] = '${call.char}' (code: ${call.result})`);
      });
    }
    
    if (analysis.capturedCalls.parseInt.length > 0) {
      console.log('\n🔍 PARSEINT CALLS (Potential XOR keys):');
      analysis.capturedCalls.parseInt.forEach((call, i) => {
        console.log(`  ${i + 1}. parseInt('${call.input}', ${call.radix}) = ${call.result}`);
      });
    }
    
    // Save complete analysis to file
    const outputData = {
      proRcpUrl,
      divId,
      divContent: analysis.divContent,
      m3u8Url,
      capturedCalls: analysis.capturedCalls,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('decoder-analysis-complete.json', JSON.stringify(outputData, null, 2));
    console.log('\n💾 Complete analysis saved to: decoder-analysis-complete.json');
    
    // Save div content separately for testing
    if (analysis.divContent) {
      fs.writeFileSync('div-content-captured.txt', analysis.divContent);
      console.log('💾 Div content saved to: div-content-captured.txt');
    }
    
    // Now let's try to reverse engineer the algorithm
    console.log('\n' + '='.repeat(80));
    console.log('REVERSE ENGINEERING THE ALGORITHM');
    console.log('='.repeat(80));
    
    if (analysis.divContent && m3u8Url) {
      console.log('\n🔬 Attempting to reverse engineer...\n');
      
      // Analyze the transformation pattern
      const input = analysis.divContent;
      const output = m3u8Url;
      
      console.log('Input (div content):');
      console.log('  Length:', input.length);
      console.log('  Sample:', input.substring(0, 100));
      console.log('  Character set:', [...new Set(input.split(''))].join(''));
      
      console.log('\nOutput (M3U8 URL):');
      console.log('  Length:', output.length);
      console.log('  Full URL:', output);
      
      // Check if it's base64
      console.log('\n🧪 Testing if input is base64...');
      try {
        const decoded = Buffer.from(input, 'base64').toString('utf8');
        console.log('  Base64 decode result:', decoded.substring(0, 200));
        
        if (decoded === output) {
          console.log('  ✅ ALGORITHM: Simple base64 decode!');
        }
      } catch (e) {
        console.log('  ❌ Not simple base64');
      }
      
      // Check for XOR patterns
      console.log('\n🧪 Analyzing for XOR patterns...');
      if (analysis.capturedCalls.charCodeAt.length > 0 && analysis.capturedCalls.fromCharCode.length > 0) {
        console.log('  ⚠️  Detected charCodeAt + fromCharCode usage (likely XOR or character manipulation)');
      }
      
      // Check for string replacements
      if (analysis.capturedCalls.replace.length > 0) {
        console.log('\n🧪 String replacement patterns detected:');
        analysis.capturedCalls.replace.forEach((call, i) => {
          console.log(`  ${i + 1}. Replace '${call.search}' with '${call.replacement}'`);
        });
      }
    }
    
    await browser.close();
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE!');
    console.log('='.repeat(80));
    console.log('\nNext steps:');
    console.log('1. Review decoder-analysis-complete.json for full details');
    console.log('2. Analyze the transformation sequence');
    console.log('3. Implement the algorithm in pure JavaScript');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the interceptor
interceptLiveDecoder();
