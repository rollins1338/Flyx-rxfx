/**
 * Analyze WASM Binary - Extract function names and structure
 * 
 * Goal: Understand the PRNG algorithm used for counter generation
 */

const fs = require('fs');
const path = require('path');

async function analyzeWasm() {
  console.log('=== WASM Binary Analysis ===\n');
  
  const wasmPath = path.join(__dirname, 'flixer_img_data.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM file size: ${wasmBuffer.length} bytes`);
  
  // Parse WASM header
  const magic = wasmBuffer.slice(0, 4).toString('hex');
  const version = wasmBuffer.readUInt32LE(4);
  console.log(`Magic: ${magic} (expected: 0061736d)`);
  console.log(`Version: ${version}`);
  
  // Compile and instantiate the WASM
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  
  // Get exports
  const exports = WebAssembly.Module.exports(wasmModule);
  console.log('\n=== Exported Functions ===');
  exports.forEach(exp => {
    console.log(`  ${exp.name}: ${exp.kind}`);
  });
  
  // Get imports
  const imports = WebAssembly.Module.imports(wasmModule);
  console.log('\n=== Imported Functions ===');
  imports.forEach(imp => {
    console.log(`  ${imp.module}.${imp.name}: ${imp.kind}`);
  });
  
  // Search for interesting strings in the binary
  console.log('\n=== Searching for Strings ===');
  const wasmStr = wasmBuffer.toString('utf8', 0, wasmBuffer.length);
  
  // Look for crypto-related strings
  const cryptoPatterns = [
    'aes', 'ctr', 'prng', 'random', 'seed', 'nonce', 'counter',
    'sha', 'hmac', 'encrypt', 'decrypt', 'key', 'iv', 'block'
  ];
  
  for (const pattern of cryptoPatterns) {
    const regex = new RegExp(pattern, 'gi');
    const matches = wasmStr.match(regex);
    if (matches) {
      console.log(`  Found "${pattern}": ${matches.length} occurrences`);
    }
  }
  
  // Look for Rust crate names (they often appear in panic messages)
  console.log('\n=== Looking for Rust Crate Names ===');
  const cratePatterns = [
    /[a-z_]+::[a-z_]+/gi,
    /crate::[a-z_]+/gi,
    /src\/[a-z_]+\.rs/gi,
  ];
  
  const foundCrates = new Set();
  for (const pattern of cratePatterns) {
    const matches = wasmStr.match(pattern);
    if (matches) {
      matches.forEach(m => foundCrates.add(m));
    }
  }
  
  if (foundCrates.size > 0) {
    console.log('Found crate references:');
    [...foundCrates].slice(0, 20).forEach(c => console.log(`  ${c}`));
  }
  
  // Look for version strings
  console.log('\n=== Looking for Version Strings ===');
  const versionPattern = /\d+\.\d+\.\d+/g;
  const versions = wasmStr.match(versionPattern);
  if (versions) {
    const uniqueVersions = [...new Set(versions)];
    console.log('Found versions:', uniqueVersions.slice(0, 10).join(', '));
  }
  
  // Analyze the binary for AES S-box (characteristic pattern)
  console.log('\n=== Looking for AES S-box ===');
  // AES S-box starts with: 0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5
  const sboxStart = Buffer.from([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5]);
  const sboxIndex = wasmBuffer.indexOf(sboxStart);
  if (sboxIndex !== -1) {
    console.log(`AES S-box found at offset ${sboxIndex}`);
  } else {
    console.log('AES S-box not found (may be computed at runtime)');
  }
  
  // Look for specific byte patterns that might indicate PRNG
  console.log('\n=== Analyzing Data Sections ===');
  
  // Find data sections (look for long sequences of non-zero bytes)
  let dataStart = -1;
  let dataLength = 0;
  for (let i = 0; i < wasmBuffer.length - 100; i++) {
    let nonZero = 0;
    for (let j = 0; j < 100; j++) {
      if (wasmBuffer[i + j] !== 0) nonZero++;
    }
    if (nonZero > 90 && dataStart === -1) {
      dataStart = i;
    } else if (nonZero < 50 && dataStart !== -1) {
      dataLength = i - dataStart;
      console.log(`Data section at ${dataStart}, length ${dataLength}`);
      dataStart = -1;
    }
  }
  
  // Extract readable strings
  console.log('\n=== Readable Strings ===');
  const stringPattern = /[\x20-\x7e]{8,}/g;
  const strings = wasmBuffer.toString('utf8').match(stringPattern);
  if (strings) {
    const uniqueStrings = [...new Set(strings)].filter(s => 
      !s.match(/^[\x00-\x1f]+$/) && 
      s.length < 100
    );
    console.log(`Found ${uniqueStrings.length} readable strings:`);
    uniqueStrings.slice(0, 50).forEach(s => console.log(`  "${s}"`));
  }
}

analyzeWasm().catch(console.error);
