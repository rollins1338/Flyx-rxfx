// Use Puppeteer to reverse engineer PlayerJS decryption in real-time
const puppeteer = require('puppeteer');
const fs = require('fs');

async function reverseEngineerPlayerJS(tmdbId) {
  console.log('='.repeat(70));
  console.log('🔬 LIVE PLAYERJS REVERSE ENGINEERING');
  console.log('='.repeat(70));
  console.log(`\nTMDB ID: ${tmdbId}\n`);

  const browser = await puppeteer.launch({
    headless: 'new', // Run headless for automated analysis
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const discoveries = {
    hiddenDiv: null,
    encoded: null,
    divId: null,
    decodingSteps: [],
    finalUrl: null,
    interceptedCalls: []
  };

  try {
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('http') || text.includes('m3u8') || text.includes('decode') || text.includes('file')) {
        console.log(`📄 [PAGE CONSOLE]:`, text);
      }
    });

    // Intercept and log all function calls related to decoding
    await page.evaluateOnNewDocument(() => {
      // Store original functions
      const originalGetElementById = document.getElementById;
      const originalQuerySelector = document.querySelector;
      const originalAtob = window.atob;
      const originalFromCharCode = String.fromCharCode;
      
      // Track all getElementById calls
      document.getElementById = function(...args) {
        const result = originalGetElementById.apply(this, args);
        if (result && result.innerHTML && result.innerHTML.length > 50) {
          console.log('🔍 [INTERCEPT] getElementById:', args[0]);
          console.log('   Content length:', result.innerHTML.length);
          console.log('   First 100 chars:', result.innerHTML.substring(0, 100));
        }
        return result;
      };
      
      // Track querySelector calls
      document.querySelector = function(...args) {
        const result = originalQuerySelector.apply(this, args);
        if (result && result.innerHTML && result.innerHTML.length > 50) {
          console.log('🔍 [INTERCEPT] querySelector:', args[0]);
          console.log('   Content length:', result.innerHTML.length);
        }
        return result;
      };
      
      // Track atob (base64 decode) calls
      window.atob = function(...args) {
        const input = args[0];
        const result = originalAtob.apply(this, args);
        if (input && input.length > 20) {
          console.log('🔓 [INTERCEPT] atob (base64 decode)');
          console.log('   Input:', input.substring(0, 100));
          console.log('   Output:', result.substring(0, 100));
          if (result.includes('http')) {
            console.log('   ✅ CONTAINS HTTP URL!');
          }
        }
        return result;
      };
      
      // Track String.fromCharCode (often used in deobfuscation)
      String.fromCharCode = function(...args) {
        const result = originalFromCharCode.apply(this, args);
        if (args.length > 10 && result.includes('http')) {
          console.log('🔓 [INTERCEPT] String.fromCharCode');
          console.log('   Result contains HTTP:', result.substring(0, 200));
        }
        return result;
      };
      
      // Intercept XOR operations (common in custom encryption)
      const originalCharCodeAt = String.prototype.charCodeAt;
      String.prototype.charCodeAt = function(...args) {
        const result = originalCharCodeAt.apply(this, args);
        // Log if this looks like it's being used for XOR
        if (this.length > 50 && args[0] !== undefined) {
          // Don't log every call, just track that XOR-like operations are happening
          if (!window._xorTracked) {
            console.log('🔓 [INTERCEPT] Possible XOR operation detected');
            window._xorTracked = true;
          }
        }
        return result;
      };
    });

    // Step 1: Navigate to embed page
    console.log('[1] Loading embed page...');
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Step 2: Extract hash
    console.log('[2] Extracting hash...');
    const hash = await page.evaluate(() => {
      const hashEl = document.querySelector('[data-hash]');
      return hashEl ? hashEl.getAttribute('data-hash') : null;
    });
    
    if (!hash) {
      console.log('❌ No hash found');
      return discoveries;
    }
    
    console.log(`✅ Hash: ${hash.substring(0, 30)}...`);
    
    // Step 3: Navigate to RCP page
    console.log('[3] Loading RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    await page.goto(rcpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Step 4: Extract ProRCP URL
    console.log('[4] Extracting ProRCP URL...');
    const prorcpHash = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="/prorcp/"]');
      if (iframe) {
        const src = iframe.getAttribute('src');
        return src ? src.split('/prorcp/')[1] : null;
      }
      
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const match = script.textContent.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
        if (match) return match[1];
      }
      
      return null;
    });
    
    if (!prorcpHash) {
      console.log('❌ No ProRCP hash found');
      return discoveries;
    }
    
    console.log(`✅ ProRCP hash: ${prorcpHash.substring(0, 30)}...`);
    
    // Step 5: Navigate to ProRCP player page
    console.log('[5] Loading ProRCP player page...');
    console.log('    🔬 WATCH THE CONSOLE FOR DECODING OPERATIONS...\n');
    
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
    await page.goto(prorcpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Step 6: Extract hidden div BEFORE PlayerJS processes it
    console.log('[6] Extracting hidden div data...');
    const hiddenDivData = await page.evaluate(() => {
      const divs = document.querySelectorAll('div[style*="display:none"], div[style*="display: none"]');
      for (const div of divs) {
        const content = div.textContent || div.innerHTML;
        if (content && content.length > 50) {
          return {
            id: div.id,
            content: content,
            length: content.length
          };
        }
      }
      return null;
    });
    
    if (hiddenDivData) {
      console.log(`✅ Hidden Div Found:`);
      console.log(`   ID: ${hiddenDivData.id}`);
      console.log(`   Length: ${hiddenDivData.length}`);
      console.log(`   First 100 chars: ${hiddenDivData.content.substring(0, 100)}`);
      
      discoveries.hiddenDiv = hiddenDivData;
      discoveries.divId = hiddenDivData.id;
      discoveries.encoded = hiddenDivData.content;
    }
    
    // Step 7: Wait and watch for decoding
    console.log('\n[7] Waiting for PlayerJS to decode...');
    console.log('    Watch the browser console for decoding operations!\n');
    
    await page.waitForTimeout(10000); // Wait 10 seconds to observe
    
    // Step 8: Try to extract the decoded m3u8 URL
    console.log('[8] Attempting to extract decoded m3u8...');
    const extractedData = await page.evaluate(() => {
      const results = {
        videoSrc: null,
        playerFile: null,
        windowVars: [],
        allUrls: []
      };
      
      // Check video element
      const video = document.querySelector('video');
      if (video && video.src) {
        results.videoSrc = video.src;
        if (video.src.includes('.m3u8')) {
          results.allUrls.push(video.src);
        }
      }
      
      // Check player objects
      if (window.player && window.player.file) {
        results.playerFile = window.player.file;
        if (window.player.file.includes('.m3u8')) {
          results.allUrls.push(window.player.file);
        }
      }
      
      // Check all window variables for m3u8 URLs
      for (const key in window) {
        try {
          const value = window[key];
          if (typeof value === 'string' && value.includes('.m3u8')) {
            results.windowVars.push({ key, value });
            results.allUrls.push(value);
          }
        } catch (e) {
          // Skip inaccessible properties
        }
      }
      
      return results;
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 EXTRACTION RESULTS');
    console.log('='.repeat(70));
    
    if (extractedData.videoSrc) {
      console.log(`\n✅ Video src: ${extractedData.videoSrc}`);
    }
    
    if (extractedData.playerFile) {
      console.log(`✅ Player file: ${extractedData.playerFile}`);
    }
    
    if (extractedData.windowVars.length > 0) {
      console.log(`\n✅ Found ${extractedData.windowVars.length} window variables with m3u8:`);
      extractedData.windowVars.forEach(({ key, value }) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    
    if (extractedData.allUrls.length > 0) {
      console.log(`\n✅ All m3u8 URLs found:`);
      extractedData.allUrls.forEach((url, i) => {
        console.log(`   [${i + 1}] ${url}`);
      });
      discoveries.finalUrl = extractedData.allUrls[0];
    }
    
    // Step 9: Analyze the decoding process
    console.log('\n' + '='.repeat(70));
    console.log('🔬 REVERSE ENGINEERING ANALYSIS');
    console.log('='.repeat(70));
    
    if (discoveries.encoded && discoveries.finalUrl) {
      console.log(`\n✅ We have both the encoded input and decoded output!`);
      console.log(`\nEncoded (first 100): ${discoveries.encoded.substring(0, 100)}`);
      console.log(`Decoded URL: ${discoveries.finalUrl}`);
      
      // Try to figure out the encoding
      console.log(`\n🔍 Analyzing encoding method...`);
      
      // Check if it's hex
      const isHex = /^[0-9a-fA-F]+$/.test(discoveries.encoded);
      console.log(`   Is hex: ${isHex}`);
      
      if (isHex) {
        console.log(`\n   Trying to reverse engineer hex-based encoding...`);
        const hexBuffer = Buffer.from(discoveries.encoded, 'hex');
        const urlBuffer = Buffer.from(discoveries.finalUrl);
        
        console.log(`   Hex decoded length: ${hexBuffer.length}`);
        console.log(`   URL length: ${urlBuffer.length}`);
        
        // Try to find XOR key
        if (hexBuffer.length >= urlBuffer.length) {
          console.log(`\n   Attempting to extract XOR key...`);
          const potentialKey = Buffer.alloc(Math.min(hexBuffer.length, urlBuffer.length));
          
          for (let i = 0; i < potentialKey.length; i++) {
            potentialKey[i] = hexBuffer[i] ^ urlBuffer.charCodeAt(i);
          }
          
          console.log(`   Potential XOR key (first 50 bytes): ${potentialKey.slice(0, 50).toString('hex')}`);
          console.log(`   As ASCII: ${potentialKey.slice(0, 50).toString('utf8').replace(/[^\x20-\x7E]/g, '.')}`);
          
          // Check if key repeats (common in XOR)
          const keyPattern = potentialKey.slice(0, 10).toString('hex');
          console.log(`   First 10 bytes pattern: ${keyPattern}`);
          
          // Check if divId is the key
          if (discoveries.divId) {
            console.log(`\n   Testing if divId is the XOR key...`);
            const divIdBuffer = Buffer.from(discoveries.divId);
            let matches = 0;
            for (let i = 0; i < Math.min(20, potentialKey.length); i++) {
              if (potentialKey[i] === divIdBuffer[i % divIdBuffer.length]) {
                matches++;
              }
            }
            console.log(`   Matches with divId: ${matches}/20`);
            if (matches > 15) {
              console.log(`   ✅ LIKELY USING DIVID AS XOR KEY!`);
            }
          }
        }
      }
      
      // Save discoveries to file
      fs.writeFileSync('decoding-discoveries.json', JSON.stringify(discoveries, null, 2));
      console.log(`\n✅ Discoveries saved to decoding-discoveries.json`);
    }
    
    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ AUTOMATED ANALYSIS COMPLETE');
    console.log('='.repeat(70));
    
    return discoveries;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    return discoveries;
  } finally {
    await browser.close();
  }
}

// Main execution
async function main() {
  const tmdbId = process.argv[2] || '1084736'; // Sonic 3
  
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║  🔬 LIVE PLAYERJS REVERSE ENGINEERING TOOL                       ║
║                                                                   ║
║  This tool will:                                                 ║
║  1. Open a browser with DevTools                                ║
║  2. Intercept all decoding operations                           ║
║  3. Log every step of the decryption process                    ║
║  4. Extract both encoded input and decoded output               ║
║  5. Analyze the encoding method                                 ║
║                                                                   ║
║  Watch the console output and browser DevTools!                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);
  
  const discoveries = await reverseEngineerPlayerJS(tmdbId);
  
  console.log('\n' + '='.repeat(70));
  console.log('📋 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  if (discoveries.encoded) {
    console.log(`\n✅ Encoded data captured: ${discoveries.encoded.length} chars`);
  }
  
  if (discoveries.finalUrl) {
    console.log(`✅ Decoded URL captured: ${discoveries.finalUrl}`);
  }
  
  if (discoveries.divId) {
    console.log(`✅ Div ID: ${discoveries.divId}`);
  }
  
  console.log(`\n📄 Full discoveries saved to: decoding-discoveries.json`);
  console.log(`\nUse this data to implement the decoder in your extractor!`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { reverseEngineerPlayerJS };
