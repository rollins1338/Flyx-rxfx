/**
 * Crack Flixer.sh WASM Encryption
 * 
 * Goal: Reverse engineer the WASM module to extract the decryption algorithm
 * and replicate it in pure JavaScript for server-side use.
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

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function analyzeWasm() {
  console.log('=== Cracking Flixer.sh WASM Encryption ===\n');
  
  // Step 1: Download the WASM binary
  console.log('1. Downloading WASM binary...');
  const wasmBuffer = await fetchBuffer('https://plsdontscrapemelove.flixer.sh/assets/wasm/img_data_bg.wasm');
  console.log(`   Size: ${wasmBuffer.length} bytes`);
  
  // Save WASM for analysis
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  fs.writeFileSync(wasmPath, wasmBuffer);
  console.log(`   Saved to: ${wasmPath}`);
  
  // Step 2: Download the JS wrapper
  console.log('\n2. Downloading JS wrapper...');
  const jsWrapper = await fetchText('https://plsdontscrapemelove.flixer.sh/assets/wasm/img_data.js');
  console.log(`   Size: ${jsWrapper.length} chars`);
  
  // Save JS wrapper
  const jsPath = path.join(__dirname, 'flixer_img_data.js');
  fs.writeFileSync(jsPath, jsWrapper);
  console.log(`   Saved to: ${jsPath}`);
  
  // Step 3: Analyze the WASM exports
  console.log('\n3. Analyzing WASM exports...');
  
  // Look for exported function names in the JS wrapper
  const exportMatches = jsWrapper.match(/export\s+(?:function|const|let|var)\s+(\w+)/g) || [];
  console.log(`   Exports found: ${exportMatches.length}`);
  exportMatches.forEach(e => console.log(`     - ${e}`));
  
  // Look for the key functions
  const keyFunctions = ['process_img_data', 'get_img_key', 'decrypt', 'encrypt'];
  console.log('\n   Key functions:');
  for (const fn of keyFunctions) {
    if (jsWrapper.includes(fn)) {
      console.log(`     ✓ ${fn} found`);
      
      // Find the function implementation
      const fnIndex = jsWrapper.indexOf(fn);
      const context = jsWrapper.substring(Math.max(0, fnIndex - 100), fnIndex + 500);
      console.log(`       Context: ${context.substring(0, 300)}...`);
    } else {
      console.log(`     ✗ ${fn} not found`);
    }
  }
  
  // Step 4: Analyze the WASM binary structure
  console.log('\n4. Analyzing WASM binary structure...');
  
  // WASM magic number: 0x00 0x61 0x73 0x6D (\\0asm)
  const magic = wasmBuffer.slice(0, 4).toString('hex');
  console.log(`   Magic number: ${magic} (expected: 0061736d)`);
  
  // WASM version
  const version = wasmBuffer.readUInt32LE(4);
  console.log(`   Version: ${version}`);
  
  // Look for string patterns in the WASM
  console.log('\n5. Looking for string patterns in WASM...');
  const wasmString = wasmBuffer.toString('utf8', 0, wasmBuffer.length);
  
  // Look for encryption-related strings
  const encryptionPatterns = ['AES', 'aes', 'CBC', 'cbc', 'decrypt', 'encrypt', 'key', 'iv', 'cipher'];
  for (const pattern of encryptionPatterns) {
    const index = wasmString.indexOf(pattern);
    if (index !== -1) {
      console.log(`   Found "${pattern}" at offset ${index}`);
    }
  }
  
  // Step 5: Analyze the image enhancer JS for clues
  console.log('\n6. Analyzing image enhancer for encryption clues...');
  const enhancerJs = await fetchText('https://plsdontscrapemelove.flixer.sh/assets/client/tmdb-image-enhancer.js');
  
  // Look for crypto operations
  const cryptoPatterns = [
    /crypto\.subtle\.\w+/g,
    /HMAC/gi,
    /SHA-256/gi,
    /AES/gi,
    /importKey/g,
    /sign\(/g,
    /decrypt\(/g,
    /encrypt\(/g,
  ];
  
  console.log('   Crypto operations found:');
  for (const pattern of cryptoPatterns) {
    const matches = enhancerJs.match(pattern) || [];
    if (matches.length > 0) {
      console.log(`     - ${pattern}: ${[...new Set(matches)].join(', ')}`);
    }
  }
  
  // Step 6: Try to understand the key generation
  console.log('\n7. Analyzing key generation...');
  
  // The get_img_key function returns a 64-char hex string
  // Let's look for how it's generated
  const keyGenPatterns = [
    /get_img_key[^}]+/g,
    /key\s*=\s*[^;]+/g,
    /64\s*[!=]/g,
  ];
  
  for (const pattern of keyGenPatterns) {
    const matches = jsWrapper.match(pattern) || [];
    if (matches.length > 0) {
      console.log(`   Pattern ${pattern}:`);
      matches.slice(0, 3).forEach(m => console.log(`     - ${m.substring(0, 100)}`));
    }
  }
  
  // Step 7: Look at the actual WASM function signatures
  console.log('\n8. Extracting WASM function signatures...');
  
  // Parse WASM sections
  let offset = 8; // Skip magic and version
  while (offset < wasmBuffer.length) {
    const sectionId = wasmBuffer[offset];
    offset++;
    
    // Read section size (LEB128)
    let sectionSize = 0;
    let shift = 0;
    let byte;
    do {
      byte = wasmBuffer[offset++];
      sectionSize |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    const sectionNames = {
      0: 'Custom',
      1: 'Type',
      2: 'Import',
      3: 'Function',
      4: 'Table',
      5: 'Memory',
      6: 'Global',
      7: 'Export',
      8: 'Start',
      9: 'Element',
      10: 'Code',
      11: 'Data',
    };
    
    console.log(`   Section ${sectionId} (${sectionNames[sectionId] || 'Unknown'}): ${sectionSize} bytes`);
    
    // For Export section, try to read export names
    if (sectionId === 7) {
      const sectionStart = offset;
      const numExports = wasmBuffer[offset++];
      console.log(`     Exports: ${numExports}`);
      
      for (let i = 0; i < Math.min(numExports, 20); i++) {
        // Read name length
        const nameLen = wasmBuffer[offset++];
        const name = wasmBuffer.slice(offset, offset + nameLen).toString('utf8');
        offset += nameLen;
        
        // Read export kind and index
        const kind = wasmBuffer[offset++];
        const kindNames = { 0: 'func', 1: 'table', 2: 'memory', 3: 'global' };
        
        // Read index (LEB128)
        let index = 0;
        shift = 0;
        do {
          byte = wasmBuffer[offset++];
          index |= (byte & 0x7f) << shift;
          shift += 7;
        } while (byte & 0x80);
        
        console.log(`       - ${name} (${kindNames[kind] || kind}:${index})`);
      }
      
      offset = sectionStart + sectionSize;
    } else {
      offset += sectionSize;
    }
    
    if (offset > wasmBuffer.length) break;
  }
  
  console.log('\n=== Analysis Complete ===');
  console.log('\nNext steps:');
  console.log('1. Use wasm2wat to disassemble the WASM binary');
  console.log('2. Analyze the process_img_data and get_img_key functions');
  console.log('3. Identify the encryption algorithm (likely AES-256-CBC or similar)');
  console.log('4. Replicate in JavaScript');
}

analyzeWasm().catch(console.error);
