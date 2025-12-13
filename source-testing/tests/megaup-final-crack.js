/**
 * Final attempt - brute force the key derivation
 * 
 * The XOR keys are: [164, 33, 104, 69, 159, 231, 52, 160, 244, 234, 35, 64, 175, 178, 169, 206, 196]
 * 
 * Let me try to find a function f(ua, i) that produces these keys
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
};

function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
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
  const enc = Array.from(decoded);
  
  // Known XOR keys (from previous analysis)
  const xorKeys = [164, 33, 104, 69, 159, 231, 52, 160, 244, 234, 35, 64, 175, 178, 169, 206, 196];
  
  console.log('Looking for key derivation function...\n');
  
  // The key might be derived from a combination of:
  // - UA bytes
  // - Position index
  // - Some constants (131, 48, etc.)
  // - Previous key values (state)
  
  // Try: key[i] = f(ua[i], ua[i-1], i, constant)
  
  // Check if there's a relationship with rotated/shifted UA bytes
  const uaBytes = ua.split('').map(c => c.charCodeAt(0));
  
  console.log('Checking rotated UA relationships...');
  
  for (let rot = 0; rot < 8; rot++) {
    const rotatedUa = uaBytes.map(b => ((b << rot) | (b >>> (8 - rot))) & 0xFF);
    let matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (rotatedUa[i % rotatedUa.length] === xorKeys[i]) matches++;
    }
    if (matches > 2) {
      console.log(`  Rotate left ${rot}: ${matches} matches`);
    }
  }
  
  // Check XOR with constants
  console.log('\nChecking UA XOR constant relationships...');
  
  for (let c = 0; c < 256; c++) {
    const xoredUa = uaBytes.map(b => b ^ c);
    let matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (xoredUa[i % xoredUa.length] === xorKeys[i]) matches++;
    }
    if (matches > 3) {
      console.log(`  XOR ${c}: ${matches} matches`);
    }
  }
  
  // Check if key[i] = ua[i] + ua[i+offset] + constant
  console.log('\nChecking UA sum relationships...');
  
  for (let offset = 1; offset < 20; offset++) {
    for (let c = 0; c < 256; c++) {
      let matches = 0;
      for (let i = 0; i < xorKeys.length; i++) {
        const sum = (uaBytes[i % uaBytes.length] + uaBytes[(i + offset) % uaBytes.length] + c) % 256;
        if (sum === xorKeys[i]) matches++;
      }
      if (matches > 5) {
        console.log(`  offset=${offset}, c=${c}: ${matches} matches`);
      }
    }
  }
  
  // Check if key[i] = ua[i] * constant mod 256
  console.log('\nChecking UA multiply relationships...');
  
  for (let m = 1; m < 256; m++) {
    for (let c = 0; c < 256; c++) {
      let matches = 0;
      for (let i = 0; i < xorKeys.length; i++) {
        const prod = (uaBytes[i % uaBytes.length] * m + c) % 256;
        if (prod === xorKeys[i]) matches++;
      }
      if (matches > 5) {
        console.log(`  m=${m}, c=${c}: ${matches} matches`);
      }
    }
  }
  
  // Check if key is derived from cumulative state
  console.log('\nChecking state-based derivation...');
  
  // Try: state[0] = seed, state[i] = f(state[i-1], ua[i])
  for (let seed = 0; seed < 256; seed++) {
    // Try: state[i] = (state[i-1] + ua[i]) % 256
    let state = seed;
    let matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (state === xorKeys[i]) matches++;
      state = (state + uaBytes[i % uaBytes.length]) % 256;
    }
    if (matches > 3) {
      console.log(`  Seed ${seed} (add): ${matches} matches`);
    }
    
    // Try: state[i] = (state[i-1] ^ ua[i])
    state = seed;
    matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (state === xorKeys[i]) matches++;
      state = state ^ uaBytes[i % uaBytes.length];
    }
    if (matches > 3) {
      console.log(`  Seed ${seed} (xor): ${matches} matches`);
    }
    
    // Try: state[i] = (state[i-1] * 131 + ua[i]) % 256
    state = seed;
    matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (state === xorKeys[i]) matches++;
      state = (state * 131 + uaBytes[i % uaBytes.length]) % 256;
    }
    if (matches > 3) {
      console.log(`  Seed ${seed} (lcg131): ${matches} matches`);
    }
  }
  
  // Maybe the key derivation uses the full UA string hash
  console.log('\nChecking full UA hash derivation...');
  
  // MD5-like mixing
  function mix(a, b, c) {
    return ((a + b) ^ c) & 0xFF;
  }
  
  // Try different hash functions
  for (let seed = 0; seed < 256; seed++) {
    const keys = [];
    let h = seed;
    for (let i = 0; i < xorKeys.length; i++) {
      keys.push(h);
      // Update hash
      for (let j = 0; j < ua.length; j++) {
        h = (h * 31 + ua.charCodeAt(j) + i) & 0xFF;
      }
    }
    
    let matches = 0;
    for (let i = 0; i < xorKeys.length; i++) {
      if (keys[i] === xorKeys[i]) matches++;
    }
    if (matches > 3) {
      console.log(`  Hash seed ${seed}: ${matches} matches`);
    }
  }
  
  // Last resort: check if the encryption is position-dependent with UA
  console.log('\nChecking position-dependent formulas...');
  
  // key[i] = (ua[i] + i * c1 + c2) % 256
  for (let c1 = 0; c1 < 256; c1++) {
    for (let c2 = 0; c2 < 256; c2++) {
      let matches = 0;
      for (let i = 0; i < xorKeys.length; i++) {
        const key = (uaBytes[i % uaBytes.length] + i * c1 + c2) % 256;
        if (key === xorKeys[i]) matches++;
      }
      if (matches >= xorKeys.length - 2) {
        console.log(`  c1=${c1}, c2=${c2}: ${matches}/${xorKeys.length} matches`);
        
        // Show the formula result
        const result = [];
        for (let i = 0; i < xorKeys.length; i++) {
          result.push((uaBytes[i % uaBytes.length] + i * c1 + c2) % 256);
        }
        console.log('    Generated:', result);
        console.log('    Expected: ', xorKeys);
      }
    }
  }
  
  // key[i] = (ua[i] ^ (i * c1)) + c2
  for (let c1 = 0; c1 < 256; c1++) {
    for (let c2 = 0; c2 < 256; c2++) {
      let matches = 0;
      for (let i = 0; i < xorKeys.length; i++) {
        const key = ((uaBytes[i % uaBytes.length] ^ (i * c1)) + c2) % 256;
        if (key === xorKeys[i]) matches++;
      }
      if (matches >= xorKeys.length - 2) {
        console.log(`  XOR formula c1=${c1}, c2=${c2}: ${matches}/${xorKeys.length} matches`);
      }
    }
  }
}

main().catch(console.error);
