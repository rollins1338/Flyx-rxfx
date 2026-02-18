// Test the actual vidlink.pro API with multiLang parameter
const crypto = require('crypto');
const KEY = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://vidlink.pro/movie/550',
  'Origin': 'https://vidlink.pro',
};

function tryDecryptAES(data) {
  try {
    const raw = Buffer.from(data.trim(), 'base64');
    if (raw.length < 32) return null;
    const iv = raw.slice(0, 16);
    const ct = raw.slice(16);
    const key = Buffer.from(KEY, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(ct);
    dec = Buffer.concat([dec, decipher.final()]);
    return dec.toString('utf8');
  } catch (e) {
    return null;
  }
}

async function run() {
  // Test with multiLang=1
  const tests = [
    '/api/b/movie/550?multiLang=1',
    '/api/b/movie/550?multiLang=0',
    '/api/b/movie/550',
    '/api/b/movie/157336?multiLang=1',
    '/api/b/tv/1396/1/1?multiLang=1',
    '/api/b/tv/1396/1/1',
  ];
  
  for (const path of tests) {
    try {
      const r = await fetch('https://vidlink.pro' + path, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000)
      });
      const text = await r.text();
      console.log(`${path} → ${r.status} len=${text.length}`);
      
      if (text.length > 0) {
        // Try JSON parse
        try {
          const json = JSON.parse(text);
          console.log('  JSON keys:', Object.keys(json));
          console.log('  JSON preview:', JSON.stringify(json).substring(0, 500));
          
          // Check if any values are encrypted
          for (const [k, v] of Object.entries(json)) {
            if (typeof v === 'string' && v.length > 50) {
              const dec = tryDecryptAES(v);
              if (dec) {
                console.log(`  Decrypted ${k}:`, dec.substring(0, 300));
              }
            }
          }
        } catch {
          // Not JSON - try decrypt
          const dec = tryDecryptAES(text);
          if (dec) {
            console.log('  DECRYPTED:', dec.substring(0, 500));
          } else {
            console.log('  RAW:', text.substring(0, 200));
          }
        }
      }
    } catch (e) {
      console.log(`${path} → ERROR: ${e.message}`);
    }
  }
  
  // Also check what cookies/headers the page sets
  console.log('\n--- Checking if cookies are needed ---');
  // First visit the movie page to get cookies
  const pageR = await fetch('https://vidlink.pro/movie/550', {
    headers: { 'User-Agent': HEADERS['User-Agent'] },
    signal: AbortSignal.timeout(10000),
    redirect: 'manual'
  });
  console.log('Page status:', pageR.status);
  const setCookies = pageR.headers.getSetCookie ? pageR.headers.getSetCookie() : [];
  console.log('Set-Cookie:', setCookies);
  
  // Try API with cookies from page
  if (setCookies.length > 0) {
    const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');
    console.log('Using cookies:', cookieStr);
    
    const apiR = await fetch('https://vidlink.pro/api/b/movie/550?multiLang=1', {
      headers: { ...HEADERS, 'Cookie': cookieStr },
      signal: AbortSignal.timeout(10000)
    });
    const apiText = await apiR.text();
    console.log('API with cookies:', apiR.status, 'len:', apiText.length);
    if (apiText.length > 0) {
      console.log('Response:', apiText.substring(0, 500));
    }
  }
}

run().catch(e => console.log('Fatal:', e));
