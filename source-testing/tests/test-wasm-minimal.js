const fs = require('fs');
const path = require('path');

console.log('Starting minimal WASM test...');

const WASM_PATH = path.join(__dirname, 'wasm-analysis/client-assets/img_data_bg.wasm');
console.log('WASM path:', WASM_PATH);
console.log('Exists:', fs.existsSync(WASM_PATH));

async function test() {
  console.log('Loading WASM...');
  const wasmBuffer = fs.readFileSync(WASM_PATH);
  console.log('Buffer size:', wasmBuffer.length);
  
  console.log('Compiling...');
  const module = await WebAssembly.compile(wasmBuffer);
  console.log('Module compiled');
  
  const imports = WebAssembly.Module.imports(module);
  console.log('Required imports:', imports.length);
  console.log('First 5 imports:', imports.slice(0, 5).map(i => i.name));
}

test().then(() => console.log('Done')).catch(e => console.error('Error:', e));
