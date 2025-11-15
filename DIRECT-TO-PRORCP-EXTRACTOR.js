const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * Go directly to the Cloudstream RCP URL and extract ProRCP
 * Then analyze ProRCP decoder in detail
 */

async function directToProRCP() {
  console.log('🚀 DIRECT PRORCP EXTRACTION');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // The Cloudstream RCP URL from network log
  const cloudstreamURL = 'https://cloudnestra.com/rcp/ZDYzMjUwYTNlOTI3MjRiMWI1ZWM2MGU5YTJmN2Y5NDA6TDFCVVNWaG5OR2czYUdwbVIwVmlPVFI1ZG1KWFNGbzRPVVpEY0ZOeVNUVklXbHB2V2trNFlUTlRORWN6YTNFMGFtWk1OR00zY1hsb2FuVXJhMWxGUlhCMWRYSXZTRFp4TWtsUVZteHVPWEJ0VUVOU05EZzJjM0JTVHpFdmN6QmlTMjlEZEdGeGRqWjNibGswVjFSeGVYQXJSMmRsZWtaWGRYWnFVMDQzTDBReGVtdHpiVUpPT0d4d2RVdG1NbGN2WW5WMmJWSXplak0xSzJjeFJqVnBTVXA2V0c5T2JDdHZZMFpRYmtGME5IZGFlVkJ1VmpRdlNXRnFjM2cxYkc5SlpWRlNjMHhhZVdWRmFYTmlXR3h4WWs4MGNTdFpUbXhXZDNaTlQxWnNWbFZhVm1kamRVWm9NbXRvTUhob2FTOXpUVEUzVkRocVVFeExaa1JDZUhsSGVrZEVaVmhqYTBsRlJrWkRhekpOY0ZFdloyeEVaRXhHTkdvMWJUUlNabEZEUTJWSldWSkRjM1pIU3pKcFFrMVJRbGh4U2t4QlkyNHdRV3ByVFV4bFlXdFJOVGx0WTJ4eFZHTnJTbmR1VTJsblpYWTFUV05FY1ZKSGJDc3dRaXRVWkZVNFZEaHhVemx5WWtodVJHSTVRVFU0SzA4MGVqUk9jMEp3VUVkaGRYTTNTRWhuY2xwbmMwMXpObU5TUzFCTVNVUk9MekJTUlRneVRGUldLMFZ2TURad1RWSjRjVzQzVDFSdmRXeFpia1l4WkZwUk1sYzJRVmx3V1RsS1pGWkJVelZsVjJoRFVrY3dTV1JVYzBFdlUyaENNVWRKUjJKYVFXeE5kMWsyV0ZSUFpWSXhiVzVWV0RKaE5IQmplREp4VDNwa1YzZ3pOMDF1ZGtWWGRVSkdhM1pQZVdwREt6UXlNbEkwZVd0V2VXTm5hREpFTTBwSFpFNTZNbFpQYkdWTFpTdDVjMlJ2V0hsMVZ6QkJZMHBaT0hwVlVuUk9WVlkxYTJObE9EaFRNa2xSUkN0cVpXcFpZM05RWVV4blVtMVZLMnhvSzI5eVZWVlpRWGcxWm1oR1RqTkVWbXRZVGpaRmFUazRUVlk1VjJkd1dYRjJjQzlJYjBSMWFURkVjbVk1VkdkRE1tTnVZVVZaYW1obFFqWkJTQzlrTTBacE5IZ3JaMnBMZVhWdVZUUkJhR05OT1ZOWVZUWlJaM2cxUjBwcFYwcFpTbmN5VFVFeE1VWmFNRTR6TmpNNWVqaEljVmRYYmxoSFQycHhUa2RtYjBoM01sSlBTWHBYYmtSbk9HMUxXbFZvVTBGamQxcFNjWEJTYVZkcmFuVjFhemt2UlRSUGJXWjJXa05OYVVoeFIxTjNVbFJIUWpKVkswZHNVbXBEU2xVM1NYbG1WbU13UzBaVlRXaEtTRFppVHpOcU1IZDFXVFJPVkVWVEsyeEJibEI2YzNSbEwzbERaalZMZEhJeFVUVk5RVTlRYURoMEwwVnVVVzF2ZWsxeWRqWlllbmR5ZUZkemRYbGFjRGsxWW5ZNFdIUTVWMU5XWVhSUFJESkpkRmhoYjFkd2IyRktWRkpLUldWYU9FeElPRE5uVkhoNVZUaElTRzA1VTFwWllrOWpXRkEyUVU4NGFFRjRXRFIwZUM5SU5VTnplbU01THprcmRUQTRUa1Y0ZUhWRU5XMTVUakkzVjJseGRsSnJhV3hsTjJNd1oxaDJXR0ZVUjBVNGFEVnpMMHQzWTBoUWNsRTROSGRvV21FclVFaE5jSFI0Vm1welNVWXJhazlwY0ZCTE1EQndZbXcwVGpWMGRVUlpTVkk1T1dkQmVHUjJWRlJpY0hKbVFYcFhiVVJ4WVZOeVkzWk9iREZqVXpnMFpYQnVPVU5SWTBrdlZXazJaRU5wZWxsRWRYVjZjM2QzZFRWMk5XWnZSRGxDYUZkdFFXeHZhVmw1VjJOS1dIZFhNekI2TTBacWNEbG1NSFJxTUhvMFFYUXdTRXd6ZVUxcWVIVmFiR3R4U2tkaGVuTnFLemczTVU5bVEyaEZjVXg0U0hGQlVGVkRRMjlFTW1GQ2FFRkhVblF4YWtwR1VUMDk-';
  
  console.log('\n📍 Navigating to Cloudstream RCP...');
  console.log('   URL:', cloudstreamURL.substring(0, 100) + '...');
  
  try {
    await page.goto(cloudstreamURL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Cloudstream RCP loaded');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Look for ProRCP iframe
    console.log('\n🔍 Searching for ProRCP iframe...');
    
    const proRCPData = await page.evaluate(() => {
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
      
      // Also check scripts
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
      console.log('❌ ProRCP not found. Checking all content...');
      
      const pageContent = await page.evaluate(() => {
        return {
          iframes: Array.from(document.querySelectorAll('iframe')).map(i => i.src),
          scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src),
          bodyText: document.body?.textContent?.substring(0, 1000)
        };
      });
      
      console.log('\nIframes:', pageContent.iframes);
      console.log('\nScripts:', pageContent.scripts);
      console.log('\nBody text:', pageContent.bodyText);
      
      await browser.close();
      return;
    }
    
    console.log('✅ Found ProRCP URL:', proRCPData.url);
    
    // Now navigate to ProRCP and intercept EVERYTHING
    console.log('\n📍 Navigating to ProRCP...');
    console.log('=' .repeat(60));
    
    const proPage = await browser.newPage();
    
    const interceptedData = {
      url: proRCPData.url,
      divId: null,
      encodedContent: null,
      decoderScript: null,
      transformations: [],
      finalResult: null
    };
    
    // Inject interception code
    await proPage.evaluateOnNewDocument(() => {
      window.interceptedTransformations = [];
      window.decoderSteps = [];
      
      // Intercept atob
      const originalAtob = window.atob;
      window.atob = function(str) {
        const result = originalAtob(str);
        console.log('🔍 ATOB:', {
          inputLength: str.length,
          inputSample: str.substring(0, 100),
          outputLength: result.length,
          outputSample: result.substring(0, 100)
        });
        
        window.interceptedTransformations.push({
          type: 'atob',
          timestamp: Date.now(),
          input: str.substring(0, 1000),
          output: result.substring(0, 1000)
        });
        
        return result;
      };
      
      // Intercept charCodeAt
      const originalCharCodeAt = String.prototype.charCodeAt;
      String.prototype.charCodeAt = function(...args) {
        const result = originalCharCodeAt.apply(this, args);
        if (this.length > 100 && this.length < 10000) {
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
          console.log('🔍 fromCharCode:', {
            argsCount: args.length,
            firstCodes: args.slice(0, 10),
            resultSample: result.substring(0, 100)
          });
          
          window.interceptedTransformations.push({
            type: 'fromCharCode',
            timestamp: Date.now(),
            argsCount: args.length,
            firstCodes: args.slice(0, 50),
            result: result.substring(0, 1000)
          });
        }
        return result;
      };
    });
    
    // Listen to console
    proPage.on('console', msg => {
      console.log('   [PRORCP]', msg.text());
    });
    
    console.log('🌐 Loading ProRCP page...');
    await proPage.goto(proRCPData.url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('⏳ Waiting for decoder...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Extract everything
    console.log('\n📦 Extracting data...');
    
    const extractedData = await proPage.evaluate(() => {
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
      console.log('\n📦 Hidden Div:');
      console.log('   ID:', extractedData.div.id);
      console.log('   Content length:', extractedData.div.content.length);
      console.log('   Content sample:', extractedData.div.content.substring(0, 100));
      
      interceptedData.divId = extractedData.div.id;
      interceptedData.encodedContent = extractedData.div.content;
      
      fs.writeFileSync('prorcp-encoded-content.txt', extractedData.div.content);
      fs.writeFileSync('prorcp-div-id.txt', extractedData.div.id);
    }
    
    if (extractedData.decoderScript) {
      console.log('\n📜 Decoder Script:');
      console.log('   Source:', extractedData.decoderScript.src);
      console.log('   Length:', extractedData.decoderScript.content.length);
      
      interceptedData.decoderScript = extractedData.decoderScript.content;
      fs.writeFileSync('prorcp-decoder-script.js', extractedData.decoderScript.content);
    }
    
    console.log('\n📊 Transformations:', extractedData.transformations.length);
    extractedData.transformations.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.type}`);
      if (t.input) console.log(`      Input: ${t.input.substring(0, 80)}...`);
      if (t.output) console.log(`      Output: ${t.output.substring(0, 80)}...`);
    });
    
    interceptedData.transformations = extractedData.transformations;
    
    if (extractedData.finalResult) {
      console.log('\n🎯 Final Result:');
      console.log('   Type:', extractedData.finalResult.type);
      console.log('   URL:', extractedData.finalResult.url);
      
      interceptedData.finalResult = extractedData.finalResult;
    }
    
    // Save everything
    fs.writeFileSync('prorcp-complete-data.json', JSON.stringify(interceptedData, null, 2));
    console.log('\n💾 Saved complete data to prorcp-complete-data.json');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PRORCP REVERSE ENGINEERING COMPLETE!');
    console.log('='.repeat(60));
    
    // Keep browser open
    console.log('\n⏸️  Browser will stay open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  await browser.close();
}

directToProRCP().catch(console.error);
