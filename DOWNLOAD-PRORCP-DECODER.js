const https = require('https');
const fs = require('fs');

const url = 'https://cloudnestra.com/sV05kUlNvOdOxvtC/04ce07a8c2a05e7cd0a83c172996261b.js?_=1744906950';

https.get(url, {
  headers: {
    'Referer': 'https://vidsrc-embed.ru/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('prorcp-decoder-script.js', data);
    console.log('✅ Downloaded decoder script!');
    console.log('Length:', data.length);
    console.log('\nFirst 500 chars:');
    console.log(data.substring(0, 500));
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
