const https = require('https');
const fs = require('fs');

const url = 'https://cloudnestra.com/sbx.js?t=1751380596';

console.log(`📥 Downloading SBX decoder: ${url}\n`);

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('sbx-decoder.js', data);
    console.log(`✅ Downloaded ${data.length} bytes`);
    console.log(`💾 Saved to: sbx-decoder.js\n`);
    
    // Quick analysis
    console.log('Quick analysis:');
    console.log(`- Contains getElementById: ${data.includes('getElementById')}`);
    console.log(`- Contains textContent: ${data.includes('textContent')}`);
    console.log(`- Contains window[: ${data.includes('window[')}`);
    console.log(`- Contains atob: ${data.includes('atob')}`);
    console.log(`- Contains charCodeAt: ${data.includes('charCodeAt')}`);
    
    console.log('\nFirst 500 chars:');
    console.log(data.substring(0, 500));
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
