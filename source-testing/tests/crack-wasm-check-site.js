/**
 * Check if Flixer is actually working
 * 
 * Let's visit the site and see if it loads content properly.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkSite() {
  console.log('=== Check Flixer Site ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Capture network requests
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('plsdontscrapemelove')) {
      apiRequests.push({
        url: request.url(),
        headers: request.headers(),
      });
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('plsdontscrapemelove')) {
      try {
        const text = await response.text();
        console.log(`\nAPI Response from ${response.url()}:`);
        console.log(`  Status: ${response.status()}`);
        console.log(`  Length: ${text.length} chars`);
      } catch (e) {
        // Ignore
      }
    }
  });
  
  console.log('Navigating to Flixer...');
  await page.goto('https://flixer.sh/watch/tv/106379/1/1', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  
  // Wait for the page to fully load
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('\n=== API Requests Made ===\n');
  for (const req of apiRequests) {
    console.log(`URL: ${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    console.log();
  }
  
  // Check if there's a video player
  const hasPlayer = await page.evaluate(() => {
    const video = document.querySelector('video');
    const iframe = document.querySelector('iframe');
    return {
      hasVideo: !!video,
      hasIframe: !!iframe,
      iframeSrc: iframe?.src || null,
    };
  });
  
  console.log('=== Player Status ===');
  console.log(`Has video element: ${hasPlayer.hasVideo}`);
  console.log(`Has iframe: ${hasPlayer.hasIframe}`);
  if (hasPlayer.iframeSrc) {
    console.log(`Iframe src: ${hasPlayer.iframeSrc}`);
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'source-testing/tests/flixer-screenshot.png' });
  console.log('\nScreenshot saved to flixer-screenshot.png');
  
  // Check the page content
  const pageContent = await page.evaluate(() => {
    return {
      title: document.title,
      bodyText: document.body.innerText.substring(0, 500),
    };
  });
  
  console.log('\n=== Page Content ===');
  console.log(`Title: ${pageContent.title}`);
  console.log(`Body (first 500 chars): ${pageContent.bodyText}`);
  
  await browser.close();
}

checkSite().catch(console.error);
