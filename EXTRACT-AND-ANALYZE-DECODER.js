/**
 * EXTRACT AND ANALYZE THE ACTUAL DECODER
 * Download the decoder script and analyze its structure
 */

const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const fs = require('fs');

class DecoderExtractor {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
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

  extractDecoderScript(html) {
    const $ = cheerio.load(html);
    
    // Look for the obfuscated decoder script
    const scripts = $('script');
    const decoderScripts = [];
    
    scripts.each((i, elem) => {
      const src = $(elem).attr('src');
      
      // Pattern: /[random]/[hash].js
      if (src && src.match(/\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js/)) {
        decoderScripts.push(src);
      }
    });
    
    return decoderScripts;
  }

  async run() {
    console.log('🔥 DECODER EXTRACTION STARTING\n');

    // Step 1: Get embed page
    console.log('📡 Step 1: Fetching embed page...');
    const embedUrl = 'https://vidsrc.xyz/embed/movie/550';
    const embedResp = await this.fetch(embedUrl);
    const dataHash = this.extractDataHash(embedResp.data);
    console.log('✅ Data hash:', dataHash);

    // Step 2: Get RCP page
    console.log('\n📡 Step 2: Fetching RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    const rcpResp = await this.fetch(rcpUrl, {
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    const proRcpUrl = this.extractProRcpUrl(rcpResp.data);
    console.log('✅ ProRCP URL:', proRcpUrl);

    // Step 3: Get ProRCP page
    console.log('\n📡 Step 3: Fetching ProRCP page...');
    const proRcpResp = await this.fetch(proRcpUrl, {
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });

    // Step 4: Extract hidden div
    console.log('\n🔍 Step 4: Extracting hidden div...');
    const divInfo = this.extractHiddenDiv(proRcpResp.data);
    console.log('✅ Div ID:', divInfo.id);
    console.log('✅ Content length:', divInfo.content.length);
    console.log('✅ Content preview:', divInfo.content.substring(0, 100) + '...');

    // Save the div content
    fs.writeFileSync('hidden-div-content.txt', divInfo.content);
    fs.writeFileSync('hidden-div-id.txt', divInfo.id);
    console.log('💾 Saved div content to hidden-div-content.txt');

    // Step 5: Extract decoder scripts
    console.log('\n🔍 Step 5: Finding decoder scripts...');
    const decoderScripts = this.extractDecoderScript(proRcpResp.data);
    console.log('✅ Found decoder scripts:', decoderScripts.length);
    
    decoderScripts.forEach((script, i) => {
      console.log(`  [${i + 1}] ${script}`);
    });

    // Step 6: Download decoder scripts
    if (decoderScripts.length > 0) {
      console.log('\n📥 Step 6: Downloading decoder scripts...');
      
      for (let i = 0; i < decoderScripts.length; i++) {
        const scriptUrl = `https://cloudnestra.com${decoderScripts[i]}`;
        console.log(`\n  Downloading: ${scriptUrl}`);
        
        const scriptResp = await this.fetch(scriptUrl, {
          referer: proRcpUrl
        });
        
        const filename = `decoder-script-${i + 1}.js`;
        fs.writeFileSync(filename, scriptResp.data);
        console.log(`  ✅ Saved to ${filename} (${scriptResp.data.length} bytes)`);
        
        // Analyze the script
        console.log(`\n  📊 Analyzing ${filename}...`);
        this.analyzeDecoderScript(scriptResp.data, divInfo.id, divInfo.content);
      }
    }

    // Step 7: Save the full page for analysis
    fs.writeFileSync('prorcp-page.html', proRcpResp.data);
    console.log('\n💾 Saved full ProRCP page to prorcp-page.html');

    console.log('\n✅ EXTRACTION COMPLETE!');
    console.log('\nFiles created:');
    console.log('  - hidden-div-content.txt (the encoded data)');
    console.log('  - hidden-div-id.txt (the div ID)');
    console.log('  - decoder-script-*.js (the decoder scripts)');
    console.log('  - prorcp-page.html (full page for reference)');
  }

  analyzeDecoderScript(script, divId, divContent) {
    console.log('    Script length:', script.length);
    
    // Check if it references the div ID
    if (script.includes(divId)) {
      console.log('    ⚠️  Script contains div ID!');
    }
    
    // Look for common decoder patterns
    const patterns = {
      'atob': script.includes('atob'),
      'fromCharCode': script.includes('fromCharCode'),
      'charCodeAt': script.includes('charCodeAt'),
      'split': script.includes('split'),
      'replace': script.includes('replace'),
      'substring': script.includes('substring'),
      'slice': script.includes('slice'),
      'XOR (^)': script.includes('^'),
      'getElementById': script.includes('getElementById'),
      'innerHTML': script.includes('innerHTML'),
      'textContent': script.includes('textContent')
    };
    
    console.log('    Patterns found:');
    Object.entries(patterns).forEach(([name, found]) => {
      if (found) {
        console.log(`      ✓ ${name}`);
      }
    });

    // Try to find function definitions
    const functionMatches = script.match(/function\s+\w+\s*\([^)]*\)/g);
    if (functionMatches) {
      console.log(`    Functions defined: ${functionMatches.length}`);
    }
  }
}

const extractor = new DecoderExtractor();
extractor.run().catch(console.error);
