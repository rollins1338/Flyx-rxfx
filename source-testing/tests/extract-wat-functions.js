/**
 * Extract specific functions from WAT file
 */

const fs = require('fs');

const WAT_PATH = 'source-testing/tests/wasm-analysis/img_data_bg.wat';
const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

// Read the WAT file
const wat = fs.readFileSync(WAT_PATH, 'utf8');

console.log(`WAT file size: ${wat.length} bytes\n`);

// Find all function definitions
const funcRegex = /\(func \$(\w+) \(;(\d+);\)/g;
const functions = [];
let match;

while ((match = funcRegex.exec(wat)) !== null) {
  functions.push({
    name: match[1],
    index: parseInt(match[2]),
    position: match.index,
  });
}

console.log(`Found ${functions.length} functions\n`);

// Sort by index
functions.sort((a, b) => a.index - b.index);

// Find key functions
const keyFuncIndices = [52, 57, 58, 59, 132]; // Main decryption, get_img_key, AES functions, process_img_data

for (const idx of keyFuncIndices) {
  const func = functions.find(f => f.index === idx);
  if (!func) {
    console.log(`Function ${idx} not found`);
    continue;
  }
  
  // Find the next function to determine end position
  const nextFunc = functions.find(f => f.index > idx);
  const endPos = nextFunc ? nextFunc.position : wat.length;
  
  // Extract function body
  const funcBody = wat.slice(func.position, endPos);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Function ${idx}: ${func.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Size: ${funcBody.length} chars`);
  
  // Save to file
  fs.writeFileSync(`${OUTPUT_DIR}/func_${idx}_${func.name}.wat`, funcBody);
  console.log(`Saved to: func_${idx}_${func.name}.wat`);
  
  // Show first 2000 chars
  console.log('\nFirst 2000 chars:');
  console.log(funcBody.slice(0, 2000));
  if (funcBody.length > 2000) {
    console.log(`\n... (${funcBody.length - 2000} more chars)`);
  }
}

// Also find the data section
const dataMatch = wat.match(/\(data \$\d+ \(i32\.const (\d+)\) "([^"]+)"\)/g);
if (dataMatch) {
  console.log(`\n\nFound ${dataMatch.length} data sections`);
  
  // Look for interesting strings
  const interestingStrings = [];
  for (const d of dataMatch.slice(0, 50)) {
    const m = d.match(/\(data \$\d+ \(i32\.const (\d+)\) "([^"]+)"\)/);
    if (m) {
      const offset = parseInt(m[1]);
      const data = m[2];
      // Decode escape sequences
      let decoded = '';
      for (let i = 0; i < data.length; i++) {
        if (data[i] === '\\' && i + 1 < data.length) {
          const next = data[i + 1];
          if (next === 'n') { decoded += '\n'; i++; }
          else if (next === 't') { decoded += '\t'; i++; }
          else if (next === '\\') { decoded += '\\'; i++; }
          else if (next === '"') { decoded += '"'; i++; }
          else if (/[0-9a-fA-F]/.test(next) && i + 2 < data.length) {
            const hex = data.slice(i + 1, i + 3);
            decoded += String.fromCharCode(parseInt(hex, 16));
            i += 2;
          } else {
            decoded += data[i];
          }
        } else {
          decoded += data[i];
        }
      }
      
      // Check if it's printable
      const printable = decoded.replace(/[^\x20-\x7E]/g, '.');
      if (printable.length > 5 && /[a-zA-Z]{3,}/.test(printable)) {
        interestingStrings.push({ offset, data: printable.slice(0, 100) });
      }
    }
  }
  
  console.log('\nInteresting strings:');
  for (const s of interestingStrings.slice(0, 30)) {
    console.log(`  ${s.offset}: ${s.data}`);
  }
}

// Find imports
const importMatch = wat.match(/\(import "wbg" "([^"]+)"/g);
if (importMatch) {
  console.log(`\n\nImports (${importMatch.length}):`);
  for (const imp of importMatch.slice(0, 20)) {
    const m = imp.match(/\(import "wbg" "([^"]+)"/);
    if (m) {
      console.log(`  ${m[1]}`);
    }
  }
}

console.log('\n\nDone!');
