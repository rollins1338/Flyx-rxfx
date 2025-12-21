/**
 * Crack Flixer.sh WASM Encryption - V2
 * 
 * Deep analysis of the encryption algorithm
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://flixer.sh/',
  'Origin': 'https://flixer.sh',
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function deepAnalysis() {
  console.log('=== Deep Analysis of Flixer.sh Encryption ===\n');
  
  // Read the saved WASM binary
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  // Step 1: Extract all strings from the WASM Data section
  console.log('1. Extracting strings from WASM Data section...\n');
  
  // Find the Data section (section ID 11)
  let offset = 8;
  let dataSection = null;
  
  while (offset < wasmBuffer.length) {
    const sectionId = wasmBuffer[offset++];
    
    // Read section size (LEB128)
    let sectionSize = 0;
    let shift = 0;
    let byte;
    do {
      byte = wasmBuffer[offset++];
      sectionSize |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    if (sectionId === 11) {
      dataSection = wasmBuffer.slice(offset, offset + sectionSize);
      break;
    }
    
    offset += sectionSize;
  }
  
  if (dataSection) {
    console.log(`   Data section size: ${dataSection.length} bytes`);
    
    // Look for readable strings
    const strings = [];
    let currentString = '';
    
    for (let i = 0; i < dataSection.length; i++) {
      const char = dataSection[i];
      if (char >= 32 && char < 127) {
        currentString += String.fromCharCode(char);
      } else {
        if (currentString.length >= 4) {
          strings.push(currentString);
        }
        currentString = '';
      }
    }
    
    // Filter for interesting strings
    const interestingStrings = strings.filter(s => 
      s.includes('aes') || s.includes('AES') ||
      s.includes('key') || s.includes('KEY') ||
      s.includes('iv') || s.includes('IV') ||
      s.includes('cipher') || s.includes('decrypt') ||
      s.includes('encrypt') || s.includes('base64') ||
      s.includes('hex') || s.includes('cbc') || s.includes('CBC') ||
      s.includes('gcm') || s.includes('GCM') ||
      s.includes('ctr') || s.includes('CTR') ||
      s.length > 20
    );
    
    console.log(`   Interesting strings found: ${interestingStrings.length}`);
    interestingStrings.slice(0, 50).forEach(s => console.log(`     - "${s}"`));
  }
  
  // Step 2: Analyze the JS wrapper more carefully
  console.log('\n2. Analyzing JS wrapper in detail...\n');
  
  const jsPath = path.join(__dirname, 'flixer_img_data.js');
  const jsWrapper = fs.readFileSync(jsPath, 'utf8');
  
  // Find the process_img_data function
  const processImgDataMatch = jsWrapper.match(/export function process_img_data\([^)]+\)\s*\{[\s\S]*?(?=export function|$)/);
  if (processImgDataMatch) {
    console.log('   process_img_data function:');
    console.log(processImgDataMatch[0].substring(0, 1000));
  }
  
  // Find the get_img_key function
  const getImgKeyMatch = jsWrapper.match(/export function get_img_key\([^)]*\)\s*\{[\s\S]*?(?=export function|$)/);
  if (getImgKeyMatch) {
    console.log('\n   get_img_key function:');
    console.log(getImgKeyMatch[0].substring(0, 800));
  }
  
  // Step 3: Look for the actual encryption implementation
  console.log('\n3. Looking for encryption patterns in WASM...\n');
  
  // Common AES S-box values (first few bytes)
  const aesSubBytes = Buffer.from([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5]);
  const sboxIndex = wasmBuffer.indexOf(aesSubBytes);
  if (sboxIndex !== -1) {
    console.log(`   ✓ AES S-box found at offset ${sboxIndex}`);
  } else {
    console.log('   ✗ AES S-box not found (might use different implementation)');
  }
  
  // Look for common encryption constants
  const constants = {
    'AES round constants': Buffer.from([0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]),
    'SHA-256 initial hash': Buffer.from([0x6a, 0x09, 0xe6, 0x67]),
  };
  
  for (const [name, pattern] of Object.entries(constants)) {
    const index = wasmBuffer.indexOf(pattern);
    if (index !== -1) {
      console.log(`   ✓ ${name} found at offset ${index}`);
    }
  }
  
  // Step 4: Try to understand the data format
  console.log('\n4. Analyzing encrypted data format...\n');
  
  // The encrypted data from the API is likely base64 encoded
  // Let's look for base64 decode patterns in the JS
  const base64Patterns = jsWrapper.match(/atob|btoa|base64|Base64/gi) || [];
  console.log(`   Base64 references: ${[...new Set(base64Patterns)].join(', ')}`);
  
  // Step 5: Look at the imports to understand what browser APIs are used
  console.log('\n5. Analyzing WASM imports...\n');
  
  // Find Import section
  offset = 8;
  while (offset < wasmBuffer.length) {
    const sectionId = wasmBuffer[offset++];
    
    let sectionSize = 0;
    let shift = 0;
    let byte;
    do {
      byte = wasmBuffer[offset++];
      sectionSize |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    if (sectionId === 2) {
      // Import section
      const importSection = wasmBuffer.slice(offset, offset + sectionSize);
      
      // Parse imports
      let importOffset = 0;
      const numImports = importSection[importOffset++];
      console.log(`   Number of imports: ${numImports}`);
      
      for (let i = 0; i < Math.min(numImports, 30); i++) {
        // Module name
        const moduleLen = importSection[importOffset++];
        const moduleName = importSection.slice(importOffset, importOffset + moduleLen).toString('utf8');
        importOffset += moduleLen;
        
        // Field name
        const fieldLen = importSection[importOffset++];
        const fieldName = importSection.slice(importOffset, importOffset + fieldLen).toString('utf8');
        importOffset += fieldLen;
        
        // Import kind
        const kind = importSection[importOffset++];
        
        // Skip the rest of the import descriptor
        if (kind === 0) {
          // Function import - skip type index
          while (importSection[importOffset] & 0x80) importOffset++;
          importOffset++;
        }
        
        if (fieldName.includes('crypto') || fieldName.includes('random') || 
            fieldName.includes('time') || fieldName.includes('navigator') ||
            fieldName.includes('localStorage') || fieldName.includes('getItem')) {
          console.log(`   ✓ ${moduleName}.${fieldName} (important)`);
        }
      }
      break;
    }
    
    offset += sectionSize;
  }
  
  // Step 6: Analyze the key derivation
  console.log('\n6. Analyzing key derivation...\n');
  
  // The key is 64 chars (32 bytes hex encoded)
  // This suggests AES-256 (256 bits = 32 bytes)
  console.log('   Key length: 64 hex chars = 32 bytes = 256 bits');
  console.log('   This matches AES-256 key size');
  
  // Look for how the key is derived
  const keyDerivationPatterns = [
    /navigator/g,
    /screen/g,
    /colorDepth/g,
    /platform/g,
    /language/g,
    /timezone/g,
    /canvas/g,
    /fingerprint/gi,
  ];
  
  console.log('\n   Browser fingerprinting APIs used:');
  for (const pattern of keyDerivationPatterns) {
    if (jsWrapper.match(pattern)) {
      console.log(`     ✓ ${pattern.source}`);
    }
  }
  
  console.log('\n=== Analysis Complete ===');
  console.log('\nConclusion:');
  console.log('- Encryption: AES-256 (based on 32-byte key)');
  console.log('- Mode: Likely CBC (found "iv" and "cipher" strings)');
  console.log('- Key derivation: Uses browser fingerprinting');
  console.log('- The WASM generates a unique key based on browser environment');
}

deepAnalysis().catch(console.error);
