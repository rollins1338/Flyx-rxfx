/**
 * Test curl-impersonate for DLHD key fetching
 * curl-impersonate mimics Chrome's TLS fingerprint
 * 
 * Install on Windows: Download from https://github.com/lwthiker/curl-impersonate/releases
 * Install on Linux: See https://github.com/lwthiker/curl-impersonate
 */

const { spawn, execSync } = require('child_process');

const KEY_URL = 'https://chevy.kiko2.ru/key/premium51/5885921';

// Try different curl-impersonate binaries
const CURL_BINARIES = [
  'curl_chrome116',
  'curl_chrome110', 
  'curl_chrome107',
  'curl_chrome104',
  'curl_chrome101',
  'curl_chrome99',
  'curl-impersonate-chrome',
  'curl-impersonate',
];

async function testCurlBinary(binary) {
  return new Promise((resolve) => {
    const args = [
      '-s',
      '-H', 'origin: https://epicplayplay.cfd',
      '-H', 'referer: https://epicplayplay.cfd/',
      '-w', '\\nHTTP_CODE:%{http_code}',
      KEY_URL
    ];
    
    const curl = spawn(binary, args, { shell: true });
    const chunks = [];
    let hasError = false;
    
    curl.stdout.on('data', (data) => chunks.push(data));
    curl.stderr.on('data', (data) => {
      // Ignore stderr unless it's a real error
      const msg = data.toString();
      if (msg.includes('not recognized') || msg.includes('not found') || msg.includes('No such file')) {
        hasError = true;
      }
    });
    
    curl.on('error', (err) => {
      resolve({ binary, error: 'not found' });
    });
    
    curl.on('close', (code) => {
      if (hasError || chunks.length === 0) {
        resolve({ binary, error: 'not available' });
        return;
      }
      
      const output = Buffer.concat(chunks);
      const outputStr = output.toString();
      
      // Extract HTTP code
      const httpCodeMatch = outputStr.match(/HTTP_CODE:(\d+)/);
      const httpCode = httpCodeMatch ? httpCodeMatch[1] : 'unknown';
      
      // Get data without HTTP_CODE suffix
      const dataEnd = outputStr.indexOf('\nHTTP_CODE:');
      const data = dataEnd > 0 ? output.slice(0, dataEnd) : output;
      
      const isValid = data.length === 16 && !data.toString('utf8').includes('error');
      
      resolve({
        binary,
        status: httpCode,
        length: data.length,
        valid: isValid,
        data: isValid ? data.toString('hex') : data.toString('utf8').substring(0, 50),
      });
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      curl.kill();
      resolve({ binary, error: 'timeout' });
    }, 10000);
  });
}

// Also test with Puppeteer if available
async function testPuppeteer() {
  console.log('\n=== Testing Puppeteer ===');
  
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.log('Puppeteer not installed');
    return null;
  }
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Navigate to player domain first
    await page.goto('https://epicplayplay.cfd/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Fetch key from within browser context
    const result = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const text = new TextDecoder().decode(buffer);
        return {
          status: response.status,
          length: buffer.byteLength,
          hex,
          text: text.substring(0, 50),
          isError: text.includes('error'),
        };
      } catch (e) {
        return { error: e.message };
      }
    }, KEY_URL);
    
    console.log('Puppeteer result:', result);
    
    if (result.length === 16 && !result.isError) {
      console.log('✓ PUPPETEER WORKS! Key:', result.hex);
      return result;
    } else {
      console.log('✗ Puppeteer got error');
      return null;
    }
  } catch (e) {
    console.log('Puppeteer error:', e.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log('Testing curl-impersonate for DLHD key fetching...');
  console.log('Key URL:', KEY_URL);
  console.log('');
  
  console.log('=== Testing curl-impersonate binaries ===');
  
  for (const binary of CURL_BINARIES) {
    const result = await testCurlBinary(binary);
    
    if (result.error) {
      console.log(`✗ ${binary}: ${result.error}`);
    } else if (result.valid) {
      console.log(`✓ ${binary}: VALID KEY! ${result.data}`);
    } else {
      console.log(`✗ ${binary}: ${result.status} (${result.length} bytes) - ${result.data}`);
    }
  }
  
  // Test Puppeteer
  await testPuppeteer();
  
  console.log('\n=== Done ===');
  console.log('If any method shows a valid key, use that approach.');
}

main();
