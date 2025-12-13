/**
 * Crack MegaUp encryption
 * 
 * The __PAGE_DATA is base64url encoded and then XOR'd or similar
 * Let's try common decryption approaches
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

// Sample encrypted data from MegaUp
const ENCRYPTED = '3wMOLPOCFprWglc038GT4eurZQDTypKLMDMT4A0mzCCgb6yyhTIuEFpOeciU9-isScEP94g4uw4';

// Base64URL decode
function base64UrlDecode(str) {
  // Replace URL-safe chars
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64');
}

// XOR with key
function xorDecrypt(data, key) {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key.charCodeAt(i % key.length);
  }
  return result;
}

// RC4 decrypt
function rc4(key, data) {
  const S = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  
  // KSA
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
    [S[i], S[j]] = [S[j], S[i]];
  }
  
  // PRGA
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

// Try various decryption methods
async function tryDecrypt() {
  console.log('Encrypted data:', ENCRYPTED);
  console.log('Length:', ENCRYPTED.length);
  
  // Decode base64url first
  const decoded = base64UrlDecode(ENCRYPTED);
  console.log('\nBase64URL decoded length:', decoded.length);
  console.log('Decoded hex:', decoded.toString('hex').substring(0, 100));
  console.log('Decoded as UTF8:', decoded.toString('utf8').substring(0, 100));
  
  // Common keys to try
  const keys = [
    'megaup',
    'megaup22',
    'megaup22.online',
    'animekai',
    'animekai.to',
    '18ryYD7yWS2JcOLzFLxK6hXpCQ', // The video ID
    'secret',
    'password',
    '123456',
  ];
  
  console.log('\n--- Trying XOR with common keys ---');
  for (const key of keys) {
    const result = xorDecrypt(decoded, key);
    const str = result.toString('utf8');
    // Check if result looks like JSON or URL
    if (str.includes('{') || str.includes('http') || str.includes('m3u8')) {
      console.log(`Key "${key}":`, str.substring(0, 200));
    }
  }
  
  console.log('\n--- Trying RC4 with common keys ---');
  for (const key of keys) {
    const result = rc4(key, decoded);
    const str = result.toString('utf8');
    if (str.includes('{') || str.includes('http') || str.includes('m3u8')) {
      console.log(`Key "${key}":`, str.substring(0, 200));
    }
  }
  
  // Try to find the key in the page
  console.log('\n--- Fetching page to find key ---');
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  // Look for var ua = ... (user agent is often used as key)
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  if (uaMatch) {
    console.log('Found UA variable:', uaMatch[1].substring(0, 50));
    
    // Try UA as key
    const result = rc4(uaMatch[1], decoded);
    const str = result.toString('utf8');
    console.log('RC4 with UA:', str.substring(0, 200));
    
    const xorResult = xorDecrypt(decoded, uaMatch[1]);
    console.log('XOR with UA:', xorResult.toString('utf8').substring(0, 200));
  }
  
  // Look for any other variables that might be keys
  const varMatches = html.match(/var\s+\w+\s*=\s*['"][^'"]{10,}['"]/g);
  if (varMatches) {
    console.log('\nOther variables found:');
    varMatches.forEach(m => console.log('  ', m.substring(0, 80)));
  }
}

tryDecrypt().catch(console.error);
