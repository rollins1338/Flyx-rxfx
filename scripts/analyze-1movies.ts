/**
 * 1movies.bz Reverse Engineering Script
 * Goal: Understand how they embed and serve video content
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'https://1movies.bz';

async function analyze1Movies() {
  console.log('=== 1movies.bz Analysis ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Watch what happens
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track all network requests
  const requests: { url: string; type: string; method: string }[] = [];
  
  page.on('request', (req) => {
    const url = req.url();
    // Filter for interesting requests
    if (url.includes('m3u8') || 
        url.includes('embed') || 
        url.includes('player') ||
        url.includes('stream') ||
        url.includes('video') ||
        url.includes('api')) {
      requests.push({
        url: url,
        type: req.resourceType(),
        method: req.method()
      });
      console.log(`[${req.resourceType()}] ${req.method()} ${url}`);
    }
  });
  
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('m3u8')) {
      console.log('\n🎯 M3U8 FOUND:', url);
      try {
        const text = await res.text();
        console.log('Content preview:', text.substring(0, 500));
      } catch (e) {
        // Response body may not be available
      }
    }
  });

  try {
    // First, visit the homepage to understand structure
    console.log('1. Visiting homepage...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get page title and basic info
    const title = await page.title();
    console.log('Page title:', title);
    
    // Look for movie links
    const movieLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/movie/"], a[href*="/watch/"], a[href*="/film/"]'));
      return links.slice(0, 10).map(a => ({
        href: (a as HTMLAnchorElement).href,
        text: a.textContent?.trim().substring(0, 50)
      }));
    });
    
    console.log('\nFound movie links:', movieLinks);
    
    // If we found a movie link, try to visit it
    if (movieLinks.length > 0) {
      console.log('\n2. Visiting first movie page...');
      await page.goto(movieLinks[0].href, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Look for iframe embeds
      const iframes = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          class: iframe.className
        }));
      });
      
      console.log('\nIframes found:', iframes);
      
      // Look for video elements
      const videos = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('video')).map(v => ({
          src: v.src,
          sources: Array.from(v.querySelectorAll('source')).map(s => s.src)
        }));
      });
      
      console.log('Video elements:', videos);
      
      // Look for any player scripts
      const scripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script[src]'))
          .map(s => (s as HTMLScriptElement).src)
          .filter(src => src.includes('player') || src.includes('video') || src.includes('embed'));
      });
      
      console.log('Player scripts:', scripts);
      
      // Get page HTML for analysis
      const html = await page.content();
      
      // Save for offline analysis
      const fs = await import('fs');
      fs.writeFileSync('1movies-movie-page.html', html);
      console.log('\nSaved page HTML to 1movies-movie-page.html');
    }
    
    // Wait a bit to capture any delayed requests
    console.log('\nWaiting for additional requests...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('\n=== All Interesting Requests ===');
    requests.forEach(r => console.log(`${r.method} ${r.url}`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

analyze1Movies().catch(console.error);
