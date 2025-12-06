/**
 * BRUTE FORCE DECRYPTION OF VIDSRC HASHES
 * Testing every possible encryption method these Russians might use
 */

const TMDB_ID = '1228246';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const crypto = require('crypto');

async function fetchPage(url: string, referer?: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers });
  return res.text();
}

function decodeB64(str: string): Buffer {
  let clean = str.replace(/--$/, '').replace(/-/g, '+').replace(/_/g, '/');
  while (clean.length % 4 !== 0) clean += '=';
  return Buffer.from(clean, 'base64');
}

function decodeB64Str(str: string): string {
  return decodeB64(str).toString('utf8');
}

// XOR decrypt
function xorDecrypt(data: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

// ROT/Caesar cipher
function rotDecrypt(str: string, shift: number): string {
  return str.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift) % 26) + 97);
    if (code >= 48 && code <= 57) return String.fromCharCode(((code - 48 + shift) % 10) + 48);
    return c;
  }).join('');
}

// Reverse string
function reverseStr(str: string): string {
  return str.split('').reverse().join('');
}

// Subtract from each char
function subtractChars(str: string, n: number): string {
  return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) - n)).join('');
}

// Check if result looks valid
function looksValid(str: string): boolean {
  // Check for URLs
  if (str.includes('http://') || str.includes('https://')) return true;
  // Check for m3u8
  if (str.includes('.m3u8')) return true;
  // Check for common video domains
  if (str.includes('cloudflare') || str.includes('cdn') || str.includes('stream')) return true;
  // Check for JSON-like structure
  if (str.includes('{"') || str.includes('":"')) return true;
  // Check for file paths
  if (str.includes('/video/') || str.includes('/movie/') || str.includes('/tv/')) return true;
  return false;
}

function looksLegible(str: string): boolean {
  // Check if mostly printable ASCII
  let printable = 0;
  for (let i = 0; i < Math.min(str.length, 100); i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) printable++;
  }
  return printable / Math.min(str.length, 100) > 0.8;
}

async function main() {
  console.log('='.repeat(80));
  console.log('BRUTE FORCE DECRYPTION');
  console.log('='.repeat(80));

  // Fetch fresh data
  const embedUrl = `https://vidsrc-embed.ru/embed/movie/${TMDB_ID}`;
  const embedHtml = await fetchPage(embedUrl);
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.error('No RCP found'); return; }
  
  const rcpHash = rcpMatch[1];
  const rcpUrl = `https://cloudnestra.com/rcp/${rcpHash}`;
  const rcpHtml = await fetchPage(rcpUrl, embedUrl);
  
  // Get timestamp from response headers or page
  const timestamp = Date.now();
  const timestampSec = Math.floor(timestamp / 1000);
  
  // Extract data-i (internal ID)
  const dataIMatch = rcpHtml.match(/data-i="(\d+)"/);
  const dataI = dataIMatch ? dataIMatch[1] : '';
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.error('No ProRCP found'); return; }
  
  const prorcpHash = prorcpMatch[1];
  
  console.log(`\nTMDB ID: ${TMDB_ID}`);
  console.log(`Internal ID (data-i): ${dataI}`);
  console.log(`Timestamp: ${timestamp} / ${timestampSec}`);
  
  // Decode the hash structure
  const rcpDecoded = decodeB64Str(rcpHash);
  const [rcpMd5, rcpDataB64] = rcpDecoded.split(':');
  const rcpDataLevel2 = decodeB64Str(rcpDataB64);
  const rcpDataLevel3 = decodeB64(rcpDataLevel2);
  
  console.log(`\nRCP MD5: ${rcpMd5}`);
  console.log(`RCP Data Level 2 (base64-like): ${rcpDataLevel2.substring(0, 80)}...`);
  console.log(`RCP Data Level 3 length: ${rcpDataLevel3.length} bytes`);
  
  // ============================================
  // TEST 1: Simple XOR with various keys
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: XOR DECRYPTION');
  console.log('='.repeat(60));
  
  const xorKeys = [
    Buffer.from(TMDB_ID),
    Buffer.from(dataI),
    Buffer.from(rcpMd5),
    Buffer.from(rcpMd5, 'hex'),
    Buffer.from('cloudnestra'),
    Buffer.from('vidsrc'),
    Buffer.from('prorcp'),
    Buffer.from(String(timestampSec)),
    Buffer.from(String(Math.floor(timestampSec / 60))), // minute
    Buffer.from(String(Math.floor(timestampSec / 3600))), // hour
    Buffer.from([0x00]),
    Buffer.from([0xFF]),
    Buffer.from([0x55]),
    Buffer.from([0xAA]),
  ];
  
  for (const key of xorKeys) {
    const result = xorDecrypt(rcpDataLevel3, key);
    const str = result.toString('utf8');
    if (looksValid(str)) {
      console.log(`\n*** XOR SUCCESS with key: ${key.toString('hex')} ***`);
      console.log(str.substring(0, 200));
    } else if (looksLegible(str)) {
      console.log(`\nXOR with ${key.toString().substring(0, 20)} -> legible: ${str.substring(0, 100)}`);
    }
  }
  
  // ============================================
  // TEST 2: ROT/Caesar cipher on Level 2 data
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: ROT/CAESAR CIPHER');
  console.log('='.repeat(60));
  
  for (let shift = 1; shift <= 25; shift++) {
    const result = rotDecrypt(rcpDataLevel2, shift);
    if (looksValid(result)) {
      console.log(`\n*** ROT${shift} SUCCESS ***`);
      console.log(result.substring(0, 200));
    }
    // Also try decoding the rotated result as base64
    try {
      const decoded = decodeB64Str(result);
      if (looksValid(decoded) || looksLegible(decoded)) {
        console.log(`\nROT${shift} + base64 -> ${decoded.substring(0, 100)}`);
      }
    } catch {}
  }
  
  // ============================================
  // TEST 3: Reverse + various operations
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: REVERSE OPERATIONS');
  console.log('='.repeat(60));
  
  const reversed = reverseStr(rcpDataLevel2);
  console.log(`Reversed: ${reversed.substring(0, 80)}...`);
  
  try {
    const reversedDecoded = decodeB64Str(reversed);
    console.log(`Reversed + base64: ${reversedDecoded.substring(0, 100)}`);
    if (looksValid(reversedDecoded)) {
      console.log('*** REVERSE + BASE64 SUCCESS ***');
    }
  } catch {}
  
  // ============================================
  // TEST 4: Subtract from each character
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: CHARACTER SUBTRACTION');
  console.log('='.repeat(60));
  
  for (let n = 1; n <= 10; n++) {
    const result = subtractChars(rcpDataLevel2, n);
    try {
      const decoded = decodeB64Str(result);
      if (looksValid(decoded) || looksLegible(decoded)) {
        console.log(`\nSubtract ${n} + base64 -> ${decoded.substring(0, 100)}`);
      }
    } catch {}
  }
  
  // ============================================
  // TEST 5: AES decryption with various keys
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: AES DECRYPTION');
  console.log('='.repeat(60));
  
  const aesKeys = [
    TMDB_ID.padEnd(16, '0'),
    TMDB_ID.padEnd(32, '0'),
    dataI.padEnd(16, '0'),
    dataI.padEnd(32, '0'),
    rcpMd5.substring(0, 16),
    rcpMd5,
    'cloudnestra'.padEnd(16, '0'),
    'vidsrc'.padEnd(16, '0'),
    String(timestampSec).padEnd(16, '0'),
    crypto.createHash('md5').update(TMDB_ID).digest('hex').substring(0, 16),
    crypto.createHash('md5').update(dataI).digest('hex').substring(0, 16),
  ];
  
  const ivOptions = [
    Buffer.alloc(16, 0),
    rcpDataLevel3.slice(0, 16),
    Buffer.from(rcpMd5.substring(0, 16)),
    Buffer.from(rcpMd5, 'hex'),
  ];
  
  for (const keyStr of aesKeys) {
    for (const iv of ivOptions) {
      for (const algo of ['aes-128-cbc', 'aes-256-cbc', 'aes-128-ecb']) {
        try {
          const keyLen = algo.includes('256') ? 32 : 16;
          const key = Buffer.from(keyStr.padEnd(keyLen, '\0').substring(0, keyLen));
          
          let decipher;
          if (algo.includes('ecb')) {
            decipher = crypto.createDecipheriv(algo, key, null);
          } else {
            decipher = crypto.createDecipheriv(algo, key, iv);
          }
          decipher.setAutoPadding(false);
          
          const decrypted = Buffer.concat([
            decipher.update(rcpDataLevel3),
            decipher.final()
          ]);
          
          const str = decrypted.toString('utf8');
          if (looksValid(str)) {
            console.log(`\n*** AES SUCCESS ***`);
            console.log(`Algorithm: ${algo}`);
            console.log(`Key: ${keyStr}`);
            console.log(`Result: ${str.substring(0, 200)}`);
          } else if (looksLegible(str)) {
            console.log(`\n${algo} with key ${keyStr.substring(0, 10)}... -> ${str.substring(0, 50)}`);
          }
        } catch {}
      }
    }
  }
  
  // ============================================
  // TEST 6: Check if it's just hex encoded
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: HEX DECODING');
  console.log('='.repeat(60));
  
  // Check if level 2 data is hex
  if (/^[0-9a-fA-F]+$/.test(rcpDataLevel2)) {
    const hexDecoded = Buffer.from(rcpDataLevel2, 'hex').toString('utf8');
    console.log(`Hex decoded: ${hexDecoded.substring(0, 100)}`);
  } else {
    console.log('Level 2 data is NOT pure hex');
  }
  
  // ============================================
  // TEST 7: RC4 decryption
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 7: RC4 DECRYPTION');
  console.log('='.repeat(60));
  
  function rc4(key: Buffer, data: Buffer): Buffer {
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
  
  const rc4Keys = [
    Buffer.from(TMDB_ID),
    Buffer.from(dataI),
    Buffer.from(rcpMd5),
    Buffer.from('cloudnestra'),
    Buffer.from('vidsrc'),
  ];
  
  for (const key of rc4Keys) {
    const result = rc4(key, rcpDataLevel3);
    const str = result.toString('utf8');
    if (looksValid(str)) {
      console.log(`\n*** RC4 SUCCESS with key: ${key.toString()} ***`);
      console.log(str.substring(0, 200));
    } else if (looksLegible(str)) {
      console.log(`RC4 with ${key.toString().substring(0, 15)} -> ${str.substring(0, 60)}`);
    }
  }
  
  // ============================================
  // TEST 8: Check raw bytes for patterns
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 8: RAW BYTE ANALYSIS');
  console.log('='.repeat(60));
  
  console.log(`\nFirst 64 bytes (hex): ${rcpDataLevel3.slice(0, 64).toString('hex')}`);
  console.log(`Last 64 bytes (hex): ${rcpDataLevel3.slice(-64).toString('hex')}`);
  
  // Check byte frequency
  const freq: number[] = new Array(256).fill(0);
  for (const b of rcpDataLevel3) freq[b]++;
  
  const mostCommon = freq.map((f, i) => ({ byte: i, freq: f }))
    .sort((a, b) => b.freq - a.freq)
    .slice(0, 10);
  
  console.log(`\nMost common bytes:`);
  mostCommon.forEach(({ byte, freq }) => {
    console.log(`  0x${byte.toString(16).padStart(2, '0')} (${String.fromCharCode(byte).replace(/[^\x20-\x7E]/g, '?')}): ${freq} times`);
  });
  
  // ============================================
  // TEST 9: Timestamp-based keys
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 9: TIMESTAMP-BASED KEYS');
  console.log('='.repeat(60));
  
  // Try various timestamp formats
  const now = new Date();
  const timestampKeys = [
    String(timestampSec),
    String(Math.floor(timestampSec / 60)), // minute
    String(Math.floor(timestampSec / 3600)), // hour
    String(Math.floor(timestampSec / 86400)), // day
    now.toISOString().split('T')[0], // YYYY-MM-DD
    now.toISOString().split('T')[0].replace(/-/g, ''), // YYYYMMDD
    `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`, // YYYYMM
  ];
  
  for (const ts of timestampKeys) {
    const key = Buffer.from(ts.padEnd(16, '0').substring(0, 16));
    const xorResult = xorDecrypt(rcpDataLevel3, key);
    if (looksValid(xorResult.toString('utf8'))) {
      console.log(`\n*** TIMESTAMP XOR SUCCESS: ${ts} ***`);
      console.log(xorResult.toString('utf8').substring(0, 200));
    }
  }
  
  // ============================================
  // TEST 10: Combined TMDB + timestamp
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST 10: COMBINED KEYS');
  console.log('='.repeat(60));
  
  const combinedKeys = [
    `${TMDB_ID}${timestampSec}`,
    `${timestampSec}${TMDB_ID}`,
    `${TMDB_ID}${dataI}`,
    `${dataI}${TMDB_ID}`,
    `${rcpMd5}${TMDB_ID}`,
    crypto.createHash('md5').update(`${TMDB_ID}${timestampSec}`).digest('hex'),
    crypto.createHash('md5').update(`${TMDB_ID}${dataI}`).digest('hex'),
  ];
  
  for (const keyStr of combinedKeys) {
    const key = Buffer.from(keyStr.substring(0, 32));
    const xorResult = xorDecrypt(rcpDataLevel3, key);
    if (looksValid(xorResult.toString('utf8'))) {
      console.log(`\n*** COMBINED KEY SUCCESS: ${keyStr.substring(0, 30)} ***`);
      console.log(xorResult.toString('utf8').substring(0, 200));
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
