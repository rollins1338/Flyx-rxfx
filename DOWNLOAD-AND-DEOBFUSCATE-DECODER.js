/**
 * DOWNLOAD THE DECODER SCRIPT AND ANALYZE IT
 */

const https = require('https');
const fs = require('fs');

// From our successful extraction, we know the decoder script path
const decoderUrl = 'https://cloudnestra.com/sV05kUlNvOdOxvtC/0e396fb9d7637c425ddb48b158fe996a.js?_=1744906950';

console.log('📥 Downloading decoder script...');
console.log('URL:', decoderUrl);

https.get(decoderUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ Downloaded:', data.length, 'bytes');
    
    fs.writeFileSync('decoder-script.js', data);
    console.log('💾 Saved to decoder-script.js');
    
    // Analyze the script
    console.log('\n🔍 Script Analysis:');
    console.log('First 500 chars:');
    console.log(data.substring(0, 500));
    
    // Look for key patterns
    console.log('\n🔎 Searching for key patterns...');
    
    if (data.includes('atob')) console.log('✅ Contains atob (base64 decode)');
    if (data.includes('charCodeAt')) console.log('✅ Contains charCodeAt (character manipulation)');
    if (data.includes('fromCharCode')) console.log('✅ Contains fromCharCode (character building)');
    if (data.includes('getElementById')) console.log('✅ Contains getElementById (div access)');
    if (data.includes('innerHTML')) console.log('✅ Contains innerHTML (content access)');
    
    // Look for XOR patterns
    const xorPattern = /\^/g;
    const xorMatches = data.match(xorPattern);
    if (xorMatches) {
      console.log(`✅ Contains ${xorMatches.length} XOR operations (^)`);
    }
    
    // Look for function definitions
    const funcPattern = /function\s+(\w+)/g;
    const functions = [];
    let match;
    while ((match = funcPattern.exec(data)) !== null) {
      functions.push(match[1]);
    }
    console.log(`\n📋 Found ${functions.length} named functions`);
    if (functions.length < 20) {
      console.log('Functions:', functions.join(', '));
    }
    
    console.log('\n💡 Next: Deobfuscate this script to understand the algorithm');
  });
}).on('error', (e) => {
  console.error('❌ Error:', e.message);
});
