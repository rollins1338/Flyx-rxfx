const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * NUCLEAR APPROACH: Extract and reverse engineer EVERY step of ProRCP decoding
 * We'll intercept the decoder function, log all transformations, and reproduce locally
 */

async function nuclearReverseEngineer() {
  console.log('🚀 NUCLEAR REVERSE ENGINEERING MODE ACTIVATED');
  console.log('================================================\n');

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Store all intercepted data
  const interceptedData = {
    divId: null,
    encodedContent: null,
    decoderScript: null,
    decoderFunctionCalls: [],
    intermediateSteps: [],
    finalResult: null,
    characterMappings: {},
    transformations: []
  };

  // Intercept console logs from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('INTERCEPT:')) {
      console.log('📡', text);
    }
  });

  // Step 1: Navigate and inject interceptor BEFORE any scripts run
  await page.evaluateOnNewDocument(() => {
    // Override String.prototype methods to log transformations
    const originalCharCodeAt = String.prototype.charCodeAt;
    const originalFromCharCode = String.fromCharCode;
    const originalSplit = String.prototype.split;
    const originalReplace = String.prototype.replace;
    
    window.interceptedTransformations = [];
    
    String.prototype.charCodeAt = function(...args) {
      const result = originalCharCodeAt.apply(this, args);
      if (this.length > 50 && this.length < 5000) {
        window.interceptedTransformations.push({
          type: 'charCodeAt',
          input: this.substring(0, 100),
          args: args,
          result: result
        });
      }
      return result;
    };
    
    String.fromCharCode = function(...args) {
      const result = originalFromCharCode.apply(String, args);
      if (args.length > 10) {
        window.interceptedTransformations.push({
          type: 'fromCharCode',
          argsCount: args.length,
          firstFew: args.slice(0, 10),
          result: result.substring(0, 100)
        });
      }
      return result;
    };

    // Intercept atob (base64 decode)
    const originalAtob = window.atob;
    window.atob = function(str) {
      const result = originalAtob(str);
      if (str.length > 50) {
        console.log('INTERCEPT: atob called');
        console.log('INTERCEPT: Input length:', str.length);
        console.log('INTERCEPT: Input sample:', str.substring(0, 100));
        console.log('INTERCEPT: Output length:', result.length);
        console.log('INTERCEPT: Output sample:', result.substring(0, 100));
        
        window.interceptedTransformations.push({
          type: 'atob',
          inputLength: str.length,
          inputSample: str.substring(0, 200),
          outputLength: result.length,
          outputSample: result.substring(0, 200)
        });
      }
      return result;
    };

    // Intercept btoa (base64 encode)
    const originalBtoa = window.btoa;
    window.btoa = function(str) {
      const result = originalBtoa(str);
      if (str.length > 50) {
        console.log('INTERCEPT: btoa called');
        window.interceptedTransformations.push({
          type: 'btoa',
          inputLength: str.length,
          outputLength: result.length
        });
      }
      return result;
    };
  });

  console.log('🎯 Navigating to ProRCP page...');
  const testUrl = 'https://vidsrc-embed.ru/prorcp.php?h=550&t=movie'; // Fight Club
  await page.goto(testUrl, { waitUntil: 'networkidle0' });

  console.log('⏳ Waiting for page to load...');
  await page.waitForTimeout(3000);

  // Step 2: Extract the hidden div content and ID
  console.log('\n📦 STEP 1: Extracting hidden div...');
  const divData = await page.evaluate(() => {
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

  if (!divData) {
    console.error('❌ Could not find hidden div!');
    await browser.close();
    return;
  }

  interceptedData.divId = divData.id;
  interceptedData.encodedContent = divData.content;

  console.log('✅ Found hidden div:');
  console.log('   ID:', divData.id);
  console.log('   Content length:', divData.content.length);
  console.log('   Content sample:', divData.content.substring(0, 100));

  // Step 3: Find and extract the decoder script
  console.log('\n📜 STEP 2: Finding decoder script...');
  const decoderInfo = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    
    for (let script of scripts) {
      const content = script.textContent || script.innerHTML;
      
      // Look for the decoder pattern
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

  if (decoderInfo) {
    interceptedData.decoderScript = decoderInfo.content;
    console.log('✅ Found decoder script:');
    console.log('   Source:', decoderInfo.src);
    console.log('   Length:', decoderInfo.length);
    
    // Save the raw decoder script
    fs.writeFileSync('decoder-script-raw.js', decoderInfo.content);
    console.log('   💾 Saved to decoder-script-raw.js');
  }

  // Step 4: Inject monitoring code and trigger decoder
  console.log('\n🔍 STEP 3: Monitoring decoder execution...');
  
  await page.evaluate((divId) => {
    // Find all functions that might be the decoder
    window.decoderCandidates = [];
    
    // Hook into the div's textContent getter
    const div = document.getElementById(divId);
    if (div) {
      let originalTextContent = div.textContent;
      
      Object.defineProperty(div, 'textContent', {
        get: function() {
          console.log('INTERCEPT: textContent accessed on div', divId);
          return originalTextContent;
        }
      });
    }
  }, divData.id);

  // Step 5: Wait and collect all transformations
  console.log('\n⏳ Waiting for decoder to execute...');
  await page.waitForTimeout(5000);

  // Step 6: Extract all intercepted transformations
  console.log('\n📊 STEP 4: Collecting transformation data...');
  const transformations = await page.evaluate(() => {
    return window.interceptedTransformations || [];
  });

  interceptedData.transformations = transformations;
  console.log(`✅ Captured ${transformations.length} transformations`);

  // Analyze transformations
  if (transformations.length > 0) {
    console.log('\n🔬 TRANSFORMATION ANALYSIS:');
    console.log('=' .repeat(50));
    
    const types = {};
    transformations.forEach(t => {
      types[t.type] = (types[t.type] || 0) + 1;
    });
    
    console.log('Transformation types:');
    Object.entries(types).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} times`);
    });

    // Show first few transformations in detail
    console.log('\nFirst transformations:');
    transformations.slice(0, 5).forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.type}:`);
      if (t.inputSample) console.log('   Input:', t.inputSample);
      if (t.outputSample) console.log('   Output:', t.outputSample);
    });
  }

  // Step 7: Try to extract the final decoded result
  console.log('\n🎯 STEP 5: Extracting final result...');
  const finalResult = await page.evaluate(() => {
    // Look for PlayerJS initialization or m3u8 URLs
    const scripts = Array.from(document.querySelectorAll('script'));
    
    for (let script of scripts) {
      const content = script.textContent;
      
      // Look for PlayerJS with file parameter
      const playerMatch = content.match(/new\s+Playerjs\s*\(\s*\{[^}]*file\s*:\s*["']([^"']+)["']/);
      if (playerMatch) {
        return {
          type: 'playerjs',
          url: playerMatch[1]
        };
      }
      
      // Look for direct m3u8 URLs
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
  } else {
    console.log('⚠️  Could not find final decoded URL');
  }

  // Step 8: Save all collected data
  console.log('\n💾 STEP 6: Saving collected data...');
  fs.writeFileSync('nuclear-intercept-data.json', JSON.stringify(interceptedData, null, 2));
  console.log('✅ Saved to nuclear-intercept-data.json');

  // Step 9: Analyze the decoder script in detail
  if (decoderInfo) {
    console.log('\n🔬 STEP 7: Analyzing decoder script...');
    analyzeDecoderScript(decoderInfo.content, divData.id);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 NUCLEAR REVERSE ENGINEERING COMPLETE!');
  console.log('='.repeat(50));

  await browser.close();
}

function analyzeDecoderScript(script, divId) {
  console.log('\n📋 DECODER SCRIPT ANALYSIS:');
  console.log('=' .repeat(50));

  // Find getElementById calls
  const getElementMatches = script.match(/getElementById\s*\(\s*["']([^"']+)["']\s*\)/g);
  if (getElementMatches) {
    console.log('\n✅ getElementById calls found:', getElementMatches.length);
    getElementMatches.forEach(match => console.log('  ', match));
  }

  // Find charCodeAt usage
  const charCodeAtMatches = script.match(/\.charCodeAt\s*\([^)]*\)/g);
  if (charCodeAtMatches) {
    console.log('\n✅ charCodeAt calls found:', charCodeAtMatches.length);
    console.log('   Sample:', charCodeAtMatches.slice(0, 3));
  }

  // Find fromCharCode usage
  const fromCharCodeMatches = script.match(/fromCharCode\s*\([^)]*\)/g);
  if (fromCharCodeMatches) {
    console.log('\n✅ fromCharCode calls found:', fromCharCodeMatches.length);
    console.log('   Sample:', fromCharCodeMatches.slice(0, 3));
  }

  // Find mathematical operations (XOR, shifts, etc)
  const xorMatches = script.match(/\^\s*\d+/g);
  if (xorMatches) {
    console.log('\n✅ XOR operations found:', xorMatches.length);
    const uniqueXor = [...new Set(xorMatches)];
    console.log('   Unique XOR values:', uniqueXor);
  }

  // Find addition/subtraction operations
  const mathOps = script.match(/charCodeAt[^+\-]*[+\-]\s*\d+/g);
  if (mathOps) {
    console.log('\n✅ Math operations on charCode:', mathOps.length);
    console.log('   Sample:', mathOps.slice(0, 3));
  }

  // Find loops
  const forLoops = script.match(/for\s*\([^)]+\)/g);
  if (forLoops) {
    console.log('\n✅ For loops found:', forLoops.length);
    forLoops.forEach(loop => console.log('  ', loop));
  }

  // Find array operations
  const arrayOps = script.match(/\[[^\]]+\]\s*=|\.push\s*\(|\.join\s*\(/g);
  if (arrayOps) {
    console.log('\n✅ Array operations found:', arrayOps.length);
  }

  // Try to extract the core decoder logic
  console.log('\n🎯 Attempting to extract core decoder logic...');
  
  // Look for function definitions
  const funcMatches = script.match(/function\s+(\w+)\s*\([^)]*\)\s*\{/g);
  if (funcMatches) {
    console.log('✅ Functions found:', funcMatches.length);
    funcMatches.forEach(func => console.log('  ', func));
  }

  // Look for variable assignments with the div content
  const divUsage = script.match(new RegExp(`getElementById\\s*\\(\\s*["']${divId}["']\\s*\\)[^;]+`, 'g'));
  if (divUsage) {
    console.log('\n✅ Div usage patterns:');
    divUsage.forEach(usage => console.log('  ', usage));
  }

  // Save analyzed patterns
  const analysis = {
    getElementCalls: getElementMatches?.length || 0,
    charCodeAtCalls: charCodeAtMatches?.length || 0,
    fromCharCodeCalls: fromCharCodeMatches?.length || 0,
    xorOperations: xorMatches?.length || 0,
    uniqueXorValues: xorMatches ? [...new Set(xorMatches)] : [],
    mathOperations: mathOps?.length || 0,
    loops: forLoops?.length || 0,
    functions: funcMatches || []
  };

  fs.writeFileSync('decoder-analysis.json', JSON.stringify(analysis, null, 2));
  console.log('\n💾 Saved analysis to decoder-analysis.json');
}

// Run it
nuclearReverseEngineer().catch(console.error);
