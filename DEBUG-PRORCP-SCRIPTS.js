/**
 * Debug script to see what scripts are on the ProRCP page
 */

const https = require('https');
const cheerio = require('cheerio');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': options.referer || '',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, statusCode: res.statusCode }));
    });

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    // Step 1: Get data-hash
    console.log('Step 1: Getting data-hash...');
    const embedResp = await fetch('https://vidsrc.xyz/embed/movie/550');
    const $ = cheerio.load(embedResp.data);
    const dataHash = $('[data-hash]').first().attr('data-hash');
    if (!dataHash) {
      console.log('Data hash not found!');
      console.log('Page content:', embedResp.data.substring(0, 500));
      return;
    }
    console.log('Data hash:', dataHash.substring(0, 50) + '...\n');

    // Step 2: Get ProRCP URL
    console.log('Step 2: Getting ProRCP URL...');
    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    const rcpResp = await fetch(rcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
    const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
    console.log('ProRCP URL:', proRcpUrl.substring(0, 80) + '...\n');

    // Step 3: Get ProRCP page and analyze scripts
    console.log('Step 3: Analyzing ProRCP page scripts...\n');
    const proRcpResp = await fetch(proRcpUrl, { 
      referer: 'https://vidsrc-embed.ru/',
      headers: { 'Origin': 'https://vidsrc-embed.ru' }
    });
    
    const $$ = cheerio.load(proRcpResp.data);
    
    console.log('='.repeat(80));
    console.log('ALL SCRIPT TAGS:');
    console.log('='.repeat(80));
    
    $$('script').each((i, elem) => {
      const src = $$(elem).attr('src');
      const content = $$(elem).html();
      
      console.log(`\nScript ${i + 1}:`);
      if (src) {
        console.log('  Type: External');
        console.log('  Src:', src);
      } else {
        console.log('  Type: Inline');
        console.log('  Length:', content ? content.length : 0);
        if (content && content.length < 500) {
          console.log('  Content:', content.substring(0, 200));
        } else if (content) {
          console.log('  Content (first 200 chars):', content.substring(0, 200));
        }
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('EXTERNAL SCRIPTS ONLY:');
    console.log('='.repeat(80));
    
    const externalScripts = [];
    $$('script[src]').each((i, elem) => {
      const src = $$(elem).attr('src');
      externalScripts.push(src);
      console.log(`${i + 1}. ${src}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('LOOKING FOR DECODER PATTERNS:');
    console.log('='.repeat(80));
    
    externalScripts.forEach((src, i) => {
      console.log(`\nScript ${i + 1}: ${src}`);
      
      // Pattern 1: /[random]/[hash].js
      if (src.match(/^\/[a-zA-Z0-9]+\/[a-f0-9]{32}\.js$/)) {
        console.log('  ✅ Matches pattern: /[random]/[hash].js');
      }
      
      // Pattern 2: Any path with hash
      if (src.match(/[a-f0-9]{32}/)) {
        console.log('  ✅ Contains MD5 hash');
      }
      
      // Pattern 3: Relative path starting with /
      if (src.startsWith('/') && !src.startsWith('//')) {
        console.log('  ✅ Relative path (likely decoder)');
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
