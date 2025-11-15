// Crack the PRO.RCP hash encoding
const axios = require('axios');

// Test with known working movie
const TMDB_ID = '558449'; // Sonic 3

async function main() {
  console.log('='.repeat(70));
  console.log('🔓 CRACKING PRO.RCP HASH ENCODING');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Get the RCP page
    console.log('\n[1] Fetching RCP page...');
    const rcpUrl = `https://cloudnestra.com/rcp/${TMDB_ID}`;
    const rcpResponse = await axios.get(rcpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/'
      }
    });
    
    // Step 2: Extract ProRCP hash
    console.log('[2] Extracting ProRCP hash...');
    const prorcpMatch = rcpResponse.data.match(/\/prorcp\/([^"']+)/);
    if (!prorcpMatch) {
      console.log('❌ No ProRCP hash found');
      return;
    }
    
    const prorcpHash = prorcpMatch[1];
    console.log(`✅ ProRCP hash: ${prorcpHash.substring(0, 50)}...`);
    
    // Step 3: Fetch ProRCP page
    console.log('\n[3] Fetching ProRCP page...');
    const prorcpUrl = `https://cloudnestra.com/prorcp/${prorcpHash}`;
    const prorcpResponse = await axios.get(prorcpUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': rcpUrl
      }
    });
    
    // Step 4: Extract hidden div
    console.log('[4] Extracting hidden div...');
    const divMatch = prorcpResponse.data.match(/<div[^>]+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);
    
    if (!divMatch) {
      console.log('❌ No hidden div found');
      console.log('\nSearching for ANY div with long content...');
      
      // Try to find any div with substantial content
      const anyDivMatch = prorcpResponse.data.match(/<div[^>]+id=["']([^"']+)["'][^>]*>([A-Za-z0-9+\/=:]{100,})<\/div>/i);
      if (anyDivMatch) {
        console.log(`✅ Found div: ${anyDivMatch[1]}`);
        analyzeDivContent(anyDivMatch[1], anyDivMatch[2]);
      } else {
        console.log('❌ No divs with encoded content found');
      }
      return;
    }
    
    const divId = divMatch[1];
    const encoded = divMatch[2];
    
    console.log(`✅ Div ID: ${divId}`);
    console.log(`✅ Encoded length: ${encoded.length}`);
    console.log(`✅ First 50 chars: ${encoded.substring(0, 50)}`);
    
    // Step 5: Analyze and decode
    console.log('\n[5] Analyzing encoding...');
    analyzeDivContent(divId, encoded);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

function analyzeDivContent(divId, encoded) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 ENCODING ANALYSIS');
  console.log('='.repeat(70));
  
  // Detect format
  const isHex = /^[0-9a-fA-F:]+$/.test(encoded);
  const isBase64 = /^[A-Za-z0-9+\/=]+$/.test(encoded);
  const hasColons = encoded.includes(':');
  const hasUppercase = /[A-Z]/.test(encoded);
  
  console.log(`\nFormat Detection:`);
  console.log(`  Is hex: ${isHex}`);
  console.log(`  Is base64: ${isBase64}`);
  console.log(`  Has colons: ${hasColons}`);
  console.log(`  Has uppercase: ${hasUppercase}`);
  console.log(`  Length: ${encoded.length}`);
  
  // Try different decoding methods
  console.log(`\n${'='.repeat(70)}`);
  console.log('🔓 TRYING DECODERS');
  console.log('='.repeat(70));
  
  // Method 1: Direct hex decode
  if (isHex) {
    console.log('\n[Method 1] Direct Hex Decode:');
    try {
      const cleaned = encoded.replace(/:/g, '');
      const hexDecoded = Buffer.from(cleaned, 'hex').toString('utf8');
      console.log(`  Result: ${hexDecoded.substring(0, 100)}`);
      if (hexDecoded.includes('http')) {
        console.log(`  ✅ FOUND HTTP URL!`);
        console.log(`  Full URL: ${hexDecoded}`);
        return;
      }
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }
  }
  
  // Method 2: Hex decode + XOR with divId
  if (isHex) {
    console.log('\n[Method 2] Hex + XOR with Div ID:');
    try {
      const cleaned = encoded.replace(/:/g, '');
      const hexBuffer = Buffer.from(cleaned, 'hex');
      const xored = Buffer.alloc(hexBuffer.length);
      
      for (let i = 0; i < hexBuffer.length; i++) {
        xored[i] = hexBuffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      
      const result = xored.toString('utf8');
      console.log(`  Result: ${result.substring(0, 100)}`);
      if (result.includes('http')) {
        console.log(`  ✅ FOUND HTTP URL!`);
        console.log(`  Full URL: ${result}`);
        return;
      }
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }
  }
  
  // Method 3: Hex decode + Caesar shifts
  if (isHex) {
    console.log('\n[Method 3] Hex + Caesar Shifts:');
    try {
      const cleaned = encoded.replace(/:/g, '');
      const hexDecoded = Buffer.from(cleaned, 'hex').toString('utf8');
      
      for (let shift = -25; shift <= 25; shift++) {
        if (shift === 0) continue;
        
        const shifted = caesarShift(hexDecoded, shift);
        if (shifted.includes('http')) {
          console.log(`  ✅ FOUND HTTP URL with shift ${shift}!`);
          console.log(`  Full URL: ${shifted}`);
          return;
        }
      }
      console.log(`  ❌ No valid URLs found with Caesar shifts`);
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }
  }
  
  // Method 4: Base64 decode
  if (isBase64) {
    console.log('\n[Method 4] Base64 Decode:');
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      console.log(`  Result: ${decoded.substring(0, 100)}`);
      if (decoded.includes('http')) {
        console.log(`  ✅ FOUND HTTP URL!`);
        console.log(`  Full URL: ${decoded}`);
        return;
      }
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }
  }
  
  // Method 5: Analyze hex bytes for patterns
  if (isHex) {
    console.log('\n[Method 5] Hex Byte Analysis:');
    try {
      const cleaned = encoded.replace(/:/g, '');
      const hexBuffer = Buffer.from(cleaned, 'hex');
      
      console.log(`  First 20 bytes (hex): ${hexBuffer.slice(0, 20).toString('hex')}`);
      console.log(`  First 20 bytes (dec): ${Array.from(hexBuffer.slice(0, 20)).join(', ')}`);
      console.log(`  First 20 bytes (char): ${hexBuffer.slice(0, 20).toString('utf8').replace(/[^\x20-\x7E]/g, '.')}`);
      
      // Check if it looks like encrypted data
      const entropy = calculateEntropy(hexBuffer);
      console.log(`  Entropy: ${entropy.toFixed(2)} (high = encrypted, low = plain text)`);
      
      // Try XOR with common keys
      console.log(`\n  Trying XOR with common patterns...`);
      const commonKeys = ['key', 'secret', 'password', divId, divId.toLowerCase(), divId.toUpperCase()];
      
      for (const key of commonKeys) {
        const xored = Buffer.alloc(hexBuffer.length);
        for (let i = 0; i < hexBuffer.length; i++) {
          xored[i] = hexBuffer[i] ^ key.charCodeAt(i % key.length);
        }
        
        const result = xored.toString('utf8');
        if (result.includes('http')) {
          console.log(`  ✅ FOUND HTTP URL with key "${key}"!`);
          console.log(`  Full URL: ${result}`);
          return;
        }
      }
      
    } catch (e) {
      console.log(`  ❌ Failed: ${e.message}`);
    }
  }
  
  console.log('\n❌ All decoding methods failed');
  console.log('\nRaw encoded data (first 200 chars):');
  console.log(encoded.substring(0, 200));
}

function caesarShift(text, shift) {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    }
    
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    
    return c;
  }).join('');
}

function calculateEntropy(buffer) {
  const freq = new Map();
  for (const byte of buffer) {
    freq.set(byte, (freq.get(byte) || 0) + 1);
  }
  
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

main();
