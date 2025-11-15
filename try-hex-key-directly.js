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
  
  console.log('\n=== DECODING ===\n');
  
  // Base64 decode
  const base64Decoded = Buffer.from(proRcpHash, 'base64').toString('utf8');
  const parts = base64Decoded.split(':');
  
  const hexKey = parts[0]; // Keep as hex string
  const encryptedData = Buffer.from(parts[1], 'base64');
  
  console.log('Hex key:', hexKey);
  console.log('Encrypted data length:', encryptedData.length);
  
  // Try RC4 with hex key as string
  console.log('\nTrying RC4 with hex key as string...');
  let result = rc4(encryptedData, hexKey);
  
  if (result[0] === 0x1f && result[1] === 0x8b) {
    console.log('✅ GZIP DETECTED! Decompressing...');
    const decompressed = zlib.gunzipSync(result);
    console.log('\n🎉 SUCCESS:');
    console.log(decompressed.toString('utf8'));
    return;
  }
  
  console.log('Result sample:', result.slice(0, 50).toString('utf8'));
  
  // Try with reversed key
  console.log('\nTrying RC4 with reversed hex key...');
  result = rc4(encryptedData, hexKey.split('').reverse().join(''));
  
  if (result[0] === 0x1f && result[1] === 0x8b) {
    console.log('✅ GZIP DETECTED! Decompressing...');
    const decompressed = zlib.gunzipSync(result);
    console.log('\n🎉 SUCCESS:');
    console.log(decompressed.toString('utf8'));
    return;
  }
  
  // Try with uppercase
  console.log('\nTrying RC4 with uppercase hex key...');
  result = rc4(encryptedData, hexKey.toUpperCase());
  
  if (result[0] === 0x1f && result[1] === 0x8b) {
    console.log('✅ GZIP DETECTED! Decompressing...');
    const decompressed = zlib.gunzipSync(result);
    console.log('\n🎉 SUCCESS:');
    console.log(decompressed.toString('utf8'));
    return;
  }
  
  // Maybe the encrypted data itself is hex-encoded?
  console.log('\nTrying to hex-decode the encrypted data first...');
  const hexDecodedData = Buffer.from(parts[1], 'hex');
  console.log('Hex decoded data length:', hexDecodedData.length);
  
  result = rc4(hexDecodedData, hexKey);
  
  if (result[0] === 0x1f && result[1] === 0x8b) {
    console.log('✅ GZIP DETECTED! Decompressing...');
    const decompressed = zlib.gunzipSync(result);
    console.log('\n🎉 SUCCESS:');
    console.log(decompressed.toString('utf8'));
    return;
  }
  
  console.log('Result sample:', result.slice(0, 50).toString('utf8'));
}

function rc4(data, key) {
  const S = [];
  for (let i = 0; i < 256; i++) S[i] = i;
  
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  let i = 0;
  j = 0;
  const result = Buffer.alloc(data.length);
  
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    
    const K = S[(S[i] + S[j]) % 256];
    result[n] = data[n] ^ K;
  }
  
  return result;
}

decodeProRcp().catch(console.error);
