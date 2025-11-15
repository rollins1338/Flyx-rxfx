/**
 * VIDSRC PRO.RCP COMPLETE SOLUTION
 * Step 1: Use fetch to get ProRCP URL and div ID
 * Step 2: Use Puppeteer to load page and extract window[divId]
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class VidsrcProCompleteSolution {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.headless = options.headless !== false;
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

  async getProRcpInfo(type, tmdbId, season = null, episode = null) {
    const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
    this.log('📡 Fetching embed page...');
    
    const embedResp = await this.fetch(embedUrl);
    const dataHash = this.extractDataHash(embedResp.data);
    if (!dataHash) throw new Error('data-hash not found');

    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    const rcpResp = await this.fetch(rcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
    if (!iframeSrcMatch) throw new Error('ProRCP iframe not found');

    const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
    const proRcpResp = await this.fetch(proRcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const divInfo = this.extractHiddenDiv(proRcpResp.data);
    if (!divInfo) throw new Error('Hidden div not found');

    return { proRcpUrl, divId: divInfo.id };
  }

  async extractM3U8WithPuppeteer(proRcpUrl, divId) {
    this.log('🎭 Launching browser...');
    
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      
      // Intercept console logs
      page.on('console', msg => {
        this.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      });
      
      // Capture ALL scripts loaded
      const scripts = [];
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('.js') && response.status() === 200) {
          try {
            const text = await response.text();
            scripts.push({ url, content: text });
          } catch (e) {
            // Ignore
          }
        }
      });
      
      // Inject interceptor BEFORE page loads
      await page.evaluateOnNewDocument((expectedDivId) => {
        console.log('🔍 Interceptor installed for div:', expectedDivId);
        
        window.decoderData = {
          divId: expectedDivId,
          divContent: null,
          divElement: null,
          atobCalls: [],
          fromCharCodeCalls: [],
          allVariables: {},
          m3u8Found: null
        };
        
        // Intercept atob to capture ALL decode operations
        const originalAtob = window.atob;
        window.atob = function(input) {
          const output = originalAtob.call(this, input);
          
          window.decoderData.atobCalls.push({
            inputLength: input.length,
            inputSample: input.substring(0, 100),
            outputLength: output.length,
            outputSample: output.substring(0, 100),
            containsM3U8: output.includes('.m3u8') || output.includes('http')
          });
          
          if (output.includes('.m3u8') || output.includes('http')) {
            console.log('🎯 FOUND M3U8 IN ATOB!');
            console.log('   Input:', input.substring(0, 200));
            console.log('   Output:', output);
            window.decoderData.m3u8Found = {
              input: input,
              output: output,
              method: 'atob'
            };
          }
          return output;
        };
        
        // Intercept String.fromCharCode to capture character operations
        const originalFromCharCode = String.fromCharCode;
        String.fromCharCode = function(...codes) {
          const result = originalFromCharCode.apply(this, codes);
          
          if (codes.length > 50) {
            window.decoderData.fromCharCodeCalls.push({
              codes: codes,
              result: result,
              timestamp: Date.now()
            });
            
            if (result.includes('.m3u8') || result.includes('http')) {
              console.log('🎯 M3U8 IN FROMCHARCODE!', result);
              window.decoderData.m3u8Found = { method: 'fromCharCode', result };
            }
          }
          
          return result;
        };
        
        // Intercept document.getElementById to capture div content
        const originalGetElementById = document.getElementById;
        document.getElementById = function(id) {
          const element = originalGetElementById.call(document, id);
          if (id === expectedDivId && element) {
            const content = element.textContent || element.innerHTML;
            console.log('🎯 DIV CONTENT CAPTURED:', content.substring(0, 100));
            window.decoderData.divContent = content;
            window.decoderData.divElement = element.outerHTML;
          }
          return element;
        };
        
        // Capture ALL window variable assignments
        setInterval(() => {
          const vars = Object.keys(window).filter(k => k.length === 10 && /^[a-zA-Z0-9]+$/.test(k));
          vars.forEach(v => {
            if (typeof window[v] === 'string' && window[v].length > 100) {
              window.decoderData.allVariables[v] = window[v].substring(0, 1000);
            }
          });
        }, 500);
      }, divId);
      
      // Set extra headers including Referer
      await page.setExtraHTTPHeaders({
        'Referer': 'https://vidsrc-embed.ru/',
        'Origin': 'https://vidsrc-embed.ru'
      });

      this.log('📄 Loading ProRCP page...');
      await page.goto(proRcpUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      this.log('⏳ Waiting for decoder...');
      
      // Wait longer and check periodically
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Get captured decoder data
      const decoderData = await page.evaluate(() => window.decoderData);
      
      // Get page HTML and all scripts
      const pageHTML = await page.content();
      
      // Save decoder data for analysis
      const fs = require('fs');
      fs.writeFileSync('decoder-data-captured.json', JSON.stringify(decoderData, null, 2));
      this.log('💾 Decoder data saved to decoder-data-captured.json');
      
      fs.writeFileSync('prorcp-page.html', pageHTML);
      this.log('💾 Page HTML saved to prorcp-page.html');
      
      fs.writeFileSync('prorcp-scripts.json', JSON.stringify(scripts, null, 2));
      this.log('💾 Scripts saved to prorcp-scripts.json');
      
      // Check what variables exist
      const allVars = await page.evaluate(() => {
        return Object.keys(window).filter(k => k.length === 10 && /^[a-zA-Z0-9]+$/.test(k));
      });
      
      this.log('🔍 Found potential div ID variables:', allVars);
      
      // Try to get the value
      let m3u8Url = await page.evaluate((divId) => window[divId], divId);
      
      // If not found, try all potential variables
      if (!m3u8Url) {
        this.log('⚠️  Trying all potential variables...');
        for (const varName of allVars) {
          const value = await page.evaluate((v) => window[v], varName);
          if (value && typeof value === 'string' && value.includes('.m3u8')) {
            this.log('✅ Found M3U8 in variable:', varName);
            m3u8Url = value;
            break;
          }
        }
      }
      
      return m3u8Url;
    } finally {
      await browser.close();
    }
  }

  async extract(type, tmdbId, season = null, episode = null) {
    try {
      this.log('\n🚀 Starting extraction...\n');

      // Phase 1: Get ProRCP URL and div ID via fetch
      this.log('📦 Phase 1: Fetching page data...');
      const { proRcpUrl, divId } = await this.getProRcpInfo(type, tmdbId, season, episode);
      this.log('✅ ProRCP URL obtained');
      this.log('✅ Div ID:', divId);

      // Phase 2: Use Puppeteer to execute decoder
      this.log('\n🎬 Phase 2: Executing decoder...');
      const m3u8Url = await this.extractM3U8WithPuppeteer(proRcpUrl, divId);
      
      if (!m3u8Url) {
        throw new Error('M3U8 URL not found');
      }

      return {
        success: true,
        url: m3u8Url,
        divId: divId,
        proRcpUrl: proRcpUrl
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
    console.log('  Movie:    node VIDSRC-PRO-COMPLETE-SOLUTION.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-COMPLETE-SOLUTION.js tv <tmdbId> <season> <episode>');
    console.log('\nExamples:');
    console.log('  node VIDSRC-PRO-COMPLETE-SOLUTION.js movie 550');
    console.log('  node VIDSRC-PRO-COMPLETE-SOLUTION.js tv 1396 1 1\n');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;
  const extractor = new VidsrcProCompleteSolution({ debug: true, headless: false });

  (async () => {
    try {
      console.log('\n🎯 VidSrc Pro COMPLETE SOLUTION\n');
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
      console.log('  Div ID:', result.divId);
      console.log('  ProRCP URL:', result.proRcpUrl.substring(0, 80) + '...');
      
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

module.exports = VidsrcProCompleteSolution;
