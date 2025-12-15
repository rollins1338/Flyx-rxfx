/**
 * Try to reverse the browser's encoding to understand the algorithm
 */

const puppeteer = require('puppeteer');

// Alphabets
const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

// Build reverse map (m -> h)
const REVERSE_MAP = new Map();
for (let i = 0; i < SHUFFLED_ALPHABET.length; i++) {
  REVERSE_MAP.set(SHUFFLED_ALPHABET[i], STANDARD_ALPHABET[i]);
}

const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

async function reverseEncoding() {
  console.log('=== REVERSING BROWSER ENCODING ===\n');
  
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
    console.log('Browser encoded:', browserEncoded.substring(0, 100) + '...');
    
    // Step 1: Reverse character substitution
    console.log('\n=== STEP 1: REVERSE SUBSTITUTION ===');
    let base64 = '';
    for (const char of browserEncoded) {
      base64 += REVERSE_MAP.get(char) || char;
    }
    console.log('Reversed to base64:', base64.substring(0, 100) + '...');
    console.log('Base64 length:', base64.length);
    
    // Step 2: Base64 decode
    console.log('\n=== STEP 2: BASE64 DECODE ===');
    // Add padding if needed
    const paddedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (paddedBase64.length % 4)) % 4;
    const fullBase64 = paddedBase64 + '='.repeat(padding);
    
    try {
      const decoded = Buffer.from(fullBase64, 'base64');
      console.log('Decoded length:', decoded.length);
      console.log('Decoded (hex):', decoded.toString('hex').substring(0, 100) + '...');
      console.log('Decoded (first 20 bytes):', [...decoded.slice(0, 20)]);
      
      // Step 3: Reverse XOR
      console.log('\n=== STEP 3: REVERSE XOR ===');
      let hexString = '';
      for (let i = 0; i < decoded.length; i++) {
        const byte = decoded[i];
        const xorByte = XOR_KEY[i % XOR_KEY.length];
        const original = byte ^ xorByte;
        hexString += String.fromCharCode(original);
      }
      console.log('Reversed XOR (should be hex):', hexString.substring(0, 100) + '...');
      console.log('Hex string length:', hexString.length);
      
      // Check if it's valid hex
      const isHex = /^[0-9a-f]+$/i.test(hexString);
      console.log('Is valid hex:', isHex);
      
      if (isHex) {
        // Step 4: This should be the AES encrypted data
        console.log('\n=== STEP 4: AES DECRYPT ===');
        console.log('Encrypted hex:', hexString.substring(0, 50) + '...');
        console.log('Encrypted length:', hexString.length);
        
        // The encrypted data length should be a multiple of 32 (16 bytes = 32 hex chars)
        console.log('Is multiple of 32:', hexString.length % 32 === 0);
      }
      
    } catch (e) {
      console.log('Base64 decode error:', e.message);
    }
    
  } finally {
    await browser.close();
  }
}

reverseEncoding().catch(console.error);
