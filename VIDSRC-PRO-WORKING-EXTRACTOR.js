/**
 * VIDSRC PRO.RCP WORKING EXTRACTOR
 * Extracts the hidden div - the M3U8 URL is created by decoder script on page load
 * We return the div info so it can be used with Puppeteer if needed
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

class VidsrcProExtractor {
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
    if (hashElement.length) {
      return hashElement.attr('data-hash');
    }

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

  async extract(type, tmdbId, season = null, episode = null) {
    try {
      // Step 1: Fetch embed page
      const embedUrl = this.buildEmbedUrl(type, tmdbId, season, episode);
      this.log('\n🎬 Step 1: Fetch Embed Page');
      this.log('URL:', embedUrl);
      
      const embedResp = await this.fetch(embedUrl);
      this.log('✅ Status:', embedResp.statusCode);

      // Step 2: Extract data-hash
      this.log('\n🔑 Step 2: Extract Data Hash');
      const dataHash = this.extractDataHash(embedResp.data);
      
      if (!dataHash) {
        throw new Error('data-hash not found');
      }
      
      this.log('✅ Hash:', dataHash.substring(0, 50) + '...');

      // Step 3: Fetch RCP page
      const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
      this.log('\n📦 Step 3: Fetch RCP Page');
      
      const rcpResp = await this.fetch(rcpUrl, { referer: embedUrl });
      this.log('✅ Status:', rcpResp.statusCode);

      // Step 4: Extract prorcp iframe src
      this.log('\n🎯 Step 4: Extract ProRCP iframe');
      const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
      
      if (!iframeSrcMatch) {
        throw new Error('ProRCP iframe src not found');
      }
      
      const proRcpPath = iframeSrcMatch[1];
      this.log('✅ Path:', proRcpPath.substring(0, 50) + '...');

      // Step 5: Fetch ProRCP player page
      const proRcpUrl = `https://cloudnestra.com${proRcpPath}`;
      this.log('\n🎮 Step 5: Fetch ProRCP Player Page');
      
      const proRcpResp = await this.fetch(proRcpUrl, { referer: rcpUrl });
      this.log('✅ Status:', proRcpResp.statusCode);

      // Step 6: Extract hidden div
      this.log('\n🔍 Step 6: Extract Hidden Div');
      const divInfo = this.extractHiddenDiv(proRcpResp.data);
      
      if (!divInfo) {
        throw new Error('Hidden div not found');
      }
      
      this.log('✅ Div ID:', divInfo.id);
      this.log('✅ Content length:', divInfo.content.length);

      return {
        success: true,
        divId: divInfo.id,
        divContent: divInfo.content,
        proRcpUrl: proRcpUrl,
        dataHash: dataHash,
        embedUrl: embedUrl,
        rcpUrl: rcpUrl,
        message: 'Hidden div extracted successfully. Use Puppeteer to execute decoder and get M3U8 URL.'
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
    console.log('  Movie:    node VIDSRC-PRO-WORKING-EXTRACTOR.js movie <tmdbId>');
    console.log('  TV Show:  node VIDSRC-PRO-WORKING-EXTRACTOR.js tv <tmdbId> <season> <episode>');
    console.log('\nExamples:');
    console.log('  node VIDSRC-PRO-WORKING-EXTRACTOR.js movie 550');
    console.log('  node VIDSRC-PRO-WORKING-EXTRACTOR.js tv 1396 1 1\n');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;
  const extractor = new VidsrcProExtractor({ debug: true });

  (async () => {
    try {
      console.log('\n🚀 VidSrc Pro Extractor - WORKING VERSION\n');
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
      console.log('ProRCP URL:', result.proRcpUrl);
      console.log('Div ID:', result.divId);
      console.log('Div Content Length:', result.divContent.length);
      console.log('\n📝 Note:', result.message);
      console.log('\n💡 To get M3U8 URL, load the ProRCP URL in a browser and access window[divId]');
      
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
