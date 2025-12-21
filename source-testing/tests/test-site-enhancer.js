/**
 * Test Site Enhancer - Use the site's own enhancer module
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testSiteEnhancer() {
  console.log('=== Testing Site Enhancer ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Navigate to Flixer
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/1396/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for WASM
  await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 });
  
  // Wait for the enhancer to be available
  await new Promise(r => setTimeout(r, 5000));
  
  // Check what modules are available
  const modules = await page.evaluate(() => {
    return {
      hasWasm: !!window.wasmImgData,
      wasmReady: window.wasmImgData?.ready,
      wasmKey: window.wasmImgData?.key?.slice(0, 16),
      hasEnhancer: typeof window.enhanceTmdbImageData === 'function',
      hasInitEnhancement: typeof window.initImageEnhancement === 'function',
      windowKeys: Object.keys(window).filter(k => 
        k.includes('enhance') || k.includes('tmdb') || k.includes('wasm') || k.includes('image')
      ),
    };
  });
  
  console.log('Available modules:', modules);
  
  // Try to use the site's enhancer if available
  if (modules.hasEnhancer) {
    console.log('\nUsing site enhancer...');
    
    const result = await page.evaluate(async () => {
      try {
        const sources = await window.enhanceTmdbImageData('tv', {
          tmdbId: 1396,
          seasonId: 1,
          episodeId: 1,
        });
        return { success: true, sources };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    });
    
    console.log('Enhancer result:', JSON.stringify(result, null, 2));
  } else {
    console.log('\nEnhancer not available, trying manual approach...');
    
    // Try to import the enhancer module
    const importResult = await page.evaluate(async () => {
      try {
        // The enhancer might be loaded as a module
        const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
        return {
          moduleScripts: scripts.map(s => s.src || s.innerHTML.slice(0, 100)),
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('Module scripts:', importResult);
  }
  
  // Check what the page shows for sources
  const pageState = await page.evaluate(() => {
    // Look for any source-related data in the page
    const sourceElements = document.querySelectorAll('[data-source], [data-server]');
    const buttons = Array.from(document.querySelectorAll('button'));
    
    return {
      sourceElements: sourceElements.length,
      buttons: buttons.map(b => ({
        text: b.textContent.trim().slice(0, 50),
        classes: b.className,
      })).filter(b => b.text.length > 0).slice(0, 20),
    };
  });
  
  console.log('\nPage state:', JSON.stringify(pageState, null, 2));
  
  await browser.close();
}

testSiteEnhancer().catch(console.error);
