/**
 * Test encoding with the SAME page data that Puppeteer uses
 */

const crypto = require('crypto');
const puppeteer = require('puppeteer');

const API_HASH = 'fcd552c4321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';

const FULL_KEY = Buffer.from([3,75,207,198,39,85,65,255,64,89,191,251,35,214,209,210,62,164,155,85,247,158,167,48,172,84,13,18,19,166,19,57]);
const AES_KEY_128 = FULL_KEY.slice(0, 16);
const AES_IV = Buffer.from([162,231,173,134,84,100,241,33,5,233,223,132,245,189,171,237]);
const XOR_KEY = Buffer.from([170,162,126,126,60,255,136,130,133]);

const STANDARD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const SHUFFLED_ALPHABET = "TuzHOxl7b0RW9o_1FPV3eGfmL4Z5pD8cahBQr2U-6yvEYwngXCdJjANtqKIMiSks";

const CHAR_MAP = new Map();
for (let i = 0; i < STANDARD_ALPHABET.length; i++) {
  CHAR_MAP.set(STANDARD_ALPHABET[i], SHUFFLED_ALPHABET[i]);
}

function encodePageData(pageData) {
  // AES-128-CBC encrypt
  const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY_128, AES_IV);
  let encrypted = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  
  // XOR
  let xored = '';
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const xorByte = XOR_KEY[i % XOR_KEY.length];
    xored += String.fromCharCode(charCode ^ xorByte);
  }
  
  // Base64
  const base64 = Buffer.from(xored, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Substitution
  let result = '';
  for (const char of base64) {
    result += CHAR_MAP.get(char) || char;
  }
  
  return result;
}

async function testWithSameData() {
  console.log('=== TESTING WITH SAME PAGE DATA ===\n');
  
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
    
    console.log('\n=== OUR ENCODED (same page data) ===');
    const ourEncoded = encodePageData(pageData);
    console.log('Length:', ourEncoded.length);
    console.log('First 100:', ourEncoded.substring(0, 100));
    
    console.log('\n=== COMPARISON ===');
    console.log('Same length:', browserEncoded.length === ourEncoded.length);
    console.log('Same content:', browserEncoded === ourEncoded);
    
    if (browserEncoded.length !== ourEncoded.length) {
      console.log('\nLength difference:', browserEncoded.length - ourEncoded.length);
      console.log('Browser/Our ratio:', (browserEncoded.length / ourEncoded.length).toFixed(2));
    }
    
    // Character frequency comparison
    console.log('\n=== CHARACTER FREQUENCY ===');
    const browserPCount = (browserEncoded.match(/p/g) || []).length;
    const ourPCount = (ourEncoded.match(/p/g) || []).length;
    console.log('Browser "p" count:', browserPCount);
    console.log('Our "p" count:', ourPCount);
    
  } finally {
    await browser.close();
  }
}

testWithSameData().catch(console.error);
