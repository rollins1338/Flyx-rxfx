/**
 * Test script to reverse engineer Flixer.sh - V11
 * 
 * Use Puppeteer to execute the WASM and extract actual sources
 */

const puppeteer = require('puppeteer');

const TEST_TV_URL = 'https://flixer.sh/watch/tv/106379/1/1';
const TEST_MOVIE_URL = 'https://flixer.sh/watch/movie/550';

async function extractFlixerSources() {
  console.log('=== Extracting Flixer.sh Sources via Browser ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Enhancer') || text.includes('WASM') || text.includes('source') ||
          text.includes('server') || text.includes('Server') || text.includes('m3u8')) {
        console.log(`[CONSOLE] ${text}`);
      }
    });
    
    // Intercept network requests
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/images') || url.includes('m3u8')) {
        console.log(`[REQ] ${request.method()} ${url}`);
        const headers = request.headers();
        if (headers['x-api-key']) {
          console.log(`  X-Api-Key: ${headers['x-api-key']}`);
        }
        if (headers['x-server']) {
          console.log(`  X-Server: ${headers['x-server']}`);
        }
      }
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/images')) {
        console.log(`[RESP] ${response.status()} ${url}`);
        try {
          const text = await response.text();
          console.log(`  Body preview: ${text.substring(0, 200)}...`);
        } catch (e) {}
      }
      if (url.includes('m3u8')) {
        console.log(`[M3U8] ${response.status()} ${url}`);
      }
    });
    
    console.log('1. Loading watch page...');
    console.log(`   URL: ${TEST_TV_URL}\n`);
    
    await page.goto(TEST_TV_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for WASM to initialize
    console.log('\n2. Waiting for WASM initialization...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Check if WASM is ready
    const wasmStatus = await page.evaluate(() => {
      if (window.wasmImgData) {
        return {
          ready: window.wasmImgData.ready,
          hasKey: !!window.wasmImgData.key,
          keyLength: window.wasmImgData.key?.length || 0,
        };
      }
      return { ready: false, hasKey: false, keyLength: 0 };
    });
    console.log(`   WASM status: ${JSON.stringify(wasmStatus)}`);
    
    // Try to call the source fetching function directly
    console.log('\n3. Attempting to fetch sources via JavaScript...');
    
    const sources = await page.evaluate(async () => {
      try {
        // Check if the functions are available
        if (typeof window.getTVSources === 'function') {
          console.log('[JS] getTVSources function found');
          const result = await window.getTVSources('106379', '1', '1');
          return { method: 'getTVSources', result };
        }
        
        // Try importing the module
        const module = await import('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-poster-utils.js');
        if (module.getTVSources) {
          console.log('[JS] Imported getTVSources');
          const result = await module.getTVSources('106379', '1', '1');
          return { method: 'imported getTVSources', result };
        }
        
        return { error: 'No source fetching function found' };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('\n4. Source fetching result:');
    console.log(JSON.stringify(sources, null, 2));
    
    // Wait longer and check for video source
    console.log('\n5. Waiting for video to load...');
    await new Promise(r => setTimeout(r, 15000));
    
    // Check video element
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        return {
          src: video.src,
          currentSrc: video.currentSrc,
          readyState: video.readyState,
          networkState: video.networkState,
        };
      }
      return null;
    });
    console.log(`   Video info: ${JSON.stringify(videoInfo, null, 2)}`);
    
    // Check for HLS instance
    const hlsInfo = await page.evaluate(() => {
      if (window.hls) {
        return {
          url: window.hls.url,
          levels: window.hls.levels?.length || 0,
        };
      }
      return null;
    });
    console.log(`   HLS info: ${JSON.stringify(hlsInfo, null, 2)}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n=== Analysis Complete ===');
}

extractFlixerSources().catch(console.error);
