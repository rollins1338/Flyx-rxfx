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

async function analyzeHash() {
  const tmdbId = '550';
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${tmdbId}`;
  
  console.log('Fetching embed page...');
  const embedResp = await fetch(embedUrl);
  const $ = cheerio.load(embedResp.data);
  const dataHash = $('[data-hash]').first().attr('data-hash');
  
  console.log('\n=== DATA HASH ===');
  console.log('Length:', dataHash.length);
  console.log('First 100 chars:', dataHash.substring(0, 100));
  console.log('Last 100 chars:', dataHash.substring(dataHash.length - 100));
  
  console.log('\n=== GETTING RCP URL ===');
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
  const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
  
  const proRcpHashMatch = proRcpUrl.match(/\/prorcp\/([^?]+)/);
  const proRcpHash = proRcpHashMatch[1];
  
  console.log('\n=== PRORCP HASH ===');
  console.log('Length:', proRcpHash.length);
  console.log('First 100 chars:', proRcpHash.substring(0, 100));
  
  console.log('\n=== DECODING ATTEMPTS ===');
  
  // Attempt 1: Direct base64 decode
  console.log('\n1. Direct base64 decode:');
  try {
    const decoded = Buffer.from(proRcpHash, 'base64');
    console.log('  Buffer length:', decoded.length);
    console.log('  First 20 bytes (hex):', decoded.slice(0, 20).toString('hex'));
    console.log('  First 20 bytes (utf8):', decoded.slice(0, 20).toString('utf8'));
    
    // Check for gzip magic bytes
    if (decoded[0] === 0x1f && decoded[1] === 0x8b) {
      console.log('  ✅ GZIP DETECTED!');
      const decompressed = zlib.gunzipSync(decoded);
      console.log('  Decompressed length:', decompressed.length);
      console.log('  Decompressed:', decompressed.toString('utf8'));
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Attempt 2: URL-safe base64
  console.log('\n2. URL-safe base64 decode:');
  try {
    const urlSafe = proRcpHash.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64');
    console.log('  Buffer length:', decoded.length);
    console.log('  First 20 bytes (hex):', decoded.slice(0, 20).toString('hex'));
    
    if (decoded[0] === 0x1f && decoded[1] === 0x8b) {
      console.log('  ✅ GZIP DETECTED!');
      const decompressed = zlib.gunzipSync(decoded);
      console.log('  Decompressed length:', decompressed.length);
      console.log('  Decompressed:', decompressed.toString('utf8'));
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Attempt 3: Check if it's hex-encoded
  console.log('\n3. Hex decode:');
  try {
    const hexDecoded = Buffer.from(proRcpHash, 'hex');
    console.log('  Buffer length:', hexDecoded.length);
    console.log('  First 20 bytes:', hexDecoded.slice(0, 20).toString('utf8'));
    
    if (hexDecoded[0] === 0x1f && hexDecoded[1] === 0x8b) {
      console.log('  ✅ GZIP DETECTED!');
      const decompressed = zlib.gunzipSync(hexDecoded);
      console.log('  Decompressed:', decompressed.toString('utf8'));
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
  
  // Attempt 4: Double base64
  console.log('\n4. Double base64 decode:');
  try {
    const first = Buffer.from(proRcpHash, 'base64').toString('utf8');
    console.log('  First decode sample:', first.substring(0, 100));
    
    const second = Buffer.from(first, 'base64');
    console.log('  Second decode length:', second.length);
    console.log('  First 20 bytes (hex):', second.slice(0, 20).toString('hex'));
    
    if (second[0] === 0x1f && second[1] === 0x8b) {
      console.log('  ✅ GZIP DETECTED!');
      const decompressed = zlib.gunzipSync(second);
      console.log('  Decompressed:', decompressed.toString('utf8'));
    }
  } catch (e) {
    console.log('  Error:', e.message);
  }
}

analyzeHash().catch(console.error);
