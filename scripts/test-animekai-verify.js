/**
 * AnimeKai + MegaUp + MegaCloud Decryption Verification Script
 * 
 * Tests ALL hand-rolled decryption against live APIs:
 * 1. AnimeKai search endpoint (AJAX)
 * 2. AnimeKai encrypt/decrypt (183 substitution tables)
 * 3. MegaUp /media/ endpoint + native XOR keystream decryption
 * 4. MegaCloud client key extraction + 3-layer cipher decryption
 * 
 * NO npm packages - pure Node.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// Config
// ============================================================================
const KAI_AJAX = 'https://animekai.to/ajax';
const HIANIME_DOMAIN = 'hianimez.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const MEGAUP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// MegaUp pre-computed XOR keystream (521 bytes)
const MEGAUP_KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';

// MegaCloud key sources
const MEGACLOUD_KEYS_URLS = [
  'https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/refs/heads/main/keys.json',
  'https://raw.githubusercontent.com/CattoFish/MegacloudKeys/refs/heads/main/keys.json',
  'https://raw.githubusercontent.com/ghoshRitesh12/aniwatch/refs/heads/main/src/extractors/megacloud-keys.json',
];

// ============================================================================
// HTTP helpers (pure Node.js, no packages)
// ============================================================================
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': UA, ...headers },
      timeout: 15000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function httpsPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = typeof data === 'string' ? data : JSON.stringify(data);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': UA,
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData);
    req.end();
  });
}

// ============================================================================
// AnimeKai Crypto (183 substitution tables)
// ============================================================================
let DECRYPT_TABLES = null;
let ENCRYPT_TABLES = null;

function loadTables() {
  if (DECRYPT_TABLES) return;
  // Try RPI proxy tables first, then app tables
  const paths = [
    path.join(__dirname, '..', 'rpi-proxy', 'animekai-tables.json'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      DECRYPT_TABLES = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log(`  Loaded ${Object.keys(DECRYPT_TABLES).length} decrypt tables from ${p}`);
      // Build encrypt tables (reverse mapping)
      ENCRYPT_TABLES = {};
      for (const [pos, table] of Object.entries(DECRYPT_TABLES)) {
        ENCRYPT_TABLES[pos] = {};
        for (const [byte, char] of Object.entries(table)) {
          ENCRYPT_TABLES[pos][char] = parseInt(byte);
        }
      }
      return;
    }
  }
  throw new Error('AnimeKai tables not found');
}

function urlSafeBase64Decode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

function urlSafeBase64Encode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getCipherPosition(plainPos) {
  if (plainPos === 0) return 0;
  if (plainPos === 1) return 7;
  if (plainPos === 2) return 11;
  if (plainPos === 3) return 13;
  if (plainPos === 4) return 15;
  if (plainPos === 5) return 17;
  if (plainPos === 6) return 19;
  return 20 + (plainPos - 7);
}

const HEADER = Buffer.from('c509bdb497cbc06873ff412af12fd8007624c29faa', 'hex');
const HEADER_LEN = 21;
const CONSTANT_BYTES = { 1:0xf2, 2:0xdf, 3:0x9b, 4:0x9d, 5:0x16, 6:0xe5, 8:0x67, 9:0xc9, 10:0xdd, 12:0x9c, 14:0x29, 16:0x35, 18:0xc8 };

function encryptAnimeKai(plaintext) {
  loadTables();
  const len = plaintext.length;
  let cipherDataLen;
  if (len <= 1) cipherDataLen = 1;
  else if (len <= 2) cipherDataLen = 8;
  else if (len <= 3) cipherDataLen = 12;
  else if (len <= 4) cipherDataLen = 14;
  else if (len <= 5) cipherDataLen = 16;
  else if (len <= 6) cipherDataLen = 18;
  else if (len <= 7) cipherDataLen = 20;
  else cipherDataLen = 20 + (len - 7);
  
  const cipher = Buffer.alloc(HEADER_LEN + cipherDataLen);
  HEADER.copy(cipher, 0);
  for (const [pos, byte] of Object.entries(CONSTANT_BYTES)) {
    const idx = HEADER_LEN + parseInt(pos);
    if (idx < cipher.length) cipher[idx] = byte;
  }
  for (let i = 0; i < len; i++) {
    const char = plaintext[i];
    const cipherPos = getCipherPosition(i);
    const table = ENCRYPT_TABLES[i];
    if (table && char in table) {
      cipher[HEADER_LEN + cipherPos] = table[char];
    } else {
      cipher[HEADER_LEN + cipherPos] = char.charCodeAt(0);
    }
  }
  return urlSafeBase64Encode(cipher);
}

function decryptAnimeKai(ciphertext) {
  loadTables();
  const cipher = urlSafeBase64Decode(ciphertext);
  const hasHeader = cipher.length > HEADER_LEN;
  const dataOffset = hasHeader ? HEADER_LEN : 0;
  const dataLen = cipher.length - dataOffset;
  
  let plaintextLen = 0;
  if (dataLen > 20) plaintextLen = 7 + (dataLen - 20);
  else if (dataLen > 19) plaintextLen = 7;
  else if (dataLen > 17) plaintextLen = 6;
  else if (dataLen > 15) plaintextLen = 5;
  else if (dataLen > 13) plaintextLen = 4;
  else if (dataLen > 11) plaintextLen = 3;
  else if (dataLen > 7) plaintextLen = 2;
  else if (dataLen > 0) plaintextLen = 1;
  
  let plaintext = '';
  for (let i = 0; i < plaintextLen; i++) {
    const cipherPos = getCipherPosition(i);
    const actualPos = dataOffset + cipherPos;
    if (actualPos >= cipher.length) break;
    const byte = cipher[actualPos];
    const table = DECRYPT_TABLES[i];
    if (table && byte in table) {
      plaintext += table[byte];
    } else {
      plaintext += String.fromCharCode(byte);
    }
  }
  return plaintext;
}

function decodeAnimeKaiHex(str) {
  return str.replace(/}([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ============================================================================
// MegaUp Native Decryption (XOR keystream)
// ============================================================================
function decryptMegaUp(encryptedBase64) {
  const keystream = Buffer.from(MEGAUP_KEYSTREAM_HEX, 'hex');
  const base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const encBytes = Buffer.from(padded, 'base64');
  
  const decLength = Math.min(keystream.length, encBytes.length);
  const decBytes = Buffer.alloc(decLength);
  for (let i = 0; i < decLength; i++) {
    decBytes[i] = encBytes[i] ^ keystream[i];
  }
  
  const result = decBytes.toString('utf8');
  // Find last valid JSON
  for (let i = result.length; i > 0; i--) {
    const substr = result.substring(0, i);
    if (substr.endsWith('}')) {
      try { JSON.parse(substr); return substr; } catch {}
    }
  }
  return result;
}

// ============================================================================
// MegaCloud 3-Layer Cipher Decryption
// ============================================================================
function keygen2(megacloudKey, clientKey) {
  const keygenHashMultVal = 31n;
  const keygenXORVal = 247;
  const keygenShiftVal = 5;
  let tempKey = megacloudKey + clientKey;
  let hashVal = 0n;
  for (let i = 0; i < tempKey.length; i++) {
    hashVal = BigInt(tempKey.charCodeAt(i)) + hashVal * keygenHashMultVal + (hashVal << 7n) - hashVal;
  }
  hashVal = hashVal < 0n ? -hashVal : hashVal;
  const lHash = Number(hashVal % 0x7fffffffffffffffn);
  tempKey = tempKey.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ keygenXORVal)).join('');
  const pivot = (lHash % tempKey.length) + keygenShiftVal;
  tempKey = tempKey.slice(pivot) + tempKey.slice(0, pivot);
  const leafStr = clientKey.split('').reverse().join('');
  let returnKey = '';
  for (let i = 0; i < Math.max(tempKey.length, leafStr.length); i++) {
    returnKey += (tempKey[i] || '') + (leafStr[i] || '');
  }
  returnKey = returnKey.substring(0, 96 + (lHash % 33));
  returnKey = [...returnKey].map(c => String.fromCharCode((c.charCodeAt(0) % 95) + 32)).join('');
  return returnKey;
}

function seedShuffle2(charArray, iKey) {
  let hashVal = 0n;
  for (let i = 0; i < iKey.length; i++) {
    hashVal = (hashVal * 31n + BigInt(iKey.charCodeAt(i))) & 0xffffffffn;
  }
  let shuffleNum = hashVal;
  const psudoRand = (arg) => {
    shuffleNum = (shuffleNum * 1103515245n + 12345n) & 0x7fffffffn;
    return Number(shuffleNum % BigInt(arg));
  };
  const retStr = [...charArray];
  for (let i = retStr.length - 1; i > 0; i--) {
    const swapIndex = psudoRand(i + 1);
    [retStr[i], retStr[swapIndex]] = [retStr[swapIndex], retStr[i]];
  }
  return retStr;
}

function columnarCipher2(src, ikey) {
  const columnCount = ikey.length;
  const rowCount = Math.ceil(src.length / columnCount);
  const cipherArry = Array(rowCount).fill(null).map(() => Array(columnCount).fill(' '));
  const keyMap = ikey.split('').map((char, index) => ({ char, idx: index }));
  const sortedMap = [...keyMap].sort((a, b) => a.char.charCodeAt(0) - b.char.charCodeAt(0));
  let srcIndex = 0;
  sortedMap.forEach(({ idx: index }) => {
    for (let i = 0; i < rowCount; i++) {
      cipherArry[i][index] = src[srcIndex++];
    }
  });
  let returnStr = '';
  for (let x = 0; x < rowCount; x++) {
    for (let y = 0; y < columnCount; y++) {
      returnStr += cipherArry[x][y];
    }
  }
  return returnStr;
}

function decryptSrc2(src, clientKey, megacloudKey) {
  const layers = 3;
  const genKey = keygen2(megacloudKey, clientKey);
  let decSrc = Buffer.from(src, 'base64').toString('binary');
  const charArray = [...Array(95)].map((_, index) => String.fromCharCode(32 + index));

  const reverseLayer = (iteration) => {
    const layerKey = genKey + iteration;
    let hashVal = 0n;
    for (let i = 0; i < layerKey.length; i++) {
      hashVal = (hashVal * 31n + BigInt(layerKey.charCodeAt(i))) & 0xffffffffn;
    }
    let seed = hashVal;
    const seedRand = (arg) => {
      seed = (seed * 1103515245n + 12345n) & 0x7fffffffn;
      return Number(seed % BigInt(arg));
    };
    decSrc = decSrc.split('').map((char) => {
      const cArryIndex = charArray.indexOf(char);
      if (cArryIndex === -1) return char;
      const randNum = seedRand(95);
      const newCharIndex = (cArryIndex - randNum + 95) % 95;
      return charArray[newCharIndex];
    }).join('');
    decSrc = columnarCipher2(decSrc, layerKey);
    const subValues = seedShuffle2(charArray, layerKey);
    const charMap = {};
    subValues.forEach((char, index) => { charMap[char] = charArray[index]; });
    decSrc = decSrc.split('').map(char => charMap[char] || char).join('');
  };

  for (let i = layers; i > 0; i--) {
    reverseLayer(i);
  }
  const dataLen = parseInt(decSrc.substring(0, 4), 10);
  return decSrc.substring(4, 4 + dataLen);
}

