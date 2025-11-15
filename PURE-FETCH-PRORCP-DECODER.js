/**
 * PURE FETCH PRORCP DECODER
 * 
 * Reverse-engineered decoder for ProRCP hidden div content.
 * This eliminates the need for Puppeteer by implementing the decoder logic directly.
 * 
 * Based on analysis of the obfuscated decoder scripts, the encoding appears to use:
 * 1. Base64 encoding (possibly URL-safe variant)
 * 2. Possible XOR with div ID
 * 3. Possible character substitution/Caesar cipher
 * 4. The result is a gzip-compressed base64 string that contains the M3U8 URL
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

class PureFetchProRcpDecoder {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  log(...args) {
    if (this.debug) console.log('[ProRcpDecoder]', ...args);
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

  /**
   * Try to decode using base64 + gzip decompression
   */
  async tryBase64Gzip(encoded) {
    try {
      const buffer = Buffer.from(encoded, 'base64');
      const decompressed = await gunzip(buffer);
      const result = decompressed.toString('utf8');
      if (result.includes('http') || result.includes('.m3u8')) {
        return result;
      }
    } catch (e) {
      // Not gzipped or invalid base64
    }
    return null;
  }

  /**
   * Try URL-safe base64 + gzip
   * ProRCP uses . instead of + and _ instead of /
   */
  async tryUrlSafeBase64Gzip(encoded) {
    try {
      // Convert URL-safe base64 to standard base64
      // ProRCP uses . for + and _ for /
      let cleaned = encoded.replace(/\./g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      while (cleaned.length % 4 !== 0) {
        cleaned += '=';
      }
      
      const buffer = Buffer.from(cleaned, 'base64');
      const decompressed = await gunzip(buffer);
      const result = decompressed.toString('utf8');
      if (result.includes('http') || result.includes('.m3u8')) {
        return result;
      }
    } catch (e) {
      // Not valid
    }
    return null;
  }

  /**
   * Try base64 + inflate (zlib without gzip headers)
   */
  async tryBase64Inflate(encoded) {
    try {
      const buffer = Buffer.from(encoded, 'base64');
      const decompressed = await inflate(buffer);
      const result = decompressed.toString('utf8');
      if (result.includes('http') || result.includes('.m3u8')) {
        return result;
      }
    } catch (e) {
      // Try inflateRaw
      try {
        const buffer = Buffer.from(encoded, 'base64');
        const decompressed = await inflateRaw(buffer);
        const result = decompressed.toString('utf8');
        if (result.includes('http') || result.includes('.m3u8')) {
          return result;
        }
      } catch (e2) {
        // Not valid
      }
    }
    return null;
  }

  /**
   * Try XOR with div ID then decompress
   */
  async tryXorDivIdDecompress(encoded, divId) {
    if (!divId) return null;
    
    try {
      // First decode base64
      const buffer = Buffer.from(encoded, 'base64');
      
      // XOR with div ID
      const xored = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      
      // Try to decompress
      try {
        const decompressed = await gunzip(xored);
        const result = decompressed.toString('utf8');
        if (result.includes('http') || result.includes('.m3u8')) {
          return result;
        }
      } catch (e) {
        // Try inflate
        try {
          const decompressed = await inflate(xored);
          const result = decompressed.toString('utf8');
          if (result.includes('http') || result.includes('.m3u8')) {
            return result;
          }
        } catch (e2) {
          // Not valid
        }
      }
    } catch (e) {
      // Not valid
    }
    return null;
  }

  /**
   * Try simple base64 decode (no compression)
   */
  trySimpleBase64(encoded) {
    try {
      const result = Buffer.from(encoded, 'base64').toString('utf8');
      if (result.includes('http') || result.includes('.m3u8')) {
        return result;
      }
    } catch (e) {
      // Not valid
    }
    return null;
  }

  /**
   * Try Caesar cipher on the encoded string before decoding
   */
  caesarShift(text, shift) {
    return text.split('').map(c => {
      const code = c.charCodeAt(0);
      
      // Uppercase A-Z
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      }
      
      // Lowercase a-z
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
      
      return c;
    }).join('');
  }

  async tryCaesarThenDecode(encoded) {
    // Try all Caesar shifts
    for (let shift = 1; shift <= 25; shift++) {
      const shifted = this.caesarShift(encoded, shift);
      
      // Try various decoding methods on shifted text
      const methods = [
        () => this.trySimpleBase64(shifted),
        () => this.tryBase64Gzip(shifted),
        () => this.tryUrlSafeBase64Gzip(shifted),
        () => this.tryBase64Inflate(shifted)
      ];
      
      for (const method of methods) {
        const result = await method();
        if (result) {
          this.log(`✅ Decoded with Caesar shift ${shift}`);
          return result;
        }
      }
    }
    return null;
  }

  /**
   * Main decoder - tries all methods
   */
  async decode(encoded, divId) {
    this.log('🔓 Starting decode attempts...');
    this.log('Encoded length:', encoded.length);
    this.log('Div ID:', divId);

    // Method 1: Direct base64 + gzip (most common based on extracted data)
    this.log('\n📝 Trying: Base64 + Gzip');
    let result = await this.tryBase64Gzip(encoded);
    if (result) {
      this.log('✅ Success: Base64 + Gzip');
      return result;
    }

    // Method 2: URL-safe base64 + gzip
    this.log('\n📝 Trying: URL-safe Base64 + Gzip');
    result = await this.tryUrlSafeBase64Gzip(encoded);
    if (result) {
      this.log('✅ Success: URL-safe Base64 + Gzip');
      return result;
    }

    // Method 3: Base64 + inflate
    this.log('\n📝 Trying: Base64 + Inflate');
    result = await this.tryBase64Inflate(encoded);
    if (result) {
      this.log('✅ Success: Base64 + Inflate');
      return result;
    }

    // Method 4: XOR with div ID + decompress
    this.log('\n📝 Trying: XOR with Div ID + Decompress');
    result = await this.tryXorDivIdDecompress(encoded, divId);
    if (result) {
      this.log('✅ Success: XOR + Decompress');
      return result;
    }

    // Method 5: Simple base64 (no compression)
    this.log('\n📝 Trying: Simple Base64');
    result = this.trySimpleBase64(encoded);
    if (result) {
      this.log('✅ Success: Simple Base64');
      return result;
    }

    // Method 6: Caesar cipher + decode
    this.log('\n📝 Trying: Caesar Cipher + Decode');
    result = await this.tryCaesarThenDecode(encoded);
    if (result) {
      this.log('✅ Success: Caesar + Decode');
      return result;
    }

    this.log('\n❌ All decoding methods failed');
    return null;
  }

  /**
   * Extract data hash from embed page
   */
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

  /**
   * Extract ProRCP URL from RCP page
   */
  extractProRcpUrl(html) {
    const patterns = [
      /src:\s*['"]([^'"]+prorcp[^'"]+)['"]/i,
      /<iframe[^>]+src=["']([^"']*prorcp[^"']*)["']/i,
      /url:\s*['"]([^'"]+prorcp[^'"]+)['"]/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        if (!url.startsWith('http')) {
          url = `https://cloudnestra.com${url}`;
        }
        return url;
      }
    }
    return null;
  }

  /**
   * Extract hidden div from ProRCP page
   */
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
        return false; // break
      }
    });
    
    return result;
  }

  /**
   * Complete extraction flow
   */
  async extract(type, tmdbId, season = null, episode = null) {
    try {
      this.log('\n🚀 Starting Pure Fetch ProRCP Extraction\n');

      // Step 1: Fetch embed page
      const embedUrl = `https://vidsrc.xyz/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`;
      this.log('📡 Step 1: Fetching embed page...');
      this.log('URL:', embedUrl);
      
      const embedResp = await this.fetch(embedUrl);
      const dataHash = this.extractDataHash(embedResp.data);
      
      if (!dataHash) {
        throw new Error('data-hash not found in embed page');
      }
      this.log('✅ Data hash:', dataHash);

      // Step 2: Fetch RCP page
      const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
      this.log('\n📡 Step 2: Fetching RCP page...');
      this.log('URL:', rcpUrl);
      
      const rcpResp = await this.fetch(rcpUrl, {
        referer: 'https://vidsrc-embed.ru/',
        headers: { 'Origin': 'https://vidsrc-embed.ru' }
      });
      
      const proRcpUrl = this.extractProRcpUrl(rcpResp.data);
      if (!proRcpUrl) {
        throw new Error('ProRCP URL not found in RCP page');
      }
      this.log('✅ ProRCP URL:', proRcpUrl);

      // Step 3: Fetch ProRCP page
      this.log('\n📡 Step 3: Fetching ProRCP page...');
      const proRcpResp = await this.fetch(proRcpUrl, {
        referer: 'https://vidsrc-embed.ru/',
        headers: { 'Origin': 'https://vidsrc-embed.ru' }
      });

      // Step 4: Extract hidden div
      this.log('\n🔍 Step 4: Extracting hidden div...');
      const divInfo = this.extractHiddenDiv(proRcpResp.data);
      
      if (!divInfo) {
        throw new Error('Hidden div not found in ProRCP page');
      }
      this.log('✅ Div ID:', divInfo.id);
      this.log('✅ Content length:', divInfo.content.length);

      // Step 5: Decode the content
      this.log('\n🔓 Step 5: Decoding content...');
      const m3u8Url = await this.decode(divInfo.content, divInfo.id);
      
      if (!m3u8Url) {
        throw new Error('Failed to decode hidden div content');
      }

      this.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅\n');
      this.log('🎥 M3U8 URL:', m3u8Url);

      return {
        success: true,
        url: m3u8Url,
        divId: divInfo.id,
        proRcpUrl: proRcpUrl
      };

    } catch (error) {
      this.log('\n❌ Extraction failed:', error.message);
      throw error;
    }
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('\nUsage:');
    console.log('  Movie:    node PURE-FETCH-PRORCP-DECODER.js movie <tmdbId>');
    console.log('  TV Show:  node PURE-FETCH-PRORCP-DECODER.js tv <tmdbId> <season> <episode>');
    console.log('\nExamples:');
    console.log('  node PURE-FETCH-PRORCP-DECODER.js movie 550');
    console.log('  node PURE-FETCH-PRORCP-DECODER.js tv 1396 1 1\n');
    process.exit(1);
  }

  const [type, tmdbId, season, episode] = args;
  const decoder = new PureFetchProRcpDecoder({ debug: true });

  (async () => {
    try {
      console.log('\n🎯 Pure Fetch ProRCP Decoder\n');
      console.log('Type:', type);
      console.log('TMDB ID:', tmdbId);
      if (type === 'tv') {
        console.log('Season:', season);
        console.log('Episode:', episode);
      }

      const result = type === 'movie'
        ? await decoder.extract('movie', tmdbId)
        : await decoder.extract('tv', tmdbId, parseInt(season), parseInt(episode));

      console.log('\n📊 Result:');
      console.log(JSON.stringify(result, null, 2));

      const fs = require('fs');
      const outputFile = `decoded-${type}-${tmdbId}${season ? `-s${season}e${episode}` : ''}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log('\n💾 Saved to:', outputFile);

    } catch (error) {
      console.error('\n❌ FAILED\n');
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = PureFetchProRcpDecoder;
