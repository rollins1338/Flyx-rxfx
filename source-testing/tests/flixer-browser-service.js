/**
 * Flixer Browser Service
 * 
 * Extracts m3u8 URLs by letting the page load naturally and capturing
 * the network traffic. This is the most reliable approach as it uses
 * the exact same flow as a real user.
 */
const puppeteer = require('puppeteer');

class FlixerBrowserService {
  constructor(options = {}) {
    this.browser = null;
    this.debug = options.debug || false;
    this.headless = options.headless !== false; // Default to headless
  }

  log(...args) {
    if (this.debug) console.log('[FlixerBrowser]', ...args);
  }

  async initialize() {
    if (this.browser) return;

    this.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: this.headless ? 'new' : false, // Use new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get m3u8 URL for content by loading the watch page
   */
  async getSource(type, tmdbId, seasonId = null, episodeId = null) {
    await this.initialize();

    const page = await this.browser.newPage();
    
    try {
      // Track m3u8 URLs
      const m3u8Urls = [];
      
      page.on('response', async response => {
        const url = response.url();
        if (url.includes('.m3u8') && url.includes('workers.dev')) {
          m3u8Urls.push(url);
          this.log('Found m3u8:', url.substring(0, 80));
        }
      });
      
      // Build watch URL
      const watchUrl = type === 'movie'
        ? `https://flixer.sh/watch/movie/${tmdbId}`
        : `https://flixer.sh/watch/tv/${tmdbId}/${seasonId}/${episodeId}`;
      
      this.log('Navigating to:', watchUrl);
      
      // Navigate to watch page
      await page.goto(watchUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      
      // Wait for m3u8 to be captured (with timeout)
      const startTime = Date.now();
      const timeout = 15000;
      
      while (m3u8Urls.length === 0 && Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 500));
      }
      
      if (m3u8Urls.length > 0) {
        // Return the master playlist (first one)
        return {
          success: true,
          url: m3u8Urls[0],
          allUrls: m3u8Urls
        };
      }
      
      return {
        success: false,
        error: 'No m3u8 URL found within timeout'
      };
      
    } finally {
      await page.close();
    }
  }

  /**
   * Get sources for multiple episodes efficiently
   */
  async getMultipleSources(requests) {
    const results = [];
    
    for (const req of requests) {
      const result = await this.getSource(req.type, req.tmdbId, req.seasonId, req.episodeId);
      results.push({
        ...req,
        ...result
      });
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 1000));
    }
    
    return results;
  }
}

module.exports = { FlixerBrowserService };

// Test when run directly
if (require.main === module) {
  (async () => {
    console.log('=== Flixer Browser Service Test ===\n');
    
    const service = new FlixerBrowserService({ 
      debug: true,
      headless: true // Test headless mode
    });
    
    try {
      // Test TV show - Arcane S1E1
      console.log('--- Testing TV Show (Arcane S1E1) ---');
      const tvResult = await service.getSource('tv', 94605, 1, 1);
      
      if (tvResult.success) {
        console.log('\n✅ SUCCESS!');
        console.log('M3U8 URL:', tvResult.url);
      } else {
        console.log('\n❌ Failed:', tvResult.error);
      }
      
      // Test Movie - Inception
      console.log('\n--- Testing Movie (Inception) ---');
      const movieResult = await service.getSource('movie', 27205);
      
      if (movieResult.success) {
        console.log('\n✅ SUCCESS!');
        console.log('M3U8 URL:', movieResult.url);
      } else {
        console.log('\n❌ Failed:', movieResult.error);
      }
      
    } catch (e) {
      console.error('\n❌ Error:', e.message);
      if (e.stack) console.error(e.stack);
    } finally {
      await service.close();
    }
  })();
}
