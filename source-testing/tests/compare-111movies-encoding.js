/**
 * Compare our encoding with browser's encoding
 */

const crypto = require('crypto');
const puppeteer = require('puppeteer');

// Encryption keys
const AES_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

// Alphabets
const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

function encodePageData(pageData) {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(pageData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  const base64 = Buffer.from(xored, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

async function compare() {
  console.log('=== COMPARING ENCODING ===\n');
  
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
    console.log('Page data length:', pageData.length);
    
    console.log('\n=== BROWSER ENCODED ===');
    console.log('Length:', browserEncoded.length);
    console.log('First 100:', browserEncoded.substring(0, 100));
    console.log('Last 100:', browserEncoded.substring(browserEncoded.length - 100));
    
    // Our encoding
    const ourEncoded = encodePageData(pageData);
    
    console.log('\n=== OUR ENCODED ===');
    console.log('Length:', ourEncoded.length);
    console.log('First 100:', ourEncoded.substring(0, 100));
    console.log('Last 100:', ourEncoded.substring(ourEncoded.length - 100));
    
    // Compare character by character
    console.log('\n=== COMPARISON ===');
    console.log('Same length:', browserEncoded.length === ourEncoded.length);
    
    if (browserEncoded.length === ourEncoded.length) {
      let firstDiff = -1;
      for (let i = 0; i < browserEncoded.length; i++) {
        if (browserEncoded[i] !== ourEncoded[i]) {
          firstDiff = i;
          break;
        }
      }
      
      if (firstDiff >= 0) {
        console.log('First difference at position:', firstDiff);
        console.log('Browser char:', browserEncoded[firstDiff], '(code:', browserEncoded.charCodeAt(firstDiff), ')');
        console.log('Our char:', ourEncoded[firstDiff], '(code:', ourEncoded.charCodeAt(firstDiff), ')');
        console.log('Context browser:', browserEncoded.substring(Math.max(0, firstDiff - 5), firstDiff + 10));
        console.log('Context ours:', ourEncoded.substring(Math.max(0, firstDiff - 5), firstDiff + 10));
      } else {
        console.log('✓ Encodings are IDENTICAL!');
      }
    }
    
    // Analyze character sets
    console.log('\n=== CHARACTER ANALYSIS ===');
    const browserChars = [...new Set(browserEncoded)].sort();
    const ourChars = [...new Set(ourEncoded)].sort();
    
    console.log('Browser chars:', browserChars.join(''));
    console.log('Our chars:', ourChars.join(''));
    
    // Check if browser uses 'p' frequently (as seen in earlier analysis)
    const browserPCount = (browserEncoded.match(/p/g) || []).length;
    const ourPCount = (ourEncoded.match(/p/g) || []).length;
    
    console.log('\nBrowser "p" count:', browserPCount);
    console.log('Our "p" count:', ourPCount);
    
  } finally {
    await browser.close();
  }
}

compare().catch(console.error);
