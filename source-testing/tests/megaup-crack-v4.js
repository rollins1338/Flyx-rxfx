/**
 * MegaUp Decryption - Stream cipher approach
 * 
 * The encryption likely uses a keystream derived from the UA
 * Let me try different keystream generation methods
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

// RC4 implementation
function rc4Init(key) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  return S;
}

function rc4Crypt(S, data) {
  S = [...S]; // Clone
  const result = [];
  let i = 0, j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    [S[i], S[j]] = [S[j], S[i]];
    result.push(data[k] ^ S[(S[i] + S[j]) % 256]);
  }
  return result;
}

// Simple XOR cipher with key
function xorCrypt(key, data) {
  return data.map((b, i) => b ^ key.charCodeAt(i % key.length));
}

// Vigenere-like cipher
function vigenereCrypt(key, data, decrypt = true) {
  return data.map((b, i) => {
    const k = key.charCodeAt(i % key.length);
    return decrypt ? (b - k + 256) % 256 : (b + k) % 256;
  });
}

async function main() {
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  const pageData = pageDataMatch[1];
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  const ua = uaMatch[1];
  
  const decoded = b64UrlDecode(pageData);
  const bytes = Array.from(decoded);
  
  console.log('Encrypted bytes:', bytes.length);
  console.log('UA:', ua);
  console.log('');
  
  // Try RC4 with various keys
  console.log('=== RC4 attempts ===\n');
  
  const keys = [
    ua,
    ua.split('').reverse().join(''),
    'megaup',
    'megaup22',
    'animekai',
    '18ryYD7yWS2JcOLzFLxK6hXpCQ', // video ID
  ];
  
  for (const key of keys) {
    const S = rc4Init(key);
    const result = rc4Crypt(S, bytes);
    const str = String.fromCharCode(...result);
    console.log(`RC4(${key.substring(0, 20)}...):`, str.substring(0, 60));
    if (str.startsWith('{')) {
      console.log('  ✓ FOUND!');
      console.log('  Full:', str);
    }
  }
  
  // Try XOR with various keys
  console.log('\n=== XOR attempts ===\n');
  
  for (const key of keys) {
    const result = xorCrypt(key, bytes);
    const str = String.fromCharCode(...result);
    console.log(`XOR(${key.substring(0, 20)}...):`, str.substring(0, 60));
    if (str.startsWith('{')) {
      console.log('  ✓ FOUND!');
    }
  }
  
  // Try Vigenere with various keys
  console.log('\n=== Vigenere attempts ===\n');
  
  for (const key of keys) {
    const result = vigenereCrypt(key, bytes, true);
    const str = String.fromCharCode(...result);
    console.log(`Vig(${key.substring(0, 20)}...):`, str.substring(0, 60));
    if (str.startsWith('{')) {
      console.log('  ✓ FOUND!');
    }
  }
  
  // The key might be derived from UA using a hash
  console.log('\n=== Hash-derived key attempts ===\n');
  
  // Simple hash
  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }
  
  // Create keystream from hash
  function hashKeystream(str, len) {
    const result = [];
    let h = simpleHash(str);
    for (let i = 0; i < len; i++) {
      h = ((h * 1103515245 + 12345) & 0x7fffffff);
      result.push(h & 0xFF);
    }
    return result;
  }
  
  const keystream = hashKeystream(ua, bytes.length);
  let result = bytes.map((b, i) => b ^ keystream[i]);
  console.log('Hash keystream XOR:', String.fromCharCode(...result).substring(0, 60));
  
  // Try with different hash seeds
  for (const seed of [0, 131, 48, 256]) {
    const ks = [];
    let h = seed;
    for (let i = 0; i < bytes.length; i++) {
      h = (h + ua.charCodeAt(i % ua.length)) & 0xFF;
      ks.push(h);
    }
    result = bytes.map((b, i) => b ^ ks[i]);
    console.log(`Seed ${seed} XOR:`, String.fromCharCode(...result).substring(0, 60));
  }
  
  // The obfuscated code had specific constants: 131, 48
  // Maybe the keystream uses these
  console.log('\n=== Constant-based keystream ===\n');
  
  // Try: keystream[i] = (ua[i] + 131) % 256
  result = bytes.map((b, i) => b ^ ((ua.charCodeAt(i % ua.length) + 131) % 256));
  console.log('XOR (ua + 131):', String.fromCharCode(...result).substring(0, 60));
  
  // Try: keystream[i] = (ua[i] ^ 131)
  result = bytes.map((b, i) => b ^ (ua.charCodeAt(i % ua.length) ^ 131));
  console.log('XOR (ua ^ 131):', String.fromCharCode(...result).substring(0, 60));
  
  // Try: keystream[i] = (ua[i] - 131 + 256) % 256
  result = bytes.map((b, i) => b ^ ((ua.charCodeAt(i % ua.length) - 131 + 256) % 256));
  console.log('XOR (ua - 131):', String.fromCharCode(...result).substring(0, 60));
  
  // Try combinations with rotation
  const rotR5 = b => ((b >>> 5) | (b << 3)) & 0xFF;
  const rotL5 = b => ((b << 5) | (b >>> 3)) & 0xFF;
  
  result = bytes.map((b, i) => rotR5(b) ^ ua.charCodeAt(i % ua.length));
  console.log('rotR5 then XOR ua:', String.fromCharCode(...result).substring(0, 60));
  
  result = bytes.map((b, i) => rotR5(b ^ ua.charCodeAt(i % ua.length)));
  console.log('XOR ua then rotR5:', String.fromCharCode(...result).substring(0, 60));
  
  // Try: decrypt = rotR5(byte) XOR (ua[i] ^ 131)
  result = bytes.map((b, i) => rotR5(b) ^ (ua.charCodeAt(i % ua.length) ^ 131));
  console.log('rotR5 XOR (ua^131):', String.fromCharCode(...result).substring(0, 60));
  
  // Try: decrypt = (byte XOR ua[i]) then rotR5 then sub131
  result = bytes.map((b, i) => {
    let x = b ^ ua.charCodeAt(i % ua.length);
    x = rotR5(x);
    x = (x - 131 + 256) % 256;
    return x;
  });
  console.log('XOR ua, rotR5, sub131:', String.fromCharCode(...result).substring(0, 60));
  
  // Try: decrypt = rotR5(byte XOR 131) XOR ua[i]
  result = bytes.map((b, i) => rotR5(b ^ 131) ^ ua.charCodeAt(i % ua.length));
  console.log('rotR5(b^131) XOR ua:', String.fromCharCode(...result).substring(0, 60));
}

main().catch(console.error);
