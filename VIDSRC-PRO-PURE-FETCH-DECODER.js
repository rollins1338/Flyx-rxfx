/**
 * VIDSRC PRO PURE FETCH DECODER
 * 
 * This script extracts M3U8 URLs from vidsrc.pro using ONLY fetch requests
 * by extracting and executing the decoder script in a VM context.
 * 
 * Flow:
 * 1. Fetch embed page → extract data-hash
 * 2. Fetch RCP page → extract ProRCP URL
 * 3. Fetch ProRCP page → extract hidden div ID, content, and decoder script URL
 * 4. Fetch decoder script → execute it in VM to decode the hidden div
 * 5. Return M3U8 URL
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const vm = require('vm');

class VidsrcProPureFetchDecoder {
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
    const hashElement = $('[data-hash]').first();
    if (hashElement.length) return hashElement.attr('data-hash');

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
    let result = null;
    $('div').each((i, elem) => {
      const $elem = $(elem);
      const style = $elem.attr('style');
      const id = $elem.attr('id');
      const content = $elem.html();
      
      if (style && style.includes('display:none') && id && content && content.length > 500) {
        result = { id, content };
        return false;
      }
    });
    return result;
  }

  extractDecoderScriptUrl(html) {
    const $ = cheerio.load(html);
    let decoderUrl = null;
    
    $('script').each((i, elem) => {
      const src = $(elem).attr('src');
      if (!src) return;
      
      // Pattern 1: /[random]/[hash].js
      if (src.match(/^\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js$/)) {
        decoderUrl = src;
        return false;
      }
      
      // Pattern 2: Any relative path with MD5 hash
      if (src.startsWith('/') && !src.startsWith('//') && src.match(/[a-f0-9]{32}/)) {
        decoderUrl = src;
        return false;
      }
      
      // Pattern 3: Any relative JS file that's not a common library
      if (src.startsWith('/') && !src.startsWith('//') && src.endsWith('.js') && 
          !src.includes('jquery') && !src.includes('playerjs') && !src.includes('player')) {
        decoderUrl = src;
        // Don't return false, keep looking for better matches
      }
    });
    
    return decoderUrl;
  }
  
  extractInlineDecoder(html, divId) {
    const $ = cheerio.load(html);
    let decoderScript = null;
    
    $('script:not([src])').each((i, elem) => {
      const content = $(elem).html();
      if (!content) return;
      
      // Look for scripts that reference the div ID as a variable
      if (content.includes(divId) && content.includes('window[')) {
        decoderScript = content;
        return false;
      }
      
      // Look for scripts that create variables dynamically
      if (content.match(/window\[['"]?\w+['"]?\]\s*=/)) {
        decoderScript = content;
        return false;
      }
    });
    
    return decoderScript;
  }

  decodeInVM(decoderScript, divId, divContent) {
    this.log('🔧 Executing decoder in VM...');
    
    try {
      // Create a sandbox environment
      const sandbox = {
        window: {},
        document: {
          getElementById: (id) => {
            if (id === divId) {
              return {
                textContent: divContent,
                innerHTML: divContent
              };
            }
            return null;
          }
        },
        console: console,
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str) => Buffer.from(str, 'binary').toString('base64')
      };
      
      // Make window properties accessible
      sandbox.window = new Proxy(sandbox.window, {
        get: (target, prop) => {
          if (prop in target) return target[prop];
          if (prop in sandbox) return sandbox[prop];
          return undefined;
        },
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        }
      });

      // Create VM context
      const context = vm.createContext(sandbox);
      
      // Execute the decoder script
      vm.runInContext(decoderScript, context, {
        timeout: 5000,
        displayErrors: true
      });
      
      // Check if the variable was created
      if (sandbox.window[divId]) {
        this.log('✅ Decoder executed successfully');
        return sandbox.window[divId];
      }
      
      // Sometimes the variable is set directly in the sandbox
      if (sandbox[divId]) {
        this.log('✅ Decoder executed successfully (direct)');
        return sandbox[divId];
      }
      
      this.log('⚠️  Variable not found after execution');
      this.log('Available variables:', Object.keys(sandbox.window));
      
      return null;
    } catch (error) {
      this.log('❌ VM execution error:', error.message);
      return null;
    }
  }

  async extract(type, tmdbId, season = null, episode = null) {
    try {
      this.log('\n🚀 Starting pure fetch extraction...\n');

      // Step 1: Get data-hash from embed page
      this.log('📡 Step 1: Fetching embed page...');
      const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
      const embedResp = await this.fetch(embedUrl);
      const dataHash = this.extractDataHash(embedResp.data);
      
      if (!dataHash) throw new Error('data-hash not found');
      this.log('✅ Data hash:', dataHash.substring(0, 50) + '...');

      // Step 2: Get ProRCP URL from RCP page
      this.log('\n📡 Step 2: Fetching RCP page...');
      const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
      const rcpResp = await this.fetch(rcpUrl, { 
        referer: 'https://vidsrc-embed.ru/',
        headers: { 'Origin': 'https://vidsrc-embed.ru' }
      });
      
      const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
      if (!iframeSrcMatch) throw new Error('ProRCP iframe not found');
      
      const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
      this.log('✅ ProRCP URL:', proRcpUrl.substring(0, 80) + '...');

      // Step 3: Get hidden div and decoder script from ProRCP page
      this.log('\n📡 Step 3: Fetching ProRCP page...');
      const proRcpResp = await this.fetch(proRcpUrl, { 
        referer: 'https://vidsrc-embed.ru/',
        headers: { 'Origin': 'https://vidsrc-embed.ru' }
      });
      
      const divInfo = this.extractHiddenDiv(proRcpResp.data);
      if (!divInfo) throw new Error('Hidden div not found');
      this.log('✅ Div ID:', divInfo.id);
      this.log('✅ Div content length:', divInfo.content.length);
      
      let decoderScript = null;
      
      // Try to find external decoder script
      const decoderScriptPath = this.extractDecoderScriptUrl(proRcpResp.data);
      if (decoderScriptPath) {
        this.log('✅ Decoder script path:', decoderScriptPath);
        
        // Step 4: Download decoder script
        this.log('\n📡 Step 4: Downloading decoder script...');
        const decoderUrl = `https://cloudnestra.com${decoderScriptPath}`;
        const decoderResp = await this.fetch(decoderUrl, {
          referer: proRcpUrl,
          headers: { 'Origin': 'https://cloudnestra.com' }
        });
        this.log('✅ Decoder script downloaded:', decoderResp.data.length, 'bytes');
        decoderScript = decoderResp.data;
      } else {
        // Try to find inline decoder
        this.log('⚠️  External decoder not found, looking for inline decoder...');
        decoderScript = this.extractInlineDecoder(proRcpResp.data, divInfo.id);
        if (decoderScript) {
          this.log('✅ Found inline decoder script:', decoderScript.length, 'bytes');
        } else {
          throw new Error('No decoder script found (external or inline)');
        }
      }

      // Step 5: Execute decoder in VM
      this.log('\n🔧 Step 5: Executing decoder...');
      const m3u8Url = this.decodeInVM(decoderScript, divInfo.id, divInfo.content);
      
      if (!m3u8Url) {
        throw new Error('Failed to decode M3U8 URL');
      }

      this.log('✅ M3U8 URL extracted:', m3u8Url.substring(0, 100) + '...');

      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        proRcpUrl: proRcpUrl,
        method: 'pure-fetch-vm'
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
    console.log('  Movie:    node VIDSRC-PRO-PURE-FETCH-DECODER.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-PURE-FETCH-DECODER.js tv <tmdbId> <season> <episode>');
    console.log('\nExamples:');
    console.log('  node VIDSRC-PRO-PURE-FETCH-DECODER.js movie 550');
    console.log('  node VIDSRC-PRO-PURE-FETCH-DECODER.js tv 1396 1 1\n');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;
  const extractor = new VidsrcProPureFetchDecoder({ debug: true });

  (async () => {
    try {
      console.log('\n🎯 VidSrc Pro PURE FETCH DECODER\n');
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
      console.log('🎥 M3U8 URL:', result.url);
      console.log('\nDetails:');
      console.log('  Method:', result.method);
      console.log('  Div ID:', result.divId);
      console.log('  ProRCP URL:', result.proRcpUrl.substring(0, 80) + '...');
      
      const fs = require('fs');
      const outputFile = `extracted-pure-fetch-${type}-${tmdbId}${season ? `-s${season}e${episode}` : ''}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log('\n💾 Saved to:', outputFile);

    } catch (error) {
      console.error('\n❌ EXTRACTION FAILED\n');
      console.error('Error:', error.message);
      if (error.stack) console.error('\nStack:', error.stack);
      process.exit(1);
    }
  })();
}

module.exports = VidsrcProPureFetchDecoder;
