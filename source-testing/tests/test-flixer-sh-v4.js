/**
 * Test script to reverse engineer Flixer.sh - V4
 * 
 * Found: plsdontscrapemelove.flixer.sh is the API domain
 * Need to find the video source endpoint
 */

const puppeteer = require('puppeteer');

const TEST_TV_URL = 'https://flixer.sh/watch/tv/106379/1/1';

async function interceptFlixerRequests() {
  console.log('=== Intercepting Flixer.sh Video Source Requests ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up request interception
    await page.setRequestInterception(true);
    
    const allRequests = [];
    
    page.on('request', (request) => {
      const url = request.url();
      
      // Log ALL requests to flixer domains
      if (url.includes('flixer') || url.includes('vidsrc') || url.includes('vidplay') ||
          url.includes('embed') || url.includes('m3u8') || url.includes('stream') ||
          url.includes('source') || url.includes('video') || url.includes('player')) {
        console.log(`[REQ] ${request.method()} ${url}`);
        allRequests.push({ method: request.method(), url, type: request.resourceType() });
      }
      
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      
      // Log responses from flixer API
      if (url.includes('plsdontscrapemelove.flixer.sh') && !url.includes('/api/tmdb/')) {
        try {
          const text = await response.text();
          console.log(`\n[RESP] ${status} ${url}`);
          console.log(`  Body: ${text.substring(0, 1000)}`);
        } catch (e) {
          console.log(`\n[RESP] ${status} ${url} (could not read body)`);
        }
      }
      
      // Log any m3u8 or video responses
      if (url.includes('m3u8') || url.includes('.mp4') || url.includes('stream')) {
        console.log(`\n[VIDEO] ${status} ${url}`);
      }
    });
    
    console.log('1. Loading TV show page and waiting for video player...');
    console.log(`   URL: ${TEST_TV_URL}\n`);
    
    await page.goto(TEST_TV_URL, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Wait for the page to fully load
    console.log('\n2. Waiting for dynamic content...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Try clicking on the play button or video area
    console.log('\n3. Looking for play button...');
    try {
      // Look for common play button selectors
      const playButton = await page.$('[class*="play"]') || 
                         await page.$('button[aria-label*="play"]') ||
                         await page.$('[class*="player"] button') ||
                         await page.$('svg[class*="play"]');
      
      if (playButton) {
        console.log('   Found play button, clicking...');
        await playButton.click();
        await new Promise(r => setTimeout(r, 5000));
      } else {
        console.log('   No play button found');
      }
    } catch (e) {
      console.log(`   Error clicking play: ${e.message}`);
    }
    
    // Check for server selection buttons
    console.log('\n4. Looking for server selection...');
    const serverButtons = await page.$$eval('[class*="server"], [class*="source"], button', buttons => 
      buttons.map(b => ({ text: b.textContent?.trim(), class: b.className })).filter(b => b.text)
    );
    console.log(`   Found ${serverButtons.length} potential server buttons:`);
    serverButtons.slice(0, 10).forEach(b => console.log(`     - "${b.text}" (${b.class})`));
    
    // Look for any data attributes that might contain source info
    console.log('\n5. Looking for data attributes...');
    const dataAttrs = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-src], [data-url], [data-source], [data-server]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        dataSrc: el.getAttribute('data-src'),
        dataUrl: el.getAttribute('data-url'),
        dataSource: el.getAttribute('data-source'),
        dataServer: el.getAttribute('data-server'),
      }));
    });
    console.log(`   Found ${dataAttrs.length} elements with data attributes:`);
    dataAttrs.forEach(d => console.log(`     - ${d.tag}: src=${d.dataSrc}, url=${d.dataUrl}, source=${d.dataSource}, server=${d.dataServer}`));
    
    // Check the page's JavaScript for API calls
    console.log('\n6. Checking for API patterns in page scripts...');
    const apiPatterns = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const patterns = [];
      scripts.forEach(s => {
        const content = s.textContent || '';
        if (content.includes('source') || content.includes('embed') || content.includes('stream')) {
          const matches = content.match(/["'`][^"'`]*(?:source|embed|stream|video)[^"'`]*["'`]/gi) || [];
          patterns.push(...matches.slice(0, 5));
        }
      });
      return patterns;
    });
    console.log(`   Found ${apiPatterns.length} patterns:`);
    apiPatterns.slice(0, 10).forEach(p => console.log(`     - ${p}`));
    
    // Summary
    console.log('\n=== All Flixer-related Requests ===');
    const flixerReqs = allRequests.filter(r => r.url.includes('flixer'));
    flixerReqs.forEach(r => console.log(`  ${r.method} ${r.url}`));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n=== Analysis Complete ===');
}

interceptFlixerRequests().catch(console.error);
