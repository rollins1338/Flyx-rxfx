/**
 * 1movies.bz - Analyze API endpoints and token generation
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const MOVIE_URL = 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp';

async function analyzeAPI() {
  console.log('=== 1movies.bz API Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture the links/list response specifically
  
  page.on('response', async (res: any) => {
    const url = res.url();
    
    if (url.includes('/ajax/links/list')) {
      console.log('\n🎯 FOUND links/list response!');
      console.log('URL:', url);
      try {
        const text = await res.text();
        console.log('Full response:', text);

        fs.writeFileSync('1movies-links-response.json', text);
      } catch (e) {
        console.log('Could not get response body');
      }
    }
    
    if (url.includes('/ajax/episodes/list')) {
      console.log('\n📋 Episodes list response:');
      try {
        const text = await res.text();
        console.log(text);
        fs.writeFileSync('1movies-episodes-response.json', text);
      } catch (e) {}
    }
  });

  try {
    console.log('Loading movie page...');
    await page.goto(MOVIE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait a bit for initial requests
    await new Promise(r => setTimeout(r, 5000));
    
    // Get the window.__$ token
    const windowToken = await page.evaluate(() => {
      return (window as any).__$;
    });
    console.log('\nwindow.__$ token:', windowToken);
    
    // Get data-meta
    const dataMeta = await page.evaluate(() => {
      const el = document.querySelector('[data-meta]');
      return el ? el.getAttribute('data-meta') : null;
    });
    console.log('data-meta:', dataMeta);
    
    // Try to find the token generation logic
    const bundleContent = await page.evaluate(async () => {
      // Look for any global functions related to token generation
      const globals = Object.keys(window).filter(k => 
        typeof (window as any)[k] === 'function' && 
        k.length < 20
      );
      return globals;
    });
    console.log('\nGlobal functions:', bundleContent.slice(0, 20));
    
    // Wait for more requests after page interaction
    console.log('\nWaiting for additional requests...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Try clicking on the episode link if available
    const episodeLink = await page.$('a[eid]');
    if (episodeLink) {
      console.log('\nFound episode link, clicking...');
      await episodeLink.click();
      await new Promise(r => setTimeout(r, 5000));
    }
    
    // Check for server buttons
    const serverBtns = await page.$$('#movie-server button, #movie-server a');
    console.log('\nServer buttons found:', serverBtns.length);
    
    if (serverBtns.length > 0) {
      console.log('Clicking first server...');
      await serverBtns[0].click();
      await new Promise(r => setTimeout(r, 5000));
    }
    
    // Get final page state
    const pageState = await page.evaluate(() => {
      return {
        iframes: Array.from(document.querySelectorAll('iframe')).map((f: any) => f.src),
        videos: Array.from(document.querySelectorAll('video')).map((v: any) => v.src),
        playerHTML: document.querySelector('#player')?.innerHTML?.substring(0, 500),
        serverHTML: document.querySelector('#movie-server')?.innerHTML?.substring(0, 500)
      };
    });
    console.log('\nPage state:', JSON.stringify(pageState, null, 2));
    
    console.log('\nKeeping browser open for 20 seconds...');
    await new Promise(r => setTimeout(r, 20000));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

analyzeAPI().catch(console.error);
