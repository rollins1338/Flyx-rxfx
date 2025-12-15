/**
 * Analyze the browser's encoded bytes more carefully
 */

const puppeteer = require('puppeteer');

const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const REVERSE_MAP = new Map();
for (let i = 0; i < SHUFFLED_ALPHABET.length; i++) {
  REVERSE_MAP.set(SHUFFLED_ALPHABET[i], STANDARD_ALPHABET[i]);
}

async function analyzeBytes() {
  console.log('=== ANALYZING BROWSER BYTES ===\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    let browserEncoded = null;
    
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
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Reverse substitution
    let base64 = '';
    for (const char of browserEncoded) {
      base64 += REVERSE_MAP.get(char) || char;
    }
    
    console.log('Base64 (first 100):', base64.substring(0, 100));
    
    // Check if the base64 contains unusual characters
    const validB64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-_=';
    const invalidChars = [...base64].filter(c => !validB64Chars.includes(c));
    console.log('Invalid base64 chars:', [...new Set(invalidChars)]);
    
    // The base64 contains characters like 'Ã', 'Â' which are UTF-8 encoded
    // This suggests the XORed string was UTF-8 encoded before base64
    
    // Let's try decoding as UTF-8
    console.log('\n=== TRYING UTF-8 DECODE ===');
    
    // First, let's see what the raw base64 looks like
    const paddedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (paddedBase64.length % 4)) % 4;
    const fullBase64 = paddedBase64 + '='.repeat(padding);
    
    const decoded = Buffer.from(fullBase64, 'base64');
    console.log('Decoded buffer length:', decoded.length);
    
    // Try to interpret as UTF-8
    const utf8String = decoded.toString('utf8');
    console.log('UTF-8 string length:', utf8String.length);
    console.log('UTF-8 string (first 50):', utf8String.substring(0, 50));
    
    // The UTF-8 string might be the XORed hex string
    // Let's check if it looks like hex after XOR reversal
    
    const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);
    
    // Try XOR on the UTF-8 string
    let xorResult = '';
    for (let i = 0; i < utf8String.length; i++) {
      const charCode = utf8String.charCodeAt(i);
      const xorByte = XOR_KEY[i % XOR_KEY.length];
      xorResult += String.fromCharCode(charCode ^ xorByte);
    }
    console.log('\nXOR result (first 50):', xorResult.substring(0, 50));
    console.log('Is hex:', /^[0-9a-f]+$/i.test(xorResult));
    
    // Maybe the encoding uses a different approach
    // Let's check if the browser is encoding each hex char separately
    
    console.log('\n=== CHECKING HEX CHAR ENCODING ===');
    // If each hex char (0-9, a-f) is encoded to multiple output chars
    // The ratio would be: 783 / (encrypted_hex_length)
    // If encrypted_hex_length is 352 (from our test), ratio = 783/352 = 2.22
    
    // This could mean each hex char becomes ~2 output chars
    // Or there's some other transformation
    
  } finally {
    await browser.close();
  }
}

analyzeBytes().catch(console.error);
