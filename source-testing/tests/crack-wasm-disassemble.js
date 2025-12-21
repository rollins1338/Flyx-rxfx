/**
 * Disassemble WASM - Convert WASM to WAT and analyze the key derivation
 */

const fs = require('fs');
const wabt = require('wabt');

async function disassembleWasm() {
  console.log('=== Disassembling WASM ===\n');
  
  const wasmPath = 'wasm-analysis/client-assets/img_data_bg.wasm';
  const wasmBuffer = fs.readFileSync(wasmPath);
  
  console.log(`WASM size: ${wasmBuffer.length} bytes`);
  
  const wabtModule = await wabt();
  
  try {
    const module = wabtModule.readWasm(wasmBuffer, {
      readDebugNames: true,
    });
    
    const wat = module.toText({
      foldExprs: false,
      inlineExport: false,
    });
    
    // Save the WAT file
    fs.writeFileSync('wasm-analysis/img_data.wat', wat);
    console.log('WAT saved to: wasm-analysis/img_data.wat');
    console.log(`WAT size: ${wat.length} bytes`);
    
    // Analyze the WAT
    console.log('\n=== Analyzing WAT ===\n');
    
    // Find exported functions
    const exportMatches = wat.match(/\(export "([^"]+)" \(func (\d+)\)\)/g);
    if (exportMatches) {
      console.log('Exported functions:');
      for (const match of exportMatches) {
        console.log(`  ${match}`);
      }
    }
    
    // Find functions that might be related to key derivation
    const funcMatches = wat.match(/\(func \$([^\s]+)/g);
    if (funcMatches) {
      console.log(`\nTotal functions: ${funcMatches.length}`);
      
      // Look for interesting function names
      const interestingFuncs = funcMatches.filter(f => 
        f.includes('key') ||
        f.includes('hash') ||
        f.includes('sha') ||
        f.includes('derive') ||
        f.includes('fingerprint') ||
        f.includes('img') ||
        f.includes('get')
      );
      
      if (interestingFuncs.length > 0) {
        console.log('\nInteresting functions:');
        for (const f of interestingFuncs) {
          console.log(`  ${f}`);
        }
      }
    }
    
    // Look for the get_img_key function
    const getImgKeyMatch = wat.match(/\(export "get_img_key" \(func (\d+)\)\)/);
    if (getImgKeyMatch) {
      const funcIndex = getImgKeyMatch[1];
      console.log(`\nget_img_key is function ${funcIndex}`);
      
      // Find the function definition
      const funcRegex = new RegExp(`\\(func \\(;${funcIndex};\\)[^]*?(?=\\(func |$)`, 's');
      const funcMatch = wat.match(funcRegex);
      
      if (funcMatch) {
        console.log(`\nget_img_key function (first 2000 chars):`);
        console.log(funcMatch[0].slice(0, 2000));
      }
    }
    
    // Look for data section
    const dataMatches = wat.match(/\(data \(i32\.const (\d+)\) "([^"]+)"\)/g);
    if (dataMatches) {
      console.log(`\nData sections: ${dataMatches.length}`);
      
      // Look for interesting data
      for (const match of dataMatches.slice(0, 20)) {
        const offsetMatch = match.match(/i32\.const (\d+)/);
        const dataMatch = match.match(/"([^"]+)"/);
        if (offsetMatch && dataMatch) {
          const offset = offsetMatch[1];
          const data = dataMatch[1];
          if (data.length > 10 && !data.includes('\\00\\00\\00\\00')) {
            console.log(`  [${offset}] ${data.slice(0, 100)}`);
          }
        }
      }
    }
    
    module.destroy();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

disassembleWasm().catch(console.error);
