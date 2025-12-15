/**
 * Trace through each encoding step to find the difference
 */

const crypto = require('crypto');
const puppeteer = require('puppeteer');

const AES_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

const REVERSE_MAP = new Map();
for (let i = 0; i < SHUFFLED_ALPHABET.length; i++) {
  REVERSE_MAP.set(SHUFFLED_ALPHABET[i], STANDARD_ALPHABET[i]);
}

async function trace() {
  console.log('=== TRACING ENCODING STEPS ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    let browserEncoded = null;
    let pageData = null;
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('fcd552c4') && url.endsWith('/sr')) {
        const parts = url.split('/');
        const fcdIdx = parts.findIndex(p => p.startsWith('fcd552c4'));
        browserEncoded = parts[fcdIdx + 1];
      }
    });
    
    await page.goto('https://111movies.com/movie/155', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    pageData = await page.evaluate(() => {
      const script = document.getElementById('__NEXT_DATA__');
      return script ? JSON.parse(script.textContent).props?.pageProps?.data : null;
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Page data:', pageData);
    console.log('Browser encoded length:', browserEncoded.length);
    
    // Step 1: AES encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
    const encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
    console.log('\n=== STEP 1: AES ENCRYPT ===');
    console.log('Encrypted hex:', encrypted.substring(0, 64) + '...');
    console.log('Length:', encrypted.length);
    
    // Step 2: XOR
    console.log('\n=== STEP 2: XOR ===');
    let xored = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i);
      const xorByte = XOR_KEY[i % XOR_KEY.length];
      xored += String.fromCharCode(charCode ^ xorByte);
    }
    console.log('XORed length:', xored.length);
    console.log('First 20 bytes (hex):', Buffer.from(xored.substring(0, 20), 'binary').toString('hex'));
    
    // Step 3: UTF-8 encode
    console.log('\n=== STEP 3: UTF-8 ENCODE ===');
    const utf8Bytes = Buffer.from(xored, 'utf8');
    console.log('UTF-8 bytes length:', utf8Bytes.length);
    console.log('First 20 bytes:', [...utf8Bytes.slice(0, 20)]);
    
    // Step 4: Base64
    console.log('\n=== STEP 4: BASE64 ===');
    const base64 = utf8Bytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    console.log('Base64 length:', base64.length);
    console.log('First 50:', base64.substring(0, 50));
    
    // Step 5: Substitution
    console.log('\n=== STEP 5: SUBSTITUTION ===');
    let result = '';
    for (const char of base64) {
      result += CHAR_MAP.get(char) || char;
    }
    console.log('Result length:', result.length);
    console.log('First 50:', result.substring(0, 50));
    
    // Now reverse the browser's encoding
    console.log('\n=== REVERSING BROWSER ENCODING ===');
    
    // Reverse substitution
    let browserBase64 = '';
    for (const char of browserEncoded) {
      browserBase64 += REVERSE_MAP.get(char) || char;
    }
    console.log('Browser base64 length:', browserBase64.length);
    console.log('Browser base64 first 50:', browserBase64.substring(0, 50));
    
    // Compare base64
    console.log('\n=== BASE64 COMPARISON ===');
    console.log('Our base64:', base64.substring(0, 50));
    console.log('Browser base64:', browserBase64.substring(0, 50));
    console.log('Same:', base64 === browserBase64);
    
    if (base64 !== browserBase64) {
      for (let i = 0; i < Math.min(base64.length, browserBase64.length); i++) {
        if (base64[i] !== browserBase64[i]) {
          console.log('\nFirst diff at:', i);
          console.log('Our:', base64[i], '(', base64.charCodeAt(i), ')');
          console.log('Browser:', browserBase64[i], '(', browserBase64.charCodeAt(i), ')');
          break;
        }
      }
    }
    
    // Decode browser base64
    const paddedBrowserBase64 = browserBase64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (paddedBrowserBase64.length % 4)) % 4;
    const fullBrowserBase64 = paddedBrowserBase64 + '='.repeat(padding);
    const browserUtf8Bytes = Buffer.from(fullBrowserBase64, 'base64');
    
    console.log('\n=== UTF-8 BYTES COMPARISON ===');
    console.log('Our UTF-8 bytes length:', utf8Bytes.length);
    console.log('Browser UTF-8 bytes length:', browserUtf8Bytes.length);
    console.log('Our first 20:', [...utf8Bytes.slice(0, 20)]);
    console.log('Browser first 20:', [...browserUtf8Bytes.slice(0, 20)]);
    
    // Compare byte by byte
    if (!utf8Bytes.equals(browserUtf8Bytes)) {
      for (let i = 0; i < Math.min(utf8Bytes.length, browserUtf8Bytes.length); i++) {
        if (utf8Bytes[i] !== browserUtf8Bytes[i]) {
          console.log('\nFirst byte diff at:', i);
          console.log('Our:', utf8Bytes[i]);
          console.log('Browser:', browserUtf8Bytes[i]);
          break;
        }
      }
    }
    
  } finally {
    await browser.close();
  }
}

trace().catch(console.error);
