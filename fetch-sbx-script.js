const https = require('https');

async function fetch(url) {
  return new Promise((resolve, reject) => {
    https.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudnestra.com/'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).end();
  });
}

async function fetchScript() {
  const url = 'https://cloudnestra.com/sbx.js?t=1751380596';
  console.log('Fetching sbx.js...\n');
  
  const script = await fetch(url);
  console.log(script);
}

fetchScript().catch(console.error);
