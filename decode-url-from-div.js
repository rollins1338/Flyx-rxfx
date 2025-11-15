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

async function extractM3U8() {
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
  
  // Find divs with encoded URLs
  console.log('\n=== EXTRACTING ENCODED URL ===\n');
  
  let encodedUrl = null;
  let divId = null;
  
  $$('div').each((i, elem) => {
    const id = $$(elem).attr('id');
    const content = $$(elem).html() ? $$(elem).html().trim() : '';
    
    // Look for content that looks like an encoded URL
    if (content && content.length > 100 && !content.includes('<') && !content.includes('>')) {
      // Check if it looks like encoded data
      if (content.match(/^[a-zA-Z0-9\/\.\{\}]+$/)) {
        encodedUrl = content;
        divId = id;
        return false; // Stop iteration
      }
    }
  });
  
  if (!encodedUrl) {
    throw new Error('Encoded URL not found in page');
  }
  
  console.log(`Found encoded URL in div #${divId}:`);
  console.log(encodedUrl.substring(0, 100) + '...\n');
  
  // Try different Caesar cipher shifts
  console.log('Trying Caesar cipher shifts...\n');
  
  for (let shift = -25; shift <= 25; shift++) {
    if (shift === 0) continue;
    
    const decoded = caesarDecode(encodedUrl, shift);
    
    if (decoded.startsWith('https://') || decoded.startsWith('http://')) {
      console.log(`✅ SUCCESS with shift ${shift}:`);
      console.log(decoded);
      return decoded;
    }
  }
  
  // Try ROT13
  console.log('\nTrying ROT13...');
  const rot13 = caesarDecode(encodedUrl, 13);
  if (rot13.startsWith('https://') || rot13.startsWith('http://')) {
    console.log('✅ SUCCESS with ROT13:');
    console.log(rot13);
    return rot13;
  }
  
  // Try character substitution
  console.log('\nTrying character substitution...');
  // eqqmp:// -> https://
  // e->h (+3), q->t (+3), q->t (+3), m->p (+3), p->s (+3)
  const decoded = caesarDecode(encodedUrl, -3);
  console.log('Shift -3:');
  console.log(decoded);
  
  return decoded;
}

function caesarDecode(str, shift) {
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
    // Numbers
    if (code >= 48 && code <= 57) {
      return String.fromCharCode(((code - 48 + shift + 10) % 10) + 48);
    }
    
    return char;
  }).join('');
}

extractM3U8()
  .then(url => {
    console.log('\n🎉 FINAL M3U8 URL:');
    console.log(url);
  })
  .catch(console.error);
