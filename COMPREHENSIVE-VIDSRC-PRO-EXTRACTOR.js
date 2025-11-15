/**
 * VIDSRC PRO - COMPREHENSIVE PURE FETCH EXTRACTOR
 * Tries multiple decoding methods to extract M3U8 URL
 */

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

function caesarDecode(str, shift) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    
    // Lowercase letters only
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    // Uppercase letters only
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    }
    
    return char;
  }).join('');
}

async function extractVidsrcPro(type, tmdbId, season, episode) {
  console.log('\n🎯 VIDSRC PRO - COMPREHENSIVE EXTRACTION\n');
  
  // Step 1: Get data hash
  const embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`;
  console.log('Step 1: Fetching embed page...');
  
  const embedResp = await fetch(embedUrl);
  const $ = cheerio.load(embedResp.data);
  const dataHash = $('[data-hash]').first().attr('data-hash');
  
  if (!dataHash) {
    throw new Error('Data hash not found');
  }
  
  console.log('✅ Data hash found');
  
  // Step 2: Get ProRCP URL
  console.log('\nStep 2: Getting ProRCP URL...');
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
  if (!iframeSrcMatch) {
    throw new Error('ProRCP iframe not found');
  }
  
  const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
  console.log('✅ ProRCP URL found');
  
  // Step 3: Get ProRCP page
  console.log('\nStep 3: Fetching ProRCP page...');
  const proRcpResp = await fetch(proRcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const $$ = cheerio.load(proRcpResp.data);
  
  // Step 4: Try to find encoded data in divs
  console.log('\nStep 4: Searching for encoded data...\n');
  
  let result = null;
  
  $$('div').each((i, elem) => {
    const id = $$(elem).attr('id');
    const content = $$(elem).html() ? $$(elem).html().trim() : '';
    
    // Skip divs with HTML content
    if (!id || !content || content.includes('<') || content.length < 50) {
      return;
    }
    
    console.log(`Found div #${id} with ${content.length} chars`);
    console.log(`Sample: ${content.substring(0, 80)}...`);
    
    // Method 1: Caesar cipher (for URLs like eqqmp://)
    if (content.includes('://')) {
      console.log('  Trying Caesar cipher...');
      const decoded = caesarDecode(content, 3);
      if (decoded.startsWith('https://') || decoded.startsWith('http://')) {
        console.log('  ✅ SUCCESS with Caesar +3!');
        result = decoded;
        return false;
      }
    }
    
    // Method 2: Hex decode
    if (/^[0-9a-f:]+$/i.test(content)) {
      console.log('  Trying hex decode...');
      try {
        const parts = content.split(':');
        for (const part of parts) {
          if (part.length > 20) {
            const decoded = Buffer.from(part, 'hex').toString('utf8');
            if (decoded.includes('.m3u8') || decoded.includes('http')) {
              console.log('  ✅ SUCCESS with hex decode!');
              result = decoded;
              return false;
            }
          }
        }
      } catch (e) {}
    }
    
    // Method 3: Base64 decode (including URL-safe)
    if (/^[A-Za-z0-9+\/=_-]+$/.test(content)) {
      console.log('  Trying base64 decode...');
      try {
        // Convert URL-safe base64 to standard base64
        const standardBase64 = content.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(standardBase64, 'base64');
        
        // Check for gzip
        if (decoded[0] === 0x1f && decoded[1] === 0x8b) {
          console.log('  Found gzip, decompressing...');
          const decompressed = zlib.gunzipSync(decoded).toString('utf8');
          if (decompressed.includes('.m3u8') || decompressed.includes('http')) {
            console.log('  ✅ SUCCESS with base64 + gzip!');
            result = decompressed;
            return false;
          }
        }
        
        const utf8 = decoded.toString('utf8');
        if (utf8.includes('.m3u8') || utf8.includes('http')) {
          console.log('  ✅ SUCCESS with base64!');
          result = utf8;
          return false;
        }
      } catch (e) {}
    }
    
    console.log('  No match\n');
  });
  
  if (!result) {
    throw new Error('Could not decode data with any method');
  }
  
  console.log('\n🎉 FINAL M3U8 URL:');
  console.log(result);
  
  return result;
}

// Test
if (require.main === module) {
  const [,, type, tmdbId, season, episode] = process.argv;
  
  if (!type || !tmdbId) {
    console.log('Usage: node COMPREHENSIVE-VIDSRC-PRO-EXTRACTOR.js <type> <tmdbId> [season] [episode]');
    console.log('Example: node COMPREHENSIVE-VIDSRC-PRO-EXTRACTOR.js movie 550');
    process.exit(1);
  }
  
  extractVidsrcPro(type, tmdbId, season, episode)
    .then(() => {
      console.log('\n✅ EXTRACTION COMPLETE!');
    })
    .catch(error => {
      console.error('\n❌ ERROR:', error.message);
      process.exit(1);
    });
}

module.exports = { extractVidsrcPro };
