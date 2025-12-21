/**
 * Crack Flixer.sh WASM Encryption - V3
 * 
 * Use Puppeteer with stealth to bypass anti-bot detection and extract sources
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

const TEST_TV = { tmdbId: '106379', season: '1', episode: '1' }; // Arcane
const TEST_MOVIE = { tmdbId: '550' }; // Fight Club

async function extractFlixerSources(type, tmdbId, season, episode) {
  console.log(`\n=== Extracting Flixer Sources for ${type} ${tmdbId} ===\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080',
    ],
  });
  
  try {
    const page = await browser.newPage();
    
    // Set a realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Enhancer') || text.includes('WASM') || text.includes('source') ||
          text.includes('server') || text.includes('Server') || text.includes('Found') ||
          text.includes('Error') || text.includes('error')) {
        console.log(`[CONSOLE] ${text}`);
      }
    });
    
    // Build the URL
    const url = type === 'movie' 
      ? `https://flixer.sh/watch/movie/${tmdbId}`
      : `https://flixer.sh/watch/tv/${tmdbId}/${season}/${episode}`;
    
    console.log(`Loading: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for WASM to initialize
    console.log('Waiting for WASM initialization...');
    await page.waitForFunction(() => {
      return window.wasmImgData && window.wasmImgData.ready;
    }, { timeout: 30000 }).catch(() => {
      console.log('WASM initialization timeout, continuing anyway...');
    });
    
    // Check WASM status
    const wasmStatus = await page.evaluate(() => {
      if (window.wasmImgData) {
        return {
          ready: window.wasmImgData.ready,
          hasKey: !!window.wasmImgData.key,
          keyLength: window.wasmImgData.key?.length || 0,
          key: window.wasmImgData.key || null,
        };
      }
      return { ready: false, hasKey: false, keyLength: 0, key: null };
    });
    
    console.log(`WASM Status: ready=${wasmStatus.ready}, hasKey=${wasmStatus.hasKey}, keyLength=${wasmStatus.keyLength}`);
    
    if (wasmStatus.key) {
      console.log(`\n*** WASM KEY EXTRACTED: ${wasmStatus.key} ***\n`);
    }
    
    // Wait for sources to load
    console.log('Waiting for sources to load...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Try to extract sources using the page's own functions
    const sources = await page.evaluate(async (mediaType, id, s, e) => {
      try {
        // Check if the enhancer module is available
        if (typeof window.getTVSources === 'function' || typeof window.getMovieSources === 'function') {
          console.log('[Extract] Using global source functions');
          if (mediaType === 'movie') {
            return await window.getMovieSources(id);
          } else {
            return await window.getTVSources(id, s, e);
          }
        }
        
        // Try to import the module directly
        const module = await import('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-poster-utils.js');
        console.log('[Extract] Imported tmdb-poster-utils module');
        
        if (mediaType === 'movie') {
          return await module.getMovieSources(id);
        } else {
          return await module.getTVSources(id, s, e);
        }
      } catch (e) {
        console.error('[Extract] Error:', e.message);
        return { error: e.message };
      }
    }, type, tmdbId, season, episode);
    
    console.log('\nExtracted sources:');
    console.log(JSON.stringify(sources, null, 2));
    
    // Also try to get the video element source
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        return {
          src: video.src,
          currentSrc: video.currentSrc,
        };
      }
      return null;
    });
    
    if (videoInfo && (videoInfo.src || videoInfo.currentSrc)) {
      console.log('\nVideo element source:');
      console.log(JSON.stringify(videoInfo, null, 2));
    }
    
    return { wasmStatus, sources, videoInfo };
    
  } catch (err) {
    console.error('Error:', err.message);
    return { error: err.message };
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Flixer.sh Source Extraction ===\n');
  
  // Test with TV show
  const tvResult = await extractFlixerSources('tv', TEST_TV.tmdbId, TEST_TV.season, TEST_TV.episode);
  
  // Test with movie
  // const movieResult = await extractFlixerSources('movie', TEST_MOVIE.tmdbId);
  
  console.log('\n=== Extraction Complete ===');
}

main().catch(console.error);
