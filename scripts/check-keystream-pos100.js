/**
 * Check if keystream is correct at position 100+
 */

const RPI_URL = 'https://rpi-proxy.vynx.cc';
const RPI_KEY = '5f1845926d725bb2a8230a6ed231fce1d03f07782f74a3f683c30ec04d4ac560';

const KEYSTREAM_HEX = 'dece4f239861eb1c7d83f86c2fb5d27e557a3fd2696781674b986f9ed5d55cb028abc5e482a02a7c03d7ee811eb7bd6ad1dba549a20e53f564208b9d5d2e28b0797f6c6e547b5ce423bbc44be596b6ad536b9edea25a6bf97ed7fe1f36298ff1a2999ace34849e30ff894c769c2cf89e2805ddb1a4e62cf1346e3eff50b915abeb3b05f42125fe1e42b27995e76d6bc69e012c03df0e0a75a027b5be1336e1d63eb1b87816a7557b893171688ee2203ab95aee224fa555ce5558d721316a7d87fe40dd6e0fdf845a4526c879aab22e307266c27946838b311826711fd0005746e99e4c319e8556c4f953d1ea00673c9266865c5245ad5cf39ac63d73287fdb199ca3751a61e9a9aff9a64e7e47af1d1addacd2821d29a00615bfa87bfa732e10a1a525981f2734d5f6c98287d30a0ff7e0b2ad598aa2fb7bf3588aa81f75b77a1c0dd0f67180ef6726d1d7394704cee33c430f0c859305da5dfe8c59ee69b6bdeace85537a0ec7cbe1fcf79334fd0a470ba980429c88828ee9c57528730f51e3eaceb2c80b3d4c6d9844ca8de1ca834950028247825b437d7d5ffb79674e874e041df103d37f003891b62c26546ed0307a2516d22866ab95ee46e711f13896d065bb7752ae8fb8ecfac03ac0f2b53e3efdc942c8532736913a0ff51bc51db845d4c6b9300daeb80b2dc5a66f55807f1d1bf327de4c00cfb176c2d24be8b860fcc0c46752aa7e3dbbd6';
const keystream = Buffer.from(KEYSTREAM_HEX, 'hex');

// Failing video ID  
const failingVideoId = 'js_JTDu8WS2JcOLzF79M6RvpCQ';

async function check() {
  const mediaUrl = `https://megaup22.online/media/${failingVideoId}`;
  const proxyUrl = `${RPI_URL}/animekai?key=${RPI_KEY}&url=${encodeURIComponent(mediaUrl)}`;
  
  const response = await fetch(proxyUrl);
  const data = await response.json();
  
  const base64 = data.result.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  console.log('Encrypted bytes:', encBytes.length);
  console.log('Keystream length:', keystream.length);
  
  // The URL should continue with something like:
  // /list,XXXXX.m3u8"}],"tracks":[...
  // Let's look at what we're getting around position 100-150
  
  console.log('\n=== Bytes around position 100-120 ===');
  for (let i = 100; i < 120 && i < encBytes.length; i++) {
    const enc = encBytes[i];
    const key = keystream[i];
    const dec = enc ^ key;
    const char = dec >= 32 && dec < 127 ? String.fromCharCode(dec) : '?';
    console.log(`${i}: enc=0x${enc.toString(16).padStart(2,'0')} key=0x${key.toString(16).padStart(2,'0')} dec=0x${dec.toString(16).padStart(2,'0')} '${char}'`);
  }
  
  // The decrypted chars at 100-105 are: a C n 3 b (garbage after 'a')
  // Let's see what the expected chars might be
  // A valid URL would have hex chars (0-9, a-f) or path chars
  
  console.log('\n=== Full decrypted around position 95-130 ===');
  const decLength = Math.min(keystream.length, encBytes.length);
  const decBytes = Buffer.alloc(decLength);
  for (let i = 0; i < decLength; i++) {
    decBytes[i] = encBytes[i] ^ keystream[i];
  }
  
  // Show hex dump
  console.log('Hex dump of decrypted bytes 95-130:');
  console.log(decBytes.slice(95, 130).toString('hex'));
  console.log('As string:');
  console.log(decBytes.slice(95, 130).toString('utf8'));
  
  // The issue might be that the URL is just shorter for this video
  // Let's look for the closing quote
  const decStr = decBytes.toString('utf8');
  const urlStart = decStr.indexOf('https://');
  const urlEnd = decStr.indexOf('"', urlStart);
  console.log(`\nURL start: ${urlStart}, URL end: ${urlEnd}`);
  console.log('URL:', decStr.substring(urlStart, urlEnd > 0 ? urlEnd : urlStart + 150));
}

check().catch(console.error);
