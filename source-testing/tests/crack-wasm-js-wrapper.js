/**
 * Crack WASM - Analyze JS Wrapper
 * 
 * Let's download and analyze the JavaScript wrapper that loads the WASM.
 * This might reveal how the decryption is called and what parameters are passed.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://flixer.sh/',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function analyzeJsWrapper() {
  console.log('=== Analyze WASM JS Wrapper ===\n');
  
  // Download the JS wrapper
  console.log('Downloading img_data.js...');
  const jsWrapper = await httpsGet('https://plsdontscrapemelove.flixer.sh/assets/wasm/img_data.js?v=1');
  
  // Save it for analysis
  fs.writeFileSync(path.join(__dirname, 'flixer_img_data.js'), jsWrapper);
  console.log(`Saved img_data.js (${jsWrapper.length} bytes)\n`);
  
  // Analyze the wrapper
  console.log('=== JS Wrapper Analysis ===\n');
  
  // Look for function definitions
  const functionMatches = jsWrapper.match(/function\s+(\w+)\s*\(/g) || [];
  console.log(`Functions found: ${functionMatches.length}`);
  console.log(functionMatches.slice(0, 20).join('\n'));
  
  // Look for process_img_data
  const processMatch = jsWrapper.match(/process_img_data[^}]+/);
  if (processMatch) {
    console.log('\n=== process_img_data context ===');
    console.log(processMatch[0].substring(0, 500));
  }
  
  // Look for wasm imports
  const importMatches = jsWrapper.match(/__wbg_\w+/g) || [];
  const uniqueImports = [...new Set(importMatches)];
  console.log(`\n=== WASM Imports (${uniqueImports.length}) ===`);
  console.log(uniqueImports.slice(0, 30).join('\n'));
  
  // Look for crypto-related code
  const cryptoMatches = jsWrapper.match(/crypto|encrypt|decrypt|aes|hmac|hash/gi) || [];
  console.log(`\n=== Crypto-related terms: ${cryptoMatches.length} ===`);
  console.log([...new Set(cryptoMatches)].join(', '));
  
  // Look for base64 handling
  const base64Matches = jsWrapper.match(/atob|btoa|base64/gi) || [];
  console.log(`\n=== Base64 terms: ${base64Matches.length} ===`);
  
  // Look for the init function
  const initMatch = jsWrapper.match(/async\s+function\s+init[^}]+\{[^}]+\}/s);
  if (initMatch) {
    console.log('\n=== init function ===');
    console.log(initMatch[0].substring(0, 1000));
  }
  
  // Look for key handling
  const keyMatches = jsWrapper.match(/key|Key|KEY/g) || [];
  console.log(`\n=== Key references: ${keyMatches.length} ===`);
  
  // Print the full wrapper for manual analysis
  console.log('\n=== Full JS Wrapper (first 5000 chars) ===\n');
  console.log(jsWrapper.substring(0, 5000));
  
  console.log('\n\n=== Full JS Wrapper (last 3000 chars) ===\n');
  console.log(jsWrapper.substring(jsWrapper.length - 3000));
}

analyzeJsWrapper().catch(console.error);
