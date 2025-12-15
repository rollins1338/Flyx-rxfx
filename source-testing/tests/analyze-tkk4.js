/**
 * Analyze tkk4.js to understand token generation
 */

const fs = require('fs');

async function main() {
  console.log('=== ANALYZING TKK4.JS ===\n');
  
  const content = fs.readFileSync('source-testing/smashystream-tkk4.js', 'utf8');
  console.log(`File size: ${content.length} chars`);
  
  // Find the key exports
  console.log('\n=== KEY EXPORTS ===\n');
  
  // Look for _gewe_town
  const geweTownIndex = content.indexOf('_gewe_town');
  if (geweTownIndex !== -1) {
    console.log('Found _gewe_town');
    const context = content.substring(Math.max(0, geweTownIndex - 200), geweTownIndex + 200);
    console.log(`Context: ${context}`);
  }
  
  // Look for _free_token
  const freeTokenIndex = content.indexOf('_free_token');
  if (freeTokenIndex !== -1) {
    console.log('\nFound _free_token');
    const context = content.substring(Math.max(0, freeTokenIndex - 200), freeTokenIndex + 200);
    console.log(`Context: ${context}`);
  }
  
  // Look for Module exports
  console.log('\n=== MODULE EXPORTS ===\n');
  
  const moduleExports = content.match(/Module\["_\w+"\]/g);
  if (moduleExports) {
    const unique = [...new Set(moduleExports)];
    console.log('Module exports:');
    for (const e of unique) {
      console.log(`  ${e}`);
    }
  }
  
  // Look for cwrap or ccall (Emscripten patterns)
  console.log('\n=== EMSCRIPTEN PATTERNS ===\n');
  
  if (content.includes('cwrap')) {
    console.log('Contains cwrap');
    const cwrapMatches = content.match(/cwrap\s*\([^)]+\)/g);
    if (cwrapMatches) {
      for (const c of cwrapMatches.slice(0, 10)) {
        console.log(`  ${c}`);
      }
    }
  }
  
  if (content.includes('ccall')) {
    console.log('Contains ccall');
  }
  
  // Look for the WASM binary
  console.log('\n=== WASM BINARY ===\n');
  
  // WASM is usually base64 encoded or as a data URI
  if (content.includes('data:application/wasm')) {
    console.log('Contains embedded WASM as data URI');
  }
  
  if (content.includes('AGFzbQ')) {
    console.log('Contains base64 encoded WASM (AGFzbQ is WASM magic bytes in base64)');
  }
  
  // Look for the token function signature
  console.log('\n=== TOKEN FUNCTION ANALYSIS ===\n');
  
  // Search for patterns that might indicate the token function
  const tokenPatterns = [
    /gewe_town[^;]+/g,
    /token[^;]{0,100}/gi,
  ];
  
  for (const pattern of tokenPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`\nPattern ${pattern}:`);
      for (const m of matches.slice(0, 5)) {
        console.log(`  ${m.substring(0, 100)}`);
      }
    }
  }
  
  // Look for how the function is called from the player bundle
  console.log('\n=== CHECKING PLAYER BUNDLE FOR USAGE ===\n');
  
  const playerBundle = fs.readFileSync('source-testing/smashystream-player-bundle.js', 'utf8');
  
  // The decoded strings showed:
  // [133]: Module function name (needs decoding with second charset)
  // [135]: Another function name
  // [137]: tokenFunc
  // [138]: freeTokenFunc
  
  // Look for Module usage in player bundle
  const moduleUsage = playerBundle.match(/Module\[[^\]]+\]/g);
  if (moduleUsage) {
    console.log('Module usage in player bundle:');
    const unique = [...new Set(moduleUsage)];
    for (const m of unique) {
      console.log(`  ${m}`);
    }
  }
  
  // Look for the actual function call pattern
  console.log('\n=== FUNCTION CALL PATTERN ===\n');
  
  // From the decoded code, we know:
  // const _ = Module[x(f[20])](x(133), x(f[19]), [x(f[19])])
  // f[20] = 134, f[19] = 132
  // So it's: Module[decoded(134)](decoded(133), decoded(132), [decoded(132)])
  
  // This looks like cwrap: Module.cwrap(funcName, returnType, [argTypes])
  
  console.log('The token function is likely called via:');
  console.log('  Module.cwrap("gewe_town", "string", ["string"])');
  console.log('  or similar pattern');
  
  // Let's verify by looking at the tkk4.js exports
  const asmExports = content.match(/asm\["[^"]+"\]/g);
  if (asmExports) {
    console.log('\nASM exports:');
    const unique = [...new Set(asmExports)];
    for (const e of unique.slice(0, 20)) {
      console.log(`  ${e}`);
    }
  }
}

main().catch(console.error);
