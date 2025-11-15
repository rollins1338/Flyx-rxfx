/**
 * VIDSRC PRO.RCP PURE FETCH EXTRACTOR
 * NO PUPPETEER - JUST FETCH AND PARSE!
 */

const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');

class VidsrcProFetchExtractor {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  log(...args) {
    if (this.debug) console.log('[VidsrcPro]', ...args);
  }

  /**
   * Fetch with proper headers
   */
  async fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          ...options.headers
        }
      };

      const req = lib.request(requestOptions, (res) => {
        let data = '';

        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.log('Redirect to:', res.headers.location);
          const redirectUrl = res.headers.location.startsWith('http') 
            ? res.headers.location 
            : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
          return this.fetch(redirectUrl, options).then(resolve).catch(reject);
        }

        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, statusCode: res.statusCode, headers: res.headers }));
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Build embed URL
   */
  buildEmbedUrl(type, tmdbId, season = null, episode = null) {
    let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season !== null && episode !== null) {
      url += `/${season}/${episode}`;
    }
    return url;
  }

  /**
   * Extract data-hash from source button
   */
  extractDataHash(html) {
    this.log('Parsing HTML for data-hash...');
    
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Look for source elements with data-hash
    const sources = doc.querySelectorAll('[data-hash]');
    
    if (sources.length > 0) {
      const hash = sources[0].getAttribute('data-hash');
      this.log('Found data-hash:', hash.substring(0, 50) + '...');
      return hash;
    }

    // Alternative: look in script tags for hash
    const scripts = doc.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      const hashMatch = content.match(/data-hash=["']([^"']+)["']/);
      if (hashMatch) {
        this.log('Found data-hash in script:', hashMatch[1].substring(0, 50) + '...');
        return hashMatch[1];
      }
    }

    return null;
  }

  /**
   * Extract hidden div from RCP page
   */
  extractHiddenDiv(html) {
    this.log('Parsing RCP page for hidden div...');
    
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Find hidden divs
    const divs = doc.querySelectorAll('div[style*="display:none"], div[style*="display: none"]');
    
    for (const div of divs) {
      if (div.id && div.innerHTML && div.innerHTML.length > 500) {
        this.log('Found hidden div:', div.id);
        this.log('Content length:', div.innerHTML.length);
        return {
          id: div.id,
          content: div.innerHTML
        };
      }
    }

    return null;
  }

  /**
   * Extract decoder script URL from RCP page
   */
  extractDecoderScript(html) {
    this.log('Looking for decoder script...');
    
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const scripts = doc.querySelectorAll('script[src]');
    
    for (const script of scripts) {
      const src = script.getAttribute('src');
      // Look for the hash-based decoder script
      if (src && src.match(/\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js/)) {
        this.log('Found decoder script:', src);
        return src;
      }
    }

    return null;
  }

  /**
   * Execute decoder script to get M3U8 URL
   */
  async executeDecoder(decoderScriptUrl, divId, divContent, baseUrl) {
    this.log('Fetching decoder script...');
    
    const scriptUrl = decoderScriptUrl.startsWith('http') 
      ? decoderScriptUrl 
      : `${baseUrl}${decoderScriptUrl}`;
    
    const response = await this.fetch(scriptUrl);
    const decoderCode = response.data;
    
    this.log('Decoder script length:', decoderCode.length);
    
    // Create a minimal DOM environment
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="${divId}" style="display:none;">${divContent}</div>
        </body>
      </html>
    `, {
      runScripts: 'outside-only',
      resources: 'usable'
    });

    const window = dom.window;
    const document = window.document;

    try {
      // Execute the decoder script in the context
      this.log('Executing decoder script...');
      
      // Inject necessary globals
      window.atob = (str) => Buffer.from(str, 'base64').toString('binary');
      window.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
      
      // Execute the decoder
      const script = new Function('window', 'document', decoderCode);
      script(window, document);
      
      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if the variable was created
      const m3u8Url = window[divId];
      
      if (m3u8Url) {
        this.log('Successfully decoded M3U8 URL!');
        return m3u8Url;
      }
      
      throw new Error('Decoder did not create the expected variable');
      
    } catch (error) {
      this.log('Error executing decoder:', error.message);
      throw error;
    }
  }

  /**
   * Main extraction method
   */
  async extract(type, tmdbId, season = null, episode = null) {
    try {
      // Step 1: Fetch embed page
      const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
      this.log('\n=== Step 1: Fetching embed page ===');
      this.log('URL:', embedUrl);
      
      const embedResponse = await this.fetch(embedUrl);
      
      if (embedResponse.statusCode !== 200) {
        throw new Error(`Failed to fetch embed page: ${embedResponse.statusCode}`);
      }

      // Step 2: Extract data-hash
      this.log('\n=== Step 2: Extracting data-hash ===');
      const dataHash = this.extractDataHash(embedResponse.data);
      
      if (!dataHash) {
        throw new Error('Could not find data-hash in embed page');
      }

      // Step 3: Fetch RCP page
      this.log('\n=== Step 3: Fetching RCP page ===');
      const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
      this.log('URL:', rcpUrl);
      
      const rcpResponse = await this.fetch(rcpUrl, {
        headers: {
          'Referer': embedUrl
        }
      });

      if (rcpResponse.statusCode !== 200) {
        throw new Error(`Failed to fetch RCP page: ${rcpResponse.statusCode}`);
      }

      // Step 4: Extract hidden div
      this.log('\n=== Step 4: Extracting hidden div ===');
      const divInfo = this.extractHiddenDiv(rcpResponse.data);
      
      if (!divInfo) {
        throw new Error('Could not find hidden div in RCP page');
      }

      // Step 5: Extract decoder script
      this.log('\n=== Step 5: Finding decoder script ===');
      const decoderScript = this.extractDecoderScript(rcpResponse.data);
      
      if (!decoderScript) {
        throw new Error('Could not find decoder script');
      }

      // Step 6: Execute decoder
      this.log('\n=== Step 6: Executing decoder ===');
      const m3u8Url = await this.executeDecoder(
        decoderScript,
        divInfo.id,
        divInfo.content,
        'https://cloudnestra.com'
      );

      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        dataHash: dataHash,
        embedUrl: embedUrl,
        rcpUrl: rcpUrl
      };

    } catch (error) {
      this.log('Extraction failed:', error.message);
      throw error;
    }
  }

  async extractMovie(tmdbId) {
    return await this.extract('movie', tmdbId);
  }

  async extractTvEpisode(tmdbId, season, episode) {
    return await this.extract('tv', tmdbId, season, episode);
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  Movie:    node VIDSRC-PRO-PURE-FETCH.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-PURE-FETCH.js tv <tmdbId> <season> <episode>');
    console.log('');
    console.log('Examples:');
    console.log('  node VIDSRC-PRO-PURE-FETCH.js movie 550');
    console.log('  node VIDSRC-PRO-PURE-FETCH.js tv 1396 1 1');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;

  const extractor = new VidsrcProFetchExtractor({ debug: true });

  (async () => {
    try {
      console.log('\n🚀 VidSrc Pro PURE FETCH Extractor\n');
      console.log('Type:', type);
      console.log('TMDB ID:', tmdbId);
      if (type === 'tv') {
        console.log('Season:', season);
        console.log('Episode:', episode);
      }

      const result = type === 'movie'
        ? await extractor.extractMovie(tmdbId)
        : await extractor.extractTvEpisode(tmdbId, parseInt(season), parseInt(episode));

      console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      console.log('M3U8 URL:', result.url);
      console.log('Div ID:', result.divId);
      console.log('Data Hash:', result.dataHash.substring(0, 50) + '...');
      
      const fs = require('fs');
      const outputFile = `extracted-${type}-${tmdbId}${season ? `-s${season}e${episode}` : ''}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log('\n💾 Saved to:', outputFile);

    } catch (error) {
      console.error('\n❌ EXTRACTION FAILED\n');
      console.error('Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  })();
}

module.exports = VidsrcProFetchExtractor;
