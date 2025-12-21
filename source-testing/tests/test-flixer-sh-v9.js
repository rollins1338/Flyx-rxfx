/**
 * Test script to reverse engineer Flixer.sh - V9
 * 
 * Use Puppeteer to interact with the video player and capture source requests
 */

const puppeteer = require('puppeteer');

const TEST_TV_URL = 'https://flixer.sh/watch/tv/106379/1/1';

async function captureSourceRequests() {
  console.log('=== Capturing Flixer.sh Source Requests ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up request interception
    await page.setRequestInterception(true);
    
    const sourceRequests = [];
    
    page.on('request', (request) => {
      const url = request.url();
      
      // Log ALL requests that might be source-related
      if (!url.includes('google') && !url.includes('facebook') && !url.includes('analytics') &&
          !url.includes('.png') && !url.includes('.jpg') && !url.includes('.svg') &&
          !url.includes('.css') && !url.includes('.woff') && !url.includes('beacon')) {
        
        // Check if it's a potential source request
        if (url.includes('m3u8') || url.includes('mp4') || url.includes('stream') ||
            url.includes('source') || url.includes('embed') || url.includes('video') ||
            url.includes('player') || url.includes('server') ||
            (url.includes('flixer') && !url.includes('/api/tmdb/') && !url.includes('.js'))) {
          console.log(`[SOURCE?] ${request.method()} ${url}`);
          sourceRequests.push({ method: request.method(), url, headers: request.headers() });
        }
      }
      
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      
      // Log responses that might contain source data
      if (url.includes('m3u8') || url.includes('source') || url.includes('server') ||
          (url.includes('flixer') && !url.includes('/api/tmdb/') && !url.includes('.js') && 
           !url.includes('.css') && !url.includes('.png'))) {
        try {
          const contentType = response.headers()['content-type'] || '';
          console.log(`\n[RESP] ${status} ${url}`);
          console.log(`  Content-Type: ${contentType}`);
          
          if (contentType.includes('json') || contentType.includes('text')) {
            const text = await response.text();
            if (text.length < 2000) {
              console.log(`  Body: ${text}`);
            } else {
              console.log(`  Body preview: ${text.substring(0, 500)}...`);
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    });
    
    console.log('1. Loading watch page...');
    console.log(`   URL: ${TEST_TV_URL}\n`);
    
    await page.goto(TEST_TV_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Wait for the page to load
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if there's a video player
    console.log('\n2. Checking for video player...');
    const hasVideo = await page.$('video');
    console.log(`   Video element found: ${!!hasVideo}`);
    
    // Look for the play button in the watch page (not the home page)
    console.log('\n3. Looking for play controls...');
    
    // Try to find and click the play button
    const playSelectors = [
      'button[aria-label*="play"]',
      '[class*="play-button"]',
      '[class*="playButton"]',
      'svg[class*="play"]',
      '[data-testid="play"]',
      '.player-play-button',
      'button:has(svg)',
    ];
    
    for (const selector of playSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          console.log(`   Found button with selector "${selector}": ${text}`);
        }
      } catch (e) {
        // Ignore
      }
    }
    
    // Wait longer for video to load
    console.log('\n4. Waiting for video to load...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Check video source
    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        return {
          src: video.src,
          currentSrc: video.currentSrc,
          sources: Array.from(video.querySelectorAll('source')).map(s => s.src),
        };
      }
      return null;
    });
    
    console.log('\n5. Video source info:');
    console.log(`   ${JSON.stringify(videoSrc, null, 2)}`);
    
    // Check for HLS.js
    const hlsInfo = await page.evaluate(() => {
      if (window.Hls) {
        return 'HLS.js is loaded';
      }
      return 'HLS.js not found';
    });
    console.log(`\n6. HLS.js status: ${hlsInfo}`);
    
    // Summary
    console.log('\n=== Source Requests Summary ===');
    console.log(`Total source-related requests: ${sourceRequests.length}`);
    sourceRequests.forEach(r => {
      console.log(`  ${r.method} ${r.url}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n=== Analysis Complete ===');
}

captureSourceRequests().catch(console.error);
