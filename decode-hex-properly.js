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

async function decodeProRcp() {
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
  
  const proRcpHashMatch = proRcpUrl.match(/\/prorcp\/([^?]+)/);
  const proRcpHash = proRcpHashMatch[1];
  
  console.log('\n=== DECODING CHAIN ===\n');
  
  // Step 1: Base64 decode
  console.log('Step 1: Base64 decode');
  const base64Decoded = Buffer.from(proRcpHash, 'base64').toString('utf8');
  console.log('Result:', base64Decoded.substring(0, 100) + '...');
  
  // Step 2: Split by colon
  console.log('\nStep 2: Split by colon');
  const parts = base64Decoded.split(':');
  console.log('Part 1 (key?):', parts[0]);
  console.log('Part 2 length:', parts[1].length);
  console.log('Part 2 sample:', parts[1].substring(0, 100));
  
  // Step 3: Hex decode part 1
  console.log('\nStep 3: Hex decode part 1');
  const keyBuffer = Buffer.from(parts[0], 'hex');
  console.log('Key (hex):', keyBuffer.toString('hex'));
  console.log('Key (utf8):', keyBuffer.toString('utf8'));
  console.log('Key (base64):', keyBuffer.toString('base64'));
  
  // Step 4: Base64 decode part 2
  console.log('\nStep 4: Base64 decode part 2');
  const encryptedData = Buffer.from(parts[1], 'base64');
  console.log('Encrypted data length:', encryptedData.length);
  console.log('First 20 bytes (hex):', encryptedData.slice(0, 20).toString('hex'));
  
  // Check for gzip
  if (encryptedData[0] === 0x1f && encryptedData[1] === 0x8b) {
    console.log('\n✅ GZIP DETECTED! Decompressing...');
    const decompressed = zlib.gunzipSync(encryptedData);
    console.log('Decompressed:', decompressed.toString('utf8'));
    return;
  }
  
  // Step 5: Try RC4 decryption with the hex-decoded key
  console.log('\nStep 5: RC4 decryption with hex key');
  const key = keyBuffer.toString('utf8');
  
  // RC4
  const S = [];
  for (let i = 0; i < 256; i++) S[i] = i;
  
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  let i = 0;
  j = 0;
  const result = Buffer.alloc(encryptedData.length);
  
  for (let n = 0; n < encryptedData.length; n++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    
    const K = S[(S[i] + S[j]) % 256];
    result[n] = encryptedData[n] ^ K;
  }
  
  console.log('RC4 result length:', result.length);
  console.log('First 20 bytes (hex):', result.slice(0, 20).toString('hex'));
  
  // Check if result is gzipped
  if (result[0] === 0x1f && result[1] === 0x8b) {
    console.log('\n✅ GZIP DETECTED after RC4! Decompressing...');
    const decompressed = zlib.gunzipSync(result);
    console.log('\n🎉 FINAL RESULT:');
    console.log(decompressed.toString('utf8'));
  } else {
    console.log('\nRC4 result (utf8):', result.toString('utf8'));
  }
}

decodeProRcp().catch(console.error);
