const https = require('https');
const fs = require('fs');

const url = 'https://cloudnestra.com/sV05kUlNvOdOxvtC/07d708a0a39d7c4a97417b9b70a9fdfc.js?_=1744906950';

console.log(`📥 Downloading obfuscated script: ${url}\n`);

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('obfuscated-decoder.js', data);
    console.log(`✅ Downloaded ${data.length} bytes`);
    console.log(`💾 Saved to: obfuscated-decoder.js\n`);
    
    // Quick analysis
    console.log('Quick analysis:');
    console.log(`- Contains getElementById: ${data.includes('getElementById')}`);
    console.log(`- Contains textContent: ${data.includes('textContent')}`);
    console.log(`- Contains innerHTML: ${data.includes('innerHTML')}`);
    console.log(`- Contains window[: ${data.includes('window[')}`);
    console.log(`- Contains atob: ${data.includes('atob')}`);
    console.log(`- Contains charCodeAt: ${data.includes('charCodeAt')}`);
    console.log(`- Contains fromCharCode: ${data.includes('fromCharCode')}`);
    
    console.log('\nFirst 1000 chars:');
    console.log(data.substring(0, 1000));
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
