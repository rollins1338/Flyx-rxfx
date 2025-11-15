/**
 * VIDSRC PRO.RCP FINAL AUTOMATED EXTRACTOR
 * Handles source selection and iframe navigation
 */

const puppeteer = require('puppeteer');

class VidsrcProExtractor {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 45000;
    this.debug = options.debug || false;
  }

  log(...args) {
    if (this.debug) console.log('[VidsrcPro]', ...args);
  }

  buildEmbedUrl(type, tmdbId, season = null, episode = null) {
    let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    
    if (type === 'tv' && season !== null && episode !== null) {
      url += `/${season}/${episode}`;
    }
    
    this.log('Built URL:', url);
    return url;
  }

  async extractFromEmbed(embedUrl) {
    this.log('Starting extraction from:', embedUrl);
    
    const browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security'
      ]
    });

    try {
      const page = await browser.newPage();
      
      // Enhanced stealth
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
      });
      
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      await page.setViewport({ width: 1920, height: 1080 });

      this.log('Loading page...');
      
      try {
        await page.goto(embedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.timeout
        });
      } catch (e) {
        this.log('Initial load timeout, continuing...');
      }

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if we need to click a source button
      this.log('Checking for source selection...');
      
      const hasSourceButton = await page.evaluate(() => {
        const sourceBtn = document.querySelector('#sources .source, .source, [data-hash]');
        return sourceBtn !== null;
      });

      if (hasSourceButton) {
        this.log('Found source button, clicking...');
        
        try {
          await page.click('#sources .source:first-child, .source:first-child');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
          this.log('Could not click source button:', e.message);
        }
      }

      // Now look for the RCP iframe
      this.log('Waiting for iframe to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const frames = page.frames();
      this.log(`Total frames: ${frames.length}`);

      let rcpFrame = null;
      for (const frame of frames) {
        const url = frame.url();
        this.log('Frame:', url);
        
        if (url.includes('cloudnestra.com/rcp/') || url.includes('/rcp/')) {
          rcpFrame = frame;
          this.log('Found RCP frame!');
          break;
        }
      }

      if (!rcpFrame) {
        // Try to get the iframe src from the page
        const iframeSrc = await page.evaluate(() => {
          const iframe = document.querySelector('iframe[src*="rcp"], iframe#the_frame');
          return iframe ? iframe.src : null;
        });

        if (iframeSrc) {
          this.log('Found iframe src:', iframeSrc);
          this.log('Navigating to iframe directly...');
          
          await page.goto(iframeSrc, {
            waitUntil: 'domcontentloaded',
            timeout: this.timeout
          });
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          rcpFrame = page;
        } else {
          throw new Error('Could not find RCP iframe');
        }
      }

      // Extract hidden div from RCP frame
      this.log('Searching for hidden div in RCP frame...');
      
      const divInfo = await rcpFrame.evaluate(() => {
        const divs = document.querySelectorAll('div[style*="display:none"], div[style*="display: none"]');
        
        for (const div of divs) {
          if (div.id && div.innerHTML && div.innerHTML.length > 500) {
            return {
              id: div.id,
              contentLength: div.innerHTML.length,
              contentPreview: div.innerHTML.substring(0, 50)
            };
          }
        }
        return null;
      });

      if (!divInfo) {
        const html = await rcpFrame.content();
        this.log('Frame HTML length:', html.length);
        this.log('Frame HTML preview:', html.substring(0, 500));
        throw new Error('Hidden div not found in RCP frame');
      }

      this.log('Found hidden div:', divInfo.id);
      this.log('Content length:', divInfo.contentLength);
      this.log('Preview:', divInfo.contentPreview);

      // Wait for decoder to create the variable
      this.log('Waiting for decoder variable...');
      
      let m3u8Url = null;
      const maxWait = 20; // 20 seconds
      
      for (let i = 0; i < maxWait; i++) {
        m3u8Url = await rcpFrame.evaluate((divId) => {
          return window[divId];
        }, divInfo.id);
        
        if (m3u8Url) {
          this.log('Variable found!');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!m3u8Url) {
        throw new Error(`Variable ${divInfo.id} was not created after ${maxWait}s`);
      }

      this.log('Successfully extracted M3U8 URL!');
      
      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        embedUrl: embedUrl
      };

    } catch (error) {
      this.log('Error:', error.message);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async extractMovie(tmdbId) {
    const embedUrl = this.buildEmbedUrl('movie', tmdbId);
    return await this.extractFromEmbed(embedUrl);
  }

  async extractTvEpisode(tmdbId, season, episode) {
    const embedUrl = this.buildEmbedUrl('tv', tmdbId, season, episode);
    return await this.extractFromEmbed(embedUrl);
  }

  async extractWithRetry(type, tmdbId, season = null, episode = null, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log(`\n=== Attempt ${attempt}/${maxRetries} ===\n`);
        
        if (type === 'movie') {
          return await this.extractMovie(tmdbId);
        } else {
          return await this.extractTvEpisode(tmdbId, season, episode);
        }
      } catch (error) {
        lastError = error;
        this.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = 3000;
          this.log(`Retrying in ${delay}ms...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  Movie:    node VIDSRC-PRO-FINAL-EXTRACTOR.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-FINAL-EXTRACTOR.js tv <tmdbId> <season> <episode>');
    console.log('');
    console.log('Examples:');
    console.log('  node VIDSRC-PRO-FINAL-EXTRACTOR.js movie 550');
    console.log('  node VIDSRC-PRO-FINAL-EXTRACTOR.js tv 1396 1 1');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;

  const extractor = new VidsrcProExtractor({
    headless: false,
    debug: true
  });

  (async () => {
    try {
      console.log('\n🎬 VidSrc Pro Extractor - FINAL VERSION\n');
      console.log('Type:', type);
      console.log('TMDB ID:', tmdbId);
      if (type === 'tv') {
        console.log('Season:', season);
        console.log('Episode:', episode);
      }

      const result = await extractor.extractWithRetry(
        type,
        tmdbId,
        season ? parseInt(season) : null,
        episode ? parseInt(episode) : null
      );

      console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      console.log('M3U8 URL:', result.url);
      console.log('Div ID:', result.divId);
      
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
