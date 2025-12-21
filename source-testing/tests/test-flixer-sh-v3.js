/**
 * Test script to reverse engineer Flixer.sh - V3
 * 
 * Use Puppeteer to intercept network requests and find the actual API calls
 */

const puppeteer = require('puppeteer');

const TEST_TV_URL = 'https://flixer.sh/watch/tv/106379/1/1';
const TEST_MOVIE_URL = 'https://flixer.sh/watch/movie/550';

async function interceptFlixerRequests() {
  console.log('=== Intercepting Flixer.sh Network Requests ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up request interception
    await page.setRequestInterception(true);
    
    const apiRequests = [];
    const embedRequests = [];
    
    page.on('request', (request) => {
      const url = request.url();
      
      // Log API requests
      if (url.includes('api.flixer.sh') || url.includes('/api/')) {
        console.log(`[API] ${request.method()} ${url}`);
        apiRequests.push({ method: request.method(), url });
      }
      
      // Log embed/video requests
      if (url.includes('embed') || url.includes('vidsrc') || url.includes('vidplay') || 
          url.includes('m3u8') || url.includes('stream')) {
        console.log(`[EMBED] ${request.method()} ${url}`);
        embedRequests.push({ method: request.method(), url });
      }
      
      request.continue();
    });
    
    page.on('response', async (response) => {
      const url = response.url();
      
      // Log API responses
      if (url.includes('api.flixer.sh') || (url.includes('/api/') && !url.includes('google'))) {
        try {
          const text = await response.text();
          console.log(`[API RESPONSE] ${response.status()} ${url}`);
          if (text.length < 1000) {
            console.log(`  Body: ${text.substring(0, 500)}`);
          } else {
            console.log(`  Body length: ${text.length} chars`);
          }
        } catch (e) {
          // Ignore
        }
      }
    });
    
    console.log('1. Loading TV show page...');
    console.log(`   URL: ${TEST_TV_URL}\n`);
    
    await page.goto(TEST_TV_URL, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a bit more for dynamic content
    await new Promise(r => setTimeout(r, 5000));
    
    // Look for iframes
    console.log('\n2. Looking for iframes...');
    const iframes = await page.$$eval('iframe', frames => 
      frames.map(f => ({ src: f.src, id: f.id, class: f.className }))
    );
    console.log(`   Found ${iframes.length} iframes:`);
    iframes.forEach(f => console.log(`     - ${f.src || '(no src)'}`));
    
    // Look for video elements
    console.log('\n3. Looking for video elements...');
    const videos = await page.$$eval('video', vids => 
      vids.map(v => ({ src: v.src, sources: Array.from(v.querySelectorAll('source')).map(s => s.src) }))
    );
    console.log(`   Found ${videos.length} video elements:`);
    videos.forEach(v => {
      console.log(`     - src: ${v.src || '(no src)'}`);
      v.sources.forEach(s => console.log(`       source: ${s}`));
    });
    
    // Check for player container
    console.log('\n4. Looking for player container...');
    const playerInfo = await page.evaluate(() => {
      const player = document.querySelector('[class*="player"]') || 
                     document.querySelector('[id*="player"]') ||
                     document.querySelector('[class*="video"]');
      if (player) {
        return {
          tag: player.tagName,
          id: player.id,
          class: player.className,
          innerHTML: player.innerHTML.substring(0, 500)
        };
      }
      return null;
    });
    if (playerInfo) {
      console.log(`   Found player: ${playerInfo.tag}#${playerInfo.id}.${playerInfo.class}`);
      console.log(`   Content preview: ${playerInfo.innerHTML.substring(0, 200)}...`);
    }
    
    // Summary
    console.log('\n=== Summary ===');
    console.log(`API requests: ${apiRequests.length}`);
    apiRequests.forEach(r => console.log(`  - ${r.method} ${r.url}`));
    console.log(`\nEmbed requests: ${embedRequests.length}`);
    embedRequests.forEach(r => console.log(`  - ${r.method} ${r.url}`));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
  
  console.log('\n=== Analysis Complete ===');
}

interceptFlixerRequests().catch(console.error);
