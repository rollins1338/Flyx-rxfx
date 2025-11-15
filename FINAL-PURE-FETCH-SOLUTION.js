const https = require('https');
const cheerio = require('cheerio');

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

function caesarDecodeLettersOnly(str, shift) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    
    // Lowercase letters
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    // Uppercase letters
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    }
    
    // Leave everything else unchanged
    return char;
  }).join('');
}

async function extractVidsrcPro(type, tmdbId, season, episode) {
  console.log('\n🎯 VIDSRC PRO - PURE FETCH EXTRACTION\n');
  
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
  
  // Step 3: Get ProRCP page and extract encoded URL from div
  console.log('\nStep 3: Fetching ProRCP page...');
  const proRcpResp = await fetch(proRcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const $$ = cheerio.load(proRcpResp.data);
  
  // Find div with encoded URL
  let encodedUrl = null;
  
  $$('div').each((i, elem) => {
    const id = $$(elem).attr('id');
    const content = $$(elem).html() ? $$(elem).html().trim() : '';
    
    // Look for divs with IDs that contain only alphanumeric content (no HTML)
    if (id && content && content.length > 100 && !content.includes('<')) {
      console.log(`Div #${id}: ${content.substring(0, 100)}`);
      
      // Check if it contains :// pattern
      if (content.includes('://')) {
        encodedUrl = content;
        console.log(`✅ Found encoded URL in div #${id}`);
        return false; // Stop iteration
      }
    }
  });
  
  if (!encodedUrl) {
    throw new Error('Encoded URL not found in page');
  }
  
  console.log('✅ Found encoded URL');
  console.log('Sample:', encodedUrl.substring(0, 50) + '...');
  
  // Step 4: Decode with Caesar cipher (shift +3 for letters only)
  console.log('\nStep 4: Decoding URL...');
  
  // eqqmp:// -> https:// means we need to shift by +3
  const decoded = caesarDecodeLettersOnly(encodedUrl, 3);
  
  if (!decoded.startsWith('https://') && !decoded.startsWith('http://')) {
    throw new Error('Decoded URL does not start with http(s)://');
  }
  
  console.log('\n✅ SUCCESS! M3U8 URL:');
  console.log(decoded);
  
  return decoded;
}

// Test
if (require.main === module) {
  const [,, type, tmdbId, season, episode] = process.argv;
  
  if (!type || !tmdbId) {
    console.log('Usage: node FINAL-PURE-FETCH-SOLUTION.js <type> <tmdbId> [season] [episode]');
    console.log('Example: node FINAL-PURE-FETCH-SOLUTION.js movie 550');
    process.exit(1);
  }
  
  extractVidsrcPro(type, tmdbId, season, episode)
    .then(url => {
      console.log('\n🎉 EXTRACTION COMPLETE!');
    })
    .catch(error => {
      console.error('\n❌ ERROR:', error.message);
      process.exit(1);
    });
}

module.exports = { extractVidsrcPro };
