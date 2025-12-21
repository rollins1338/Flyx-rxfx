/**
 * Analyze WAT - Look for key derivation patterns in the disassembled WASM
 */

const fs = require('fs');

function analyzeWat() {
  console.log('=== Analyzing WAT ===\n');
  
  const wat = fs.readFileSync('wasm-analysis/img_data.wat', 'utf8');
  
  console.log(`WAT size: ${wat.length} bytes`);
  console.log(`Lines: ${wat.split('\n').length}`);
  
  // Find all function definitions
  const funcMatches = wat.match(/\(func \(;\d+;\)/g);
  console.log(`\nTotal functions: ${funcMatches ? funcMatches.length : 0}`);
  
  // Find all exports
  const exports = wat.match(/\(export "[^"]+" \(func \d+\)\)/g);
  console.log('\nExports:');
  if (exports) {
    for (const exp of exports) {
      console.log(`  ${exp}`);
    }
  }
  
  // Find data sections with interesting content
  console.log('\n=== Data Sections ===\n');
  
  const dataMatches = wat.matchAll(/\(data \(i32\.const (\d+)\) "([^"]+)"\)/g);
  const dataItems = [];
  
  for (const match of dataMatches) {
    const offset = parseInt(match[1]);
    const data = match[2];
    
    // Decode escape sequences
    let decoded = '';
    let i = 0;
    while (i < data.length) {
      if (data[i] === '\\' && i + 2 < data.length) {
        const hex = data.substr(i + 1, 2);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          decoded += String.fromCharCode(parseInt(hex, 16));
          i += 3;
          continue;
        }
      }
      decoded += data[i];
      i++;
    }
    
    dataItems.push({ offset, raw: data, decoded });
  }
  
  console.log(`Total data items: ${dataItems.length}`);
  
  // Look for interesting strings
  console.log('\n=== Interesting Strings ===\n');
  
  for (const item of dataItems) {
    // Check if it contains printable ASCII
    const printable = item.decoded.replace(/[^\x20-\x7E]/g, '');
    if (printable.length > 10) {
      console.log(`[${item.offset}] ${printable.slice(0, 100)}`);
    }
  }
  
  // Look for format strings
  console.log('\n=== Format Strings ===\n');
  
  for (const item of dataItems) {
    if (item.decoded.includes('{}') || item.decoded.includes(':')) {
      const printable = item.decoded.replace(/[^\x20-\x7E]/g, '.');
      console.log(`[${item.offset}] ${printable.slice(0, 100)}`);
    }
  }
  
  // Look for SHA256 constants
  console.log('\n=== SHA256 Constants ===\n');
  
  // SHA256 initial hash values (H0-H7) as hex strings
  const sha256H = [
    '6a09e667', 'bb67ae85', '3c6ef372', 'a54ff53a',
    '510e527f', '9b05688c', '1f83d9ab', '5be0cd19'
  ];
  
  for (const h of sha256H) {
    // Search for the constant in the WAT
    const pattern = `i32.const ${parseInt(h, 16)}`;
    if (wat.includes(pattern)) {
      console.log(`Found SHA256 H constant: ${h} (${parseInt(h, 16)})`);
    }
    
    // Also search for negative representation
    const signed = parseInt(h, 16) | 0;
    if (signed < 0) {
      const negPattern = `i32.const ${signed}`;
      if (wat.includes(negPattern)) {
        console.log(`Found SHA256 H constant (signed): ${h} (${signed})`);
      }
    }
  }
  
  // Look for the fingerprint format
  console.log('\n=== Fingerprint Format Search ===\n');
  
  // Search for colons in data
  for (const item of dataItems) {
    if (item.decoded.includes(':') && item.decoded.length > 5) {
      const printable = item.decoded.replace(/[^\x20-\x7E:]/g, '.');
      if (printable.includes(':')) {
        console.log(`[${item.offset}] ${printable.slice(0, 150)}`);
      }
    }
  }
  
  // Look for specific constants used in get_img_key
  console.log('\n=== Constants in get_img_key ===\n');
  
  // Extract function 57 (get_img_key)
  const func57Start = wat.indexOf('(func (;57;)');
  const func58Start = wat.indexOf('(func (;58;)');
  
  if (func57Start !== -1 && func58Start !== -1) {
    const func57 = wat.slice(func57Start, func58Start);
    
    // Find all i32.const values
    const constMatches = func57.matchAll(/i32\.const (\d+)/g);
    const constants = new Set();
    
    for (const match of constMatches) {
      const val = parseInt(match[1]);
      if (val > 1000000) { // Likely memory offsets
        constants.add(val);
      }
    }
    
    console.log('Memory offsets used in get_img_key:');
    const sortedConstants = Array.from(constants).sort((a, b) => a - b);
    for (const c of sortedConstants.slice(0, 30)) {
      // Look up what's at this offset in data
      const dataItem = dataItems.find(d => d.offset === c);
      if (dataItem) {
        const printable = dataItem.decoded.replace(/[^\x20-\x7E]/g, '.');
        console.log(`  [${c}] ${printable.slice(0, 50)}`);
      } else {
        console.log(`  [${c}] (no data)`);
      }
    }
  }
  
  // Look for XOR operations
  console.log('\n=== XOR Operations ===\n');
  
  const xorCount = (wat.match(/i32\.xor/g) || []).length;
  const xor64Count = (wat.match(/i64\.xor/g) || []).length;
  
  console.log(`i32.xor count: ${xorCount}`);
  console.log(`i64.xor count: ${xor64Count}`);
  
  // Look for the specific XOR pattern in get_img_key
  if (func57Start !== -1 && func58Start !== -1) {
    const func57 = wat.slice(func57Start, func58Start);
    const xorInFunc = (func57.match(/i32\.xor/g) || []).length;
    const xor64InFunc = (func57.match(/i64\.xor/g) || []).length;
    
    console.log(`XOR in get_img_key: i32=${xorInFunc}, i64=${xor64InFunc}`);
  }
}

analyzeWat();
