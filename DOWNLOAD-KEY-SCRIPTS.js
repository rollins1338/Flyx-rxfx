const https = require('https');
const fs = require('fs');

const scripts = [
  'https://vidsrc-embed.ru/base64.js?t=1688387834',
  'https://vidsrc-embed.ru/sources.js?t=1745104089',
  'https://vidsrc-embed.ru/sbx.js?t=1754734900'
];

async function downloadScript(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  for (const url of scripts) {
    const filename = url.split('/').pop().split('?')[0];
    console.log(`Downloading ${filename}...`);
    const content = await downloadScript(url);
    fs.writeFileSync(`downloaded-${filename}`, content);
    console.log(`✅ Saved ${filename} (${content.length} bytes)`);
  }
})();
