/**
 * Extract the m3u8 URL from the page after it loads naturally
 */
const puppeteer = require('puppeteer');

async function extractFromPage() {
  console.log('=== Extracting URL from Page ===\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Track m3u8 URLs
  const m3u8Urls = [];
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('.m3u8')) {
      m3u8Urls.push(url);
      console.log('📺 Found m3u8:', url.substring(0, 100));
    }
  });
  
  // Navigate to content page
  console.log('Navigating to Flixer watch page...');
  await page.goto('https://flixer.sh/watch/tv/94605/1/1', { 
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });
  
  // Wait for video to load
  console.log('Waiting for video to load...');
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n=== Results ===');
  console.log('M3U8 URLs found:', m3u8Urls.length);
  
  if (m3u8Urls.length > 0) {
    console.log('\n✅ SUCCESS! Found m3u8 URLs:');
    for (const url of m3u8Urls) {
      console.log('  ', url);
    }
    
    // The first URL is usually the master playlist
    const masterUrl = m3u8Urls[0];
    console.log('\nMaster playlist URL:', masterUrl);
  } else {
    console.log('\n❌ No m3u8 URLs found');
  }
  
  await browser.close();
}

extractFromPage().catch(console.error);
