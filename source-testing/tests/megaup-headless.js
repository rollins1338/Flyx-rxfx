/**
 * Use a simple approach - intercept the JWPlayer setup call
 * The decrypted data is passed to jwplayer().setup()
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

async function extractWithEval() {
  console.log('Attempting to extract stream URL using eval approach...\n');
  
  // Fetch the embed page
  const response = await fetch('https://megaup22.online/e/18ryYD7yWS2JcOLzFLxK6hXpCQ', {
    headers: { ...HEADERS, 'Referer': 'https://animekai.to/' },
  });
  const html = await response.text();
  
  // Extract __PAGE_DATA
  const pageDataMatch = html.match(/window\.__PAGE_DATA\s*=\s*"([^"]+)"/);
  const pageData = pageDataMatch ? pageDataMatch[1] : null;
  console.log('__PAGE_DATA:', pageData);
  
  // Extract the ua variable
  const uaMatch = html.match(/var\s+ua\s*=\s*['"]([^'"]+)['"]/);
  const ua = uaMatch ? uaMatch[1] : HEADERS['User-Agent'];
  console.log('UA:', ua.substring(0, 50) + '...');
  
  // Fetch app.js
  const appJsMatch = html.match(/src="([^"]+app\.js[^"]*)"/);
  const jsResponse = await fetch(appJsMatch[1], { headers: HEADERS });
  const appJs = await jsResponse.text();
  
  console.log('\nAnalyzing app.js structure...');
  
  // The app.js creates a player and calls setup with the decrypted sources
  // We need to find where jwplayer is called
  
  // Look for the jwplayer setup pattern
  const jwSetupIdx = appJs.indexOf('jwplayer');
  console.log('jwplayer index:', jwSetupIdx);
  
  // The decryption happens before jwplayer setup
  // Let's look for where the decrypted data is used
  
  // Find the main initialization function
  const initPatterns = [
    /function\s+\w+\s*\(\s*\)\s*\{[^}]*jwplayer/,
    /\.\s*setup\s*\(\s*\{/,
  ];
  
  for (const pattern of initPatterns) {
    const match = appJs.match(pattern);
    if (match) {
      console.log('Found pattern:', match[0].substring(0, 100));
    }
  }
  
  // The key insight: the decryption uses the UA as part of the key
  // Let's try to find the exact algorithm by looking at the byte operations
  
  console.log('\n=== Trying UA-based decryption ===');
  
  // Base64URL decode
  let b64 = pageData.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const decoded = Buffer.from(b64, 'base64');
  
  console.log('Decoded bytes:', decoded.length);
  
  // The decryption likely uses:
  // 1. XOR with UA bytes
  // 2. Some rotation/shift
  // 3. Add/subtract constants
  
  // Try: For each byte, XOR with corresponding UA byte, then apply transforms
  
  // Method 1: Simple XOR with UA
  let result = Buffer.alloc(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ ua.charCodeAt(i % ua.length);
  }
  console.log('XOR with UA:', result.toString('utf8').substring(0, 80));
  
  // Method 2: XOR with reversed UA
  const reversedUa = ua.split('').reverse().join('');
  for (let i = 0; i < decoded.length; i++) {
    result[i] = decoded[i] ^ reversedUa.charCodeAt(i % reversedUa.length);
  }
  console.log('XOR with reversed UA:', result.toString('utf8').substring(0, 80));
  
  // Method 3: XOR with UA hash
  // Create a simple hash of UA
  let uaHash = 0;
  for (let i = 0; i < ua.length; i++) {
    uaHash = ((uaHash << 5) - uaHash + ua.charCodeAt(i)) | 0;
  }
  console.log('UA hash:', uaHash);
  
  // Method 4: RC4 with UA as key
  function rc4(key, data) {
    const S = Array.from({ length: 256 }, (_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key.charCodeAt(i % key.length)) % 256;
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
  
  result = rc4(ua, decoded);
  console.log('RC4 with UA:', result.toString('utf8').substring(0, 80));
  
  // Method 5: The obfuscated code had specific constants
  // Try combining operations in different orders
  
  const ops = {
    xor131: b => b ^ 131,
    sub131: b => (b - 131 + 256) % 256,
    add131: b => (b + 131) % 256,
    rotL5: b => ((b << 5) | (b >>> 3)) & 0xFF,
    rotR5: b => ((b >>> 5) | (b << 3)) & 0xFF,
  };
  
  // Try: XOR with UA byte, then XOR 131, then rotate
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b ^= ua.charCodeAt(i % ua.length);
    b ^= 131;
    result[i] = b;
  }
  console.log('XOR UA, XOR 131:', result.toString('utf8').substring(0, 80));
  
  // Try: XOR 131, then XOR with UA
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b ^= 131;
    b ^= ua.charCodeAt(i % ua.length);
    result[i] = b;
  }
  console.log('XOR 131, XOR UA:', result.toString('utf8').substring(0, 80));
  
  // Try: sub 131, then XOR with UA
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b = (b - 131 + 256) % 256;
    b ^= ua.charCodeAt(i % ua.length);
    result[i] = b;
  }
  console.log('sub 131, XOR UA:', result.toString('utf8').substring(0, 80));
  
  // Try: XOR with UA, then sub 131
  for (let i = 0; i < decoded.length; i++) {
    let b = decoded[i];
    b ^= ua.charCodeAt(i % ua.length);
    b = (b - 131 + 256) % 256;
    result[i] = b;
  }
  console.log('XOR UA, sub 131:', result.toString('utf8').substring(0, 80));
}

extractWithEval().catch(console.error);
