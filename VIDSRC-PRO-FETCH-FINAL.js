/**
 * VIDSRC PRO.RCP PURE FETCH EXTRACTOR - FINAL VERSION
 * Uses cheerio for parsing and vm2 for safe script execution
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const vm = require('vm');

class VidsrcProFetchExtractor {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  log(...args) {
    if (this.debug) console.log('[VidsrcPro]', ...args);
  }

  async fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const lib = urlObj.protocol === 'https:' ? https : http;

      const req = lib.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': options.referer || '',
          ...options.headers
        }
      }, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
          return this.fetch(redirectUrl, options).then(resolve).catch(reject);
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ data, statusCode: res.statusCode }));
      });

      req.on('error', reject);
      req.end();
    });
  }

  buildEmbedUrl(type, tmdbId, season = null, episode = null) {
    let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    if (type === 'tv' && season !== null && episode !== null) {
      url += `/${season}/${episode}`;
    }
    return url;
  }

  extractDataHash(html) {
    const $ = cheerio.load(html);
    
    // Look for elements with data-hash attribute
    const hashElement = $('[data-hash]').first();
    if (hashElement.length) {
      return hashElement.attr('data-hash');
    }

    // Look in scripts
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (content) {
        const match = content.match(/data-hash=["']([^"']+)["']/);
        if (match) return match[1];
      }
    }

    return null;
  }

  extractHiddenDiv(html) {
    const $ = cheerio.load(html);
    
    $('div').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style');
      const id = $elem.attr('id');
      const content = $elem.html();
      
      if (style && style.includes('display:none') && id && content && content.length > 500) {
        this.hiddenDiv = { id, content };
        return false; // break
      }
    });

    return this.hiddenDiv || null;
  }

  extractDecoderScript(html) {
    const $ = cheerio.load(html);
    
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && src.match(/\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js/)) {
        this.decoderScript = src;
        return false;
      }
    });

    return this.decoderScript || null;
  }

  executeDecoder(decoderCode, divId, divContent) {
    this.log('Creating sandbox environment...');
    
    // Create a sandbox with necessary globals
    const sandbox = {
      window: {},
      document: {
        getElementById: (id) => {
          if (id === divId) {
            return {
              innerHTML: divContent,
              textContent: divContent,
              id: divId
            };
          }
          return null;
        }
      },
      atob: (str) => Buffer.from(str, 'base64').toString('binary'),
      btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
      console: { log: (...args) => this.log('Decoder:', ...args) }
    };

    // Make window properties accessible
    sandbox.window = new Proxy(sandbox, {
      get: (target, prop) => target[prop],
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      }
    });

    try {
      // Execute decoder in sandbox
      vm.createContext(sandbox);
      vm.runInContext(decoderCode, sandbox, { timeout: 5000 });
      
      // Check if variable was created
      const m3u8Url = sandbox[divId] || sandbox.window[divId];
      
      if (m3u8Url) {
        this.log('Decoder created variable successfully!');
        return m3u8Url;
      }

      throw new Error('Decoder did not create the expected variable');
      
    } catch (error) {
      this.log('Decoder execution error:', error.message);
      throw error;
    }
  }

  async extract(type, tmdbId, season = null, episode = null) {
    try {
      // Step 1: Fetch embed page
      const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
      this.log('\n=== STEP 1: Fetch Embed Page ===');
      this.log('URL:', embedUrl);
      
      const embedResp = await this.fetch(embedUrl);
      this.log('Status:', embedResp.statusCode);

      // Step 2: Extract data-hash
      this.log('\n=== STEP 2: Extract Data Hash ===');
      const dataHash = this.extractDataHash(embedResp.data);
      
      if (!dataHash) {
        throw new Error('data-hash not found');
      }
      
      this.log('Hash:', dataHash.substring(0, 50) + '...');

      // Step 3: Fetch RCP page
      const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
      this.log('\n=== STEP 3: Fetch RCP Page ===');
      this.log('URL:', rcpUrl);
      
      const rcpResp = await this.fetch(rcpUrl, { referer: embedUrl });
      this.log('Status:', rcpResp.statusCode);

      // Step 3.5: Extract prorcp iframe src
      this.log('\n=== STEP 3.5: Extract ProRCP iframe ===');
      const $ = cheerio.load(rcpResp.data);
      const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
      
      if (!iframeSrcMatch) {
        throw new Error('ProRCP iframe src not found');
      }
      
      const proRcpPath = iframeSrcMatch[1];
      this.log('ProRCP path:', proRcpPath.substring(0, 50) + '...');

      // Step 4: Fetch ProRCP player page
      const proRcpUrl = `https://cloudnestra.com${proRcpPath}`;
      this.log('\n=== STEP 4: Fetch ProRCP Player Page ===');
      this.log('URL:', proRcpUrl.substring(0, 80) + '...');
      
      const proRcpResp = await this.fetch(proRcpUrl, { referer: rcpUrl });
      this.log('Status:', proRcpResp.statusCode);

      // Step 5: Extract hidden div
      this.log('\n=== STEP 5: Extract Hidden Div ===');
      const divInfo = this.extractHiddenDiv(proRcpResp.data);
      
      if (!divInfo) {
        throw new Error('Hidden div not found');
      }
      
      this.log('Div ID:', divInfo.id);
      this.log('Content length:', divInfo.content.length);

      // Step 6: Extract decoder script
      this.log('\n=== STEP 6: Extract Decoder Script ===');
      const decoderPath = this.extractDecoderScript(proRcpResp.data);
      
      if (!decoderPath) {
        throw new Error('Decoder script not found');
      }
      
      this.log('Script path:', decoderPath);

      // Step 7: Fetch decoder script
      const decoderUrl = `https://cloudnestra.com${decoderPath}`;
      this.log('\n=== STEP 7: Fetch Decoder Script ===');
      this.log('URL:', decoderUrl);
      
      const decoderResp = await this.fetch(decoderUrl, { referer: proRcpUrl });
      this.log('Script length:', decoderResp.data.length);

      // Step 8: Execute decoder
      this.log('\n=== STEP 8: Execute Decoder ===');
      const m3u8Url = this.executeDecoder(decoderResp.data, divInfo.id, divInfo.content);

      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        dataHash: dataHash,
        embedUrl: embedUrl,
        rcpUrl: rcpUrl
      };

    } catch (error) {
      this.log('\n❌ Error:', error.message);
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
    console.log('\nUsage:');
    console.log('  Movie:    node VIDSRC-PRO-FETCH-FINAL.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-FETCH-FINAL.js tv <tmdbId> <season> <episode>');
    console.log('\nExamples:');
    console.log('  node VIDSRC-PRO-FETCH-FINAL.js movie 550');
    console.log('  node VIDSRC-PRO-FETCH-FINAL.js tv 1396 1 1\n');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;
  const extractor = new VidsrcProFetchExtractor({ debug: true });

  (async () => {
    try {
      console.log('\n🚀 VidSrc Pro PURE FETCH Extractor - FINAL\n');
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
      console.log('\nDetails:');
      console.log('  Div ID:', result.divId);
      console.log('  Data Hash:', result.dataHash.substring(0, 50) + '...');
      
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

module.exports = VidsrcProFetchExtractor;
