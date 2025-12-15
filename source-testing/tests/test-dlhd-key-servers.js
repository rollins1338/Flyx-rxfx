/**
 * Test different DLHD key server combinations
 * The M3U8 specifies chevy.kiko2.ru but maybe other servers work
 */

const https = require('https');

const CHANNEL = 51;
const KEY_ID = 5885923;

// Different server combinations to try
const KEY_SERVERS = [
  // Current format from M3U8
  `https://chevy.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://chevy.giokko.ru/key/premium${CHANNEL}/${KEY_ID}`,
  
  // Try zeko servers (since M3U8 comes from zekonew)
  `https://zeko.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://zekonew.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://zeko.giokko.ru/key/premium${CHANNEL}/${KEY_ID}`,
  
  // Try other car-named servers
  `https://ford.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://dodge.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://tesla.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://honda.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://toyota.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  
  // Try top servers
  `https://top1.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://top2.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  `https://top3.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  
  // Try chevynew (like zekonew)
  `https://chevynew.kiko2.ru/key/premium${CHANNEL}/${KEY_ID}`,
  
  // Try old wmsxx.php format
  `https://top1.kiko2.ru/wmsxx.php?id=${KEY_ID}&channel=premium${CHANNEL}`,
  `https://top2.kiko2.ru/wmsxx.php?id=${KEY_ID}&channel=premium${CHANNEL}`,
  `https://chevy.kiko2.ru/wmsxx.php?id=${KEY_ID}&channel=premium${CHANNEL}`,
];

function fetchKey(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://epicplayplay.cfd',
        'Referer': 'https://epicplayplay.cfd/',
      },
      timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({ 
          status: res.statusCode, 
          length: data.length,
          data: data.length === 16 && !data.toString('utf8').includes('error') 
            ? data.toString('hex') 
            : data.toString('utf8').substring(0, 50)
        });
      });
    });
    
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout' });
    });
  });
}

async function main() {
  console.log('Testing DLHD key servers...\n');
  console.log(`Channel: ${CHANNEL}, Key ID: ${KEY_ID}\n`);
  
  for (const url of KEY_SERVERS) {
    const result = await fetchKey(url);
    
    if (result.error) {
      console.log(`✗ ${url.substring(8, 50)}... - ${result.error}`);
    } else if (result.status === 200 && result.length === 16) {
      console.log(`✓ ${url.substring(8, 50)}... - VALID KEY: ${result.data}`);
    } else {
      console.log(`✗ ${url.substring(8, 50)}... - ${result.status} (${result.length}b): ${result.data}`);
    }
  }
}

main();
