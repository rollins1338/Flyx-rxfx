const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * FINAL ATTACK: Go directly to ProRCP and intercept EVERY transformation
 */

async function finalProRCPIntercept() {
  console.log('🎯 FINAL PRORCP DECODER INTERCEPT');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,  // Disable devtools to avoid detection
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // Hide that we're using Puppeteer
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    
    // Hide Chrome automation
    window.chrome = {
      runtime: {},
    };
    
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  // Set proper headers to mimic coming from vidsrc-embed.ru
  await page.setExtraHTTPHeaders({
    'Referer': 'https://vidsrc-embed.ru/',
    'Origin': 'https://vidsrc-embed.ru',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  // The ProRCP URL extracted from Cloudstream
  const proRCPURL = 'https://cloudnestra.com/prorcp/ZTVhOGMxMmFhYjU1YTM0YjlhYzdjYzFjNWRjNGVmOWE6ZVZoWVdqSkhSR2w2UkZGaWNHTlZhRWt4VkVkd2FFWkNiVzB6TUdFMWJHTnBSM0p5TTFoRGNrdDFVbTR4YzNSd2VVSmxPRVZ3TUVJMVpuTlJVWHBLSzBaVmEzaGlLMWhZYVhkWFoySkZNblJXVjBJMGVXUkdlakp2VFRkTWNFVTBjV05EVVdaR1VHMXZjSGRPWm14Q1kxSlhaM1ZwVm1aRGVqVndSMnd3TW5veU9ESXJNRXgwUzAxU2RXd3dTVGRKUkVwR01tRjBNaXN5YmxwVFdsSmFWMFpRVnk5dWMwMXNOMlZJUTNSck9ISkJUVVl3VlZKbGIwcG1VRFZOT1M4d1VXcExPRFI1UkVkUmVUWkVRMXB6TUcxQ1dVNUlTR2syZHpCWlMzbDNNRnB5UjNsNk4yd3ZaMHAxT0dwM1RISjBXbEpSYjBOWWVHUlhTRFI1THpacWNISkRlR1ZITTFSSlZqaHRWbmRIVFhsbWJqaEhaR016VUdRMVkydHpObUl3Y25WNFdUWkhkVmxQT0VWWFF6aGpRMVl5U3pWQ1Eyb3ZWWEEzZEdwSk5IUnJja04wU1dOcVNtNUJOVXhhVlZOUVVpdE1PWEpwT1doNlZrVjVRbFp0YldvMGJrNWxNRTltWVVSNFFXcFBSWE5EV2s5WWNreFZiM1J1VEZSRlZITXdjU3M0V1dSMVRWSkdWWGxQYVdabVkwY3JZblZIV2xGaFJqTkdhRGhTUWtsM01WRnlOR2hFTUVGTFRsZDZRWE5QZGt0QlNIRlpUbFl2VVhwaWRVVlRUWGh6VUhWRU1sRmtlVkZaYkRoTlJEUnRRWEIxZVc5SlJGRXlSR1ptY2poTmNXNVhiSE5QUkdzcmNsVmtOR3QzUzBkWGJGTnNZVThyTUdKRE1HZFVSRThyVTJsUlYzbHBaMHN5YzBsamJtWnZXalI1VmtSNFpWaHRhamsxY0dOblEyWXhkeXMyVlRKQ1pscEVSV0V3VFhWWGR6bEpjMnBTUjBnM1kyNU9VMlJLTlRSS2VuWXpjRFJ1V0dJd1RsRnZWMlJJTXpONFJXMWhSVmhwYjIwcmNtSkhjemxvWjBaWlIycHlTazFpY3k5SU1UWXpPRzlJUVV4RE9YbFNTQ3ROVkRoaVJ5ODNiR1JLU1ZnM1VuSkhURlJPYkhvM1dESTVXblZUTlRSUlJuWm5ka0ZaWkU4dlVqZHhRWFZ0Y2xwTVZ5OWpWbGQ2VUVkb2RqWk9ia3hhTTAxUGNqRnpWR1Y1ZW05NFMydHRRblFyTUZkQllqWkZZVmQ2U0Rkb1QyVk9WMnN2VkVNMWRrUjRRbmxSUlZSR1pYTndUemRCVEN0S2IzVnFXSEpTTkhOcVNrYzFhazlPVURjd05sbHlWekZNUTNGcWRXWk1OR1JRSzI5dlVGTndaamhQUTJ4M2NGUlJTbkEyVFU1bGNucHNXV3R5WTFwak1qbHRSM2xoTkZsWFVGbElkV1VyVFhwdVVEVjBUbGRoSzFkVU5YcENNWEp4WjBST1duZ3JMMVF6TTNoWGRGTlVjVUZFV1dKalQyTkNLM041Tlc1bk1qbHhkbFp6UVdSdlZqUlZTbWs1U1d4MlRVWnlTVWd6TkRSR1ExZHFRU3NyYTJOQlpDdHZNVkpsVjFJclRtaDVWaXRQVkRkeWF6RlNkVWhXZVVoTVJrcDNSek5OUldkb2FrMXFTRzQzYjBsVVYxZGFVVEZoVm5wRFIwOW9NMmtyVUZjeWFWRjBkVUpYYXpGU01VWjNjRmMyUm5sM1NteExNak5rVFdGRVREZDJWblZqUmxOaWFUSk1VRE5oVEdjeFZsQlhTV2xRV1hCMldqTllNMHBUVTFJdlRVUkdTa1JaV0daQ1NIVnJLMVpMVW13eGIzSlRSRXc1ZGpkWFRqSlRUMnQ2VjBGTWN6WmlhMFZaYm1kUGNXaFlURTVUVlhGdU4xYzBPR04wZFUwNFNpOW5hbTl4UkdzNFRtSm1ZWGhDUkZkeE9GQkVlRlI2Ymtwc2NXcHVSRmcyVDFveGFHNXdhMnBFU2pKb2QxTTJUVWgyTmtaMlUyeE5UemxRYmxGSVVUMDk-';
  
  const interceptedData = {
    url: proRCPURL,
    divId: null,
    encodedContent: null,
    decoderScript: null,
    transformations: [],
    decoderSteps: [],
    finalResult: null
  };
  
  // Inject COMPREHENSIVE interception code with anti-debugger bypass
  await page.evaluateOnNewDocument(() => {
    // BYPASS ANTI-DEBUGGER FIRST
    // Override debugger statement
    const noop = () => {};
    window.eval = new Proxy(window.eval, {
      apply: function(target, thisArg, argumentsList) {
        const code = argumentsList[0];
        if (typeof code === 'string' && (code.includes('debugger') || code.includes('devtools'))) {
          console.log('🛡️ Blocked debugger/devtools check');
          return;
        }
        return target.apply(thisArg, argumentsList);
      }
    });
    
    // Block debugger statements
    const originalFunction = Function;
    window.Function = new Proxy(originalFunction, {
      construct: function(target, args) {
        const code = args[args.length - 1];
        if (typeof code === 'string' && (code.includes('debugger') || code.includes('devtools'))) {
          console.log('🛡️ Blocked Function with debugger');
          return function() {};
        }
        return new target(...args);
      }
    });
    
    // Override setInterval/setTimeout for anti-debugger loops
    const originalSetInterval = window.setInterval;
    const originalSetTimeout = window.setTimeout;
    
    window.setInterval = function(fn, delay) {
      if (typeof fn === 'function') {
        const fnStr = fn.toString();
        if (fnStr.includes('debugger') || fnStr.includes('devtools')) {
          console.log('🛡️ Blocked setInterval with debugger');
          return 0;
        }
      }
      return originalSetInterval.apply(this, arguments);
    };
    
    window.setTimeout = function(fn, delay) {
      if (typeof fn === 'function') {
        const fnStr = fn.toString();
        if (fnStr.includes('debugger') || fnStr.includes('devtools')) {
          console.log('🛡️ Blocked setTimeout with debugger');
          return 0;
        }
      }
      return originalSetTimeout.apply(this, arguments);
    };
    
    // Now setup interception
    window.interceptedTransformations = [];
    window.decoderSteps = [];
    window.allOperations = [];
    
    console.log('🔍 INTERCEPTION ACTIVE + ANTI-DEBUGGER BYPASSED');
    
    // Intercept atob (base64 decode)
    const originalAtob = window.atob;
    window.atob = function(str) {
      const result = originalAtob(str);
      
      console.log('═══════════════════════════════════════');
      console.log('🔍 ATOB CALLED');
      console.log('Input length:', str.length);
      console.log('Input (first 200):', str.substring(0, 200));
      console.log('Output length:', result.length);
      console.log('Output (first 200):', result.substring(0, 200));
      console.log('═══════════════════════════════════════');
      
      window.interceptedTransformations.push({
        type: 'atob',
        timestamp: Date.now(),
        inputLength: str.length,
        input: str,
        outputLength: result.length,
        output: result
      });
      
      return result;
    };
    
    // Intercept charCodeAt
    const originalCharCodeAt = String.prototype.charCodeAt;
    let charCodeAtCalls = 0;
    String.prototype.charCodeAt = function(...args) {
      const result = originalCharCodeAt.apply(this, args);
      
      if (this.length > 100 && this.length < 10000) {
        charCodeAtCalls++;
        if (charCodeAtCalls <= 5) {
          console.log('🔍 charCodeAt:', {
            stringLength: this.length,
            stringSample: this.substring(0, 100),
            index: args[0],
            result: result
          });
        }
        
        window.decoderSteps.push({
          type: 'charCodeAt',
          stringLength: this.length,
          index: args[0],
          result: result
        });
      }
      
      return result;
    };
    
    // Intercept fromCharCode
    const originalFromCharCode = String.fromCharCode;
    String.fromCharCode = function(...args) {
      const result = originalFromCharCode.apply(String, args);
      
      if (args.length > 20) {
        console.log('═══════════════════════════════════════');
        console.log('🔍 fromCharCode CALLED');
        console.log('Args count:', args.length);
        console.log('First 20 codes:', args.slice(0, 20));
        console.log('Result length:', result.length);
        console.log('Result (first 200):', result.substring(0, 200));
        console.log('═══════════════════════════════════════');
        
        window.interceptedTransformations.push({
          type: 'fromCharCode',
          timestamp: Date.now(),
          argsCount: args.length,
          firstCodes: args.slice(0, 100),
          resultLength: result.length,
          result: result
        });
      }
      
      return result;
    };
    
    // Intercept getElementById
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
      const element = originalGetElementById.call(document, id);
      
      if (element && element.style && element.style.display === 'none') {
        console.log('═══════════════════════════════════════');
        console.log('🔍 getElementById CALLED FOR HIDDEN DIV');
        console.log('Div ID:', id);
        console.log('Content length:', element.textContent?.length);
        console.log('Content (first 200):', element.textContent?.substring(0, 200));
        console.log('═══════════════════════════════════════');
        
        window.interceptedTransformations.push({
          type: 'getElementById',
          timestamp: Date.now(),
          divId: id,
          contentLength: element.textContent?.length,
          content: element.textContent
        });
      }
      
      return element;
    };
  });
  
  // Listen to console
  page.on('console', msg => {
    console.log('[PRORCP]', msg.text());
  });
  
  console.log('\n🌐 Loading ProRCP page...');
  console.log('URL:', proRCPURL.substring(0, 100) + '...');
  
  try {
    await page.goto(proRCPURL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Page loaded');
    
    console.log('\n⏳ Waiting for decoder to execute...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Extract everything
    console.log('\n📦 EXTRACTING ALL DATA...');
    console.log('=' .repeat(60));
    
    const extractedData = await page.evaluate(() => {
      // Find hidden div
      const div = document.querySelector('div[id][style*="display: none"]') ||
                  document.querySelector('div[id][style*="display:none"]');
      
      // Find decoder script
      const scripts = Array.from(document.querySelectorAll('script'));
      let decoderScript = null;
      
      for (let script of scripts) {
        const content = script.textContent;
        if (content.includes('getElementById') && 
            (content.includes('charCodeAt') || content.includes('fromCharCode'))) {
          decoderScript = {
            content: content,
            src: script.src || 'inline'
          };
          break;
        }
      }
      
      // Find final result
      let finalResult = null;
      for (let script of scripts) {
        const content = script.textContent;
        
        const playerMatch = content.match(/new\s+Playerjs\s*\(\s*\{[^}]*file\s*:\s*["']([^"']+)["']/);
        if (playerMatch) {
          finalResult = { type: 'playerjs', url: playerMatch[1] };
          break;
        }
        
        const m3u8Match = content.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
        if (m3u8Match) {
          finalResult = { type: 'm3u8', url: m3u8Match[1] };
          break;
        }
      }
      
      return {
        div: div ? {
          id: div.id,
          content: div.textContent
        } : null,
        decoderScript: decoderScript,
        finalResult: finalResult,
        transformations: window.interceptedTransformations || [],
        decoderSteps: window.decoderSteps || []
      };
    });
    
    console.log('\n✅ EXTRACTION COMPLETE!');
    console.log('=' .repeat(60));
    
    if (extractedData.div) {
      console.log('\n📦 HIDDEN DIV:');
      console.log('   ID:', extractedData.div.id);
      console.log('   Content length:', extractedData.div.content.length);
      console.log('   Content sample:', extractedData.div.content.substring(0, 150));
      
      interceptedData.divId = extractedData.div.id;
      interceptedData.encodedContent = extractedData.div.content;
      
      fs.writeFileSync('FINAL-prorcp-encoded.txt', extractedData.div.content);
      fs.writeFileSync('FINAL-prorcp-divid.txt', extractedData.div.id);
      console.log('   💾 Saved encoded content and div ID');
    }
    
    if (extractedData.decoderScript) {
      console.log('\n📜 DECODER SCRIPT:');
      console.log('   Source:', extractedData.decoderScript.src);
      console.log('   Length:', extractedData.decoderScript.content.length);
      
      interceptedData.decoderScript = extractedData.decoderScript.content;
      fs.writeFileSync('FINAL-prorcp-decoder.js', extractedData.decoderScript.content);
      console.log('   💾 Saved decoder script');
    }
    
    console.log('\n📊 TRANSFORMATIONS:', extractedData.transformations.length);
    extractedData.transformations.forEach((t, i) => {
      console.log(`\n   ${i + 1}. ${t.type} at ${t.timestamp}`);
      if (t.input) {
        console.log(`      Input (${t.inputLength} chars):`, t.input.substring(0, 100) + '...');
      }
      if (t.output) {
        console.log(`      Output (${t.outputLength} chars):`, t.output.substring(0, 100) + '...');
      }
      if (t.firstCodes) {
        console.log(`      First codes:`, t.firstCodes.slice(0, 20));
      }
    });
    
    interceptedData.transformations = extractedData.transformations;
    interceptedData.decoderSteps = extractedData.decoderSteps;
    
    if (extractedData.finalResult) {
      console.log('\n🎯 FINAL RESULT:');
      console.log('   Type:', extractedData.finalResult.type);
      console.log('   URL:', extractedData.finalResult.url);
      
      interceptedData.finalResult = extractedData.finalResult;
    }
    
    // Save complete data
    fs.writeFileSync('FINAL-prorcp-complete-data.json', JSON.stringify(interceptedData, null, 2));
    console.log('\n💾 Saved complete data to FINAL-prorcp-complete-data.json');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPLETE! NOW ANALYZE THE TRANSFORMATIONS!');
    console.log('='.repeat(60));
    
    // Keep browser open
    console.log('\n⏸️  Browser staying open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

finalProRCPIntercept().catch(console.error);
