/**
 * VIDSRC PRO - PURE FETCH IMPLEMENTATION
 * Extracted RC4 and base64 decoder from obfuscated code
 */

const https = require('https');
const cheerio = require('cheerio');

// Custom base64 decoder (extracted from obfuscated code)
function customBase64Decode(input) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
  let output = '';
  let decodedOutput = '';
  
  for (let i = 0, enc1, enc2, enc3, enc4; i < input.length;) {
    enc1 = alphabet.indexOf(input.charAt(i++));
    enc2 = alphabet.indexOf(input.charAt(i++));
    enc3 = alphabet.indexOf(input.charAt(i++));
    enc4 = alphabet.indexOf(input.charAt(i++));
    
    if (~enc1) {
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      
      if (enc3 !== 64) {
        output += String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output += String.fromCharCode(chr3);
      }
    }
  }
  
  // Decode URI component
  for (let i = 0; i < output.length; i++) {
    decodedOutput += '%' + ('00' + output.charCodeAt(i).toString(16)).slice(-2);
  }
  
  return decodeURIComponent(decodedOutput);
}

// RC4 cipher (extracted from obfuscated code)
function rc4Decrypt(data, key) {
  // First decode the data with custom base64
  data = customBase64Decode(data);
  
  // Initialize S-box
  const S = [];
  for (let i = 0; i < 256; i++) {
    S[i] = i;
  }
  
  // KSA (Key Scheduling Algorithm)
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  // PRGA (Pseudo-Random Generation Algorithm)
  let i = 0;
  j = 0;
  let result = '';
  
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    
    const K = S[(S[i] + S[j]) % 256];
    result += String.fromCharCode(data.charCodeAt(n) ^ K);
  }
  
  return result;
}

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
  
  console.log('✅ Data hash:', dataHash.substring(0, 50) + '...');
  
  // Step 2: Get ProRCP URL
  console.log('\nStep 2: Getting ProRCP URL...');
  const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
  const rcpResp = await fetch(rcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  const iframeSrcMatch = rcpResp.data.match(/src:\s*['"]([^'"]+)['"]/);
  if (!iframeSrcMatch) {
    throw new Error('ProRCP iframe not found');
  }
  
  const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
  console.log('✅ ProRCP URL:', proRcpUrl.substring(0, 80) + '...');
  
  // Step 3: Get ProRCP page and extract encoded data
  console.log('\nStep 3: Fetching ProRCP page...');
  const proRcpResp = await fetch(proRcpUrl, { referer: 'https://vidsrc-embed.ru/' });
  
  // The encoded data is in the ProRCP URL itself!
  // Extract the hash from the URL: /prorcp/{hash}
  const proRcpHashMatch = proRcpUrl.match(/\/prorcp\/([^?]+)/);
  if (!proRcpHashMatch) {
    throw new Error('ProRCP hash not found in URL');
  }
  
  const proRcpHash = proRcpHashMatch[1];
  console.log('✅ ProRCP hash:', proRcpHash.substring(0, 50) + '...');
  
  // Step 4: Decode the hash
  console.log('\nStep 4: Decoding hash...');
  
  // The hash is base64 encoded, decode it
  const decodedHash = Buffer.from(proRcpHash, 'base64').toString('utf8');
  console.log('Decoded hash:', decodedHash.substring(0, 100));
  
  // The decoded hash contains: {something}:{encoded_data}
  const parts = decodedHash.split(':');
  if (parts.length < 2) {
    throw new Error('Invalid hash format');
  }
  
  const encodedData = parts[1];
  console.log('Encoded data length:', encodedData.length);
  console.log('Encoded data sample:', encodedData.substring(0, 100));
  
  // The encoded data is base64, decode it first
  let base64Decoded = Buffer.from(encodedData, 'base64').toString('utf8');
  console.log('Base64 decoded length:', base64Decoded.length);
  console.log('Base64 decoded sample:', base64Decoded.substring(0, 100));
  
  // Check if it's ANOTHER base64 layer
  if (/^[A-Za-z0-9+\/=]+$/.test(base64Decoded)) {
    console.log('Detected another base64 layer, decoding...');
    try {
      const secondDecode = Buffer.from(base64Decoded, 'base64').toString('utf8');
      console.log('Second decode length:', secondDecode.length);
      console.log('Second decode sample:', secondDecode.substring(0, 100));
      
      if (secondDecode.includes('.m3u8') || secondDecode.includes('http')) {
        console.log('\n✅ SUCCESS! M3U8 URL found after double base64:');
        console.log(secondDecode);
        return secondDecode;
      }
      
      base64Decoded = secondDecode;
    } catch (e) {
      console.log('Second decode failed:', e.message);
    }
  }
  
  // Check if it's already the M3U8 URL
  if (base64Decoded.includes('.m3u8') || base64Decoded.includes('http')) {
    console.log('\n✅ SUCCESS! M3U8 URL found after base64 decode:');
    console.log(base64Decoded);
    return base64Decoded;
  }
  
  // Step 5: Try RC4 decryption
  console.log('\nStep 5: Trying RC4 decryption...');
  
  // Extract more potential keys
  const hashPart1 = parts[0];
  const hashPart2 = parts[1];
  
  const possibleKeys = [
    hashPart1,
    hashPart2,
    dataHash,
    Buffer.from(dataHash, 'base64').toString('utf8'),
    tmdbId.toString(),
    proRcpHash,
    Buffer.from(proRcpHash, 'base64').toString('utf8').split(':')[0],
    'vidsrc',
    'prorcp',
    'cloudnestra',
    // Try the hash part as hex
    hashPart1.substring(0, 16),
    hashPart1.substring(0, 32),
    // Try reversed
    hashPart1.split('').reverse().join(''),
    // Try combinations
    hashPart1 + tmdbId,
    tmdbId + hashPart1
  ];
  
  for (const key of possibleKeys) {
    try {
      console.log(`Trying RC4 with key: ${key.substring(0, 20)}...`);
      
      // RC4 decrypt the base64 decoded data
      const S = [];
      for (let i = 0; i < 256; i++) S[i] = i;
      
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
        [S[i], S[j]] = [S[j], S[i]];
      }
      
      let i = 0;
      j = 0;
      let result = '';
      
      for (let n = 0; n < base64Decoded.length; n++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;
        [S[i], S[j]] = [S[j], S[i]];
        
        const K = S[(S[i] + S[j]) % 256];
        result += String.fromCharCode(base64Decoded.charCodeAt(n) ^ K);
      }
      
      if (result.includes('.m3u8') || result.includes('http')) {
        console.log('\n✅ SUCCESS! Found M3U8 URL:');
        console.log(result);
        return result;
      }
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }
  }
  
  throw new Error('Could not decrypt data with any key');
}

// Test
if (require.main === module) {
  const [,, type, tmdbId, season, episode] = process.argv;
  
  if (!type || !tmdbId) {
    console.log('Usage: node VIDSRC-PRO-PURE-FETCH-FINAL.js <type> <tmdbId> [season] [episode]');
    console.log('Example: node VIDSRC-PRO-PURE-FETCH-FINAL.js movie 550');
    process.exit(1);
  }
  
  extractVidsrcPro(type, tmdbId, season, episode)
    .then(url => {
      console.log('\n🎉 EXTRACTION COMPLETE!');
      console.log('M3U8 URL:', url);
    })
    .catch(error => {
      console.error('\n❌ ERROR:', error.message);
      process.exit(1);
    });
}

module.exports = { extractVidsrcPro, rc4Decrypt, customBase64Decode };
