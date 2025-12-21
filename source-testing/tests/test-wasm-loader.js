const { FlixerWasmLoader } = require('./flixer-node-wasm-loader.js');
const crypto = require('crypto');

console.log('=== Test WASM Loader ===');

async function main() {
  console.log('Creating loader...');
  
  const loader = new FlixerWasmLoader({
    sessionId: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  });
  
  console.log('Initializing...');
  await loader.initialize();
  
  console.log('Getting key...');
  const key = loader.getImgKey();
  
  console.log('Key:', key);
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
