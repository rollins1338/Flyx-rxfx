const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * COMPLETE CHAIN REVERSE ENGINEERING
 * 1. Start at vidsrc-embed.ru/embed/movie/550
 * 2. Extract Cloudstream RCP URL
 * 3. Navigate to Cloudstream RCP
 * 4. Extract ProRCP URL
 * 5. Navigate to ProRCP and INTERCEPT EVERYTHING
 */

async function completeChainReverseEngineer() {
  console.log('🚀 COMPLETE CHAIN REVERSE ENGINEERING');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  const chain = {
    step1_vidsrcEmbed: null,
    step2_cloudstreamRCP: null,
    step3_proRCP: null,
    step4_decoderData: null
  };

  // Enable request interception
  await page.setRequestInterception(true);
  const requests = [];
  
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
    request.continue();
  });

  // ============================================================
  // STEP 1: Navigate to vidsrc-embed.ru
  // ============================================================
  console.log('\n📍 STEP 1: Navigating to vidsrc-embed.ru...');
  const startUrl = 'https://vidsrc-embed.ru/embed/movie/550';
  chain.step1_vidsrcEmbed = startUrl;
  
  console.log('   URL:', startUrl);
  await page.goto(startUrl, { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // ============================================================
  // STEP 2: Extract Cloudstream RCP URL
  // ============================================================
  console.log('\n📍 STEP 2: Extracting Cloudstream RCP URL...');
  
  const cloudstreamData = await page.evaluate(() => {
    // Look for iframes
    const iframes = Array.from(document.querySelectorAll('iframe'));
    
    for (let iframe of iframes) {
      const src = iframe.src;
      if (src && src.includes('cloudstream')) {
        return {
          url: src,
          found: true
        };
      }
    }
    
    // Look in scripts for cloudstream references
    const scripts = Array.from(document.querySelectorAll('script'));
    for (let script of scripts) {
      const content = script.textContent;
      const match = content.match(/(https?:\/\/[^"'\s]*cloudstream[^"'\s]*)/i);
      if (match) {
        return {
          url: match[1],
          found: true
        };
      }
    }
    
    return { found: false };
  });

  if (!cloudstreamData.found) {
    console.error('❌ Could not find Cloudstream RCP URL!');
    console.log('\n🔍 Checking all iframes and scripts...');
    
    const allData = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe')).map(i => i.src);
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      return { iframes, scripts };
    });
    
    console.log('Iframes found:', allData.iframes);
    console.log('Scripts found:', allData.scripts);
    
    await browser.close();
    return;
  }

  chain.step2_cloudstreamRCP = cloudstreamData.url;
  console.log('✅ Found Cloudstream RCP:', cloudstreamData.url);

  // ============================================================
  // STEP 3: Navigate to Cloudstream RCP and extract ProRCP
  // ============================================================
  console.log('\n📍 STEP 3: Navigating to Cloudstream RCP...');
  await page.goto(cloudstreamData.url, { waitUntil: 'networkidle0' });
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🔍 Extracting ProRCP URL...');
  
  const proRCPData = await page.evaluate(() => {
    // Look for iframes with prorcp
    const iframes = Array.from(document.querySelectorAll('iframe'));
    
    for (let iframe of iframes) {
      const src = iframe.src;
      if (src && src.includes('prorcp')) {
        return {
          url: src,
          found: true
        };
      }
    }
    
    // Look in scripts
    const scripts = Array.from(document.querySelectorAll('script'));
    for (let script of scripts) {
      const content = script.textContent;
      const match = content.match(/(https?:\/\/[^"'\s]*prorcp[^"'\s]*)/i);
      if (match) {
        return {
          url: match[1],
          found: true
        };
      }
    }
    
    return { found: false };
  });

  if (!proRCPData.found) {
    console.error('❌ Could not find ProRCP URL!');
    console.log('\n🔍 Checking all iframes and scripts...');
    
    const allData = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe')).map(i => i.src);
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      const inlineScripts = Array.from(document.querySelectorAll('script:not([src])')).map(s => s.textContent.substring(0, 200));
      return { iframes, scripts, inlineScripts };
    });
    
    console.log('Iframes found:', allData.iframes);
    console.log('Scripts found:', allData.scripts);
    console.log('Inline scripts:', allData.inlineScripts);
    
    await browser.close();
    return;
  }

  chain.step3_proRCP = proRCPData.url;
  console.log('✅ Found ProRCP:', proRCPData.url);

  // ============================================================
  // STEP 4: Navigate to ProRCP and INTERCEPT EVERYTHING
  // ============================================================
  console.log('\n📍 STEP 4: Navigating to ProRCP and intercepting...');
  console.log('=' .repeat(60));

  // Create a new page for ProRCP with full interception
  const proPage = await browser.newPage();
  
  const interceptedData = {
    url: proRCPData.url,
    divId: null,
    encodedContent: null,
    decoderScript: null,
    transformations: [],
    finalResult: null
  };

  // Inject interception code BEFORE navigation
  await proPage.evaluateOnNewDocument(() => {
    window.interceptedTransformations = [];
    
    // Intercept atob
    const originalAtob = window.atob;
    window.atob = function(str) {
      const result = originalAtob(str);
      if (str.length > 50) {
        console.log('🔍 ATOB CALLED');
        console.log('   Input length:', str.length);
        console.log('   Input sample:', str.substring(0, 100));
        console.log('   Output length:', result.length);
        console.log('   Output sample:', result.substring(0, 100));
        
        window.interceptedTransformations.push({
          type: 'atob',
          timestamp: Date.now(),
          inputLength: str.length,
          inputSample: str.substring(0, 500),
          outputLength: result.length,
          outputSample: result.substring(0, 500)
        });
      }
      return result;
    };

    // Intercept String.prototype.charCodeAt
    const originalCharCodeAt = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function(...args) {
      const result = originalCharCodeAt.apply(this, args);
      if (this.length > 100 && this.length < 10000) {
        window.interceptedTransformations.push({
          type: 'charCodeAt',
          timestamp: Date.now(),
          stringLength: this.length,
          stringSample: this.substring(0, 100),
          index: args[0],
          result: result
        });
      }
      return result;
    };

    // Intercept String.fromCharCode
    const originalFromCharCode = String.fromCharCode;
    String.fromCharCode = function(...args) {
      const result = originalFromCharCode.apply(String, args);
      if (args.length > 20) {
        console.log('🔍 fromCharCode CALLED with', args.length, 'chars');
        console.log('   First 10 codes:', args.slice(0, 10));
        console.log('   Result sample:', result.substring(0, 100));
        
        window.interceptedTransformations.push({
          type: 'fromCharCode',
          timestamp: Date.now(),
          argsCount: args.length,
          firstCodes: args.slice(0, 20),
          resultLength: result.length,
          resultSample: result.substring(0, 500)
        });
      }
      return result;
    };

    // Intercept getElementById
    const originalGetElementById = document.getElementById;
    document.getElementById = function(id) {
      const element = originalGetElementById.call(document, id);
      if (element && element.style.display === 'none') {
        console.log('🔍 getElementById CALLED for hidden div:', id);
        console.log('   Content length:', element.textContent?.length);
        console.log('   Content sample:', element.textContent?.substring(0, 100));
        
        window.interceptedTransformations.push({
          type: 'getElementById',
          timestamp: Date.now(),
          divId: id,
          contentLength: element.textContent?.length,
          contentSample: element.textContent?.substring(0, 500)
        });
      }
      return element;
    };
  });

  // Listen to console logs
  proPage.on('console', msg => {
    const text = msg.text();
    console.log('   [PAGE]', text);
  });

  console.log('🌐 Loading ProRCP page...');
  await proPage.goto(proRCPData.url, { waitUntil: 'networkidle0' });
  
  console.log('⏳ Waiting for decoder to execute...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Extract hidden div
  console.log('\n📦 Extracting hidden div...');
  const divData = await proPage.evaluate(() => {
    const div = document.querySelector('div[id][style*="display: none"]') ||
                document.querySelector('div[id][style*="display:none"]');
    
    if (div) {
      return {
        id: div.id,
        content: div.textContent,
        innerHTML: div.innerHTML
      };
    }
    return null;
  });

  if (divData) {
    interceptedData.divId = divData.id;
    interceptedData.encodedContent = divData.content;
    console.log('✅ Found hidden div:');
    console.log('   ID:', divData.id);
    console.log('   Content length:', divData.content.length);
    console.log('   Content sample:', divData.content.substring(0, 100));
  }

  // Extract decoder script
  console.log('\n📜 Extracting decoder script...');
  const decoderScript = await proPage.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    
    for (let script of scripts) {
      const content = script.textContent || script.innerHTML;
      
      if (content.includes('getElementById') && 
          (content.includes('charCodeAt') || content.includes('fromCharCode'))) {
        return {
          content: content,
          src: script.src || 'inline',
          length: content.length
        };
      }
    }
    return null;
  });

  if (decoderScript) {
    interceptedData.decoderScript = decoderScript.content;
    console.log('✅ Found decoder script:');
    console.log('   Source:', decoderScript.src);
    console.log('   Length:', decoderScript.length);
    
    fs.writeFileSync('prorcp-decoder-script.js', decoderScript.content);
    console.log('   💾 Saved to prorcp-decoder-script.js');
  }

  // Get all transformations
  console.log('\n📊 Collecting transformations...');
  const transformations = await proPage.evaluate(() => {
    return window.interceptedTransformations || [];
  });

  interceptedData.transformations = transformations;
  console.log(`✅ Captured ${transformations.length} transformations`);

  if (transformations.length > 0) {
    console.log('\n🔬 TRANSFORMATION SEQUENCE:');
    transformations.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.type} at ${t.timestamp}`);
      if (t.type === 'atob') {
        console.log(`      Input: ${t.inputSample?.substring(0, 80)}...`);
        console.log(`      Output: ${t.outputSample?.substring(0, 80)}...`);
      } else if (t.type === 'fromCharCode') {
        console.log(`      Codes: [${t.firstCodes?.join(', ')}...]`);
        console.log(`      Result: ${t.resultSample?.substring(0, 80)}...`);
      }
    });
  }

  // Try to extract final result
  console.log('\n🎯 Extracting final decoded result...');
  const finalResult = await proPage.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    
    for (let script of scripts) {
      const content = script.textContent;
      
      // Look for PlayerJS
      const playerMatch = content.match(/new\s+Playerjs\s*\(\s*\{[^}]*file\s*:\s*["']([^"']+)["']/);
      if (playerMatch) {
        return {
          type: 'playerjs',
          url: playerMatch[1]
        };
      }
      
      // Look for m3u8
      const m3u8Match = content.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
      if (m3u8Match) {
        return {
          type: 'm3u8',
          url: m3u8Match[1]
        };
      }
    }
    
    return null;
  });

  if (finalResult) {
    interceptedData.finalResult = finalResult;
    console.log('✅ Found final result:');
    console.log('   Type:', finalResult.type);
    console.log('   URL:', finalResult.url);
  }

  chain.step4_decoderData = interceptedData;

  // Save everything
  console.log('\n💾 Saving complete chain data...');
  fs.writeFileSync('complete-chain-data.json', JSON.stringify(chain, null, 2));
  console.log('✅ Saved to complete-chain-data.json');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 COMPLETE CHAIN REVERSE ENGINEERING DONE!');
  console.log('='.repeat(60));
  console.log('\nChain summary:');
  console.log('1. vidsrc-embed.ru:', chain.step1_vidsrcEmbed);
  console.log('2. Cloudstream RCP:', chain.step2_cloudstreamRCP);
  console.log('3. ProRCP:', chain.step3_proRCP);
  console.log('4. Transformations:', chain.step4_decoderData?.transformations?.length || 0);
  console.log('5. Final result:', chain.step4_decoderData?.finalResult?.url || 'Not found');

  await browser.close();
}

// Run it
completeChainReverseEngineer().catch(console.error);
