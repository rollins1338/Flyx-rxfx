/**
 * Crack Hexa Encryption v31 - Intercept enc-dec.app decryption with Puppeteer
 */

const crypto = require('crypto');
const puppeteer = require('puppeteer');

async function interceptDecryption() {
  console.log('=== Intercepting enc-dec.app Decryption ===\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  
  // Intercept all network requests
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    request.continue();
  });
  
  // Capture console logs
  page.on('console', msg => {
    if (msg.text().includes('CRYPTO') || msg.text().includes('decrypt')) {
      console.log('Console:', msg.text());
    }
  });
  
  // Inject code to intercept crypto operations
  await page.evaluateOnNewDocument(() => {
    // Intercept SubtleCrypto
    const originalDecrypt = crypto.subtle.decrypt;
    crypto.subtle.decrypt = async function(algorithm, key, data) {
      console.log('CRYPTO decrypt called:', JSON.stringify(algorithm));
      console.log('CRYPTO key:', key);
      console.log('CRYPTO data length:', data.byteLength);
      return originalDecrypt.apply(this, arguments);
    };
    
    const originalImportKey = crypto.subtle.importKey;
    crypto.subtle.importKey = async function(format, keyData, algorithm, extractable, keyUsages) {
      console.log('CRYPTO importKey:', format, algorithm, keyUsages);
      if (keyData instanceof ArrayBuffer) {
        console.log('CRYPTO keyData:', new Uint8Array(keyData).slice(0, 32));
      }
      return originalImportKey.apply(this, arguments);
    };
    
    // Intercept TextDecoder
    const originalDecode = TextDecoder.prototype.decode;
    TextDecoder.prototype.decode = function(input) {
      const result = originalDecode.apply(this, arguments);
      if (result && result.includes('sources')) {
        console.log('CRYPTO TextDecoder result:', result.slice(0, 100));
      }
      return result;
    };
  });
  
  // Navigate to enc-dec.app
  console.log('Loading enc-dec.app...');
  await page.goto('https://enc-dec.app/', { waitUntil: 'networkidle2' });
  
  // Get encrypted data
  const key = crypto.randomBytes(32).toString('hex');
  console.log('Key:', key);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  console.log('Encrypted length:', encrypted.length);
  
  // Make the decryption request through the page
  console.log('\nMaking decryption request...');
  
  const result = await page.evaluate(async (encrypted, key) => {
    try {
      const response = await fetch('https://enc-dec.app/api/dec-hexa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: encrypted, key }),
      });
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  }, encrypted, key);
  
  console.log('Result:', JSON.stringify(result).slice(0, 200));
  
  await browser.close();
}

// Alternative: Try to find the algorithm by analyzing the server response headers
async function analyzeServerResponse() {
  console.log('\n=== Analyzing Server Response ===\n');
  
  const key = crypto.randomBytes(32).toString('hex');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/plain',
    'X-Api-Key': key,
  };
  
  const url = 'https://themoviedb.hexa.su/api/tmdb/tv/105248/season/1/episode/1/images';
  const encResponse = await fetch(url, { headers });
  const encrypted = await encResponse.text();
  
  console.log('Response headers:');
  for (const [name, value] of encResponse.headers.entries()) {
    console.log(`  ${name}: ${value}`);
  }
  
  // Check if there's any hint in the response
  const encBytes = Buffer.from(encrypted, 'base64');
  console.log('\nEncrypted data analysis:');
  console.log('  Total bytes:', encBytes.length);
  console.log('  First 4 bytes (magic?):', encBytes.subarray(0, 4).toString('hex'));
  console.log('  Bytes 4-8:', encBytes.subarray(4, 8).toString('hex'));
  
  // Check for common magic bytes
  const magicBytes = {
    '53616c74': 'Salted__ (OpenSSL)',
    '00000000': 'Null prefix',
    '01000000': 'Version 1?',
    '02000000': 'Version 2?',
  };
  
  const first4 = encBytes.subarray(0, 4).toString('hex');
  if (magicBytes[first4]) {
    console.log('  Magic bytes match:', magicBytes[first4]);
  }
}

async function main() {
  try {
    await interceptDecryption();
  } catch (e) {
    console.log('Puppeteer interception failed:', e.message);
  }
  
  await analyzeServerResponse();
}

main().catch(console.error);
