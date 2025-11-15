/**
 * COMPLETE TRACE: DIV ID -> M3U8 URL CONVERSION
 * This script will intercept EVERY step of how PlayerJS processes the hidden div
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function traceDivIdToM3U8() {
  console.log('🔍 Starting complete div ID to M3U8 trace...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Store all intercepted data
  const traceData = {
    divId: null,
    divContent: null,
    decodingSteps: [],
    networkRequests: [],
    functionCalls: [],
    finalM3U8: null
  };

  // Intercept ALL network requests
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    traceData.networkRequests.push({
      type: 'request',
      url: url,
      method: request.method(),
      headers: request.headers(),
      postData: request.postData()
    });
    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    traceData.networkRequests.push({
      type: 'response',
      url: url,
      status: response.status(),
      headers: response.headers()
    });
    
    // Capture m3u8 responses
    if (url.includes('.m3u8')) {
      try {
        const text = await response.text();
        traceData.networkRequests.push({
          type: 'm3u8_content',
          url: url,
          content: text
        });
      } catch (e) {}
    }
  });

  // Inject comprehensive monitoring BEFORE any scripts load
  await page.evaluateOnNewDocument(() => {
    window.traceLog = [];
    
    // Override document.getElementById to catch div access
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
      const element = originalGetElementById.call(document, id);
      if (element && element.tagName === 'DIV' && element.style.display === 'none') {
        window.traceLog.push({
          step: 'DIV_ACCESS',
          divId: id,
          innerHTML: element.innerHTML,
          timestamp: Date.now()
        });
      }
      return element;
    };

    // Override querySelector/querySelectorAll
    const originalQuerySelector = document.querySelector;
    document.querySelector = function(selector) {
      const element = originalQuerySelector.call(document, selector);
      if (element && element.tagName === 'DIV' && element.style.display === 'none') {
        window.traceLog.push({
          step: 'QUERY_SELECTOR',
          selector: selector,
          innerHTML: element.innerHTML,
          timestamp: Date.now()
        });
      }
      return element;
    };

    // Intercept atob (base64 decode)
    const originalAtob = window.atob;
    window.atob = function(str) {
      const result = originalAtob.call(window, str);
      window.traceLog.push({
        step: 'ATOB',
        input: str.substring(0, 100) + '...',
        output: result.substring(0, 100) + '...',
        inputLength: str.length,
        outputLength: result.length,
        timestamp: Date.now()
      });
      return result;
    };

    // Intercept btoa (base64 encode)
    const originalBtoa = window.btoa;
    window.btoa = function(str) {
      const result = originalBtoa.call(window, str);
      window.traceLog.push({
        step: 'BTOA',
        input: str.substring(0, 100) + '...',
        output: result.substring(0, 100) + '...',
        timestamp: Date.now()
      });
      return result;
    };

    // Intercept String methods that might be used for decoding
    const stringProto = String.prototype;
    
    const originalCharCodeAt = stringProto.charCodeAt;
    let charCodeAtCalls = 0;
    stringProto.charCodeAt = function(index) {
      charCodeAtCalls++;
      if (charCodeAtCalls % 100 === 0) {
        window.traceLog.push({
          step: 'CHAR_CODE_AT_BATCH',
          count: charCodeAtCalls,
          stringLength: this.length,
          timestamp: Date.now()
        });
      }
      return originalCharCodeAt.call(this, index);
    };

    const originalFromCharCode = String.fromCharCode;
    let fromCharCodeCalls = 0;
    String.fromCharCode = function(...args) {
      fromCharCodeCalls++;
      if (fromCharCodeCalls % 100 === 0) {
        window.traceLog.push({
          step: 'FROM_CHAR_CODE_BATCH',
          count: fromCharCodeCalls,
          timestamp: Date.now()
        });
      }
      return originalFromCharCode.apply(String, args);
    };

    // Intercept eval
    const originalEval = window.eval;
    window.eval = function(code) {
      window.traceLog.push({
        step: 'EVAL',
        code: code.substring(0, 200) + '...',
        codeLength: code.length,
        timestamp: Date.now()
      });
      return originalEval.call(window, code);
    };

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
      this._traceUrl = url;
      this._traceMethod = method;
      return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
      window.traceLog.push({
        step: 'XHR_REQUEST',
        method: this._traceMethod,
        url: this._traceUrl,
        data: data,
        timestamp: Date.now()
      });
      
      this.addEventListener('load', function() {
        window.traceLog.push({
          step: 'XHR_RESPONSE',
          url: this._traceUrl,
          status: this.status,
          response: this.responseText.substring(0, 200) + '...',
          timestamp: Date.now()
        });
      });
      
      return originalXHRSend.apply(this, arguments);
    };

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      window.traceLog.push({
        step: 'FETCH_REQUEST',
        url: url,
        options: options,
        timestamp: Date.now()
      });
      
      return originalFetch.apply(window, arguments).then(response => {
        window.traceLog.push({
          step: 'FETCH_RESPONSE',
          url: url,
          status: response.status,
          timestamp: Date.now()
        });
        return response;
      });
    };

    // Monitor PlayerJS initialization
    Object.defineProperty(window, 'Playerjs', {
      set: function(value) {
        window.traceLog.push({
          step: 'PLAYERJS_SET',
          timestamp: Date.now()
        });
        window._Playerjs = value;
      },
      get: function() {
        return window._Playerjs;
      }
    });

    console.log('🔍 Trace monitoring injected!');
  });

  // Navigate to a pro.rcp page
  console.log('📡 Navigating to pro.rcp page...');
  const testUrl = 'https://vidsrc.xyz/embed/movie/550'; // Fight Club
  await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 60000 });

  // Wait for player to initialize
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Extract the hidden div information
  const divInfo = await page.evaluate(() => {
    const divs = document.querySelectorAll('div[style*="display: none"], div[style*="display:none"]');
    for (const div of divs) {
      if (div.id && div.innerHTML) {
        return {
          id: div.id,
          content: div.innerHTML
        };
      }
    }
    return null;
  });

  if (divInfo) {
    console.log('\n✅ Found hidden div:');
    console.log('ID:', divInfo.id);
    console.log('Content length:', divInfo.content.length);
    console.log('Content preview:', divInfo.content.substring(0, 100) + '...');
    traceData.divId = divInfo.id;
    traceData.divContent = divInfo.content;
  }

  // Get all trace logs
  const traceLogs = await page.evaluate(() => window.traceLog);
  traceData.functionCalls = traceLogs;

  console.log('\n📊 Trace Summary:');
  console.log('Total function calls intercepted:', traceLogs.length);
  
  // Analyze the sequence
  const stepCounts = {};
  traceLogs.forEach(log => {
    stepCounts[log.step] = (stepCounts[log.step] || 0) + 1;
  });
  
  console.log('\n📈 Function call breakdown:');
  Object.entries(stepCounts).forEach(([step, count]) => {
    console.log(`  ${step}: ${count}`);
  });

  // Look for the decoding sequence
  console.log('\n🔄 Decoding sequence:');
  let lastTimestamp = 0;
  traceLogs.forEach((log, index) => {
    if (log.step === 'DIV_ACCESS' || log.step === 'ATOB' || log.step === 'EVAL' || 
        log.step.includes('XHR') || log.step.includes('FETCH')) {
      const timeDiff = lastTimestamp ? log.timestamp - lastTimestamp : 0;
      console.log(`  [${index}] ${log.step} (+${timeDiff}ms)`);
      if (log.divId) console.log(`      Div ID: ${log.divId}`);
      if (log.url) console.log(`      URL: ${log.url}`);
      lastTimestamp = log.timestamp;
    }
  });

  // Check for m3u8 URLs in network requests
  const m3u8Requests = traceData.networkRequests.filter(req => 
    req.url && req.url.includes('.m3u8')
  );
  
  if (m3u8Requests.length > 0) {
    console.log('\n🎯 M3U8 URLs found:');
    m3u8Requests.forEach(req => {
      console.log(`  ${req.url}`);
      traceData.finalM3U8 = req.url;
    });
  }

  // Save complete trace
  fs.writeFileSync(
    'divid-to-m3u8-trace.json',
    JSON.stringify(traceData, null, 2)
  );
  console.log('\n💾 Complete trace saved to divid-to-m3u8-trace.json');

  // Keep browser open for manual inspection
  console.log('\n⏸️  Browser kept open for inspection. Press Ctrl+C to close.');
  await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  await browser.close();
}

traceDivIdToM3U8().catch(console.error);
