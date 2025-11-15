const https = require('https');
const fs = require('fs');

const url = 'https://cloudnestra.com/pjs/pjs_main_drv_cast.061125.js';

console.log(`Downloading: ${url}\n`);

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('pjs_main_drv_cast.js', data);
    console.log(`✅ Downloaded ${data.length} bytes`);
    console.log(`💾 Saved to: pjs_main_drv_cast.js\n`);
    
    // Search for the decoder
    if (data.includes('getElementById')) {
      console.log('✅ Contains getElementById');
    }
    if (data.includes('atob')) {
      console.log('✅ Contains atob');
    }
    if (data.includes('window[')) {
      console.log('✅ Contains window[] assignment');
    }
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
