/**
 * Trace through the 111movies encoding step by step
 * 
 * From the JS:
 * 1. u = cipher.update(n._data, "utf8", "hex") + cipher.final("hex")
 * 2. p = "" then for each char in u: p += String.fromCharCode(charCode ^ xorKey[i % 9])
 * 3. x = Buffer.from(p, "binary").toString("base64").replace(+,-).replace(/,_).replace(=,"")
 * 4. x = x.split("").map(char => substitutionMap.get(char) || char).join("")
 * 
 * Let me trace through with actual values
 */

const crypto = require('crypto');

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

function traceEncoding(pageData) {
  console.log('=== STEP 1: AES ENCRYPTION ===');
  console.log('Input (pageData):', pageData.substring(0, 50) + '...');
  console.log('Input length:', pageData.length);
  
  const cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY_128, AES_IV);
  const u = cipher.update(pageData, 'utf8', 'hex') + cipher.final('hex');
  
  console.log('Output (u - hex string):', u.substring(0, 50) + '...');
  console.log('Output length:', u.length);
  console.log('First 10 chars:', u.substring(0, 10));
  console.log('First 10 char codes:', [...u.substring(0, 10)].map(c => c.charCodeAt(0)));
  
  console.log('\n=== STEP 2: XOR ===');
  console.log('XOR key:', [...XOR_KEY]);
  
  let p = '';
  for (let i = 0; i < u.length; i++) {
    const t = u.charCodeAt(i);
    const n = XOR_KEY[i % XOR_KEY.length];
    const xored = t ^ n;
    p += String.fromCharCode(xored);
    
    if (i < 10) {
      console.log(`  u[${i}] = '${u[i]}' (${t}) ^ ${n} = ${xored} -> '${String.fromCharCode(xored)}'`);
    }
  }
  
  console.log('Output (p - xored string) length:', p.length);
  console.log('First 10 bytes (hex):', Buffer.from(p, 'binary').toString('hex').substring(0, 20));
  
  console.log('\n=== STEP 3: BASE64 ===');
  const base64 = Buffer.from(p, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  console.log('Output (base64):', base64.substring(0, 50) + '...');
  console.log('Output length:', base64.length);
  
  console.log('\n=== STEP 4: CHARACTER SUBSTITUTION ===');
  let x = '';
  for (const char of base64) {
    const mapped = CHAR_MAP.get(char);
    x += mapped || char;
    
    if (x.length <= 10) {
      console.log(`  '${char}' -> '${mapped || char}'`);
    }
  }
  
  console.log('Output (x - final):', x.substring(0, 50) + '...');
  console.log('Output length:', x.length);
  
  return x;
}

// Test with a simple input
console.log('=== TESTING WITH SIMPLE INPUT ===\n');
traceEncoding('test');

console.log('\n\n=== TESTING WITH SAMPLE PAGE DATA ===\n');
const samplePageData = 'r2lKs_BKrbSLrbQdw2mLrMybwMrSmumXm_gvwMeLs2TWwMBdlGBLlF4Fs2YSmb-Xw_ISlbBGrMyFmMIys2sFr_gLrblXrM0vmXSGlGTKluYSrbgzmXUFlbVCsMYbmXTxsXQzw2UCsFY1mbmGsFgLmb4Sl_QAr_rCrb-ds_41lX-X';
traceEncoding(samplePageData);
