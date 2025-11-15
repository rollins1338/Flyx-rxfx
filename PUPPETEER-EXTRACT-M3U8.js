// Use Puppeteer to let PlayerJS decode the m3u8 URL for us
const puppeteer = require('puppeteer');

async function extractM3U8WithPuppeteer(tmdbId) {
  console.log('='.repeat(70));
  console.log('🎭 PUPPETEER M3U8 EXTRACTOR');
  console.log('='.repeat(70));
  console.log(`\nTMDB ID: ${tmdbId}\n`);

  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Intercept network requests to catch the m3u8 URL
    const m3u8Urls = [];
    
    await page.on('request', request => {
      const url = request.url();
      if (url.includes('.m3u8')) {
        console.log(`✅ Intercepted m3u8: ${url}`);
        m3u8Urls.push(url);
      }
    });

    // Step 1: Get the embed page
    console.log('[1] Loading embed page...');
    const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Step 2: Extract hash
    console.log('[2] Extracting hash...');
    const hash = await page.evaluate(() => {
      const hashEl = document.querySelector('[data-hash]');
      return hashEl ? hashEl.getAttribute('data-hash') : null;
    });
    
    if (!hash) {
      console.log('❌ No hash found');
      return null;
    }
    
    console.log(`✅ Hash: ${hash.substring(0, 30)}...`);
    
    // Step 3: Navigate to RCP page
    console.log('[3] Loading RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    await page.goto(rcpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Step 4: Extract ProRCP URL
    console.log('[4] Extracting ProRCP URL...');
    const prorcpHash = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="/prorcp/"]');
      if (iframe) {
        const src = iframe.getAttribute('src');
        return src ? src.split('/prorcp/')[1] : null;
      }
      
      // Also check for dynamically created iframes
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const match = script.textContent.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/);
        if (match) return match[1];
      }
      
      return null;
    });
    
    if (!prorcpHash) {
      console.log('❌ No ProRCP hash found');
      return null;
    }
    
    console.log(`✅ ProRCP hash: ${prorcpHash.substring(0, 30)}...`);
    
    // Step 5: Navigate to ProRCP player page
    console.log('[5] Loading ProRCP player page...');
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
    await page.goto(prorcpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for PlayerJS to initialize and decode the m3u8
    console.log('[6] Waiting for PlayerJS to decode m3u8...');
    await page.waitForTimeout(5000); // Give it time to initialize
    
    // Step 6: Extract the decoded m3u8 URL from the player
    console.log('[7] Extracting m3u8 from player...');
    const m3u8FromPlayer = await page.evaluate(() => {
      // Try to get from video element
      const video = document.querySelector('video');
      if (video && video.src && video.src.includes('.m3u8')) {
        return video.src;
      }
      
      // Try to get from player object
      if (window.player && window.player.file) {
        return window.player.file;
      }
      
      // Try to get from Playerjs object
      if (window.Playerjs && window.Playerjs.file) {
        return window.Playerjs.file;
      }
      
      // Check all script variables
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const match = script.textContent.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
        if (match) return match[1];
      }
      
      return null;
    });
    
    if (m3u8FromPlayer) {
      console.log(`✅ Found m3u8 from player: ${m3u8FromPlayer}`);
      m3u8Urls.push(m3u8FromPlayer);
    }
    
    // Step 7: Check intercepted requests
    if (m3u8Urls.length > 0) {
      console.log(`\n${'='.repeat(70)}`);
      console.log('✅ SUCCESS! Found m3u8 URLs:');
      console.log('='.repeat(70));
      m3u8Urls.forEach((url, i) => {
        console.log(`\n[${i + 1}] ${url}`);
      });
      
      return m3u8Urls[0]; // Return first one
    } else {
      console.log('\n❌ No m3u8 URLs found');
      
      // Debug: Show page content
      console.log('\nPage HTML (first 1000 chars):');
      const html = await page.content();
      console.log(html.substring(0, 1000));
      
      return null;
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Main execution
async function main() {
  const tmdbId = process.argv[2] || '1084736'; // Sonic 3
  
  const m3u8Url = await extractM3U8WithPuppeteer(tmdbId);
  
  if (m3u8Url) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('🎉 EXTRACTION COMPLETE');
    console.log('='.repeat(70));
    console.log(`\nM3U8 URL: ${m3u8Url}`);
  } else {
    console.log(`\n${'='.repeat(70)}`);
    console.log('❌ EXTRACTION FAILED');
    console.log('='.repeat(70));
  }
}

if (require.main === module) {
  main();
}

module.exports = { extractM3U8WithPuppeteer };
