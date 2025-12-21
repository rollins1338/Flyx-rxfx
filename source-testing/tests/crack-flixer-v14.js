/**
 * Crack Flixer.sh - V14
 * 
 * Let's check if there's an external decryption service for Flixer
 * similar to how Videasy uses enc-dec.app
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const API_BASE = 'https://plsdontscrapemelove.flixer.sh';
const DECRYPTION_SERVICES = [
  'https://enc-dec.app/api/dec-flixer',
  'https://enc-dec.app/api/decrypt',
  'https://api.enc-dec.app/dec-flixer',
];

function generateNonce() {
  return crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').substring(0, 22);
}

function generateSignature(key, timestamp, nonce, urlPath) {
  return crypto.createHmac('sha256', key).update(`${key}:${timestamp}:${nonce}:${urlPath}`).digest('base64');
}

function makeRequest(urlPath, key, extraHeaders = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();
  const signature = generateSignature(key, timestamp, nonce, urlPath);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'Origin': 'https://flixer.sh',
    'Referer': 'https://flixer.sh/',
    'X-Api-Key': key,
    'X-Request-Timestamp': timestamp.toString(),
    'X-Request-Nonce': nonce,
    'X-Request-Signature': signature,
    'X-Client-Fingerprint': 'jnurg',
    'bW90aGFmYWth': '1',
    ...extraHeaders,
  };
  
  return new Promise((resolve, reject) => {
    https.get(`${API_BASE}${urlPath}`, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function postRequest(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    };
    
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Try external decryption services
 */
async function tryExternalDecryption() {
  console.log('=== Try External Decryption Services ===\n');
  
  const testPath = '/api/tmdb/tv/106379/season/1/episode/1/images';
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const res = await makeRequest(testPath, apiKey, { 'X-Only-Sources': '1', 'X-Server': 'alpha' });
  
  console.log(`API Key: ${apiKey}`);
  console.log(`Encrypted data: ${res.data.substring(0, 50)}...`);
  
  for (const service of DECRYPTION_SERVICES) {
    console.log(`\nTrying: ${service}`);
    
    try {
      const decRes = await postRequest(service, {
        text: res.data,
        key: apiKey,
      });
      
      console.log(`Status: ${decRes.status}`);
      console.log(`Response: ${decRes.data.substring(0, 200)}`);
      
      if (decRes.status === 200) {
        try {
          const json = JSON.parse(decRes.data);
          if (json.result || json.decrypted || json.data) {
            console.log('\n*** DECRYPTION SERVICE FOUND! ***');
            console.log(JSON.stringify(json, null, 2));
            return service;
          }
        } catch (e) {
          // Not JSON
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
  
  return null;
}

/**
 * Check if enc-dec.app has a Flixer endpoint
 */
async function checkEncDecApp() {
  console.log('\n=== Check enc-dec.app Endpoints ===\n');
  
  const endpoints = [
    '/api/dec-flixer',
    '/api/flixer',
    '/api/decrypt/flixer',
    '/api/dec',
  ];
  
  for (const endpoint of endpoints) {
    const url = `https://enc-dec.app${endpoint}`;
    console.log(`Checking: ${url}`);
    
    try {
      const res = await postRequest(url, { test: true });
      console.log(`  Status: ${res.status}, Response: ${res.data.substring(0, 100)}`);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

/**
 * Let's also check if there's a way to use the Flixer embed directly
 * without needing to decrypt the API response
 */
async function checkFlixerEmbed() {
  console.log('\n=== Check Flixer Embed ===\n');
  
  // Flixer might have an embed URL that we can use directly
  const embedUrls = [
    'https://flixer.sh/embed/movie/550',  // Fight Club
    'https://flixer.sh/embed/tv/106379/1/1',  // Squid Game
    'https://flixer.sh/e/movie/550',
    'https://flixer.sh/e/tv/106379/1/1',
  ];
  
  for (const url of embedUrls) {
    console.log(`Checking: ${url}`);
    
    try {
      const res = await new Promise((resolve, reject) => {
        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        }).on('error', reject);
      });
      
      console.log(`  Status: ${res.status}`);
      
      if (res.status === 200) {
        // Check if it contains video sources
        if (res.data.includes('m3u8') || res.data.includes('mp4') || res.data.includes('source')) {
          console.log('  Contains video references!');
          
          // Extract any URLs
          const urlMatches = res.data.match(/https?:\/\/[^\s"'<>]+\.(m3u8|mp4)/g);
          if (urlMatches) {
            console.log('  Found URLs:', urlMatches.slice(0, 3));
          }
        }
        
        // Check for iframe
        const iframeMatch = res.data.match(/<iframe[^>]+src="([^"]+)"/);
        if (iframeMatch) {
          console.log(`  Iframe src: ${iframeMatch[1]}`);
        }
      } else if (res.status === 302 || res.status === 301) {
        console.log(`  Redirect to: ${res.headers.location}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

/**
 * Check if we can get sources from a different Flixer API endpoint
 */
async function checkAlternativeApis() {
  console.log('\n=== Check Alternative APIs ===\n');
  
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  const endpoints = [
    '/api/sources/movie/550',
    '/api/sources/tv/106379/1/1',
    '/api/stream/movie/550',
    '/api/stream/tv/106379/1/1',
    '/api/v1/movie/550',
    '/api/v1/tv/106379/1/1',
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Checking: ${API_BASE}${endpoint}`);
    
    try {
      const res = await makeRequest(endpoint, apiKey);
      console.log(`  Status: ${res.status}, Length: ${res.data.length}`);
      
      if (res.status === 200 && res.data.length > 0) {
        console.log(`  Response: ${res.data.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

async function main() {
  await tryExternalDecryption();
  await checkEncDecApp();
  await checkFlixerEmbed();
  await checkAlternativeApis();
}

main().catch(console.error);
