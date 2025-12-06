/**
 * Attempt to bypass Turnstile by extracting data from the RCP hash itself
 * 
 * Theory: The RCP hash structure is base64(MD5:base64(encrypted_data))
 * The encrypted data might contain the ProRCP path or stream URLs directly
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const crypto = require('crypto');

function decodeB64(str: string): Buffer {
  let clean = str.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  return Buffer.from(clean, 'base64');
}

function decodeB64Str(str: string): string {
  return decodeB64(str).toString('utf8');
}

// XOR decrypt with various keys
function xorDecrypt(data: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// RC4 decrypt
function rc4Decrypt(key: Buffer, data: Buffer): Buffer {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  const result = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    result[k] = data[k] ^ S[(S[i] + S[j]) % 256];
  }
  return result;
}

// AES decrypt attempt
function tryAesDecrypt(data: Buffer, key: string, iv?: Buffer): string | null {
  const algorithms = ['aes-128-cbc', 'aes-256-cbc', 'aes-128-ecb'];
  
  for (const algo of algorithms) {
    try {
      const keyLen = algo.includes('256') ? 32 : 16;
      const keyBuf = Buffer.from(key.padEnd(keyLen, '\0').substring(0, keyLen));
      
      let decipher;
      if (algo.includes('ecb')) {
        decipher = crypto.createDecipheriv(algo, keyBuf, null);
      } else {
        const ivBuf = iv || Buffer.alloc(16, 0);
        decipher = crypto.createDecipheriv(algo, keyBuf, ivBuf);
      }
      decipher.setAutoPadding(false);
      
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      const str = decrypted.toString('utf8');
      
      if (str.includes('https://') || str.includes('.m3u8') || str.includes('tmstr')) {
        return str;
      }
    } catch {}
  }
  return null;
}

async function analyzeRcpHash(rcpHash: string, tmdbId: string) {
  console.log('='.repeat(70));
  console.log('ANALYZING RCP HASH FOR TURNSTILE BYPASS');
  console.log('='.repeat(70));
  
  console.log(`\nRCP Hash length: ${rcpHash.length}`);
  console.log(`RCP Hash preview: ${rcpHash.substring(0, 80)}...`);
  
  // Decode level 1
  const level1 = decodeB64Str(rcpHash);
  console.log(`\nLevel 1 decoded: ${level1.substring(0, 100)}...`);
  
  // Split by colon
  const parts = level1.split(':');
  if (parts.length !== 2) {
    console.log('Unexpected structure - not MD5:DATA format');
    return null;
  }
  
  const [md5Hash, dataB64] = parts;
  console.log(`\nMD5 hash: ${md5Hash}`);
  console.log(`Data (base64) length: ${dataB64.length}`);
  
  // Decode level 2
  const level2 = decodeB64Str(dataB64);
  console.log(`Level 2 decoded length: ${level2.length}`);
  console.log(`Level 2 preview: ${level2.substring(0, 80)}...`);
  
  // Try to decode level 3
  let level3: Buffer;
  try {
    level3 = decodeB64(level2);
    console.log(`Level 3 (binary) length: ${level3.length} bytes`);
  } catch {
    console.log('Level 3 decode failed - level 2 is not base64');
    level3 = Buffer.from(level2, 'binary');
  }
  
  // Try various decryption methods
  console.log('\n' + '='.repeat(50));
  console.log('TRYING DECRYPTION METHODS');
  console.log('='.repeat(50));
  
  // Possible keys
  const keys = [
    tmdbId,
    md5Hash,
    md5Hash.substring(0, 16),
    crypto.createHash('md5').update(tmdbId).digest('hex'),
    crypto.createHash('md5').update(tmdbId).digest('hex').substring(0, 16),
    'cloudnestra',
    'vidsrc',
    'prorcp',
    'srcrcp',
  ];
  
  // Try XOR
  console.log('\n[XOR Decryption]');
  for (const key of keys) {
    const keyBuf = Buffer.from(key);
    const result = xorDecrypt(level3, keyBuf);
    const str = result.toString('utf8');
    if (str.includes('https://') || str.includes('.m3u8')) {
      console.log(`*** XOR SUCCESS with key: ${key} ***`);
      console.log(str.substring(0, 200));
      return str;
    }
  }
  
  // Try RC4
  console.log('\n[RC4 Decryption]');
  for (const key of keys) {
    const keyBuf = Buffer.from(key);
    const result = rc4Decrypt(keyBuf, level3);
    const str = result.toString('utf8');
    if (str.includes('https://') || str.includes('.m3u8')) {
      console.log(`*** RC4 SUCCESS with key: ${key} ***`);
      console.log(str.substring(0, 200));
      return str;
    }
  }
  
  // Try AES
  console.log('\n[AES Decryption]');
  for (const key of keys) {
    const result = tryAesDecrypt(level3, key);
    if (result) {
      console.log(`*** AES SUCCESS with key: ${key} ***`);
      console.log(result.substring(0, 200));
      return result;
    }
    
    // Try with first 16 bytes as IV
    const result2 = tryAesDecrypt(level3.subarray(16), key, level3.subarray(0, 16));
    if (result2) {
      console.log(`*** AES SUCCESS with key: ${key} (IV from data) ***`);
      console.log(result2.substring(0, 200));
      return result2;
    }
  }
  
  console.log('\n*** ALL DECRYPTION METHODS FAILED ***');
  console.log('The RCP hash is encrypted with a server-side key we cannot access.');
  return null;
}

async function main() {
  const TMDB_ID = '550'; // Fight Club
  
  console.log('Fetching embed page...');
  const embedRes = await fetch(`https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`, {
    headers: { 'User-Agent': UA }
  });
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) {
    console.log('No RCP hash found');
    return;
  }
  
  const rcpHash = rcpMatch[1];
  await analyzeRcpHash(rcpHash, TMDB_ID);
  
  console.log('\n' + '='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  console.log(`
The RCP hash contains encrypted data that requires a server-side private key.
When Turnstile appears, the server won't give us the ProRCP hash without solving it.

ALTERNATIVE APPROACHES:
1. Use a Turnstile solving service (CapSolver, 2Captcha, etc.)
2. Use a headless browser with stealth plugins (Puppeteer + puppeteer-extra-plugin-stealth)
3. Use a residential proxy to avoid Turnstile triggering
4. Cache successful extractions to reduce requests
5. Implement request rate limiting to avoid triggering Turnstile
`);
}

main().catch(console.error);
