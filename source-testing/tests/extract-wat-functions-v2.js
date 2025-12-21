/**
 * Extract specific functions from WAT file - v2
 */

const fs = require('fs');

const WAT_PATH = 'source-testing/tests/wasm-analysis/img_data_bg.wat';
const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

// Read the WAT file
const wat = fs.readFileSync(WAT_PATH, 'utf8');

console.log(`WAT file size: ${wat.length} bytes\n`);

// Find all function definitions - format: (func (;N;) (type M)
const funcRegex = /\(func \(;(\d+);\) \(type \d+\)/g;
const functions = [];
let match;

while ((match = funcRegex.exec(wat)) !== null) {
  functions.push({
    index: parseInt(match[1]),
    position: match.index,
  });
}

console.log(`Found ${functions.length} functions\n`);

// Sort by index
functions.sort((a, b) => a.index - b.index);

// Find key functions
const keyFuncIndices = [52, 57, 58, 59, 132]; // Main decryption, get_img_key, AES functions, process_img_data

for (const idx of keyFuncIndices) {
  const funcIdx = functions.findIndex(f => f.index === idx);
  if (funcIdx === -1) {
    console.log(`Function ${idx} not found`);
    continue;
  }
  
  const func = functions[funcIdx];
  
  // Find the next function to determine end position
  const nextFunc = functions[funcIdx + 1];
  const endPos = nextFunc ? nextFunc.position : wat.length;
  
  // Extract function body
  const funcBody = wat.slice(func.position, endPos);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Function ${idx}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Size: ${funcBody.length} chars`);
  
  // Save to file
  fs.writeFileSync(`${OUTPUT_DIR}/func_${idx}.wat`, funcBody);
  console.log(`Saved to: func_${idx}.wat`);
  
  // Analyze the function
  const calls = funcBody.match(/call (\d+)/g) || [];
  const uniqueCalls = [...new Set(calls.map(c => parseInt(c.split(' ')[1])))];
  console.log(`Calls to functions: ${uniqueCalls.join(', ')}`);
  
  // Count operations
  const xorCount = (funcBody.match(/i32\.xor|i64\.xor/g) || []).length;
  const loadCount = (funcBody.match(/\.load/g) || []).length;
  const storeCount = (funcBody.match(/\.store/g) || []).length;
  console.log(`XOR ops: ${xorCount}, Loads: ${loadCount}, Stores: ${storeCount}`);
  
  // Show first 3000 chars
  console.log('\nFirst 3000 chars:');
  console.log(funcBody.slice(0, 3000));
  if (funcBody.length > 3000) {
    console.log(`\n... (${funcBody.length - 3000} more chars)`);
  }
}

// Also extract the exports section
const exportsMatch = wat.match(/\(export "[^"]+" \(func (\d+)\)\)/g);
if (exportsMatch) {
  console.log('\n\nExports:');
  for (const exp of exportsMatch) {
    console.log(`  ${exp}`);
  }
}

// Find data section with strings
console.log('\n\nLooking for data sections...');
const dataMatch = wat.match(/\(data \(i32\.const (\d+)\) "([^"]+)"\)/g);
if (dataMatch) {
  console.log(`Found ${dataMatch.length} data sections`);
  
  // Look for interesting strings
  for (const d of dataMatch.slice(0, 100)) {
    const m = d.match(/\(data \(i32\.const (\d+)\) "([^"]+)"\)/);
    if (m) {
      const offset = parseInt(m[1]);
      const data = m[2];
      
      // Check for readable strings
      if (data.length > 10 && /[a-zA-Z_]{4,}/.test(data)) {
        // Decode escape sequences
        let decoded = data.replace(/\\([0-9a-fA-F]{2})/g, (_, hex) => {
          const code = parseInt(hex, 16);
          return code >= 32 && code < 127 ? String.fromCharCode(code) : '.';
        });
        decoded = decoded.replace(/[^\x20-\x7E]/g, '.');
        
        if (/[a-zA-Z]{4,}/.test(decoded)) {
          console.log(`  ${offset}: ${decoded.slice(0, 80)}`);
        }
      }
    }
  }
}

console.log('\n\nDone!');
