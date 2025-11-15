/**
 * VIDSRC PRO.RCP COMPLETE AUTOMATED EXTRACTOR WITH IFRAME HANDLING
 * Follows the iframe chain to extract M3U8 URLs
 */

const puppeteer = require('puppeteer');

class VidsrcProExtractor {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.debug = options.debug || false;
  }

  log(...args) {
    if (this.debug) console.log('[VidsrcPro]', ...args);
  }

  /**
   * Build the embed URL from TMDB ID
   */
  buildEmbedUrl(type, tmdbId, season = null, episode = null) {
    // Start with vidsrc.xyz which redirects to vidsrc-embed.ru
    let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    
    if (type === 'tv' && season !== null && episode !== null) {
      url += `/${season}/${episode}`;
    }
    
    this.log('Built URL:', url);
    return url;
  }

  /**
   * Wait for and switch to iframe containing the player
   */
  async findPlayerFrame(page) {
    this.log('Looking for player iframe...');
    
    // Wait for iframes to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const frames = page.frames();
    this.log(`Found ${frames.length} frames`);
    
    // Look for the pro.rcp iframe
    for (const frame of frames) {
      const url = frame.url();
      this.log('Frame URL:', url);
      
      if (url.includes('cloudnestra.com/rcp/') || url.includes('pro.rcp')) {
        this.log('Found pro.rcp frame!');
        return frame;
      }
    }
    
    return null;
  }

  /**
   * Extract M3U8 URL from embed page
   */
  async extractFromEmbed(embedUrl) {
    this.log('Starting extraction from:', embedUrl);
    
    const browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      this.log('Loading initial page...');
      await page.goto(embedUrl, {
        waitUntil: 'networkidle0',
        timeout: this.timeout
      });

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to find hidden div in main page first
      this.log('Checking main page for hidden div...');
      let divInfo = await page.evaluate(() => {
        const divs = document.querySelectorAll('div[style*="display:none"], div[style*="display: none"]');
        
        for (const div of divs) {
          if (div.id && div.innerHTML && div.innerHTML.length > 1000) {
            return {
              id: div.id,
              contentLength: div.innerHTML.length
            };
          }
        }
        return null;
      });

      let targetFrame = page;

      // If not found in main page, look in iframes
      if (!divInfo) {
        this.log('Not found in main page, checking iframes...');
        const playerFrame = await this.findPlayerFrame(page);
        
        if (playerFrame) {
          targetFrame = playerFrame;
          
          // Check for hidden div in iframe
          divInfo = await playerFrame.evaluate(() => {
            const divs = document.querySelectorAll('div[style*="display:none"], div[style*="display: none"]');
            
            for (const div of divs) {
              if (div.id && div.innerHTML && div.innerHTML.length > 1000) {
                return {
                  id: div.id,
                  contentLength: div.innerHTML.length
                };
              }
            }
            return null;
          });
        }
      }

      if (!divInfo) {
        // Dump page content for debugging
        const html = await page.content();
        this.log('Page HTML length:', html.length);
        
        throw new Error('Hidden div not found in page or iframes');
      }

      this.log('Found hidden div:', divInfo.id);
      this.log('Content length:', divInfo.contentLength);

      // Wait for the decoder script to create the global variable
      this.log('Waiting for decoder to create variable...');
      
      try {
        await targetFrame.waitForFunction(
          (divId) => {
            return window[divId] !== undefined && window[divId] !== null;
          },
          { timeout: 15000 },
          divInfo.id
        );
      } catch (e) {
        this.log('Timeout waiting for variable, checking if it exists...');
      }

      // Extract the M3U8 URL from the global variable
      const m3u8Url = await targetFrame.evaluate((divId) => {
        const value = window[divId];
        console.log('Variable value:', value);
        return value;
      }, divInfo.id);

      if (!m3u8Url) {
        throw new Error(`Variable ${divInfo.id} was not created or is empty`);
      }

      this.log('Successfully extracted M3U8 URL!');
      
      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        embedUrl: embedUrl
      };

    } catch (error) {
      this.log('Error during extraction:', error.message);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Extract M3U8 URL for a movie
   */
  async extractMovie(tmdbId) {
    const embedUrl = this.buildEmbedUrl('movie', tmdbId);
    return await this.extractFromEmbed(embedUrl);
  }

  /**
   * Extract M3U8 URL for a TV show episode
   */
  async extractTvEpisode(tmdbId, season, episode) {
    const embedUrl = this.buildEmbedUrl('tv', tmdbId, season, episode);
    return await this.extractFromEmbed(embedUrl);
  }

  /**
   * Extract with automatic retry
   */
  async extractWithRetry(type, tmdbId, season = null, episode = null, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`Attempt ${attempt}/${maxRetries}`);
        
        if (type === 'movie') {
          return await this.extractMovie(tmdbId);
        } else {
          return await this.extractTvEpisode(tmdbId, season, episode);
        }
      } catch (error) {
        lastError = error;
        this.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          this.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  Movie:    node VIDSRC-PRO-IFRAME-EXTRACTOR.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-IFRAME-EXTRACTOR.js tv <tmdbId> <season> <episode>');
    console.log('');
    console.log('Examples:');
    console.log('  node VIDSRC-PRO-IFRAME-EXTRACTOR.js movie 550');
    console.log('  node VIDSRC-PRO-IFRAME-EXTRACTOR.js tv 1396 1 1');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;

  const extractor = new VidsrcProExtractor({
    headless: false,
    debug: true
  });

  (async () => {
    try {
      console.log('\n🎬 VidSrc Pro Extractor (with iframe support)\n');
      console.log('Type:', type);
      console.log('TMDB ID:', tmdbId);
      if (type === 'tv') {
        console.log('Season:', season);
        console.log('Episode:', episode);
      }
      console.log('');

      const result = await extractor.extractWithRetry(
        type,
        tmdbId,
        season ? parseInt(season) : null,
        episode ? parseInt(episode) : null
      );

      console.log('\n✅ SUCCESS!\n');
      console.log('M3U8 URL:', result.url);
      console.log('Div ID:', result.divId);
      console.log('Embed URL:', result.embedUrl);
      
      // Save to file
      const fs = require('fs');
      const outputFile = `extracted-${type}-${tmdbId}${season ? `-s${season}e${episode}` : ''}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log('\n💾 Saved to:', outputFile);

    } catch (error) {
      console.error('\n❌ EXTRACTION FAILED\n');
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = VidsrcProExtractor;
