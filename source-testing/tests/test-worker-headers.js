/**
 * Test what headers are being sent when a CF Worker makes a request
 * We'll use a request bin service to see exactly what headers arrive
 */

const https = require('https');

// Use httpbin.org to echo back the headers we send
const testUrl = 'https://httpbin.org/headers';

console.log('Testing what headers arrive at destination...\n');

const options = {
  hostname: 'httpbin.org',
  path: '/headers',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Referer': 'https://111movies.com/',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Headers received by httpbin.org:');
    console.log(JSON.parse(data).headers);
  });
});

req.on('error', e => console.error('Error:', e.message));
req.end();
