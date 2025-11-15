const https = require('https');
const cheerio = require('cheerio');
const zlib = require('zlib');

async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    https.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': options.referer || '',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data }));
    }).on('error', reject).end();
  });
}

async function decodeFromDiv() {
  const tmdbId = '550';
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  console.log('Fetching embed page...');
  const embedResp = await fetch(embedUrl);
  const $ = cheerio.load(embedResp.data);
  const dataHash = $('[data-hash]').first().attr('data-hash');
  
  console.log('Getting RCP URL...');
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
  const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
  
  console.log('\nFetching ProRCP page...');
  const proRcpResp = await fetch(proRcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const $$ = cheerio.load(proRcpResp.data);
  
  // Find all divs and look for hex data
  console.log('\n=== SEARCHING FOR HEX DATA ===\n');
  
  $$('div').each((i, elem) => {
    const id = $$(elem).attr('id');
    const content = $$(elem).html() ? $$(elem).html().trim() : '';
    
    if (id) {
      console.log(`Div #${id}: ${content.substring(0, 150)}`);
    }
    
    if (content && content.length > 50 && /^[a-f0-9]+$/i.test(content)) {
      console.log(`Found hex data in div #${id}:`);
      console.log(`Length: ${content.length}`);
      console.log(`Sample: ${content.substring(0, 100)}...\n`);
      
      // Try to decode it
      console.log('Attempting to decode...');
      
      try {
        const buffer = Buffer.from(content, 'hex');
        console.log(`Decoded buffer length: ${buffer.length}`);
        console.log(`First 20 bytes (hex): ${buffer.slice(0, 20).toString('hex')}`);
        
        // Check for gzip
        if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
          console.log('✅ GZIP DETECTED! Decompressing...');
          const decompressed = zlib.gunzipSync(buffer);
          console.log('\n🎉 SUCCESS:');
          console.log(decompressed.toString('utf8'));
          return false; // Stop iteration
        }
        
        // Try as UTF-8
        const utf8 = buffer.toString('utf8');
        if (utf8.includes('.m3u8') || utf8.includes('http')) {
          console.log('\n🎉 SUCCESS (UTF-8):');
          console.log(utf8);
          return false;
        }
        
        console.log('UTF-8 sample:', utf8.substring(0, 100));
        
      } catch (e) {
        console.log('Error:', e.message);
      }
      
      console.log('---\n');
    }
  });
}

decodeFromDiv().catch(console.error);
