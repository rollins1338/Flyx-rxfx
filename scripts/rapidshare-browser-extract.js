/**
 * RapidShare Browser-Based Stream Extractor
 * 
 * This script uses Puppeteer to load the embed page and intercept
 * the JWPlayer setup call to get the full HLS URL.
 * 
 * Usage:
 *   node rapidshare-browser-extract.js <embed_url>
 * 
 * Example:
 *   node rapidshare-browser-extract.js https://rapidairmax.site/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ
 */

const puppeteer = require('puppeteer');

async function extractStream(embedUrl) {
  console.log('Starting browser extraction...');
  console.log('Embed URL:', embedUrl);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up request interception to capture HLS requests
    await page.setRequestInterception(true);
    
    const capturedUrls = [];
    
    page.on('request', request => {
      const url = request.url();
      
      // Capture HLS/m3u8 requests
      if (url.includes('.m3u8') || url.includes('/stream/') || url.includes('core36link')) {
        console.log('[CAPTURED] HLS request:', url);
        capturedUrls.push({
          type: 'request',
          url: url,
          headers: request.headers()
        });
      }
      
      request.continue();
    });
    
    // Inject hook script before page loads
    await page.evaluateOnNewDocument(() => {
      // Store captured data
      window.__CAPTURED_STREAMS = [];
      
      // Hook JWPlayer when it's defined
      Object.defineProperty(window, 'jwplayer', {
        configurable: true,
        set: function(jw) {
          console.log('[HOOK] JWPlayer defined');
          
          // Wrap the jwplayer function
          const wrappedJW = function(id) {
            const player = jw(id);
            const origSetup = player.setup;
            
            player.setup = function(config) {
              console.log('[HOOK] JWPlayer setup called');
              
              // Extract sources from config
              if (config && config.sources) {
                config.sources.forEach(source => {
                  if (source.file) {
                    console.log('[HOOK] Found source:', source.file);
                    window.__CAPTURED_STREAMS.push({
                      type: 'jwplayer',
                      url: source.file,
                      label: source.label || 'unknown'
                    });
                  }
                });
              }
              
              // Also check playlist
              if (config && config.playlist) {
                config.playlist.forEach(item => {
                  if (item.sources) {
                    item.sources.forEach(source => {
                      if (source.file) {
                        console.log('[HOOK] Found playlist source:', source.file);
                        window.__CAPTURED_STREAMS.push({
                          type: 'jwplayer-playlist',
                          url: source.file,
                          label: source.label || 'unknown'
                        });
                      }
                    });
                  }
                  if (item.file) {
                    console.log('[HOOK] Found playlist file:', item.file);
                    window.__CAPTURED_STREAMS.push({
                      type: 'jwplayer-playlist',
                      url: item.file
                    });
                  }
                });
              }
              
              return origSetup.call(this, config);
            };
            
            return player;
          };
          
          // Copy properties
          Object.keys(jw).forEach(key => {
            wrappedJW[key] = jw[key];
          });
          
          Object.defineProperty(window, 'jwplayer', {
            value: wrappedJW,
            writable: true,
            configurable: true
          });
        },
        get: function() {
          return this._jwplayer;
        }
      });
    });
    
    // Navigate to embed page
    console.log('Loading embed page...');
    await page.goto(embedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for player to initialize
    await page.waitForTimeout(3000);
    
    // Get captured streams from page
    const pageStreams = await page.evaluate(() => {
      return window.__CAPTURED_STREAMS || [];
    });
    
    // Combine all captured URLs
    const allStreams = [...capturedUrls, ...pageStreams];
    
    // Get PAGE_DATA and app.js hash
    const pageInfo = await page.evaluate(() => {
      const pageData = window.__PAGE_DATA;
      const appJsMatch = document.documentElement.innerHTML.match(/\/assets\/b\/([a-f0-9]+)\/min\/app\.js/);
      const baseMatch = document.querySelector('base');
      
      return {
        pageData: pageData,
        appJsHash: appJsMatch ? appJsMatch[1] : null,
        baseHref: baseMatch ? baseMatch.href : null
      };
    });
    
    return {
      success: allStreams.length > 0,
      embedUrl: embedUrl,
      pageData: pageInfo.pageData,
      appJsHash: pageInfo.appJsHash,
      baseHref: pageInfo.baseHref,
      streams: allStreams
    };
    
  } finally {
    await browser.close();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('RapidShare Browser-Based Stream Extractor');
    console.log('');
    console.log('Usage:');
    console.log('  node rapidshare-browser-extract.js <embed_url>');
    console.log('');
    console.log('Example:');
    console.log('  node rapidshare-browser-extract.js https://rapidairmax.site/e/2MvvbnGoWS2JcOLzFLpK7RXpCQ');
    process.exit(0);
  }
  
  extractStream(args[0])
    .then(result => {
      console.log('\n=== Extraction Result ===\n');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { extractStream };
