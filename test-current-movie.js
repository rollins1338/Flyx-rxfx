// Test with Sonic 3 - a current movie
const https = require('https');

async function fetchPage(url, referer = 'https://vidsrc-embed.ru/') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': referer
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function test() {
  const tmdbId = '1084736'; // Sonic 3
  
  console.log('Testing Sonic 3...\n');
  
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  const embedPage = await fetchPage(embedUrl);
  
  const hash = embedPage.match(/data-hash=["']([^"']+)["']/)[1];
  console.log('[1] Hash found');
  
  const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
  const rcpPage = await fetchPage(rcpUrl, embedUrl);
  
  const prorcp = rcpPage.match(/\/prorcp\/([A-Za-z0-9+\/=\-_]+)/)?.[1];
  if (!prorcp) {
    console.log('[2] No prorcp - might be Cloudflare blocked');
    return;
  }
  console.log('[2] ProRCP found');
  
  const playerUrl = `https://cloudnestra.com/prorcp/${prorcp}`;
  const playerPage = await fetchPage(playerUrl, rcpUrl);
  
  const match = playerPage.match(/<div[^>]+id="([^"]+)"[^>]*style="display:\s*none;?"[^>]*>([^<]+)<\/div>/i);
  if (!match) {
    console.log('[3] No hidden div');
    return;
  }
  
  const divId = match[1];
  const encoded = match[2];
  
  console.log('[3] DivID:', divId);
  console.log('[3] Encoded length:', encoded.length);
  console.log('[3] First 50:', encoded.substring(0, 50));
  console.log('[3] FULL ENCODED:');
  console.log(encoded);
  
  // Detect format
  const isHex = /^[0-9a-f]+$/i.test(encoded);
  const hasUppercase = /[A-Z]/.test(encoded);
  
  console.log('\n[4] Format detection:');
  console.log('    Is hex:', isHex);
  console.log('    Has uppercase:', hasUppercase);
  
  if (isHex) {
    console.log('\n[5] Trying hex-based decoders...');
    // Try hex decode
    const hexDecoded = Buffer.from(encoded, 'hex');
    console.log('    Hex decoded length:', hexDecoded.length);
    
    // Try XOR with divId
    const xored = Buffer.alloc(hexDecoded.length);
    for (let i = 0; i < hexDecoded.length; i++) {
      xored[i] = hexDecoded[i] ^ divId.charCodeAt(i % divId.length);
    }
    const xorResult = xored.toString('utf8');
    console.log('    XOR result has http:', xorResult.includes('http'));
    
    if (xorResult.includes('http')) {
      console.log('\n*** SUCCESS with Hex + XOR! ***');
      console.log(xorResult.substring(0, 200));
    }
  } else if (hasUppercase) {
    console.log('\n[5] Trying letter-based decoders...');
    // Try Caesar shifts
    for (let shift = -5; shift <= 5; shift++) {
      if (shift === 0) continue;
      const result = encoded.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
        if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
        return c;
      }).join('');
      
      if (result.includes('http')) {
        console.log(`\n*** SUCCESS with Caesar ${shift}! ***`);
        console.log(result.substring(0, 200));
        break;
      }
    }
  }
}

test().catch(console.error);
