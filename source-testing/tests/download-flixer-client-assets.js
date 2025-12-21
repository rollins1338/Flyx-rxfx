/**
 * Download Flixer Client Assets
 * 
 * Get the tmdb-image-enhance and post-utils JS files that interface with the WASM
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const OUTPUT_DIR = 'source-testing/tests/wasm-analysis/client-assets';

async function downloadClientAssets() {
  console.log('=== Downloading Flixer Client Assets ===\n');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Track all JS files loaded
  const jsFiles = new Map();
  
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    
    // Capture JS files
    if (url.includes('.js') || contentType.includes('javascript')) {
      try {
        const content = await response.text();
        const filename = url.split('/').pop().split('?')[0];
        jsFiles.set(url, { filename, content, size: content.length });
        
        // Check for interesting keywords
        const keywords = ['img_data', 'wasm', 'process_img', 'get_img_key', 'tmdb', 'enhance', 'post-utils', 'fingerprint', 'canvas'];
        const hasKeyword = keywords.some(k => content.toLowerCase().includes(k));
        
        if (hasKeyword) {
          console.log(`[INTERESTING] ${filename} (${content.length} bytes)`);
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Also capture WASM
    if (url.includes('.wasm')) {
      try {
        const buffer = await response.buffer();
        const filename = url.split('/').pop().split('?')[0];
        fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);
        console.log(`[WASM] Saved ${filename} (${buffer.length} bytes)`);
      } catch (e) {
        console.log(`[WASM] Failed to save: ${e.message}`);
      }
    }
  });
  
  console.log('Loading flixer.sh...\n');
  
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM to be ready
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  console.log('\n=== Captured JS Files ===\n');
  
  // Save all JS files and analyze them
  for (const [url, data] of jsFiles) {
    const { filename, content, size } = data;
    
    // Check for WASM-related content
    const isWasmRelated = content.includes('wasm') || 
                          content.includes('img_data') || 
                          content.includes('process_img') ||
                          content.includes('get_img_key') ||
                          content.includes('__wbg_') ||
                          content.includes('__wbindgen');
    
    if (isWasmRelated) {
      console.log(`\n*** WASM-RELATED: ${filename} ***`);
      console.log(`URL: ${url}`);
      console.log(`Size: ${size} bytes`);
      
      // Save the file
      const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      fs.writeFileSync(path.join(OUTPUT_DIR, safeName), content);
      console.log(`Saved to: ${safeName}`);
      
      // Extract key snippets
      const snippets = [];
      
      // Find function definitions related to WASM
      const funcMatches = content.match(/function\s+\w*(?:wasm|img|process|key|fingerprint)\w*\s*\([^)]*\)\s*\{[^}]{0,500}/gi);
      if (funcMatches) {
        snippets.push(...funcMatches.slice(0, 5));
      }
      
      // Find __wbg_ function implementations
      const wbgMatches = content.match(/__wbg_\w+\s*[:=]\s*function[^}]+\}/g);
      if (wbgMatches) {
        snippets.push(...wbgMatches.slice(0, 10));
      }
      
      // Find exports
      const exportMatches = content.match(/exports\.\w+\s*=\s*[^;]+/g);
      if (exportMatches) {
        snippets.push(...exportMatches.slice(0, 10));
      }
      
      if (snippets.length > 0) {
        console.log('\nKey snippets:');
        for (const snippet of snippets.slice(0, 5)) {
          console.log(`  ${snippet.slice(0, 200)}...`);
        }
      }
    }
  }
  
  // Also get the inline scripts from the page
  console.log('\n=== Inline Scripts ===\n');
  
  const inlineScripts = await page.evaluate(() => {
    const scripts = [];
    document.querySelectorAll('script').forEach((script, i) => {
      if (script.textContent && script.textContent.length > 100) {
        scripts.push({
          index: i,
          content: script.textContent,
          hasWasm: script.textContent.includes('wasm') || script.textContent.includes('img_data'),
        });
      }
    });
    return scripts;
  });
  
  for (const script of inlineScripts) {
    if (script.hasWasm) {
      console.log(`\n*** Inline Script ${script.index} (WASM-related) ***`);
      console.log(`Size: ${script.content.length} bytes`);
      fs.writeFileSync(path.join(OUTPUT_DIR, `inline-script-${script.index}.js`), script.content);
      console.log(`Saved to: inline-script-${script.index}.js`);
    }
  }
  
  // Get the wasmImgData object structure
  console.log('\n=== wasmImgData Object ===\n');
  
  const wasmInfo = await page.evaluate(() => {
    const info = {
      ready: window.wasmImgData?.ready,
      functions: [],
      properties: [],
    };
    
    if (window.wasmImgData) {
      for (const key of Object.keys(window.wasmImgData)) {
        const val = window.wasmImgData[key];
        if (typeof val === 'function') {
          info.functions.push({
            name: key,
            length: val.length,
            toString: val.toString().slice(0, 500),
          });
        } else {
          info.properties.push({
            name: key,
            type: typeof val,
            value: typeof val === 'object' ? JSON.stringify(val).slice(0, 200) : String(val).slice(0, 200),
          });
        }
      }
    }
    
    return info;
  });
  
  console.log('Ready:', wasmInfo.ready);
  console.log('\nFunctions:');
  for (const fn of wasmInfo.functions) {
    console.log(`  ${fn.name}(${fn.length} args)`);
    console.log(`    ${fn.toString.slice(0, 200)}...`);
  }
  console.log('\nProperties:');
  for (const prop of wasmInfo.properties) {
    console.log(`  ${prop.name}: ${prop.type} = ${prop.value}`);
  }
  
  // Save wasmInfo
  fs.writeFileSync(path.join(OUTPUT_DIR, 'wasm-info.json'), JSON.stringify(wasmInfo, null, 2));
  
  // Try to get the actual WASM module and its imports
  console.log('\n=== WASM Module Imports ===\n');
  
  const wasmImports = await page.evaluate(() => {
    // Try to find the WASM instance
    const imports = [];
    
    // Check if there's a wbg object (wasm-bindgen generated)
    if (window.wbg) {
      for (const key of Object.keys(window.wbg)) {
        imports.push({
          name: key,
          type: typeof window.wbg[key],
          value: typeof window.wbg[key] === 'function' 
            ? window.wbg[key].toString().slice(0, 300)
            : String(window.wbg[key]).slice(0, 100),
        });
      }
    }
    
    return imports;
  });
  
  if (wasmImports.length > 0) {
    console.log(`Found ${wasmImports.length} WASM imports:`);
    for (const imp of wasmImports.slice(0, 20)) {
      console.log(`  ${imp.name}: ${imp.type}`);
      if (imp.type === 'function') {
        console.log(`    ${imp.value.slice(0, 150)}...`);
      }
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, 'wasm-imports.json'), JSON.stringify(wasmImports, null, 2));
  }
  
  await browser.close();
  
  console.log(`\n=== Done ===`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);
}

downloadClientAssets().catch(console.error);
