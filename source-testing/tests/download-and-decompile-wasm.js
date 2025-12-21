/**
 * Download and Decompile Flixer WASM
 * 
 * This script will:
 * 1. Download the latest WASM binary from flixer.sh
 * 2. Convert it to WAT (WebAssembly Text format)
 * 3. Analyze the structure and find key functions
 * 4. Extract embedded strings and constants
 */

const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('=== Flixer WASM Reverse Engineering ===\n');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Download the WASM file
  console.log('Downloading WASM from flixer.sh...');
  const wasmUrl = 'https://flixer.sh/wasm/img_data_bg.wasm';
  const wasmPath = path.join(OUTPUT_DIR, 'img_data_bg.wasm');
  
  try {
    await downloadFile(wasmUrl, wasmPath);
    console.log(`Downloaded to ${wasmPath}`);
  } catch (e) {
    console.log(`Download failed: ${e.message}`);
    // Use existing file if available
    const existingPath = 'source-testing/tests/flixer_img_data.wasm';
    if (fs.existsSync(existingPath)) {
      console.log('Using existing WASM file...');
      fs.copyFileSync(existingPath, wasmPath);
    } else {
      throw new Error('No WASM file available');
    }
  }
  
  const wasmBuffer = fs.readFileSync(wasmPath);
  console.log(`WASM size: ${wasmBuffer.length} bytes\n`);
  
  // Try to convert to WAT using wasm2wat if available
  console.log('Converting to WAT format...');
  const watPath = path.join(OUTPUT_DIR, 'img_data_bg.wat');
  
  try {
    execSync(`wasm2wat "${wasmPath}" -o "${watPath}"`, { stdio: 'pipe' });
    console.log(`WAT file created: ${watPath}`);
  } catch (e) {
    console.log('wasm2wat not available, using manual analysis...');
  }
  
  // Analyze the WASM binary structure
  console.log('\n=== WASM Binary Analysis ===\n');
  
  // WASM magic number and version
  const magic = wasmBuffer.slice(0, 4).toString('hex');
  const version = wasmBuffer.readUInt32LE(4);
  console.log(`Magic: ${magic} (should be 0061736d)`);
  console.log(`Version: ${version}`);
  
  // Parse WASM sections
  let offset = 8;
  const sections = [];
  
  while (offset < wasmBuffer.length) {
    const sectionId = wasmBuffer[offset];
    offset++;
    
    // Read LEB128 encoded size
    let size = 0;
    let shift = 0;
    let byte;
    do {
      byte = wasmBuffer[offset++];
      size |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    const sectionNames = {
      0: 'custom',
      1: 'type',
      2: 'import',
      3: 'function',
      4: 'table',
      5: 'memory',
      6: 'global',
      7: 'export',
      8: 'start',
      9: 'element',
      10: 'code',
      11: 'data',
      12: 'data_count',
    };
    
    sections.push({
      id: sectionId,
      name: sectionNames[sectionId] || `unknown_${sectionId}`,
      offset: offset,
      size: size,
    });
    
    offset += size;
  }
  
  console.log('Sections:');
  for (const section of sections) {
    console.log(`  ${section.name} (id=${section.id}): offset=${section.offset}, size=${section.size}`);
  }
  
  // Extract strings from the data section
  console.log('\n=== Extracting Strings ===\n');
  
  const dataSection = sections.find(s => s.name === 'data');
  if (dataSection) {
    const dataStart = dataSection.offset;
    const dataEnd = dataStart + dataSection.size;
    const dataBuffer = wasmBuffer.slice(dataStart, dataEnd);
    
    // Find printable ASCII strings
    const strings = [];
    let currentString = '';
    let stringStart = -1;
    
    for (let i = 0; i < dataBuffer.length; i++) {
      const byte = dataBuffer[i];
      if (byte >= 32 && byte < 127) {
        if (stringStart === -1) stringStart = i;
        currentString += String.fromCharCode(byte);
      } else {
        if (currentString.length >= 4) {
          strings.push({ offset: stringStart, value: currentString });
        }
        currentString = '';
        stringStart = -1;
      }
    }
    
    // Filter interesting strings
    const interestingStrings = strings.filter(s => 
      s.value.includes('aes') ||
      s.value.includes('ctr') ||
      s.value.includes('hmac') ||
      s.value.includes('key') ||
      s.value.includes('cipher') ||
      s.value.includes('encrypt') ||
      s.value.includes('decrypt') ||
      s.value.includes('hash') ||
      s.value.includes('sha') ||
      s.value.includes('nonce') ||
      s.value.includes('iv') ||
      s.value.includes('salt') ||
      s.value.includes('derive') ||
      s.value.includes('pbkdf') ||
      s.value.includes('hkdf') ||
      s.value.includes('random') ||
      s.value.includes('seed') ||
      s.value.includes('state') ||
      s.value.includes('block') ||
      s.value.includes('pad') ||
      s.value.includes('base64') ||
      s.value.includes('fingerprint') ||
      s.value.includes('canvas') ||
      s.value.includes('navigator') ||
      s.value.includes('screen') ||
      s.value.includes('localStorage') ||
      /^[0-9a-f]{32,}$/i.test(s.value) // Hex strings
    );
    
    console.log('Crypto-related strings:');
    for (const s of interestingStrings.slice(0, 50)) {
      console.log(`  [${s.offset}] ${s.value.slice(0, 100)}`);
    }
    
    // Find all Rust crate paths
    const crateStrings = strings.filter(s => s.value.includes('crates.io') || s.value.includes('registry'));
    console.log('\nRust crate references:');
    for (const s of crateStrings) {
      console.log(`  ${s.value.slice(0, 150)}`);
    }
  }
  
  // Look for embedded keys/constants
  console.log('\n=== Looking for Embedded Keys ===\n');
  
  // Search for 32-byte sequences with high entropy (potential keys)
  const potentialKeys = [];
  
  for (let i = 0; i < wasmBuffer.length - 32; i++) {
    const seq = wasmBuffer.slice(i, i + 32);
    
    // Calculate entropy
    const counts = new Array(256).fill(0);
    for (const byte of seq) counts[byte]++;
    
    let entropy = 0;
    for (const count of counts) {
      if (count > 0) {
        const p = count / 32;
        entropy -= p * Math.log2(p);
      }
    }
    
    // High entropy and not all same byte
    if (entropy > 4.5 && new Set(seq).size > 20) {
      // Check if it's in the data section (more likely to be a key)
      const inDataSection = dataSection && i >= dataSection.offset && i < dataSection.offset + dataSection.size;
      
      potentialKeys.push({
        offset: i,
        entropy: entropy,
        hex: seq.toString('hex'),
        inDataSection,
      });
    }
  }
  
  // Deduplicate and sort by entropy
  const uniqueKeys = [];
  const seen = new Set();
  for (const key of potentialKeys.sort((a, b) => b.entropy - a.entropy)) {
    if (!seen.has(key.hex)) {
      seen.add(key.hex);
      uniqueKeys.push(key);
    }
  }
  
  console.log('Potential embedded keys (high entropy 32-byte sequences):');
  for (const key of uniqueKeys.slice(0, 20)) {
    console.log(`  [${key.offset}] entropy=${key.entropy.toFixed(2)} data=${key.inDataSection} ${key.hex}`);
  }
  
  // Save analysis results
  const analysisPath = path.join(OUTPUT_DIR, 'analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify({
    wasmSize: wasmBuffer.length,
    sections,
    potentialKeys: uniqueKeys.slice(0, 50),
  }, null, 2));
  
  console.log(`\nAnalysis saved to ${analysisPath}`);
  
  // Now let's try to understand the decryption function
  console.log('\n=== Function Analysis ===\n');
  
  // The main function is process_img_data which takes (encrypted_base64, api_key)
  // We need to trace through the WASM to understand:
  // 1. How the key is derived
  // 2. How the IV/nonce is extracted from the prefix
  // 3. The exact AES-CTR implementation
  
  // Look for the export section to find function indices
  const exportSection = sections.find(s => s.name === 'export');
  if (exportSection) {
    console.log('Analyzing export section...');
    // The exports tell us which functions are process_img_data and get_img_key
  }
  
  // Look for the code section
  const codeSection = sections.find(s => s.name === 'code');
  if (codeSection) {
    console.log(`Code section: ${codeSection.size} bytes`);
    console.log('This contains the actual function implementations.');
  }
  
  console.log('\nTo fully reverse engineer, we need to:');
  console.log('1. Use wasm2wat to get readable assembly');
  console.log('2. Identify the key derivation function');
  console.log('3. Trace the AES-CTR implementation');
  console.log('4. Find where the fingerprint is used');
}

main().catch(console.error);
