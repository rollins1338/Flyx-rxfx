/**
 * Compare our v8 encoding (AES-256-CBC) with browser's encoding
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

// Reverse map for decoding
const REVERSE_MAP = new Map();
for (let i = 0; i < SHUFFLED_ALPHABET.length; i++) {
  REVERSE_MAP.set(SHUFFLED_ALPHABET[i], STANDARD_ALPHABET[i]);
}

function encodePageData(pageData) {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  const encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  const utf8Bytes = Buffer.from(xored, 'utf8');
  
  const base64 = utf8Bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return { result, encrypted, xored, base64 };
}

function decodeToHex(encoded) {
  // Reverse substitution
  let base64 = '';
  for (const char of encoded) {
    base64 += REVERSE_MAP.get(char) || char;
  }
  
  // Base64 decode
  const paddedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (paddedBase64.length % 4)) % 4;
  const fullBase64 = paddedBase64 + '='.repeat(padding);
  const decoded = Buffer.from(fullBase64, 'base64');
  
  // UTF-8 to string
  const utf8String = decoded.toString('utf8');
  
  // Reverse XOR
  let hex = '';
  for (let i = 0; i < utf8String.length; i++) {
    const charCode = utf8String.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    hex += String.fromCharCode(charCode ^ xorByte);
  }
  
  return hex;
}

async function compare() {
  console.log('=== COMPARING ENCODING V8 WITH BROWSER ===\n');
  
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
    
    // Our encoding
    const { result: ourEncoded, encrypted: ourEncrypted } = encodePageData(pageData);
    
    // Decode browser's to get their hex
    const browserHex = decodeToHex(browserEncoded);
    
    console.log('\n=== ENCRYPTED HEX COMPARISON ===');
    console.log('Our encrypted hex:', ourEncrypted.substring(0, 64));
    console.log('Browser encrypted hex:', browserHex.substring(0, 64));
    console.log('Same:', ourEncrypted === browserHex);
    
    if (ourEncrypted !== browserHex) {
      // Find first difference
      for (let i = 0; i < Math.min(ourEncrypted.length, browserHex.length); i++) {
        if (ourEncrypted[i] !== browserHex[i]) {
          console.log('\nFirst difference at position:', i);
          console.log('Our char:', ourEncrypted[i]);
          console.log('Browser char:', browserHex[i]);
          console.log('Our context:', ourEncrypted.substring(Math.max(0, i - 5), i + 10));
          console.log('Browser context:', browserHex.substring(Math.max(0, i - 5), i + 10));
          break;
        }
      }
      
      // Check if it's valid hex
      console.log('\nOur hex valid:', /^[0-9a-f]+$/i.test(ourEncrypted));
      console.log('Browser hex valid:', /^[0-9a-f]+$/i.test(browserHex));
    }
    
  } finally {
    await browser.close();
  }
}

compare().catch(console.error);
