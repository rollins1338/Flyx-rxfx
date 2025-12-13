/**
 * Crack MegaUp Encryption - Full Reverse Engineering
 * 
 * The __PAGE_DATA is base64url encoded, then the decoded bytes go through
 * a custom cipher. Let's figure out what it is.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

// Multiple samples to analyze patterns
const SAMPLES = [
  {
    url: 'https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ',
    pageData: '3wMOLPOCFprWglc038GT4eurZQDTypKLMDMT4A0mzCCgb6yyhTIuEFpOeciU9-isScEP94g4uw4',
  }
];

// Base64URL decode
function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

// Try to find patterns in the obfuscated JS
async function analyzeJS() {
  console.log('=== Fetching and analyzing MegaUp JS ===\n');
  
  const response = await fetch(SAMPLES[0].url, {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  // Get the app.js URL
  const appJsMatch = html.match(/src="([^"]+app\.js[^"]*)"/);
  if (!appJsMatch) {
    console.log('No app.js found');
    return null;
  }
  
  console.log('Fetching:', appJsMatch[1]);
  const jsResponse = await fetch(appJsMatch[1], { headers: HEADERS });
  const js = await jsResponse.text();
  
  console.log('JS size:', js.length, 'bytes');
  
  // The key insight: look for the decryption function that processes __PAGE_DATA
  // Common patterns in video player decryption:
  // 1. Base64 decode
  // 2. XOR or RC4 with a key derived from something on the page
  // 3. JSON parse the result
  
  // Search for key derivation patterns
  console.log('\n=== Searching for crypto patterns ===');
  
  // Look for charCodeAt loops (common in XOR/RC4)
  const charCodeLoops = js.match(/charCodeAt\s*\([^)]*\)[^;]{0,100}/g);
  if (charCodeLoops) {
    console.log('\ncharCodeAt patterns found:', charCodeLoops.length);
    // These are likely part of the cipher
  }
  
  // Look for modulo 256 (common in byte manipulation)
  const mod256 = js.match(/\%\s*256/g);
  console.log('% 256 occurrences:', mod256?.length || 0);
  
  // Look for bitwise operations
  const xorOps = js.match(/\^\s*\d+|\^\s*\w+\[/g);
  console.log('XOR operations:', xorOps?.length || 0);
  
  // Look for array initialization 0-255 (RC4 S-box)
  const sboxInit = js.match(/Array\s*\(\s*256\s*\)|new\s+Array\s*\(\s*256\s*\)/g);
  console.log('256-byte array init:', sboxInit?.length || 0);
  
  return js;
}

// Analyze the encrypted data structure
function analyzeEncrypted() {
  console.log('\n=== Analyzing encrypted data ===\n');
  
  const encrypted = SAMPLES[0].pageData;
  const decoded = b64UrlDecode(encrypted);
  
  console.log('Encrypted string length:', encrypted.length);
  console.log('Decoded bytes length:', decoded.length);
  console.log('Decoded hex:', decoded.toString('hex'));
  console.log('Decoded bytes:', Array.from(decoded).join(', '));
  
  // Look for patterns in the bytes
  const bytes = Array.from(decoded);
  
  // Check byte distribution
  const freq = {};
  bytes.forEach(b => freq[b] = (freq[b] || 0) + 1);
  console.log('\nByte frequency (top 10):');
  Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([byte, count]) => console.log(`  ${byte}: ${count}`));
  
  // The result should be JSON like: {"file":"https://...m3u8","..."}
  // JSON starts with { which is 0x7B (123)
  // If XOR'd, first byte XOR key[0] should equal 123
  
  const firstByte = bytes[0];
  const expectedFirst = 123; // '{'
  const possibleKeyByte = firstByte ^ expectedFirst;
  console.log('\nFirst byte:', firstByte);
  console.log('Expected first byte (for JSON):', expectedFirst);
  console.log('Possible key byte 0:', possibleKeyByte, `(char: ${String.fromCharCode(possibleKeyByte)})`);
  
  return decoded;
}

// Try various decryption methods
function tryDecryptions(decoded, key) {
  console.log('\n=== Trying decryption with key:', key, '===\n');
  
  // Simple XOR
  const xorResult = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    xorResult[i] = decoded[i] ^ key.charCodeAt(i % key.length);
  }
  const xorStr = xorResult.toString('utf8');
  console.log('XOR result:', xorStr.substring(0, 100));
  if (xorStr.startsWith('{') || xorStr.includes('http')) {
    console.log('✓ XOR WORKS!');
    return xorStr;
  }
  
  // RC4
  const rc4Result = rc4Decrypt(key, decoded);
  const rc4Str = rc4Result.toString('utf8');
  console.log('RC4 result:', rc4Str.substring(0, 100));
  if (rc4Str.startsWith('{') || rc4Str.includes('http')) {
    console.log('✓ RC4 WORKS!');
    return rc4Str;
  }
  
  return null;
}

function rc4Decrypt(key, data) {
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

// Custom cipher based on the obfuscated patterns
function customDecrypt(decoded, key) {
  // Based on the patterns found, try variations
  const result = Buffer.alloc(decoded.length);
  
  // Try: XOR with rotating key + byte shift
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    // XOR with key
    b ^= key.charCodeAt(i % key.length);
    // Subtract constant (seen in obfuscated code: -131)
    b = (b - 131 + 256) % 256;
    result[i] = b;
  }
  
  return result;
}

// Try to extract key from the video ID or page
async function findKey() {
  console.log('\n=== Searching for encryption key ===\n');
  
  const response = await fetch(SAMPLES[0].url, {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  // The key might be:
  // 1. The User-Agent
  // 2. Part of the video ID
  // 3. A hash of something
  // 4. Hidden in the page
  
  // Extract all potential keys from the page
  const potentialKeys = [];
  
  // User-Agent from page
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  if (uaMatch) potentialKeys.push({ name: 'ua', value: uaMatch[1] });
  
  // Video ID from URL
  const videoId = SAMPLES[0].url.split('/e/')[1];
  potentialKeys.push({ name: 'videoId', value: videoId });
  
  // Any other variables
  const varMatches = html.matchAll(/var\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g);
  for (const match of varMatches) {
    if (match[2].length > 5 && match[2].length < 200) {
      potentialKeys.push({ name: match[1], value: match[2] });
    }
  }
  
  console.log('Potential keys found:');
  potentialKeys.forEach(k => console.log(`  ${k.name}: ${k.value.substring(0, 50)}...`));
  
  return potentialKeys;
}

async function main() {
  // Step 1: Analyze the JS
  const js = await analyzeJS();
  
  // Step 2: Analyze the encrypted data
  const decoded = analyzeEncrypted();
  
  // Step 3: Find potential keys
  const keys = await findKey();
  
  // Step 4: Try each key with different methods
  console.log('\n=== Brute forcing decryption ===\n');
  
  for (const key of keys) {
    const result = tryDecryptions(decoded, key.value);
    if (result) {
      console.log('\n✓✓✓ SUCCESS with key:', key.name);
      console.log('Decrypted:', result);
      return;
    }
  }
  
  // Step 5: Try custom cipher variations
  console.log('\n=== Trying custom cipher variations ===\n');
  
  for (const key of keys) {
    const result = customDecrypt(decoded, key.value);
    const str = result.toString('utf8');
    console.log(`Custom (${key.name}):`, str.substring(0, 80));
    if (str.startsWith('{') || str.includes('http')) {
      console.log('✓ CUSTOM CIPHER WORKS!');
      return;
    }
  }
  
  console.log('\nNeed to dig deeper into the obfuscated JS...');
}

main().catch(console.error);
