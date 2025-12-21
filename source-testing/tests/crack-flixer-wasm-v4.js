/**
 * Crack Flixer.sh WASM Encryption - V4
 * 
 * Analyze the full flow and try to replicate it server-side
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const https = require('https');

puppeteer.use(StealthPlugin());

// Test content
const TEST_TV = { tmdbId: '106379', season: '1', episode: '1' };

function fetchWithHeaders(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers,
    };
    
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function analyzeFlixerFlow() {
  console.log('=== Analyzing Flixer.sh Full Flow ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Capture all network requests
    const apiRequests = [];
    
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('plsdontscrapemelove') && url.includes('/api/')) {
        apiRequests.push({
          url,
          method: request.method(),
          headers: request.headers(),
        });
        console.log(`[REQ] ${request.method()} ${url}`);
        Object.entries(request.headers()).forEach(([k, v]) => {
          if (k.startsWith('x-') || k === 'bw90agfmywth') {
            console.log(`  ${k}: ${v}`);
          }
        });
      }
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/tmdb/') && url.includes('/images')) {
        console.log(`\n[RESP] ${response.status()} ${url}`);
        try {
          const text = await response.text();
          console.log(`  Body (first 200 chars): ${text.substring(0, 200)}`);
          console.log(`  Body length: ${text.length}`);
        } catch (e) {}
      }
    });
    
    const url = `https://flixer.sh/watch/tv/${TEST_TV.tmdbId}/${TEST_TV.season}/${TEST_TV.episode}`;
    console.log(`Loading: ${url}\n`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for WASM
    await page.waitForFunction(() => window.wasmImgData?.ready, { timeout: 30000 }).catch(() => {});
    
    // Extract key and analyze the signature generation
    const analysis = await page.evaluate(async () => {
      const results = {
        wasmKey: window.wasmImgData?.key || null,
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          screenWidth: screen.width,
          screenHeight: screen.height,
          colorDepth: screen.colorDepth,
          timezoneOffset: new Date().getTimezoneOffset(),
        },
      };
      
      // Try to get the signature generation function
      try {
        // Import the enhancer module
        const module = await import('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-image-enhancer.js');
        
        // Get the buildSecureHeaders function if exposed
        if (module.buildSecureHeaders) {
          const testHeaders = await module.buildSecureHeaders(results.wasmKey, '/api/tmdb/tv/106379/season/1/episode/1/images');
          results.sampleHeaders = testHeaders;
        }
      } catch (e) {
        results.moduleError = e.message;
      }
      
      return results;
    });
    
    console.log('\n=== Analysis Results ===\n');
    console.log('WASM Key:', analysis.wasmKey);
    console.log('\nBrowser Info:', JSON.stringify(analysis.browserInfo, null, 2));
    
    if (analysis.sampleHeaders) {
      console.log('\nSample Headers:', JSON.stringify(analysis.sampleHeaders, null, 2));
    }
    
    if (analysis.moduleError) {
      console.log('\nModule Error:', analysis.moduleError);
    }
    
    // Now let's try to understand the header generation
    console.log('\n=== Captured API Requests ===\n');
    apiRequests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${req.url}`);
      console.log('   Headers:');
      Object.entries(req.headers).forEach(([k, v]) => {
        if (k.startsWith('x-') || k === 'bw90agfmywth' || k === 'accept') {
          console.log(`     ${k}: ${v}`);
        }
      });
    });
    
    // Extract the actual source URL
    console.log('\n=== Extracting Source URL ===\n');
    
    const sourceData = await page.evaluate(async () => {
      try {
        const module = await import('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-poster-utils.js');
        const result = await module.getTVSources('106379', '1', '1');
        return result;
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('Source Data:', JSON.stringify(sourceData, null, 2));
    
    // Extract the working M3U8 URL
    if (sourceData.poster_sources) {
      for (const [server, data] of Object.entries(sourceData.poster_sources)) {
        if (data && data.url) {
          console.log(`\n*** WORKING M3U8 URL (${server}): ***`);
          console.log(data.url);
        }
      }
    }
    
    return { analysis, apiRequests, sourceData };
    
  } finally {
    await browser.close();
  }
}

analyzeFlixerFlow().catch(console.error);
